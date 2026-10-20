import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLayoutStore } from '@/app/layout/layoutStore';
import { useNavigationStore } from '@/app/navigationStore';
import { FileMenu } from '@/app/project/FileMenu';
import { SettingsDialog } from '@/app/settings/SettingsDialog';
import { useSimStore } from '@/app/sim/simStore';
import { useWorkspaceStore } from '@/app/workspaceStore';
import { useModuleStore } from '@/modules/moduleStore';
import type { PhysicsScene } from '@/physics/types';
import { formatReleaseDate } from './format';
import { compareVersions } from './version';
import { WHATSNEW_KEY } from './rules';
import { WhatsNewDialog } from './WhatsNewDialog';
import {
  initWhatsNew,
  loadReleaseNotes,
  resetWhatsNewForTests,
  tryAutoShow,
  useWhatsNewStartup,
  useWhatsNewStore,
} from './whatsNewStore';

const L = (vi: string) => ({ vi, en: `${vi} (en)` });

/** A complete versions.json entry (the loader validates the whole schema). */
function fixtureEntry(
  version: string,
  { notesReady = true, status = 'released', released = '2026-10-13T14:50:00Z' } = {},
) {
  const isReleased = status === 'released';
  return {
    version,
    status,
    statusNote: isReleased ? null : 'Chưa phát hành.',
    channel: 'github',
    dates: {
      devStart: null,
      firstCommit: null,
      lastCommit: null,
      merged: null,
      built: null,
      released: isReleased ? released : null,
      tagged: null,
    },
    evidence: ['test fixture'],
    tests: [],
    refs: {
      tag: isReleased ? `v${version}` : null,
      tagSha: null,
      releaseUrl: isReleased ? `https://github.com/o/r/releases/tag/v${version}` : null,
      prs: [],
      commits: [],
      branches: [],
    },
    publicNotes: {
      summary: L(`Tóm tắt ${version}`),
      added: [L(`Tính năng ${version}`)],
      improved: [L(`Cải tiến ${version}`)],
      fixed: [L(`Sửa lỗi ${version}`)],
      security: [],
      performance: [],
      changed: [],
      deprecated: [],
      knownIssues: [],
    },
    notesReady,
    learnerHighlights: [{ area: 'teacher', ...L(`Nổi bật ${version}`) }],
  };
}

const FIXTURE = {
  schemaVersion: 1,
  product: 'SimLab',
  repository: 'https://github.com/o/r',
  evidenceCheckedAt: '2026-10-14',
  overview: ['Tổng quan.'],
  milestones: [],
  openQuestions: [],
  versions: [
    fixtureEntry('0.6.0', { status: 'in-review' }),
    fixtureEntry('0.5.2'),
    fixtureEntry('0.5.1', { notesReady: false, status: 'merged-not-released' }),
    fixtureEntry('0.5.0', { released: '2026-10-13T02:39:36Z' }),
  ],
};

const loader = vi.fn(() => Promise.resolve<unknown>(FIXTURE));
/** Settings → Lịch sử phiên bản, under the version the app is running. */
const CURRENT_HINT =
  'Bạn đang dùng bản này. Ngày phát hành của một bản chỉ được ghi vào lịch sử ở các bản sau.';
const stored = () => JSON.parse(localStorage.getItem(WHATSNEW_KEY) ?? 'null') as unknown;

/** A user who used the app before, last saw `lastSeen`, now runs 0.6.0. */
async function startAfterUpdate(record: Record<string, string> | null) {
  localStorage.setItem('stemsim.tourDone', '1');
  if (record) localStorage.setItem(WHATSNEW_KEY, JSON.stringify(record));
  await act(() => initWhatsNew());
}

/** Closing the app and opening it again (same storage). */
async function restart() {
  resetWhatsNewForTests(loader);
  useWhatsNewStore.setState({ current: '0.6.0' });
  await act(() => initWhatsNew());
}

const calm = () => true;

describe('the "SimLab đã được cập nhật" box after an update', () => {
  beforeEach(() => {
    loader.mockClear();
    resetWhatsNewForTests(loader);
    useWhatsNewStore.setState({ current: '0.6.0' });
    useNavigationStore.setState({ screen: 'home', previousScreen: null });
    useWorkspaceStore.setState({ settingsOpen: false, settingsSection: 'appearance' });
  });
  afterEach(() => {
    resetWhatsNewForTests();
  });

  it('a new version shows once: "Đóng" records it and the next start shows nothing', async () => {
    const user = userEvent.setup();
    render(<WhatsNewDialog />);
    await startAfterUpdate({ lastSeen: '0.5.2' });
    act(() => {
      tryAutoShow(calm);
    });
    expect(screen.getByRole('heading', { name: 'SimLab đã được cập nhật' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Phiên bản 0.6.0' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Phiên bản 0.5.2' })).not.toBeInTheDocument();
    // Grouped notes of the newest version.
    for (const group of ['Tính năng mới', 'Cải tiến', 'Sửa lỗi']) {
      expect(screen.getByRole('heading', { name: group, level: 4 })).toBeInTheDocument();
    }

    await user.click(screen.getByRole('button', { name: 'Đóng' }));
    expect(stored()).toEqual({ lastSeen: '0.6.0' });
    expect(useWhatsNewStore.getState()).toMatchObject({ open: false, pending: [] });

    loader.mockClear();
    await restart();
    expect(useWhatsNewStore.getState()).toMatchObject({ pending: [], waiting: false });
    // The same version again: nothing is even loaded.
    expect(loader).not.toHaveBeenCalled();
  });

  it('a multi-version upgrade lists each version with ready notes and only real dates', async () => {
    render(<WhatsNewDialog />);
    await startAfterUpdate({ lastSeen: '0.4.1' });
    act(() => {
      tryAutoShow(calm);
    });
    const headings = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    // 0.5.1 has no reviewed notes, so it is not listed.
    expect(headings).toEqual(['Phiên bản 0.6.0', 'Phiên bản 0.5.2', 'Phiên bản 0.5.0']);
    const v060 = screen.getByRole('region', { name: 'Phiên bản 0.6.0' });
    expect(within(v060).getByText('Ngày phát hành: chưa xác minh')).toBeInTheDocument();
    const v052 = screen.getByRole('region', { name: 'Phiên bản 0.5.2' });
    expect(within(v052).getByText('Ngày phát hành: 13/10/2026')).toBeInTheDocument();
    expect(within(v052).getByText('Nổi bật 0.5.2')).toBeInTheDocument();
  });

  it('"Để sau": not shown by itself again, but "Có gì mới" stays in the ☰ menu', async () => {
    const user = userEvent.setup();
    render(
      <>
        <FileMenu />
        <WhatsNewDialog />
      </>,
    );
    await startAfterUpdate({ lastSeen: '0.5.2' });
    act(() => {
      tryAutoShow(calm);
    });
    await user.click(screen.getByRole('button', { name: 'Để sau' }));
    expect(stored()).toEqual({ lastSeen: '0.5.2', snoozed: '0.6.0' });
    expect(useWhatsNewStore.getState().open).toBe(false);

    // The menu button carries the mark and the entry until the notes are opened.
    const menuButton = screen.getByRole('button', { name: 'Tệp (có điểm mới trong SimLab)' });
    await user.click(menuButton);
    await user.click(screen.getByRole('menuitem', { name: 'Có gì mới' }));
    expect(useWhatsNewStore.getState().open).toBe(true);
    expect(screen.getByRole('heading', { name: 'Phiên bản 0.6.0' })).toBeInTheDocument();

    // Next start of the same version: still reachable, never opened by itself.
    await restart();
    expect(useWhatsNewStore.getState().pending.map((v) => v.version)).toEqual(['0.6.0']);
    expect(useWhatsNewStore.getState().waiting).toBe(false);
    expect(tryAutoShow(calm)).toBe(false);
  });

  it('"Xem chi tiết" records the version and opens Settings → Lịch sử phiên bản', async () => {
    const user = userEvent.setup();
    render(<WhatsNewDialog />);
    await startAfterUpdate({ lastSeen: '0.5.2' });
    act(() => {
      tryAutoShow(calm);
    });
    await user.click(screen.getByRole('button', { name: 'Xem chi tiết' }));
    expect(stored()).toEqual({ lastSeen: '0.6.0' });
    expect(useWorkspaceStore.getState()).toMatchObject({
      settingsOpen: true,
      settingsSection: 'versions',
    });
  });

  it('Esc closes the box like "Đóng"', async () => {
    const { container } = render(<WhatsNewDialog />);
    await startAfterUpdate({ lastSeen: '0.5.2' });
    act(() => {
      tryAutoShow(calm);
    });
    const dialog = container.querySelector('dialog')!;
    act(() => {
      fireEvent(dialog, new Event('cancel', { cancelable: true }));
    });
    expect(stored()).toEqual({ lastSeen: '0.6.0' });
    expect(useWhatsNewStore.getState().open).toBe(false);
  });

  it('a fresh install records the version silently', async () => {
    await act(() => initWhatsNew());
    expect(stored()).toEqual({ lastSeen: '0.6.0' });
    expect(useWhatsNewStore.getState()).toMatchObject({ pending: [], waiting: false, open: false });
  });

  it('missing or invalid notes: no box and no crash', async () => {
    resetWhatsNewForTests(() => Promise.resolve({ versions: 'broken' }));
    useWhatsNewStore.setState({ current: '0.6.0' });
    await startAfterUpdate({ lastSeen: '0.5.2' });
    expect(useWhatsNewStore.getState()).toMatchObject({ pending: [], loadState: 'error' });
    expect(tryAutoShow(calm)).toBe(false);

    resetWhatsNewForTests(() => Promise.reject(new Error('chunk failed')));
    useWhatsNewStore.setState({ current: '0.6.0' });
    await act(() => initWhatsNew());
    expect(useWhatsNewStore.getState()).toMatchObject({ pending: [], loadState: 'error' });
    // Nothing was recorded, so fixed notes can still be shown later.
    expect(stored()).toEqual({ lastSeen: '0.5.2' });
  });

  it('never opens during a lesson, a simulation, presentation or another dialog', async () => {
    await startAfterUpdate({ lastSeen: '0.5.2' });
    expect(useWhatsNewStore.getState().waiting).toBe(true);

    act(() => {
      useNavigationStore.setState({ screen: 'teacher' });
    });
    expect(tryAutoShow()).toBe(false);

    act(() => {
      useNavigationStore.setState({ screen: 'lab' });
      useSimStore.setState({ scene: { id: 'projectile' } as unknown as PhysicsScene });
    });
    expect(tryAutoShow()).toBe(false);
    act(() => {
      useSimStore.setState({ scene: null });
      useModuleStore.setState({ loading: true });
    });
    expect(tryAutoShow()).toBe(false);
    act(() => {
      useModuleStore.setState({ loading: false });
      useNavigationStore.setState({ screen: 'home' });
      useLayoutStore.setState({ presentation: true });
    });
    expect(tryAutoShow()).toBe(false);
    act(() => {
      useLayoutStore.setState({ presentation: false });
    });

    const other = document.createElement('dialog');
    other.setAttribute('open', '');
    document.body.append(other);
    expect(tryAutoShow()).toBe(false);
    other.remove();

    // Back on the launch page with nothing open: now it may appear.
    expect(tryAutoShow()).toBe(true);
    expect(useWhatsNewStore.getState().open).toBe(true);
  });

  it('opens by itself at start-up once the launch page is calm', async () => {
    localStorage.setItem('stemsim.tourDone', '1');
    localStorage.setItem(WHATSNEW_KEY, JSON.stringify({ lastSeen: '0.5.2' }));
    function Host() {
      useWhatsNewStartup(10);
      return <WhatsNewDialog />;
    }
    render(<Host />);
    await waitFor(() => {
      expect(useWhatsNewStore.getState().open).toBe(true);
    });
    expect(screen.getByRole('heading', { name: 'SimLab đã được cập nhật' })).toBeInTheDocument();
  });
});

describe('Settings → Lịch sử phiên bản', () => {
  beforeEach(() => {
    resetWhatsNewForTests(loader);
    useWhatsNewStore.setState({ current: '0.6.0' });
    useWorkspaceStore.setState({ settingsOpen: true, settingsSection: 'appearance' });
  });
  afterEach(() => {
    resetWhatsNewForTests();
  });

  it('opens from Settings and lists every version newest first with its status', async () => {
    const user = userEvent.setup();
    render(
      <SettingsDialog
        open
        onClose={() => {
          useWorkspaceStore.getState().setSettingsOpen(false);
        }}
      />,
    );
    await user.click(screen.getByRole('tab', { name: 'Lịch sử phiên bản' }));
    const list = await screen.findByRole('list', { name: 'Các phiên bản, mới nhất ở trên' });
    const items = Array.from(list.children) as HTMLElement[];
    expect(items.map((li) => li.querySelector('.version-history__version')?.textContent)).toEqual([
      'Phiên bản 0.6.0',
      'Phiên bản 0.5.2',
      'Phiên bản 0.5.1',
      'Phiên bản 0.5.0',
    ]);
    // The running version gets a neutral label, never a status its own bundle cannot know.
    expect(within(items[0]!).getByText('Bản đang dùng')).toBeInTheDocument();
    expect(within(items[0]!).getByText(CURRENT_HINT)).toBeInTheDocument();
    expect(within(items[0]!).queryByText('Đang xét duyệt')).not.toBeInTheDocument();
    expect(
      within(items[0]!).queryByText('Phiên bản này đang được xét duyệt, chưa phát hành.'),
    ).not.toBeInTheDocument();
    expect(within(items[1]!).getByText('Đã phát hành')).toBeInTheDocument();
    expect(within(items[2]!).getByText('Chưa phát hành riêng')).toBeInTheDocument();
    expect(
      within(items[2]!).getByText(/^Phiên bản này không có bản phát hành riêng/),
    ).toBeInTheDocument();
    expect(within(items[2]!).queryByText(CURRENT_HINT)).not.toBeInTheDocument();
    expect(
      within(items[2]!).getByText('Ghi chú này là bản nháp, chưa được duyệt để công bố.'),
    ).toBeInTheDocument();
    // Notes are folded under each version; the newest is open.
    expect(items[0]!.querySelector('details')).toHaveAttribute('open');
    expect(items[1]!.querySelector('details')).not.toHaveAttribute('open');
  });

  it('a released app never calls its own version unreleased or in review', async () => {
    // release-notes/README.md: after the merge the bundled entry says "merged-not-released";
    // "released" can only be written after the GitHub Release exists, i.e. in a later version.
    const merged = {
      ...FIXTURE,
      versions: [fixtureEntry('0.6.0', { status: 'merged-not-released' }), fixtureEntry('0.5.2')],
    };
    resetWhatsNewForTests(() => Promise.resolve(merged));
    useWhatsNewStore.setState({ current: '0.6.0' });
    useWorkspaceStore.setState({ settingsSection: 'versions' });
    const view = render(<SettingsDialog open onClose={() => undefined} />);
    let items = Array.from(
      (await screen.findByRole('list', { name: 'Các phiên bản, mới nhất ở trên' })).children,
    ) as HTMLElement[];
    expect(within(items[0]!).getByText('Bản đang dùng')).toBeInTheDocument();
    expect(within(items[0]!).getByText(CURRENT_HINT)).toBeInTheDocument();
    expect(within(items[0]!).queryByText('Chưa phát hành riêng')).not.toBeInTheDocument();
    expect(
      within(items[0]!).queryByText(/^Phiên bản này không có bản phát hành riêng/),
    ).not.toBeInTheDocument();
    view.unmount();

    // Running an older, really released version: its status and date are shown as usual.
    resetWhatsNewForTests(() => Promise.resolve(merged));
    useWhatsNewStore.setState({ current: '0.5.2' });
    render(<SettingsDialog open onClose={() => undefined} />);
    items = Array.from(
      (await screen.findByRole('list', { name: 'Các phiên bản, mới nhất ở trên' })).children,
    ) as HTMLElement[];
    expect(within(items[0]!).getByText('Chưa phát hành riêng')).toBeInTheDocument();
    expect(within(items[0]!).queryByText(CURRENT_HINT)).not.toBeInTheDocument();
    expect(within(items[1]!).getByText('Bản đang dùng')).toBeInTheDocument();
    expect(within(items[1]!).getByText('Đã phát hành')).toBeInTheDocument();
    expect(within(items[1]!).getByText('Ngày phát hành: 13/10/2026')).toBeInTheDocument();
    expect(within(items[1]!).queryByText(CURRENT_HINT)).not.toBeInTheDocument();
  });

  it('says so plainly when the history cannot be read', async () => {
    resetWhatsNewForTests(() => Promise.resolve(null));
    useWorkspaceStore.setState({ settingsSection: 'versions' });
    render(<SettingsDialog open onClose={() => undefined} />);
    expect(await screen.findByText(/Chưa đọc được lịch sử phiên bản/)).toBeInTheDocument();
  });
});

describe('bundled release notes', () => {
  afterEach(() => {
    resetWhatsNewForTests();
  });

  it('match the running version and drive the box from the real data', async () => {
    resetWhatsNewForTests();
    const notes = await loadReleaseNotes();
    expect(notes).not.toBeNull();
    expect(useWhatsNewStore.getState().loadState).toBe('ready');
    expect(notes!.versions[0]!.version).toBe(__APP_VERSION__);

    // An upgrade from 0.4.1 lists exactly the reviewed versions after it.
    await startAfterUpdate({ lastSeen: '0.4.1' });
    const expected = notes!.versions
      .filter((v) => v.notesReady && compareVersions(v.version, '0.4.1') > 0)
      .map((v) => v.version);
    expect(useWhatsNewStore.getState().pending.map((v) => v.version)).toEqual(expected);
  });

  it('show dates as a day in Vietnam', () => {
    expect(formatReleaseDate('2026-10-13T14:50:00Z', 'vi')).toBe('13/10/2026');
    expect(formatReleaseDate('2026-10-13T19:05:41Z', 'vi')).toBe('14/10/2026');
    expect(formatReleaseDate('2026-10-09', 'en')).toBe('09/10/2026');
    expect(formatReleaseDate('not a date', 'vi')).toBe('not a date');
  });
});
