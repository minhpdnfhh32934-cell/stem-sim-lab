import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { useWorkspaceStore } from '@/app/workspaceStore';
import { loadModule } from '@/modules/registry';
import { ScienceCard } from '@/science-card/ScienceCard';
import type { StudioScenario } from '../scenario';
import StudioScreen from '../StudioScreen';
import { useStudioStore } from '../studioStore';
import { knttLesson } from './card';
import { guidedOf, orderAnswers, readSheet, withSheet, type Sheet } from './check';
import { guidedFor, guidedForTopic } from './lessons';
import type { GuidedActivity } from './schema';
import { GUIDED_TOPICS } from './topics';

beforeEach(() => {
  useSettingsStore.setState({ locale: 'vi', uiMode: 'basic' });
  useStudioStore.setState({ tab: 'biology', sessions: {}, picked: {} });
  useWorkspaceStore.setState({ scienceCard: null });
});

function lesson(topic: string): StudioScenario {
  const s = guidedForTopic(topic);
  if (!s) throw new Error(topic);
  return s;
}

const next = () => screen.getByRole('button', { name: /^Tiếp:/ });

/** What a reader sees or hears: the text and every accessible name given by an attribute. */
function spoken(root: HTMLElement): string {
  const names = [...root.querySelectorAll('[aria-label], [title], [alt]')].map((el) =>
    ['aria-label', 'title', 'alt'].map((a) => el.getAttribute(a) ?? '').join(' '),
  );
  return [root.textContent, ...names].join(' ');
}

type User = ReturnType<typeof userEvent.setup>;

/** Answers one activity the way a learner does, with the lesson's own key. */
async function solve(user: User, a: GuidedActivity) {
  const box = screen.getByRole('region', { name: new RegExp(a.prompt.vi.slice(0, 30)) });
  if (a.kind === 'order') {
    for (const [i, item] of a.items.entries()) {
      const rows = () =>
        [...box.querySelectorAll('li[data-row]')].map((li) => li.getAttribute('data-row'));
      while (rows().indexOf(item.id) > i) {
        await user.click(within(box).getByRole('button', { name: `Đưa lên: ${item.text.vi}` }));
      }
    }
  } else if (a.kind === 'match') {
    for (const p of a.pairs) {
      await user.selectOptions(within(box).getByLabelText(p.left.vi), p.right.vi);
    }
  } else {
    for (const item of a.items) {
      const group = a.groups.find((g) => g.id === item.group);
      const radios = within(box).getByRole('radiogroup', { name: item.text.vi });
      await user.click(within(radios).getByRole('radio', { name: group?.label.vi ?? '' }));
    }
  }
}

describe('guided textbook lessons in the lab library', () => {
  it.each(GUIDED_TOPICS)(
    '%s: title, choices, an honest panel and a qualitative card',
    async (topic) => {
      const s = lesson(topic);
      const b = guidedOf(s);
      if (!b) throw new Error('guided');
      const view = await loadModule(topic);
      expect(view.title).toEqual(s.title);
      const stage = render(<view.Stage />);
      expect(screen.getByRole('heading', { name: s.title.vi })).toBeVisible();
      expect(screen.getAllByRole('radio')).toHaveLength(b.choices.length);
      for (const c of b.choices)
        expect(screen.getByRole('radio', { name: c.text.vi })).toBeEnabled();
      const card = useWorkspaceStore.getState().scienceCard;
      if (!card) throw new Error('card');
      expect(card.confidence).toBe('qualitative');
      expect(card.equations).toEqual([]);
      expect(card.assumptions[0]?.vi).toBe(
        'Bài học mô tả theo sách giáo khoa, bằng lời văn của SimLab: không có thí nghiệm, phép đo hay phép tính.',
      );
      // The model line names only the kinds of activity this lesson has.
      const kinds = new Set(b.activities.map((a) => a.kind));
      for (const [kind, word] of [
        ['order', 'sắp xếp'],
        ['match', 'ghép đôi'],
        ['sort', 'phân loại'],
      ] as const) {
        expect(card.model.vi.includes(word), `${topic} ${kind}`).toBe(kinds.has(kind));
      }
      const l = knttLesson(b.kntt);
      expect(card.sources[0]?.citation).toContain(
        `Bài ${String(l?.number)}. ${l?.title ?? ''}, tr. `,
      );
      expect(stage.container.textContent).not.toMatch(/mô phỏng/i);
      stage.unmount();
      if (!view.Panel) throw new Error('panel');
      const panel = render(<view.Panel />);
      expect(panel.container).toHaveTextContent('Bài học mô tả: không có thí nghiệm hay số đo.');
      expect(panel.container).toHaveTextContent(`Bài ${String(b.kntt.lesson)} “${l?.title ?? ''}”`);
      panel.unmount();
      // The card as the Inspector and Science Studio show it, in both languages.
      for (const [locale, word] of [
        ['vi', /mô phỏng/i],
        ['en', /simulat/i],
      ] as const) {
        act(() => {
          useSettingsStore.setState({ locale });
        });
        const shown = render(<ScienceCard card={card} />);
        expect(spoken(shown.container), `${topic} ${locale}`).not.toMatch(word);
        expect(
          shown.getByRole('article', { name: locale === 'vi' ? 'Thẻ Khoa học' : 'Science Card' }),
        ).toBeInTheDocument();
        shown.unmount();
      }
    },
  );

  it('a whole lesson by hand: predict, every activity, check, answers, explain, conclude, report', async () => {
    const user = userEvent.setup();
    const s = lesson('levelsOfLife');
    const b = guidedOf(s);
    if (!b) throw new Error('guided');
    const view = await loadModule('levelsOfLife');
    const { container } = render(<view.Stage />);

    expect(next()).toBeDisabled();
    await user.click(screen.getByRole('radio', { name: 'Mô' }));
    await user.click(next());
    // The activities give the answer away: back at Predict, the choice can no longer change.
    await user.click(screen.getByRole('button', { name: 'Quay lại' }));
    expect(screen.getByRole('radio', { name: 'Tế bào' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'Mô' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText(/^Dự đoán đã được ghi lại/)).toBeInTheDocument();
    await user.click(next());

    // Activities: "Kiểm tra" waits for a complete sheet.
    const check = screen.getByRole('button', { name: 'Kiểm tra' });
    expect(check).toBeDisabled();
    for (const a of b.activities) await solve(user, a);
    expect(check).toBeEnabled();
    // With the keyboard: the pressed button disables itself, so the focus moves to the result.
    for (let n = 0; n < 20 && document.activeElement !== check; n++) await user.tab();
    expect(check).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(screen.getByText(/^Em đúng 20\/20 ý\./)).toHaveFocus();
    expect(screen.getAllByText('Đúng').length).toBe(20);
    // Each checked control points at its own outcome.
    const pair = b.activities.find((x) => x.kind === 'match')?.pairs[0];
    expect(screen.getByLabelText(pair?.left.vi ?? '')).toHaveAccessibleDescription(/^Đúng/);
    // Changing an answer drops the check; putting it back and checking again restores it.
    const first = b.activities[0];
    if (first?.kind !== 'order') throw new Error('order first');
    const second = first.items[1];
    if (!second) throw new Error('items');
    await user.click(screen.getByRole('button', { name: `Đưa lên: ${second.text.vi}` }));
    expect(next()).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Kiểm tra' }));
    expect(screen.getByText(/^Em đúng 18\/20 ý\./)).toBeInTheDocument();
    expect(screen.getAllByText(/^Chưa đúng\. Đáp án: vị trí/)).toHaveLength(2);
    await user.click(
      screen.getByRole('button', { name: `Đưa lên: ${first.items[0]?.text.vi ?? ''}` }),
    );
    await user.click(screen.getByRole('button', { name: 'Kiểm tra' }));
    await user.click(next());

    // Answers: the prediction's answer and each row's reason; the lab's Inspector has the card.
    expect(screen.getByText('Đáp án: Tế bào')).toBeInTheDocument();
    expect(screen.getByText(/^Em đã chọn: Mô/)).toBeInTheDocument();
    expect(container.querySelector('.science-card')).toBeNull();
    await user.click(next());

    await user.type(
      screen.getByLabelText('Giải thích của em'),
      'Tế bào tự sống được, bào quan thì không.',
    );
    await user.click(next());

    const conclude = container.querySelector('.studio-flow__body');
    expect(conclude).toHaveTextContent('Đáp án của bài học: Tế bào');
    expect(conclude).toHaveTextContent('Dự đoán chưa khớp.');
    await user.type(screen.getByLabelText('Kết luận của em'), 'Tế bào là cấp tổ chức sống cơ bản.');
    expect(container.querySelector('.studio-flow__body')?.textContent).not.toMatch(/mô phỏng/i);
    await user.click(next());

    const report = screen.getByLabelText('Bản xem trước báo cáo').textContent;
    expect(report).toContain('Đáp án và kết quả kiểm tra các hoạt động');
    expect(report).toContain('Đáp án của bài học: Tế bào');
    expect(report).toContain('Đúng 8/8');
    expect(report).toContain('Bài 3. Các cấp độ tổ chức của thế giới sống, tr. 18–22');
    expect(report).not.toMatch(/mô phỏng/i);
    expect(container.querySelector('.studio-flow')).toHaveTextContent(
      'Em đã hoàn thành bài học này.',
    );
  });

  it('the order activity can be finished with Tab, Enter and Space alone; the focus follows the item', async () => {
    const user = userEvent.setup();
    const s = lesson('levelsOfLife');
    const order = guidedOf(s)?.activities[0];
    if (order?.kind !== 'order') throw new Error('order first');
    const view = await loadModule('levelsOfLife');
    render(<view.Stage />);
    await user.click(screen.getByRole('radio', { name: 'Tế bào' }));
    await user.click(next());

    const box = screen.getByRole('region', { name: new RegExp(order.prompt.vi.slice(0, 30)) });
    const rows = () =>
      [...box.querySelectorAll('li[data-row]')].map((li) => li.getAttribute('data-row'));
    const arrow = (dir: 'lên' | 'xuống', text: string) =>
      within(box).getByRole('button', { name: `Đưa ${dir}: ${text}` });
    const textOf = (id: string | null | undefined) =>
      order.items.find((i) => i.id === id)?.text.vi ?? '';
    const tabTo = async (el: HTMLElement) => {
      for (let n = 0; n < 100 && document.activeElement !== el; n++) await user.tab();
      expect(el).toHaveFocus();
    };
    const total = order.items.length;

    // Down from the top: the moved item keeps the focus.
    const top = textOf(rows()[0]);
    await tabTo(arrow('xuống', top));
    await user.keyboard('{Enter}');
    expect(arrow('xuống', top)).toHaveFocus();
    expect(within(box).getByText(`${top}: vị trí 2/${String(total)}`)).toBeInTheDocument();

    let press = '{Enter}';
    for (const [i, item] of order.items.entries()) {
      if (rows().indexOf(item.id) === i) continue;
      await tabTo(arrow('lên', item.text.vi));
      while (rows().indexOf(item.id) > i) {
        const at = rows().indexOf(item.id);
        await user.keyboard(press);
        press = press === '{Enter}' ? '[Space]' : '{Enter}';
        expect(rows().indexOf(item.id)).toBe(at - 1);
        // Its "Đưa lên" keeps the focus; at the top (disabled) the focus goes to "Đưa xuống".
        expect(arrow(at - 1 === 0 ? 'xuống' : 'lên', item.text.vi)).toHaveFocus();
        expect(
          within(box).getByText(`${item.text.vi}: vị trí ${String(at)}/${String(total)}`),
        ).toBeInTheDocument();
      }
    }
    expect(rows()).toEqual(order.items.map((i) => i.id));
  });

  it('files, history and undo carry the answers, read back through the same checks', async () => {
    const s = lesson('levelsOfLife');
    const b = guidedOf(s);
    if (!b) throw new Error('guided');
    const view = await loadModule('levelsOfLife');
    const state = view.state;
    if (!state) throw new Error('state');
    const [order, match, sort] = b.activities;
    if (order?.kind !== 'order' || match?.kind !== 'match' || sort?.kind !== 'sort') {
      throw new Error('activities');
    }
    const answers: Sheet = {
      [order.id]: orderAnswers(order.items.map((i) => i.id)),
      [match.id]: Object.fromEntries(match.pairs.map((p) => [p.id, p.id])),
      [sort.id]: Object.fromEntries(sort.items.map((i) => [i.id, i.group])),
    };
    let changes = 0;
    const off = state.subscribe(() => {
      changes += 1;
    });
    act(() => {
      useStudioStore.getState().update(s, (x) => withSheet(s, x, answers, 1));
    });
    expect(changes).toBe(1);
    const saved = state.get();
    expect(saved).toEqual({ answers });

    act(() => {
      useStudioStore.setState({ sessions: {} });
    });
    state.set(JSON.parse(JSON.stringify(saved)) as Record<string, unknown>);
    const restored = useStudioStore.getState().sessions[s.id];
    expect(readSheet(s.id, b, restored?.actions ?? [])).toEqual(answers);
    // Restored before any prediction: the prediction stays open.
    expect(restored?.predictionLocked).toBe(false);

    // A damaged file: unknown activities, rows and values are dropped.
    state.set({
      answers: { nope: { a: 'b' }, [match.id]: { [match.pairs[0]?.id ?? '']: 'nope', x: 1 } },
    });
    expect(state.get()).toEqual({ answers: readSheet(s.id, b, []) });
    off();
  });
});

describe('guided textbook lessons in Science Studio', () => {
  it('have their own group, and open with the guided steps and the card inline', async () => {
    const user = userEvent.setup();
    const s = lesson('microbeApplications');
    const b = guidedOf(s);
    if (!b) throw new Error('guided');
    render(<StudioScreen />);
    // The header is true for both kinds of lesson: only experiments have simulated numbers.
    expect(screen.getByText(/Bài mô tả theo SGK: đáp án lấy từ nội dung bài\./)).toBeVisible();
    // The subject's own lessons keep their picker; the textbook lessons are a second group.
    expect(screen.getByRole('group', { name: 'Chọn bài học' })).toBeInTheDocument();
    const group = screen.getByRole('group', { name: 'Bài học mô tả theo SGK' });
    // The biology tab lists the biology lessons only (chemistry and physics have their own tabs).
    expect(within(group).getAllByRole('button')).toHaveLength(guidedFor('biology').length);
    await user.click(within(group).getByRole('button', { name: s.title.vi }));
    expect(screen.getByRole('heading', { name: s.title.vi })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Hoạt động' })).toBeDisabled();

    const answer = b.choices.find((c) => c.id === b.answer);
    await user.click(screen.getByRole('radio', { name: answer?.text.vi ?? '' }));
    await user.click(next());
    for (const a of b.activities) await solve(user, a);
    await user.click(screen.getByRole('button', { name: 'Kiểm tra' }));
    await user.click(next());
    expect(screen.getByRole('heading', { name: 'Xem đáp án và lí do' })).toBeVisible();
    expect(document.querySelector('.science-card')).not.toBeNull();
    expect(useStudioStore.getState().picked.biology).toBe(s.id);
  });
});
