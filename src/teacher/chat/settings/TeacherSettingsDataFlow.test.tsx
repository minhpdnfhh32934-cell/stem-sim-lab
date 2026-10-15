import { render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useAiStore } from '@/ai/aiStore';
import { useLocalAiStore } from '@/ai/local/localAiStore';
import { setTransportForTests, type LlmTransport } from '@/ai/transport';
import { useVoiceStore } from '@/teacher/voice/voiceStore';
import { useChatStore } from '../chatStore';
import { TeacherSettings } from './TeacherSettings';

const fake: LlmTransport = {
  chat: () => Promise.reject(new Error('no call expected')),
  models: () => Promise.resolve([]),
  setKey: () => Promise.resolve(),
  hasKey: () => Promise.resolve(false),
  deleteKey: () => Promise.resolve(),
};

/** The two columns of "Dữ liệu của em đi đâu?". */
function flow() {
  const box = screen.getByRole('region', { name: 'Dữ liệu của em đi đâu?' });
  const [kept, sent] = within(box).getAllByRole('list');
  if (!kept || !sent) throw new Error('flow lists missing');
  return {
    kept: within(kept)
      .getAllByRole('listitem')
      .map((li) => li.textContent),
    sent: within(sent)
      .getAllByRole('listitem')
      .map((li) => li.textContent),
  };
}

describe('"Dữ liệu của em đi đâu?" with the AI on this computer', () => {
  beforeEach(() => {
    setTransportForTests(fake);
    useAiStore.setState({ provider: 'gemini' });
    useVoiceStore.setState({ enabled: false });
    useChatStore.setState({
      engine: 'local',
      engineChosen: true,
      thinkEnabled: false,
      webLookup: false,
      verifierProvider: 'claude',
    });
    useLocalAiStore.setState({
      selected: {
        kind: 'lmStudio',
        baseUrl: 'http://127.0.0.1:1234',
        model: 'qwen2.5-7b',
        label: 'LM Studio · qwen2.5-7b',
      },
    });
  });
  afterEach(() => {
    setTransportForTests(null);
    useLocalAiStore.setState({ selected: null });
  });

  it('lists nothing sent online while Think and Wikipedia are off, and names the program', () => {
    render(<TeacherSettings />);
    const { kept, sent } = flow();
    expect(sent).toEqual([
      'Không có gì được gửi lên mạng khi em hỏi AI Teacher (Think và tra Wikipedia đang tắt).',
    ]);
    expect(kept).toContain(
      'Khi dùng AI trên máy khác (LM Studio, 127.0.0.1:1234): câu hỏi chỉ đi tới chương trình đó trên máy này.',
    );
    // No line about the API answering, photos or downloads.
    expect(sent.join(' ')).not.toMatch(/Gemini|HuggingFace|ảnh/);
  });

  it('with Think or Wikipedia on, says exactly what is sent and where', () => {
    useChatStore.setState({ thinkEnabled: true, webLookup: true });
    render(<TeacherSettings />);
    const { sent } = flow();
    expect(sent).toHaveLength(2);
    expect(sent[0]).toMatch(
      /^Think đang bật: câu hỏi, bản nháp của AI trên máy, trích đoạn tài liệu liên quan, tóm tắt phần trò chuyện cũ \(nếu có\) và ngữ cảnh màn hình \(nếu em bật\) → Claude để rà soát\. Không gửi tới nhà cung cấp dự phòng\.$/,
    );
    expect(sent[1]).toBe('Tra Wikipedia đang bật: câu hỏi → Wikipedia.');
  });

  it('chosen but no program picked yet: still nothing online', () => {
    useLocalAiStore.setState({ selected: null });
    render(<TeacherSettings />);
    const { kept, sent } = flow();
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatch(/^Không có gì được gửi lên mạng/);
    expect(kept.some((k) => k.includes('(chưa chọn)'))).toBe(true);
  });
});
