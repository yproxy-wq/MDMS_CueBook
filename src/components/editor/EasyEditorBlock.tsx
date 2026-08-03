import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import DOMPurify from 'dompurify';
import { 
  Bold, Italic, Underline, Strikethrough, Link as LinkIcon, Code, 
  Image as ImageIcon, Search, FileText, X,
  Type, ChevronDown, Check, Undo, Redo, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Palette, Table, Eye, EyeOff, List, ListOrdered, Quote, Minus
} from 'lucide-react';
import { htmlToMarkdown, renderMarkdown } from '../../utils/markdown';
import { ImageResource } from '../../types';
import { motion, AnimatePresence } from 'motion/react';

interface EasyEditorBlockProps {
  initialContent: string;
  onChange: (md: string) => void;
  images?: ImageResource[];
  themeColor?: string;
}

export const EasyEditorBlock: React.FC<EasyEditorBlockProps> = ({ 
  initialContent, 
  onChange, 
  images = [],
  themeColor = '#1e50a2'
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const isEditing = useRef(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ドロップダウンメニュー外タップ検知用のRef
  const textTypeRef = useRef<HTMLDivElement>(null);
  const alignRef = useRef<HTMLDivElement>(null);
  const colorRef = useRef<HTMLDivElement>(null);
  const detailsRef = useRef<HTMLDivElement>(null);
  
  
  // ツールバーのインタラクティブな状態
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [imageSearch, setImageSearch] = useState('');
  const [textTypeMenuOpen, setTextTypeMenuOpen] = useState(false);
  const [alignMenuOpen, setAlignMenuOpen] = useState(false);
  const [colorMenuOpen, setColorMenuOpen] = useState(false);
  const [detailsMenuOpen, setDetailsMenuOpen] = useState(false);
  const [pasteConfirmOpen, setPasteConfirmOpen] = useState(false);
  const [pendingPasteData, setPendingPasteData] = useState<{ text: string, html: string } | null>(null);

  // カーソル位置のフォーマット状態
  const [activeStates, setActiveStates] = useState({
    bold: false,
    italic: false,
    underline: false,
    strikeThrough: false,
    alignLeft: false,
    alignCenter: false,
    alignRight: false,
    alignJustify: false,
    unorderedList: false,
    orderedList: false,
    blockType: 'p',
    color: 'inherit'
  });

  const getActiveBlockType = (): string => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return 'p';
    const range = selection.getRangeAt(0);
    let node: Node | null = range.commonAncestorContainer;
    while (node && node !== editorRef.current) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const tag = (node as Element).tagName.toLowerCase();
        if (['h1', 'h2', 'h3', 'blockquote', 'pre', 'ul', 'ol'].includes(tag)) {
          return tag;
        }
      }
      node = node.parentNode;
    }
    return 'p';
  };

  const updateActiveStates = useCallback(() => {
    if (typeof document === 'undefined') return;
    
    setActiveStates({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      strikeThrough: document.queryCommandState('strikeThrough'),
      alignLeft: document.queryCommandState('justifyLeft'),
      alignCenter: document.queryCommandState('justifyCenter'),
      alignRight: document.queryCommandState('justifyRight'),
      alignJustify: document.queryCommandState('justifyFull'),
      unorderedList: document.queryCommandState('insertUnorderedList'),
      orderedList: document.queryCommandState('insertOrderedList'),
      blockType: getActiveBlockType(),
      color: document.queryCommandValue('foreColor') || 'inherit'
    });
  }, []);

  useEffect(() => {
    if (editorRef.current && !isEditing.current) {
      editorRef.current.innerHTML = renderMarkdown(initialContent || '');
    }
  }, [initialContent]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.addEventListener('selectionchange', updateActiveStates);
    return () => {
      document.removeEventListener('selectionchange', updateActiveStates);
    };
  }, [updateActiveStates]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (textTypeRef.current && !textTypeRef.current.contains(target)) {
        setTextTypeMenuOpen(false);
      }
      if (alignRef.current && !alignRef.current.contains(target)) {
        setAlignMenuOpen(false);
      }
      if (colorRef.current && !colorRef.current.contains(target)) {
        setColorMenuOpen(false);
      }
      if (detailsRef.current && !detailsRef.current.contains(target)) {
        setDetailsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  const handleInput = useCallback((html: string) => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      onChange(htmlToMarkdown(html));
    }, 500);
  }, [onChange]);

  const execCommand = (cmd: string, value: string = '') => {
    document.execCommand(cmd, false, value);
    if (editorRef.current) handleInput(editorRef.current.innerHTML);
    updateActiveStates();
  };

  const applyBlockType = (type: string) => {
    if (type === 'ul') {
      execCommand('insertUnorderedList');
    } else if (type === 'ol') {
      execCommand('insertOrderedList');
    } else if (type === 'details') {
      insertDetails(true);
    } else {
      execCommand('formatBlock', type);
    }
    setTextTypeMenuOpen(false);
  };

  const insertTask = () => {
    execCommand('insertUnorderedList');
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const textNode = document.createTextNode('[ ] ');
      range.insertNode(textNode);
      range.setStartAfter(textNode);
      range.setEndAfter(textNode);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    if (editorRef.current) handleInput(editorRef.current.innerHTML);
    setTextTypeMenuOpen(false);
  };

  const applyLink = () => {
    const url = prompt('リンク先URLを入力してください:', 'https://');
    if (url) {
      execCommand('createLink', url);
    }
  };

  const insertImageTag = (id: string) => {
    const tag = `[[${id}]]`;
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      if (editorRef.current?.contains(range.commonAncestorContainer)) {
        range.deleteContents();
        const textNode = document.createTextNode(tag);
        range.insertNode(textNode);
        range.setStartAfter(textNode);
        range.setEndAfter(textNode);
        selection.removeAllRanges();
        selection.addRange(range);
      } else {
        if (editorRef.current) editorRef.current.innerHTML += tag;
      }
    } else {
      if (editorRef.current) editorRef.current.innerHTML += tag;
    }
    
    if (editorRef.current) handleInput(editorRef.current.innerHTML);
    setShowImagePicker(false);
  };

  const insertHTMLAtCursor = (html: string) => {
    const cleanHTML = DOMPurify.sanitize(html, {
      ADD_TAGS: ['details', 'summary', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'p', 'br', 'span', 'strong', 'em', 'u', 's', 'a', 'div', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'blockquote', 'code', 'pre', 'hr'],
      ADD_ATTR: ['class', 'style', 'open', 'href', 'target', 'rel']
    });
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      if (editorRef.current && editorRef.current.contains(range.commonAncestorContainer)) {
        range.deleteContents();
        const el = document.createElement('div');
        el.innerHTML = cleanHTML;
        const frag = document.createDocumentFragment();
        let node;
        while ((node = el.firstChild)) {
          frag.appendChild(node);
        }
        range.insertNode(frag);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
      } else {
        if (editorRef.current) {
          editorRef.current.innerHTML += cleanHTML;
        }
      }
    } else {
      if (editorRef.current) {
        editorRef.current.innerHTML += cleanHTML;
      }
    }
    if (editorRef.current) handleInput(editorRef.current.innerHTML);
  };

  const insertTable = () => {
    const tableHTML = `
      <table class="border-collapse border border-white/20 w-full text-xs my-2">
        <thead>
          <tr>
            <th class="border border-white/20 p-2 font-bold bg-white/5 text-left">ヘッダー 1</th>
            <th class="border border-white/20 p-2 font-bold bg-white/5 text-left">ヘッダー 2</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="border border-white/20 p-2">データ 1</td>
            <td class="border border-white/20 p-2">データ 2</td>
          </tr>
        </tbody>
      </table>
      <p><br></p>
    `;
    insertHTMLAtCursor(tableHTML);
  };

  const insertHorizontalRule = () => {
    execCommand('insertHorizontalRule');
  };

  const insertDetails = (isOpen: boolean) => {
    const detailsHTML = `
      <details ${isOpen ? 'open' : ''} class="border border-white/10 rounded-xl p-3 my-2 bg-white/5">
        <summary class="font-bold cursor-pointer select-none text-sky-400 outline-none">タイトル（ここをクリックして${isOpen ? '折り畳む' : '展開'}）</summary>
        <div class="mt-2 text-white/80">ここにコンテンツを入力してください。</div>
      </details>
      <p><br></p>
    `;
    insertHTMLAtCursor(detailsHTML);
    setDetailsMenuOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (typeof document === 'undefined') return;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const isMod = e.ctrlKey || e.metaKey;

    if (isMod) {
      const key = e.key.toLowerCase();
      if (key === 'b') {
        e.preventDefault();
        execCommand('bold');
        return;
      }
      if (key === 'i') {
        e.preventDefault();
        execCommand('italic');
        return;
      }
      if (key === 'u') {
        e.preventDefault();
        execCommand('underline');
        return;
      }
      if (key === 'k') {
        e.preventDefault();
        applyLink();
        return;
      }
      if (key === 'z') {
        e.preventDefault();
        execCommand(e.shiftKey ? 'redo' : 'undo');
        return;
      }
      if (key === 'y') {
        e.preventDefault();
        execCommand('redo');
        return;
      }
      if (key === 'x' && e.shiftKey) {
        e.preventDefault();
        execCommand('strikeThrough');
        return;
      }
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      execCommand(e.shiftKey ? 'outdent' : 'indent');
      return;
    }

    if (e.key === 'Backspace') {
      let node: Node | null = selection.getRangeAt(0).commonAncestorContainer;
      let inSummary = false;
      let summaryEl: HTMLElement | null = null;
      while (node && node !== editorRef.current) {
        if (node.nodeType === Node.ELEMENT_NODE && (node as Element).tagName.toLowerCase() === 'summary') {
          inSummary = true;
          summaryEl = node as HTMLElement;
          break;
        }
        node = node.parentNode;
      }
      if (inSummary && summaryEl) {
        const range = selection.getRangeAt(0);
        if (range.startOffset === 0 && range.collapsed) {
          e.preventDefault();
          return;
        }
      }
    }
    
    if (e.key === 'Enter') {
      let node: Node | null = selection.getRangeAt(0).commonAncestorContainer;
      let liEl: HTMLElement | null = null;
      while (node && node !== editorRef.current) {
        if (node.nodeType === Node.ELEMENT_NODE && (node as Element).tagName.toLowerCase() === 'li') {
          liEl = node as HTMLElement;
          break;
        }
        node = node.parentNode;
      }

      if (liEl) {
        const text = liEl.textContent?.replace(/\u200B/g, '').trim() || '';
        const hasBr = liEl.querySelector('br');
        if (text === '' && (!hasBr || liEl.childNodes.length <= 1)) {
          e.preventDefault();
          execCommand('outdent');
          let checkLi: Node | null = window.getSelection()?.getRangeAt(0).commonAncestorContainer || null;
          while (checkLi && checkLi !== editorRef.current) {
            if (checkLi.nodeType === Node.ELEMENT_NODE && (checkLi as Element).tagName.toLowerCase() === 'li') {
              execCommand('formatBlock', 'p');
              break;
            }
            checkLi = checkLi.parentNode;
          }
          return;
        }
      }

      let inSummary = false;
      let summaryEl: HTMLElement | null = null;
      let detailsEl: HTMLElement | null = null;
      
      while (node && node !== editorRef.current) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const tag = (node as Element).tagName.toLowerCase();
          if (tag === 'summary') {
            inSummary = true;
            summaryEl = node as HTMLElement;
          }
          if (tag === 'details') {
            detailsEl = node as HTMLElement;
          }
        }
        node = node.parentNode;
      }
      
      if (inSummary && summaryEl && detailsEl) {
        e.preventDefault();
        
        let contentEl = summaryEl.nextElementSibling as HTMLElement;
        if (!contentEl || contentEl.tagName.toLowerCase() === 'summary') {
          contentEl = document.createElement('div');
          contentEl.className = 'mt-2 text-white/80';
          contentEl.innerHTML = '&#8203;';
          detailsEl.appendChild(contentEl);
        }
        
        const newRange = document.createRange();
        newRange.selectNodeContents(contentEl);
        newRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(newRange);
        
        if (editorRef.current) handleInput(editorRef.current.innerHTML);
        return;
      }
      
      if (detailsEl && !inSummary) {
        let activeBlock: HTMLElement | null = null;
        let rangeNode = selection.getRangeAt(0).commonAncestorContainer;
        while (rangeNode && rangeNode !== detailsEl) {
          if (rangeNode.nodeType === Node.ELEMENT_NODE) {
            activeBlock = rangeNode as HTMLElement;
            break;
          }
          rangeNode = rangeNode.parentNode!;
        }
        
        if (activeBlock) {
          const text = activeBlock.textContent?.replace(/\u200B/g, '').trim() || '';
          const hasBr = activeBlock.querySelector('br');
          
          if (text === '' && !hasBr) {
            e.preventDefault();
            activeBlock.remove();
            
            const p = document.createElement('p');
            p.innerHTML = '<br>';
            detailsEl.parentNode?.insertBefore(p, detailsEl.nextSibling);
            
            const newRange = document.createRange();
            newRange.selectNodeContents(p);
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);
            
            if (editorRef.current) handleInput(editorRef.current.innerHTML);
            return;
          }
        }
      }
    }
  };

  const parseTSVToHTMLTable = (tsv: string): string => {
    const lines = tsv.trim().split(/\r?\n/);
    if (lines.length === 0) return '';
    let html = '<table class="border-collapse border border-white/20 w-full text-xs my-2">';
    lines.forEach((line, index) => {
      const cells = line.split('\t');
      html += '<tr>';
      cells.forEach(cell => {
        const tag = index === 0 ? 'th' : 'td';
        const classes = index === 0 
          ? 'border border-white/20 p-2 font-bold bg-white/5 text-left' 
          : 'border border-white/20 p-2';
        html += `<${tag} class="${classes}">${cell.trim() || '&nbsp;'}</${tag}>`;
      });
      html += '</tr>';
    });
    html += '</table><p><br></p>';
    return html;
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const htmlData = e.clipboardData.getData('text/html') || '';
    const textData = e.clipboardData.getData('text/plain') || '';
    
    const selection = window.getSelection();
    let isSummary = false;
    let isInDetails = false;
    if (selection && selection.rangeCount > 0) {
      let node: Node | null = selection.getRangeAt(0).commonAncestorContainer;
      while (node && node !== editorRef.current) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const tagName = (node as Element).tagName.toLowerCase();
          if (tagName === 'summary') {
            isSummary = true;
            break;
          }
          if (tagName === 'details') {
            isInDetails = true;
          }
        }
        node = node.parentNode;
      }
    }

    if (isSummary) {
      e.preventDefault();
      const cleanText = textData.replace(/[\r\n]/g, ' ');
      document.execCommand('insertText', false, cleanText);
      if (editorRef.current) handleInput(editorRef.current.innerHTML);
      return;
    }

    const hasTableMarkup = htmlData.includes('<table') || htmlData.includes('<tr');
    const isTSV = textData.includes('\t') && textData.includes('\n');
    
    if (hasTableMarkup || isTSV) {
      e.preventDefault();
      setPendingPasteData({ text: textData, html: htmlData });
      setPasteConfirmOpen(true);
      return;
    }

    if (isInDetails) {
      e.preventDefault();
      const lines = textData.split(/\r?\n/);
      const formattedHTML = lines
        .map(line => line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'))
        .join('<br>');
      document.execCommand('insertHTML', false, formattedHTML);
      if (editorRef.current) handleInput(editorRef.current.innerHTML);
      return;
    }
  };

  const confirmConvertTable = () => {
    if (!pendingPasteData) return;
    let targetHTML = '';
    const isTSV = pendingPasteData.text.includes('\t') && pendingPasteData.text.includes('\n');
    
    if (isTSV) {
      targetHTML = parseTSVToHTMLTable(pendingPasteData.text);
    } else if (pendingPasteData.html) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(pendingPasteData.html, 'text/html');
      const tables = doc.querySelectorAll('table');
      if (tables.length > 0) {
        tables.forEach(table => {
          table.className = "border-collapse border border-white/20 w-full text-xs my-2";
          table.querySelectorAll('th').forEach(th => {
            th.className = "border border-white/20 p-2 font-bold bg-white/5 text-left";
          });
          table.querySelectorAll('td').forEach(td => {
            td.className = "border border-white/20 p-2";
          });
        });
        targetHTML = doc.body.innerHTML;
      } else {
        targetHTML = pendingPasteData.html;
      }
    }
    
    insertHTMLAtCursor(targetHTML);
    setPasteConfirmOpen(false);
    setPendingPasteData(null);
  };

  const cancelConvertTable = () => {
    if (!pendingPasteData) return;
    const escapedText = pendingPasteData.text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    const textHtml = escapedText.replace(/\r?\n/g, '<br>');
    insertHTMLAtCursor(textHtml);
    setPasteConfirmOpen(false);
    setPendingPasteData(null);
  };

  const filteredImages = useMemo(() => {
    return images.filter(img => 
      img.id.toLowerCase().includes(imageSearch.toLowerCase()) || 
      img.name.toLowerCase().includes(imageSearch.toLowerCase())
    );
  }, [images, imageSearch]);

  const togglePicker = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowImagePicker(prev => !prev);
  };

  // テキストタイプ定義
  const textTypes = [
    { name: '本文', value: 'p', prefix: 'T' },
    { name: '見出し (Lv.1)', value: 'h1', prefix: 'H1' },
    { name: '見出し (Lv.2)', value: 'h2', prefix: 'H2' },
    { name: '見出し (Lv.3)', value: 'h3', prefix: 'H3' },
    { name: '番号付きリスト', value: 'ol', prefix: '123' },
    { name: '箇条書きリスト', value: 'ul', prefix: '三' },
    { name: 'タスク', value: 'task', prefix: 'v' },
    { name: '引用', value: 'blockquote', prefix: '“' },
    { name: 'コードブロック', value: 'pre', prefix: '{}' },
    { name: '折り畳みエリア', value: 'details', prefix: '>' }
  ];

  const currentTextType = textTypes.find(t => t.value === activeStates.blockType) || textTypes[0];

  // 整列タイプ定義
  const alignTypes = [
    { name: '左揃え', value: 'alignLeft', icon: <AlignLeft size={14} />, cmd: 'justifyLeft' },
    { name: '中央揃え', value: 'alignCenter', icon: <AlignCenter size={14} />, cmd: 'justifyCenter' },
    { name: '右揃え', value: 'alignRight', icon: <AlignRight size={14} />, cmd: 'justifyRight' },
    { name: '両端揃え', value: 'alignJustify', icon: <AlignJustify size={14} />, cmd: 'justifyFull' }
  ];

  const currentColAlign = alignTypes.find(a => activeStates[a.value as keyof typeof activeStates]) || alignTypes[0];

  // カラーパレット定義
  const colorOptions = [
    { name: '標準', value: 'inherit', hex: '#fff' },
    { name: 'テーマカラー', value: themeColor, hex: themeColor },
    { name: 'レッド', value: '#ef4444', hex: '#ef4444' },
    { name: 'グリーン', value: '#22c55e', hex: '#22c55e' },
    { name: 'ブルー', value: '#3b82f6', hex: '#3b82f6' },
    { name: 'イエロー', value: '#eab308', hex: '#eab308' },
    { name: 'ホワイト', value: '#ffffff', hex: '#ffffff' }
  ];

  const styleButton = (isActive: boolean) => {
    return isActive ? {
      color: themeColor,
      backgroundColor: themeColor + '1a',
      borderColor: themeColor + '30'
    } : {};
  };

  return (
    <div 
      className="flex flex-col border rounded-xl overflow-hidden bg-black/40 transition-all duration-300"
      style={{ 
        borderColor: themeColor + '20',
        boxShadow: `0 8px 32px rgba(0,0,0,0.4), 0 0 15px ${themeColor}0a`
      }}
    >
      {/* 編集ツールバー */}
      <div className="flex items-center flex-wrap gap-0.5 p-1.5 bg-zinc-950/80 border-b border-white/10 relative text-white/80 select-none font-sans text-xs backdrop-blur-xl z-[100]">
        
        {/* 1. テキストタイプ選択 (ドロップダウン) */}
        <div className="relative" ref={textTypeRef}>
          <button
            onMouseDown={e => { e.preventDefault(); setTextTypeMenuOpen(!textTypeMenuOpen); }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 hover:bg-white/5 rounded-lg text-white/70 hover:text-white transition-all border border-transparent hover:border-white/5 font-bold text-[11px] h-8"
          >
            <Type size={14} style={{ color: activeStates.blockType !== 'p' ? themeColor : 'inherit' }} />
            <span className="font-sans tracking-wide truncate max-w-[80px]">{currentTextType.name}</span>
            <ChevronDown size={10} className="opacity-40" />
          </button>
          
          <AnimatePresence>
            {textTypeMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: 4, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 4, scale: 0.95 }}
                transition={{ duration: 0.1, ease: 'easeOut' }}
                className="absolute left-0 mt-1 w-44 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden z-[200] py-1 backdrop-blur-3xl"
              >
                  {textTypes.map((t) => {
                    const isSelected = activeStates.blockType === t.value;
                    return (
                      <button
                        key={t.value}
                        onMouseDown={e => { 
                          e.preventDefault(); 
                          if (t.value === 'task') {
                            insertTask();
                          } else {
                            applyBlockType(t.value);
                          }
                        }}
                        className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-white/5 transition-colors text-white/70 hover:text-white text-[11px]"
                      >
                        <span className="font-sans flex items-center gap-2">
                          <span className="w-5 text-center font-mono text-[9px] opacity-40">{t.prefix}</span>
                          {t.name}
                        </span>
                        {isSelected && <Check size={12} style={{ color: themeColor }} />}
                      </button>
                    );
                  })}
                </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ディバイダー */}
        <div className="w-px h-4 bg-white/10 mx-1" />

        {/* 2. 整列選択 (ドロップダウン) */}
        <div className="relative" ref={alignRef}>
          <button
            onMouseDown={e => { e.preventDefault(); setAlignMenuOpen(!alignMenuOpen); }}
            className="flex items-center justify-center p-1.5 hover:bg-white/5 rounded-lg text-white/70 hover:text-white transition-all border border-transparent hover:border-white/5 h-8 w-8"
            title="段落の整列"
          >
            {currentColAlign.icon}
          </button>
          
          <AnimatePresence>
            {alignMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: 4, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 4, scale: 0.95 }}
                transition={{ duration: 0.1, ease: 'easeOut' }}
                className="absolute left-0 mt-1 w-32 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden z-[200] py-1 backdrop-blur-3xl"
              >
                  {alignTypes.map((a) => {
                    const isSelected = activeStates[a.value as keyof typeof activeStates];
                    return (
                      <button
                        key={a.value}
                        onMouseDown={e => { e.preventDefault(); execCommand(a.cmd); setAlignMenuOpen(false); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-white/5 transition-colors text-white/70 hover:text-white text-[11px]"
                      >
                        <span style={{ color: isSelected ? themeColor : 'inherit' }}>{a.icon}</span>
                        <span className="font-sans">{a.name}</span>
                        {isSelected && <Check size={10} className="ml-auto" style={{ color: themeColor }} />}
                      </button>
                    );
                  })}
                </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ディバイダー */}
        <div className="w-px h-4 bg-white/10 mx-1" />

        {/* 3. 書式トグルボタン群 (Bold, Italic, Underline, Strikethrough) */}
        <button 
          onMouseDown={e => { e.preventDefault(); execCommand('bold'); }} 
          className="p-1.5 hover:bg-white/5 rounded-lg text-white/60 hover:text-white transition-all border border-transparent h-8 w-8 flex items-center justify-center" 
          style={styleButton(activeStates.bold)}
          title="太字 (Ctrl+B)"
        >
          <Bold size={14}/>
        </button>
        <button 
          onMouseDown={e => { e.preventDefault(); execCommand('italic'); }} 
          className="p-1.5 hover:bg-white/5 rounded-lg text-white/60 hover:text-white transition-all border border-transparent h-8 w-8 flex items-center justify-center" 
          style={styleButton(activeStates.italic)}
          title="斜体 (Ctrl+I)"
        >
          <Italic size={14}/>
        </button>
        <button 
          onMouseDown={e => { e.preventDefault(); execCommand('underline'); }} 
          className="p-1.5 hover:bg-white/5 rounded-lg text-white/60 hover:text-white transition-all border border-transparent h-8 w-8 flex items-center justify-center" 
          style={styleButton(activeStates.underline)}
          title="下線 (Ctrl+U)"
        >
          <Underline size={14}/>
        </button>
        <button 
          onMouseDown={e => { e.preventDefault(); execCommand('strikeThrough'); }} 
          className="p-1.5 hover:bg-white/5 rounded-lg text-white/60 hover:text-white transition-all border border-transparent h-8 w-8 flex items-center justify-center" 
          style={styleButton(activeStates.strikeThrough)}
          title="打ち消し線 (Ctrl+Shift+X)"
        >
          <Strikethrough size={14}/>
        </button>

        {/* ディバイダー */}
        <div className="w-px h-4 bg-white/10 mx-1" />

        {/* 4. リスト・引用・区切り線クイックボタン */}
        <button 
          onMouseDown={e => { e.preventDefault(); execCommand('insertUnorderedList'); }} 
          className="p-1.5 hover:bg-white/5 rounded-lg text-white/60 hover:text-white transition-all border border-transparent h-8 w-8 flex items-center justify-center" 
          style={styleButton(activeStates.unorderedList)}
          title="箇条書きリスト"
        >
          <List size={14}/>
        </button>
        <button 
          onMouseDown={e => { e.preventDefault(); execCommand('insertOrderedList'); }} 
          className="p-1.5 hover:bg-white/5 rounded-lg text-white/60 hover:text-white transition-all border border-transparent h-8 w-8 flex items-center justify-center" 
          style={styleButton(activeStates.orderedList)}
          title="番号付きリスト"
        >
          <ListOrdered size={14}/>
        </button>
        <button 
          onMouseDown={e => { e.preventDefault(); execCommand('formatBlock', 'blockquote'); }} 
          className="p-1.5 hover:bg-white/5 rounded-lg text-white/60 hover:text-white transition-all border border-transparent h-8 w-8 flex items-center justify-center" 
          style={styleButton(activeStates.blockType === 'blockquote')}
          title="引用"
        >
          <Quote size={14}/>
        </button>
        <button 
          onMouseDown={e => { e.preventDefault(); insertHorizontalRule(); }} 
          className="p-1.5 hover:bg-white/5 rounded-lg text-white/60 hover:text-white transition-all border border-transparent h-8 w-8 flex items-center justify-center" 
          title="区切り線 (水平線)"
        >
          <Minus size={14}/>
        </button>

        {/* ディバイダー */}
        <div className="w-px h-4 bg-white/10 mx-1" />

        {/* 5. テーブル、リンク、コード */}
        <button 
          type="button"
          onMouseDown={e => { e.preventDefault(); insertTable(); }} 
          className="p-1.5 hover:bg-white/5 rounded-lg text-white/60 hover:text-white transition-all border border-transparent h-8 w-8 flex items-center justify-center" 
          title="テーブル挿入"
        >
          <Table size={14}/>
        </button>
        <button 
          onMouseDown={e => { e.preventDefault(); applyLink(); }} 
          className="p-1.5 hover:bg-white/5 rounded-lg text-white/60 hover:text-white transition-all border border-transparent h-8 w-8 flex items-center justify-center"
          title="リンク挿入 (Ctrl+K)"
        >
          <LinkIcon size={14}/>
        </button>
        <button 
          onMouseDown={e => { e.preventDefault(); execCommand('formatBlock', 'pre'); }} 
          className="p-1.5 hover:bg-white/5 rounded-lg text-white/60 hover:text-white transition-all border border-transparent h-8 w-8 flex items-center justify-center"
          style={styleButton(activeStates.blockType === 'pre')}
          title="コードブロック"
        >
          <Code size={14}/>
        </button>

        {/* 5. テキスト色 (ドロップダウン) */}
        <div className="relative" ref={colorRef}>
          <button
            onMouseDown={e => { e.preventDefault(); setColorMenuOpen(!colorMenuOpen); }}
            className="flex items-center justify-center gap-0.5 p-1.5 hover:bg-white/5 rounded-lg text-white/70 hover:text-white transition-all border border-transparent hover:border-white/5 h-8 w-10"
            title="テキストの色"
          >
            <Palette size={14} style={{ color: activeStates.color !== 'inherit' && activeStates.color !== 'rgb(255, 255, 255)' ? activeStates.color : 'inherit' }} />
            <ChevronDown size={8} className="opacity-40" />
          </button>
          
          <AnimatePresence>
            {colorMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: 4, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 4, scale: 0.95 }}
                transition={{ duration: 0.1, ease: 'easeOut' }}
                className="absolute left-0 mt-1 w-40 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden z-[200] py-1 backdrop-blur-3xl"
              >
                {colorOptions.map((c) => (
                  <button
                    key={c.value}
                    onMouseDown={e => { 
                      e.preventDefault(); 
                      execCommand('foreColor', c.value); 
                      setColorMenuOpen(false); 
                    }}
                    className="w-full flex items-center gap-3 px-3 py-1.5 hover:bg-white/5 transition-colors text-white/70 hover:text-white text-[11px]"
                  >
                    <span className="w-3 h-3 rounded-full border border-white/10" style={{ backgroundColor: c.hex }} />
                    <span className="font-sans">{c.name}</span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ディバイダー */}
        <div className="w-px h-4 bg-white/10 mx-1" />

        {/* 6. Undo & Redo (ユーザー様の要望) */}
        <button 
          onMouseDown={e => { e.preventDefault(); execCommand('undo'); }} 
          className="p-1.5 hover:bg-white/5 rounded-lg text-white/60 hover:text-white transition-all border border-transparent h-8 w-8 flex items-center justify-center"
          title="元に戻す (Ctrl+Z)"
        >
          <Undo size={14}/>
        </button>
        <button 
          onMouseDown={e => { e.preventDefault(); execCommand('redo'); }} 
          className="p-1.5 hover:bg-white/5 rounded-lg text-white/60 hover:text-white transition-all border border-transparent h-8 w-8 flex items-center justify-center"
          title="やり直す (Ctrl+Y)"
        >
          <Redo size={14}/>
        </button>

        {/* ディバイダー */}
        <div className="w-px h-4 bg-white/10 mx-1" />

        {/* 7. Sync Media ボタン */}
        <button 
          type="button"
          onMouseDown={togglePicker}
          className={`px-2.5 rounded-lg transition-all flex items-center gap-1.5 h-8 border text-xs font-bold ${showImagePicker ? 'text-white' : 'hover:bg-white/5 text-white/60 hover:text-white border-transparent hover:border-white/5'}`}
          style={{
            backgroundColor: showImagePicker ? themeColor + '20' : 'transparent',
            borderColor: showImagePicker ? themeColor + '50' : 'transparent',
            color: showImagePicker ? themeColor : 'inherit'
          }}
          title="メディアボタンを配置"
        >
          <ImageIcon size={14}/>
          <span className="text-[9px] font-bold uppercase tracking-wider hidden md:inline">Sync Media</span>
        </button>

        {/* 右端のユーティリティボタン (折り畳みエリア) */}
        <div className="flex items-center gap-1 ml-auto">
          {/* 折り畳みエリア (メニュー付き) */}
          <div className="relative" ref={detailsRef}>
            <button 
              type="button"
              onMouseDown={e => { e.preventDefault(); setDetailsMenuOpen(!detailsMenuOpen); }} 
              className={`px-2 rounded-lg transition-all flex items-center gap-1.5 h-8 border text-xs font-bold ${
                detailsMenuOpen 
                  ? 'bg-sky-500/10 border-sky-500/30 text-sky-400' 
                  : 'bg-white/5 border-white/10 hover:border-white/20 text-white/80 hover:text-white hover:bg-white/10'
              }`} 
              title="折り畳みエリア挿入"
            >
              <div className="flex items-center gap-0.5">
                <Eye size={12} className={detailsMenuOpen ? 'text-sky-400' : 'text-white/60'} />
                <span className="text-[9px] opacity-40 font-mono text-white/40">/</span>
                <EyeOff size={12} className={detailsMenuOpen ? 'text-sky-400' : 'text-white/60'} />
              </div>
              <span className="text-[9px] font-bold tracking-wider uppercase">Details</span>
              <ChevronDown size={12} className={`transform transition-transform opacity-60 ${detailsMenuOpen ? 'rotate-180 text-sky-400 opacity-100' : ''}`} />
            </button>
            
            <AnimatePresence>
              {detailsMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 4, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 4, scale: 0.95 }}
                  transition={{ duration: 0.1, ease: 'easeOut' }}
                  className="absolute right-0 mt-1 w-36 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden z-[200] py-1 backdrop-blur-3xl"
                >
                    <button
                      type="button"
                      onMouseDown={e => { e.preventDefault(); insertDetails(false); }}
                      className="w-full flex items-center px-3 py-2 text-left hover:bg-white/5 transition-colors text-white/70 hover:text-white text-[11px] font-sans"
                    >
                      閉じた状態で挿入
                    </button>
                    <button
                      type="button"
                      onMouseDown={e => { e.preventDefault(); insertDetails(true); }}
                      className="w-full flex items-center px-3 py-2 text-left hover:bg-white/5 transition-colors text-white/70 hover:text-white text-[11px] font-sans"
                    >
                      展開状態で挿入
                    </button>
                  </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Sync Media Picker ポップアップ */}
        {showImagePicker && typeof document !== 'undefined' && createPortal(
          <AnimatePresence mode="wait">
            {showImagePicker && (
              <div key="image-picker-portal" className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                  onMouseDown={() => setShowImagePicker(false)}
                />
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  className="relative w-full max-w-md bg-zinc-900 border border-white/10 rounded-[24px] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
                  onMouseDown={e => e.stopPropagation()}
                >
                  <div className="p-4 border-b border-white/5 space-y-3 bg-black/20">
                    <div className="flex items-center justify-between">
                      <div className="text-[10px] font-black text-white/20 uppercase tracking-widest px-1">INSERT MEDIA SYNC BUTTON</div>
                      <button onClick={() => setShowImagePicker(false)} className="text-white/20 hover:text-white transition-colors">
                        <X size={16} />
                      </button>
                    </div>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" size={14} />
                      <input 
                        autoFocus
                        type="text"
                        placeholder="Search media..."
                        value={imageSearch}
                        onChange={e => setImageSearch(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-xl py-2 pl-9 pr-3 text-xs text-white focus:outline-none transition-all"
                      />
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 gap-3 custom-scrollbar min-h-[300px]">
                    {filteredImages.map(img => (
                      <button
                        key={img.id}
                        onClick={() => insertImageTag(img.id)}
                        className="group relative aspect-video bg-black/40 rounded-xl overflow-hidden border border-white/5 hover:border-purple-500/50 transition-all flex items-center justify-center ring-offset-black focus:ring-2 focus:ring-purple-500 outline-none"
                      >
                        {img.type === 'pdf' ? (
                          <div className="flex flex-col items-center justify-center gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
                            <FileText size={24} className="text-red-500" />
                            <span className="text-[9px] font-bold text-white/40 uppercase">PDF</span>
                          </div>
                        ) : (
                          img.url ? (
                            <img src={img.url} alt={img.name} className="w-full h-full object-cover opacity-50 group-hover:opacity-100 transition-opacity" />
                          ) : null
                        )}
                        <div className="absolute inset-x-0 bottom-0 p-2 bg-black/80 backdrop-blur-md translate-y-full group-hover:translate-y-0 transition-transform">
                          <div className="text-[10px] font-mono font-bold text-white truncate text-center">[[{img.id}]]</div>
                        </div>
                      </button>
                    ))}
                    {filteredImages.length === 0 && (
                      <div className="col-span-2 py-16 flex flex-col items-center justify-center text-white/10 gap-3">
                        <Search size={32} />
                        <span className="text-[10px] font-bold uppercase tracking-widest">No matching media</span>
                      </div>
                    )}
                  </div>
                  <div className="p-4 border-t border-white/5 bg-black/40">
                    <button 
                      onClick={() => setShowImagePicker(false)}
                      className="w-full py-2.5 bg-white/5 border border-white/10 rounded-xl text-[10px] font-bold text-white/60 hover:text-white hover:bg-white/10 uppercase transition-all tracking-widest font-cinzel"
                    >Close</button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body
        )}

        {/* 表貼り付けの確認ポップアップ */}
        {pasteConfirmOpen && typeof document !== 'undefined' && createPortal(
          <AnimatePresence mode="wait">
            {pasteConfirmOpen && (
              <div key="paste-confirm-portal" className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-black/85 backdrop-blur-md"
                  onClick={cancelConvertTable}
                />
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  className="relative w-full max-w-sm bg-zinc-900 border border-white/10 rounded-[20px] shadow-2xl overflow-hidden flex flex-col p-6 space-y-4"
                  onClick={e => e.stopPropagation()}
                >
                  <div className="space-y-2">
                    <div className="text-[10px] font-black text-sky-400 uppercase tracking-widest">TABLE CONVERSION</div>
                    <h3 className="text-sm font-bold text-white font-sans">表形式データを検出しました</h3>
                    <p className="text-xs text-white/50 leading-relaxed font-sans">
                      貼り付けられたテキストにスプレッドシートやExcelの表構造が含まれています。このデータをMarkdown対応のテーブルに変換して挿入しますか？
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={confirmConvertTable}
                      className="flex-1 py-2 bg-sky-500 hover:bg-sky-600 active:bg-sky-700 text-black font-bold text-xs rounded-xl transition-colors font-sans"
                    >
                      表に変換して挿入
                    </button>
                    <button 
                      onClick={cancelConvertTable}
                      className="flex-1 py-2 bg-white/5 hover:bg-white/10 text-white/80 border border-white/10 text-xs rounded-xl transition-all font-sans"
                    >
                      通常のテキストとして貼付
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body
        )}

      </div>
      
      {/* エディタの編集ペイン */}
      <div 
        ref={editorRef} 
        contentEditable 
        onFocus={() => { isEditing.current = true; }} 
        onBlur={() => { isEditing.current = false; }}
        onInput={(e) => handleInput(e.currentTarget.innerHTML)}
        onPaste={handlePaste}
        onKeyDown={handleKeyDown}
        className="markdown-content prose prose-invert prose-zinc max-w-none w-full bg-[#0a0a0a] text-[14px] text-white/90 outline-none p-6 min-h-[220px]"
      />
    </div>
  );
};
