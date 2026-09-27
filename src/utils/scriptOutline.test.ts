import { describe, expect, it } from 'vitest';
import { parseOutlineNodes, visibleOutlineNodes } from './scriptOutline';
import { preprocessMarkdownForDetails } from './detailsMarkup';

describe('outline branch boundaries', () => {
  const nodes = parseOutlineNodes('# A\n## A1\n### A1 child\n## A2\n### A2 child\n# B\n## B1');
  it('folds only the selected branch, not a later sibling branch', () => {
    expect(visibleOutlineNodes(nodes, new Set(['1'])).map(n => n.text)).toEqual(['A', 'A1', 'A2', 'A2 child', 'B', 'B1']);
  });
  it('folds a whole parent and stops at the next parent', () => {
    expect(visibleOutlineNodes(nodes, new Set(['0'])) .map(n => n.text)).toEqual(['A', 'B', 'B1']);
  });
  it('parses indented list children', () => {
    expect(parseOutlineNodes('- A\n  - B\n    - C').map(n => n.depth)).toEqual([0, 1, 2]);
  });
});
describe('details markup', () => {
  it('preserves nested and sibling boundaries and content outside details', () => {
    const input = 'Before\n<details><summary>A</summary>\nA body\n<details><summary>Inner</summary>\nInner body\n</details>\n</details>\nBetween\n<details><summary>B</summary>\nB body\n</details>\nAfter';
    const result = preprocessMarkdownForDetails(input);
    expect(result).toContain('</details><br></details>\nBetween\n<details>');
    expect(result).toContain('Before\n');
    expect(result).toContain('</details>\nAfter');
    expect(result.match(/<details>/g)).toHaveLength(3);
    expect(preprocessMarkdownForDetails(result)).toBe(result);
  });
  it('leaves unmatched markup and ordinary Markdown untouched', () => {
    expect(preprocessMarkdownForDetails('# Heading\nText')).toBe('# Heading\nText');
    expect(preprocessMarkdownForDetails('<details>\nunfinished')).toBe('<details>\nunfinished');
  });
});
