import { marked } from 'marked';
import DOMPurify from 'dompurify';

export const preprocessMarkdownForDetails = (md: string): string => {
  if (!md || !md.includes('<details')) return md;

  let processed = md;
  let prev = '';

  const replaceDetails = (input: string): string => {
    return input.replace(/<details([^>]*)>([\s\S]*?)<\/details>/gi, (match, attrs, content) => {
      const summaryMatch = content.match(/^(\s*<summary[\s\S]*?<\/summary>)([\s\S]*)$/i);
      if (summaryMatch) {
        const summary = summaryMatch[1].trim();
        const body = summaryMatch[2]
          .replace(/(\r?\n\s*){2,}/g, '<br><br>')
          .replace(/\r?\n/g, '<br>')
          .replace(/^(<br>)+/, '')
          .replace(/(<br>)+$/, '');
        return `<details${attrs}>${summary}${body}</details>`;
      } else {
        const body = content
          .replace(/(\r?\n\s*){2,}/g, '<br><br>')
          .replace(/\r?\n/g, '<br>')
          .replace(/^(<br>)+/, '')
          .replace(/(<br>)+$/, '');
        return `<details${attrs}>${body}</details>`;
      }
    });
  };

  while (processed !== prev) {
    prev = processed;
    processed = replaceDetails(processed);
  }

  return processed;
};

export const renderMarkdown = (md: string): string => {
  if (!md) return '';
  const preprocessed = preprocessMarkdownForDetails(md);
  const rawHtml = marked.parse(preprocessed) as string;
  return DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS: ['b', 'strong', 'i', 'em', 'u', 's', 'strike', 'del', 'code', 'pre', 'blockquote', 'hr', 'a', 'span', 'font', 'ul', 'ol', 'li', 'div', 'p', 'br', 'details', 'summary', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'img'],
    ALLOWED_ATTR: ['href', 'title', 'target', 'style', 'color', 'class', 'src', 'alt']
  });
};

export const htmlToMarkdown = (html: string): string => {
  const container = document.createElement('div');
  container.innerHTML = html;
  const processNode = (node: Node): string => {
    let result = '';
    node.childNodes.forEach(child => {
      if (child.nodeType === Node.TEXT_NODE) {
        result += child.textContent;
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const el = child as HTMLElement;
        const tag = el.tagName.toLowerCase();
        switch (tag) {
          case 'h1': result += `\n# ${processNode(el)}\n`; break;
          case 'h2': result += `\n## ${processNode(el)}\n`; break;
          case 'h3': result += `\n### ${processNode(el)}\n`; break;
          case 'b': case 'strong': result += `**${processNode(el)}**`; break;
          case 'i': case 'em': result += `*${processNode(el)}*`; break;
          case 'u': case 'ins': result += `<u>${processNode(el)}</u>`; break;
          case 's': case 'strike': case 'del': result += `~~${processNode(el)}~~`; break;
          case 'code': result += `\`${processNode(el)}\``; break;
          case 'pre': result += `\n\`\`\`\n${processNode(el)}\n\`\`\`\n`; break;
          case 'blockquote': result += `\n> ${processNode(el)}\n`; break;
          case 'hr': result += `\n---\n`; break;
          case 'a': {
            const href = el.getAttribute('href') || '#';
            result += `[${processNode(el)}](${href})`;
            break;
          }
          case 'span':
          case 'font': {
            const inner = processNode(el);
            const style = el.getAttribute('style');
            const color = el.getAttribute('color');
            if (style) {
              result += `<span style="${style}">${inner}</span>`;
            } else if (color) {
              result += `<span style="color:${color}">${inner}</span>`;
            } else {
              result += inner;
            }
            break;
          }
          case 'ul':
          case 'ol': result += `\n${processNode(el)}\n`; break;
          case 'li': {
            const parent = el.parentElement;
            if (parent && parent.tagName.toLowerCase() === 'ol') {
              const children = Array.from(parent.children);
              const idx = children.indexOf(el) + 1;
              result += `${idx}. ${processNode(el)}\n`;
            } else {
              result += `- ${processNode(el)}\n`;
            }
            break;
          }
          case 'div': case 'p': {
            const inner = processNode(el);
            if (inner.trim() || el.querySelector('br')) result += `\n${inner}\n`; 
            else result += `\n`;
            break;
          }
          case 'br': result += '\n'; break;
          case 'table': {
            let tableMd = '\n';
            const rows = Array.from(el.querySelectorAll('tr')).filter(row => row.closest('table') === el);
            rows.forEach((row, rowIndex) => {
              const cells = Array.from(row.querySelectorAll('th, td')).filter(cell => cell.closest('tr') === row);
              const cellTexts = cells.map(cell => processNode(cell).trim().replace(/\|/g, '\\|'));
              tableMd += `| ${cellTexts.join(' | ')} |\n`;
              if (rowIndex === 0) {
                const separators = cells.map(() => '---');
                tableMd += `| ${separators.join(' | ')} |\n`;
              }
            });
            result += tableMd + '\n';
            break;
          }
          case 'tr':
          case 'th':
          case 'td':
            // table 側で一括処理するため単独ではスルー
            break;
          case 'details': {
            const isOpen = el.hasAttribute('open');
            const summaryEl = el.querySelector('summary');
            const summaryText = summaryEl ? processNode(summaryEl).trim() : '詳細';
            
            const contentNodes: string[] = [];
            el.childNodes.forEach(c => {
              if (c.nodeType === Node.ELEMENT_NODE && (c as HTMLElement).tagName.toLowerCase() === 'summary') {
                return;
              }
              contentNodes.push(processNode(c));
            });
            let bodyText = contentNodes.join('').trim();
            // Clean up double newlines inside details body to keep HTML block intact in marked
            bodyText = bodyText.replace(/(\r?\n\s*){2,}/g, '<br><br>').replace(/\r?\n/g, '<br>').replace(/^(<br>)+/, '').replace(/(<br>)+$/, '');
            
            result += `\n<details${isOpen ? ' open' : ''}><summary>${summaryText}</summary>${bodyText}</details>\n`;
            break;
          }
          case 'summary':
            // details 側で一括処理するため単独ではスルー
            break;
          default: result += processNode(el);
        }
      }
    });
    return result;
  };
  let markdown = processNode(container);
  markdown = markdown.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/^\n+/, '').replace(/\n+$/, '');
  return markdown;
};
