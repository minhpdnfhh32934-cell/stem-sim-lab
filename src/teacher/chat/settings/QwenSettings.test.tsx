import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useBuiltinStore } from '@/ai/builtin/builtinStore';
import { setBuiltinClientForTests, type BuiltinClient } from '@/ai/builtin/client';
import { BUILTIN_SELECTION, type BuiltinStatus } from '@/ai/builtin/types';
import { useLocalAiStore } from '@/ai/local/localAiStore';
import { AiError } from '@/ai/types';
import { translate } from '@/app/i18n';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { useChatStore } from '../chatStore';
import { QwenSettings } from './QwenSettings';

/** Rust's `builtin_ai_*` commands are a scripted fake: no model, card or server is touched. */
const client = {
  status: vi.fn<BuiltinClient['status']>(),
  download: vi.fn<BuiltinClient['download']>(),
  cancel: vi.fn<BuiltinClient['cancel']>(),
  remove: vi.fn<BuiltinClient['remove']>(),
  start: vi.fn<BuiltinClient['start']>(),
  stop: vi.fn<BuiltinClient['stop']>(),
  enable: vi.fn<BuiltinClient['enable']>(),
};

const SIZE = 5_627_044_256;
const base: BuiltinStatus = {
  supported: true,
  runtime: true,
  card: { name: 'NVIDIA GeForce RTX 4080', dedicatedMb: 16_376 },
  ineligible: null,
  model: { state: 'missing' },
  size: SIZE,
  freeBytes: 200_000_000_000,
  downloading: false,
  server: 'stopped',
  gpuFault: false,
};
const tv = (key: Parameters<typeof translate>[1], params?: Record<string, string>) =>
  translate('vi', key, params);

function show(status: BuiltinStatus) {
  client.status.mockResolvedValue(status);
  return render(<QwenSettings />);
}

beforeEach(() => {
  for (const fn of Object.values(client)) fn.mockReset();
  for (const fn of [
    client.download,
    client.cancel,
    client.remove,
    client.start,
    client.stop,
    client.enable,
  ]) {
    fn.mockResolvedValue();
  }
  setBuiltinClientForTests(client);
  useSettingsStore.setState({ locale: 'vi' });
  useBuiltinStore.setState({
    status: null,
    statusError: null,
    progress: null,
    busy: null,
    error: null,
  });
  useLocalAiStore.setState({ selected: null, checks: {}, userEndpoints: [] });
  useChatStore.setState({ engine: 'gemma', engineChosen: false });
});
afterEach(() => {
  setBuiltinClientForTests(null);
});

describe('the Qwen card (Settings → Gemma cục bộ, #190)', () => {
  it('names the size, what the computer needs and the terms before the download', async () => {
    show(base);
    expect(
      await screen.findByText(tv('builtinAi.size', { size: '5,63 GB', free: '200,00 GB' })),
    ).toBeVisible();
    expect(
      screen.getByText(tv('builtinAi.needsHere', { name: 'NVIDIA GeForce RTX 4080', gb: '16' })),
    ).toBeVisible();
    expect(screen.getByText(tv('builtinAi.terms'))).toBeVisible();
    for (const name of ['openModel', 'openApache', 'openLlama'] as const) {
      expect(screen.getByRole('link', { name: tv(`builtinAi.${name}`) })).toBeVisible();
    }
    expect(screen.getByRole('button', { name: tv('builtinAi.download') })).toBeEnabled();
    expect(screen.queryByRole('button', { name: tv('builtinAi.use') })).toBeNull();
  });

  it.each([
    [
      { ...base, card: null, ineligible: { reason: 'noDiscrete' as const } },
      tv('builtinAi.ineligible.noDiscrete'),
    ],
    [
      {
        ...base,
        card: null,
        ineligible: { reason: 'tooSmall' as const, name: 'RTX 3050', dedicatedMb: 4096 },
      },
      tv('builtinAi.ineligible.tooSmall', { name: 'RTX 3050', gb: '4' }),
    ],
    [{ ...base, runtime: false, card: null }, tv('builtinAi.noRuntime')],
    [{ ...base, supported: false, runtime: false, card: null }, tv('builtinAi.notDesktop')],
  ])(
    'a computer that cannot run it is told why, and nothing can be downloaded or run',
    async (status, text) => {
      show(status);
      expect(await screen.findByText(text)).toBeVisible();
      expect(screen.queryByRole('button', { name: tv('builtinAi.download') })).toBeNull();
      expect(screen.queryByRole('button', { name: tv('builtinAi.use') })).toBeNull();
    },
  );

  it('downloads with progress and time left, can be cancelled, and resumes a partial file', async () => {
    let report: (n: number) => void = () => undefined;
    let finish: () => void = () => undefined;
    client.download.mockImplementation((onBytes) => {
      report = onBytes;
      return new Promise<void>((done) => {
        finish = done;
      });
    });
    show(base);
    await userEvent.click(await screen.findByRole('button', { name: tv('builtinAi.download') }));
    report(SIZE / 4);
    expect(await screen.findByText(/Đang tải Qwen · 25%/)).toBeVisible();
    expect(screen.getByRole('progressbar')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: tv('builtinAi.cancel') }));
    expect(client.cancel).toHaveBeenCalledTimes(1);
    client.status.mockResolvedValue({ ...base, model: { state: 'partial', bytes: SIZE / 4 } });
    finish();
    expect(
      await screen.findByRole('button', {
        name: tv('builtinAi.resume', { done: '1,41 GB', size: '5,63 GB' }),
      }),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: tv('builtinAi.remove') })).toBeVisible();
  });

  it('a failed download says why in plain words', async () => {
    client.download.mockRejectedValue(
      new AiError(
        'unavailable',
        'builtin-download: {"kind":"noSpace","need":6700000000,"free":1000000000}',
      ),
    );
    show(base);
    await userEvent.click(await screen.findByRole('button', { name: tv('builtinAi.download') }));
    expect(
      await screen.findByText(
        tv('builtinAi.downloadError.noSpace', { need: '6,70 GB', free: '1,00 GB' }),
      ),
    ).toBeVisible();
  });

  it('a downloaded model is chosen for AI Teacher (the local engine), loaded, freed and unselected', async () => {
    show({ ...base, model: { state: 'ready' } });
    await userEvent.click(await screen.findByRole('button', { name: tv('builtinAi.use') }));
    expect(useLocalAiStore.getState().selected).toEqual(BUILTIN_SELECTION);
    expect(useChatStore.getState().engine).toBe('local');
    expect(client.start).toHaveBeenCalledTimes(1);
    client.status.mockResolvedValue({ ...base, model: { state: 'ready' }, server: 'running' });
    await useBuiltinStore.getState().refresh();
    expect(
      await screen.findByText(tv('builtinAi.running', { name: 'NVIDIA GeForce RTX 4080' })),
    ).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: tv('builtinAi.stop') }));
    expect(client.stop).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: tv('builtinAi.unselect') }));
    expect(useLocalAiStore.getState().selected).toBeNull();
    expect(useChatStore.getState().engine).not.toBe('local');
  });

  it('after a card fault Qwen stays off until "Bật lại"', async () => {
    show({ ...base, model: { state: 'ready' }, gpuFault: true });
    expect(await screen.findByText(tv('builtinAi.gpuFault'))).toBeVisible();
    expect(screen.queryByRole('button', { name: tv('builtinAi.use') })).toBeNull();
    client.status.mockResolvedValue({ ...base, model: { state: 'ready' } });
    await userEvent.click(screen.getByRole('button', { name: tv('builtinAi.enable') }));
    expect(client.enable).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: tv('builtinAi.use') })).toBeVisible();
    });
  });

  it('an older desktop app without the commands shows no Qwen card', async () => {
    client.status.mockRejectedValue(new AiError('unavailable', 'needs-app-update'));
    const { container } = render(<QwenSettings />);
    await waitFor(() => {
      expect(useBuiltinStore.getState().statusError).toBe('needs-app-update');
    });
    expect(container).toBeEmptyDOMElement();
  });

  it('deleting the chosen model also unselects it, so nothing is sent', async () => {
    useLocalAiStore.getState().select(BUILTIN_SELECTION);
    useChatStore.getState().setEngine('local');
    show({ ...base, model: { state: 'ready' } });
    client.status.mockResolvedValue(base);
    await userEvent.click(await screen.findByRole('button', { name: tv('builtinAi.remove') }));
    expect(client.remove).toHaveBeenCalledTimes(1);
    expect(useLocalAiStore.getState().selected).toBeNull();
    expect(useChatStore.getState().engine).not.toBe('local');
  });
});
