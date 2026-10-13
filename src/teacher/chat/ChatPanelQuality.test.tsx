import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useAiStore } from '@/ai/aiStore';
import { setTransportForTests, type LlmTransport } from '@/ai/transport';
import type { ChatRequest } from '@/ai/types';
import { ChatPanel } from './ChatPanel';
import { useChatStore } from './chatStore';

// The AI is a scripted fake: these tests check what the chat screen shows, not a real model.
let calls: ChatRequest[];
let hang: boolean;
let reply: string;
let aborted: boolean;

const fake: LlmTransport = {
  chat: (req, signal) => {
    calls.push(req);
    if (!hang) return Promise.resolve({ content: reply, model: 'gemini-model', durationMs: 1 });
    return new Promise((_, reject) => {
      signal?.addEventListener('abort', () => {
        aborted = true;
        reject(new DOMException('aborted', 'AbortError'));
      });
    });
  },
  models: () => Promise.resolve([]),
  setKey: () => Promise.resolve(),
  hasKey: () => Promise.resolve(true),
  deleteKey: () => Promise.resolve(),
};

describe('AI Teacher chat: stop, missing data, unverified numbers', () => {
  beforeEach(() => {
    calls = [];
    hang = false;
    reply = 'Trả lời';
    aborted = false;
    setTransportForTests(fake);
    useAiStore.setState({ provider: 'gemini', status: 'ok' });
    useChatStore.setState({
      engine: 'cloud',
      engineChosen: true,
      messages: [],
      summary: null,
      thinkEnabled: false,
      answering: false,
      stopAnswer: null,
      stopped: false,
    });
  });
  afterEach(() => {
    setTransportForTests(null);
  });

  it('"Dừng" stops the answer being written and the chat stays usable', async () => {
    const user = userEvent.setup();
    hang = true;
    render(<ChatPanel teacherPage showScreenContext={false} />);
    await user.type(screen.getByRole('textbox', { name: 'Nhập câu hỏi' }), 'Lực là gì?{Enter}');
    const stop = await screen.findByRole('button', { name: 'Dừng câu trả lời đang viết' });
    expect(screen.queryByRole('button', { name: 'Gửi câu hỏi' })).not.toBeInTheDocument();
    await user.click(stop);
    expect(
      await screen.findByText('Đã dừng câu trả lời. Em có thể hỏi lại hoặc hỏi câu khác.'),
    ).toBeInTheDocument();
    expect(aborted).toBe(true);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    // Only the question stays: a stopped answer leaves no message.
    expect(useChatStore.getState().messages.map((m) => m.role)).toEqual(['user']);
    expect(useChatStore.getState().stopAnswer).toBeNull();

    hang = false;
    await user.type(screen.getByRole('textbox', { name: 'Nhập câu hỏi' }), 'Còn lực ma sát?');
    await user.click(screen.getByRole('button', { name: 'Gửi câu hỏi' }));
    await waitFor(() => {
      expect(useChatStore.getState().messages.at(-1)?.content).toBe('Trả lời');
    });
    expect(
      screen.queryByText('Đã dừng câu trả lời. Em có thể hỏi lại hoặc hỏi câu khác.'),
    ).not.toBeInTheDocument();
  });

  it('a problem without numbers gets the app notice, invented numbers get the chip', async () => {
    const user = userEvent.setup();
    reply = 'Nếu xe chạy 60 km/h trong 1 giờ thì đi được khoảng 50 km.';
    render(<ChatPanel teacherPage showScreenContext={false} />);
    await user.type(
      screen.getByRole('textbox', { name: 'Nhập câu hỏi' }),
      'Tính quãng đường ô tô đi được.{Enter}',
    );
    expect(await screen.findByText('SimLab nhắc (không phải AI)')).toBeInTheDocument();
    expect(screen.getByText(/Đề bài chưa có số liệu nào nên chưa giải được/)).toBeInTheDocument();
    expect(
      screen.getByText('Số do AI tự đưa ra (chưa kiểm chứng): 60 km/h, 1 giờ, 50 km'),
    ).toBeInTheDocument();
    // The prompt told the AI to ask for the data instead of assuming it.
    expect(calls[0]?.system).toContain('ĐỀ CHƯA CÓ SỐ LIỆU');
    const stored = useChatStore.getState().messages.at(-1);
    expect(stored).toMatchObject({
      missingData: true,
      unverifiedNumbers: ['60 km/h', '1 giờ', '50 km'],
    });
  });

  it('an answer that only restates the given data shows no chip and no notice', async () => {
    const user = userEvent.setup();
    reply = 'Cho m = 2 kg, F = 10 N. Theo định luật II Newton, a = F/m.';
    render(<ChatPanel teacherPage showScreenContext={false} />);
    await user.type(
      screen.getByRole('textbox', { name: 'Nhập câu hỏi' }),
      'Vật 2 kg chịu lực 10 N. Tính gia tốc.{Enter}',
    );
    await waitFor(() => {
      expect(useChatStore.getState().messages).toHaveLength(2);
    });
    expect(screen.queryByText(/chưa kiểm chứng/)).not.toBeInTheDocument();
    expect(screen.queryByText('SimLab nhắc (không phải AI)')).not.toBeInTheDocument();
  });
});
