import { describe, expect, it } from 'vitest';
import { toSpokenText } from './speak';
import { VOICE_PRESETS, VOICE_SAMPLE, VOICE_STYLES, useVoiceStore } from './voiceStore';

describe('teacher voice', () => {
  it('is off by default with the cheerful style', () => {
    expect(useVoiceStore.getState().enabled).toBe(false);
    expect(useVoiceStore.getState().style).toBe('vui');
    expect(VOICE_STYLES).toEqual(['vui', 'am', 'lanh', 'hai']);
    expect(VOICE_PRESETS.vui.rate).toBeGreaterThan(VOICE_PRESETS.am.rate);
  });

  it('has the agreed sample sentence for previews', () => {
    expect(VOICE_SAMPLE).toContain('Steam Sim Lab');
  });

  it('cleans markdown and math for speech', () => {
    expect(toSpokenText('### Tiêu đề\n**Đậm** và $P = m$')).toBe('Tiêu đề\nĐậm và P = m');
    expect(toSpokenText('```python\nprint(1)\n```')).toContain('đoạn mã');
    expect(toSpokenText('Xem [hình](http://x) nhé')).toBe('Xem hình nhé');
    expect(toSpokenText('- một\n- hai')).toBe('một\nhai');
  });

  it('escapes nothing audible and caps very long answers', () => {
    const long = 'a'.repeat(5000);
    expect(toSpokenText(long).length).toBeLessThanOrEqual(1500);
    expect(toSpokenText('<script>alert(1)</script>')).not.toContain('<script>');
  });
});
