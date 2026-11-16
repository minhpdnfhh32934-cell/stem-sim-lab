import { createElement } from 'react';
import { bindStore } from '@/modules/binding';
import type { ModuleStateBinding, ModuleView } from '@/modules/types';
import type { StudioScenario } from '../scenario';
import type { ActionRecord } from '../session';
import { useStudioStore } from '../studioStore';
import { ANSWER_OP, guidedOf, readSheet, withSheet, type Sheet } from './check';
import { GuidedPanel, GuidedStage } from './GuidedModuleViews';
import { guidedForTopic } from './lessons';

/** The learner's sheet as stored in the lesson's Science Studio session. */
function storedSheet(scenario: StudioScenario): Sheet {
  const b = guidedOf(scenario);
  if (!b) return {};
  return readSheet(scenario.id, b, useStudioStore.getState().sessions[scenario.id]?.actions ?? []);
}

/** A sheet from a file or the history (untrusted): read back through the same validation. */
export function sheetFrom(scenario: StudioScenario, raw: unknown): Sheet {
  const b = guidedOf(scenario);
  if (!b) return {};
  const actions: ActionRecord[] = [];
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [activity, rows] of Object.entries(raw)) {
      if (!rows || typeof rows !== 'object' || Array.isArray(rows)) continue;
      for (const [row, value] of Object.entries(rows as Record<string, unknown>)) {
        if (typeof value === 'string') {
          actions.push({ op: ANSWER_OP, arg: `${activity}:${row}=${value}`, at: 0 });
        }
      }
    }
  }
  return readSheet(scenario.id, b, actions);
}

/**
 * Files, history and undo carry the learner's answers: a small adapter over the studio store, so
 * the lab and Science Studio share one session.
 */
export function guidedState(scenario: StudioScenario): ModuleStateBinding {
  const adapter = {
    getState: () => ({ answers: storedSheet(scenario) }),
    setState: (patch: Partial<{ answers: Sheet }>) => {
      if (!patch.answers) return;
      const sheet = sheetFrom(scenario, patch.answers);
      useStudioStore.getState().update(scenario, (s) => withSheet(scenario, s, sheet, Date.now()));
    },
    subscribe: (listener: (state: { answers: Sheet }) => void) =>
      useStudioStore.subscribe(() => {
        listener(adapter.getState());
      }),
  };
  return bindStore(adapter, ['answers']);
}

const built = new Map<string, ModuleView>();

/** The library module of a descriptive textbook topic: its guided lesson, nothing else. */
export function guidedModule(topic: string): ModuleView {
  const cached = built.get(topic);
  if (cached) return cached;
  const scenario = guidedForTopic(topic);
  if (!scenario) throw new Error(`No guided lesson for topic "${topic}"`);
  const view: ModuleView = {
    title: scenario.title,
    Stage: function Stage() {
      return createElement(GuidedStage, { scenario });
    },
    Panel: function Panel() {
      return createElement(GuidedPanel, { scenario });
    },
    state: guidedState(scenario),
  };
  built.set(topic, view);
  return view;
}
