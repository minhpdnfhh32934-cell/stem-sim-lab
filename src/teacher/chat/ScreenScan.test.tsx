import { act, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ScreenScan } from './ScreenScan';

describe('ScreenScan', () => {
  it('is hidden until the screen-context toggle fires a scan', () => {
    const { container } = render(<ScreenScan />);
    expect(container.querySelector('.screen-scan')).not.toBeInTheDocument();
    act(() => {
      window.dispatchEvent(new Event('stemsim:screen-scan'));
    });
    expect(container.querySelector('.screen-scan__band')).toBeInTheDocument();
  });
});
