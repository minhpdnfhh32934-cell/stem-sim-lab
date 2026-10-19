import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MessageBody } from './MessageBody';
import { parseMessage } from './messageParse';

describe('parseMessage', () => {
  it('splits fences, display math and markdown', () => {
    const blocks = parseMessage('Hi\n```python\nprint(1)\n```\n$$x^2$$\nBye');
    expect(blocks.map((b) => b.kind)).toEqual(['md', 'code', 'math', 'md']);
  });

  it('keeps unclosed fences and dollars as plain text', () => {
    const blocks = parseMessage('```oops\nand $5 plus $6');
    expect(blocks).toEqual([{ kind: 'md', lines: ['```oops', 'and $5 plus $6'] }]);
  });
});

describe('MessageBody', () => {
  it('renders headings, bold, lists and rules instead of raw marks', () => {
    render(<MessageBody content={'### Tiêu đề\n**Đậm** nhé\n- một\n- hai\n---\nXong'} />);
    expect(screen.getByRole('heading', { level: 4 })).toHaveTextContent('Tiêu đề');
    expect(screen.getByText('Đậm').tagName).toBe('STRONG');
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(document.querySelector('.msg-hr')).not.toBeNull();
    expect(document.body.textContent).not.toContain('###');
  });

  it('frames code instead of showing fences', () => {
    render(<MessageBody content={'Ví dụ:\n```python\nprint(1)\n```'} />);
    expect(document.querySelector('.msg-code__lang')).toHaveTextContent('python');
    expect(document.querySelector('.msg-code__body')).toHaveTextContent('print(1)');
    expect(document.body.textContent).not.toContain('```');
  });

  it('renders KaTeX formulas instead of dollar signs', async () => {
    render(<MessageBody content={'Ta có $$P = m \\cdot g$$ và $v_0$ nhé'} />);
    await waitFor(() => {
      expect(document.querySelector('.msg-math .katex')).not.toBeNull();
    });
    expect(document.body.textContent).not.toContain('$$');
  });

  it('never injects markup from hostile answers', () => {
    render(<MessageBody content={'<script>alert(1)</script>\n[click](javascript:alert(2))'} />);
    expect(document.querySelector('script')).toBeNull();
    expect(document.body.textContent).toContain('click');
    expect(document.querySelector('.chat-message__body a')).toBeNull();
  });

  it('shows where an AI-written link leads but never makes it clickable (audit SEC-03)', () => {
    render(<MessageBody content={'Xem [bài viết này](https://evil.example/login?next=1) nhé'} />);
    expect(document.querySelector('a')).toBeNull();
    expect(screen.getByText('bài viết này')).toBeInTheDocument();
    expect(screen.getByText('(evil.example)')).toBeInTheDocument();
    expect(screen.getByTitle('https://evil.example/login?next=1')).toBeInTheDocument();
  });
});
