import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emblem, meteors } from './menuArt';

// The menu's art, serialized: tags, attributes in the order they are set, children in order. A
// snapshot of what the code drew before the emblem's numbers moved to emblemShape.ts (shared with
// the hub's 3D emblem): the menu must stay byte-identical.

interface FakeNode {
  readonly tag: string;
  readonly attrs: [string, string][];
  readonly children: FakeNode[];
  className: string;
  textContent: string | null;
  setAttribute(name: string, value: string): void;
  append(...nodes: FakeNode[]): void;
}

function node(tag: string): FakeNode {
  const n: FakeNode = {
    tag,
    attrs: [],
    children: [],
    className: '',
    textContent: null,
    setAttribute(name, value) {
      const i = n.attrs.findIndex(([key]) => key === name);
      if (i >= 0) n.attrs[i] = [name, value];
      else n.attrs.push([name, value]);
    },
    append(...nodes) {
      n.children.push(...nodes);
    },
  };
  return n;
}

const serialize = (n: FakeNode, indent = ''): string => {
  const attrs = [...(n.className ? [['class', n.className]] : []), ...n.attrs]
    .map(([key, value]) => ` ${key ?? ''}="${value ?? ''}"`)
    .join('');
  const text = n.textContent ?? '';
  if (n.children.length === 0) return `${indent}<${n.tag}${attrs}>${text}</${n.tag}>`;
  const inner = n.children.map((c) => serialize(c, `${indent}  `)).join('\n');
  return `${indent}<${n.tag}${attrs}>\n${inner}\n${indent}</${n.tag}>`;
};

describe('menu art', () => {
  beforeEach(() => {
    vi.stubGlobal('document', {
      createElement: (tag: string) => node(tag),
      createElementNS: (_ns: string, tag: string) => node(tag),
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('draws the emblem as it always has', () => {
    expect(serialize(emblem() as unknown as FakeNode)).toMatchInlineSnapshot(`
      "<svg viewBox="0 0 240 240" fill="none" class="menu-emblem" aria-hidden="true" focusable="false">
        <circle cx="120" cy="120" r="88" fill="#4fb3d9" fill-opacity="0.06"></circle>
        <circle cx="120" cy="120" r="114" stroke="#4fb3d9" stroke-opacity="0.35" stroke-width="1.5"></circle>
        <circle cx="120" cy="120" r="103" stroke="#4fb3d9" stroke-opacity="0.55" stroke-width="8" stroke-dasharray="1.2 9.586"></circle>
        <circle cx="120" cy="120" r="88" stroke="#4fb3d9" stroke-opacity="0.25"></circle>
        <g class="emblem-orbit">
          <circle cx="120" cy="6" r="6" fill="#4fb3d9" fill-opacity="0.22"></circle>
          <circle cx="120" cy="6" r="2.4" fill="#cdeefa"></circle>
        </g>
        <path d="M44 168H196" stroke="#4fb3d9" stroke-opacity="0.7" stroke-width="1.5"></path>
        <path d="M56 168v7M80 168v4M104 168v7M128 168v4M152 168v7M176 168v4" stroke="#4fb3d9" stroke-opacity="0.5"></path>
        <path d="M56 168Q120 28 184 168" class="emblem-flight" stroke="#cdeefa" stroke-opacity="0.85" stroke-width="2" stroke-dasharray="5 6" stroke-linecap="round"></path>
        <circle cx="75.2" cy="132.3" r="3" fill="#4fb3d9" fill-opacity="0.4" class="emblem-strobe" style="--rest: 0.4; --at: 0s"></circle>
        <circle cx="94.4" cy="109.2" r="3.5" fill="#4fb3d9" fill-opacity="0.65" class="emblem-strobe" style="--rest: 0.65; --at: 0.25s"></circle>
        <circle cx="145.6" cy="109.2" r="3.5" fill="#4fb3d9" fill-opacity="0.65" class="emblem-strobe" style="--rest: 0.65; --at: 0.75s"></circle>
        <circle cx="164.8" cy="132.3" r="3" fill="#4fb3d9" fill-opacity="0.4" class="emblem-strobe" style="--rest: 0.4; --at: 1s"></circle>
        <circle cx="120" cy="98" r="16" fill="#ffb454" fill-opacity="0.18" class="emblem-glow"></circle>
        <circle cx="120" cy="98" r="7" fill="#ffb454"></circle>
      </svg>"
    `);
  });

  it('draws the science glyphs as they always have', () => {
    const drawn = meteors().map((m) => serialize(m as unknown as FakeNode));
    expect(drawn.join('\n')).toMatchInlineSnapshot(`
      "<span class="menu-meteor flask">
        <svg viewBox="0 0 24 24" fill="none" stroke="#cdeefa" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round" focusable="false">
          <path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3l-5-9V3"></path>
          <path d="M7.6 15.5h8.8" stroke-dasharray="1.5 1.5" opacity="0.7"></path>
        </svg>
      </span>
      <span class="menu-meteor helix">
        <svg viewBox="0 0 24 24" fill="none" stroke="#cdeefa" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round" focusable="false">
          <path d="M7 2c0 5 10 5 10 10s-10 5-10 10M17 2c0 5-10 5-10 10s10 5 10 10"></path>
          <path d="M8.6 5.2h6.8M10.6 9.6h2.8M10.6 14.4h2.8M8.6 18.8h6.8"></path>
        </svg>
      </span>
      <span class="menu-meteor apple">
        <svg viewBox="0 0 24 24" fill="none" stroke="#cdeefa" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round" focusable="false">
          <path d="M12 8c-2-1.4-6-1-6.5 3-.4 3.6 2.2 9 4.2 9 .9 0 1.4-.5 2.3-.5s1.4.5 2.3.5c2 0 4.6-5.4 4.2-9C18 7 14 6.6 12 8z"></path>
          <path d="M12 8c0-2 .8-3.4 2.2-4.2"></path>
          <path d="M21 3v6M19.5 7.5 21 9l1.5-1.5"></path>
        </svg>
      </span>
      <span class="menu-meteor pendulum">
        <svg viewBox="0 0 24 24" fill="none" stroke="#cdeefa" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round" focusable="false">
          <path d="M5 3h14M12 3l4.3 12.8M19.2 17.9a2.2 2.2 0 1 0-4.4 0a2.2 2.2 0 1 0 4.4 0"></path>
          <path d="M4.15 16.6A15.7 15.7 0 0 0 19.85 16.6" stroke-dasharray="1 2" opacity="0.7"></path>
        </svg>
      </span>"
    `);
  });
});
