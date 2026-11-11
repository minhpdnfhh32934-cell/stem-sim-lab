import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import raw from '../../../data/elements.json';
import { ElementDetails } from './ElementDetails';

afterEach(() => {
  cleanup();
});

describe('ElementDetails source line (#192)', () => {
  it('names the mendeleev version the data was generated with', () => {
    // "mendeleev 1.3.0 (L. M. Mentel): …" as written by scripts/data/gen_elements.py.
    const [name, version] = raw.source.citation.split(' ');
    expect(name).toBe('mendeleev');
    expect(version).toMatch(/^\d+\.\d+/);
    const { container } = render(<ElementDetails />);
    const line = container.querySelector('.el-card__source')?.textContent ?? '';
    expect(line).toContain(`mendeleev ${version ?? ''} `);
  });
});
