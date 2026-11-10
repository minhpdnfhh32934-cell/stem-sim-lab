import { useShallow } from 'zustand/react/shallow';
import { useT } from '@/app/i18n';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { useSimStore } from '@/app/sim/simStore';
import { useWorkspaceStore } from '@/app/workspaceStore';

type Tool = 'ruler' | 'vectors' | 'protractor' | 'stopwatch' | 'trail';

/** Basic shows the ruler and the vectors; Advanced adds the others (as the classic tool bar). */
const SWITCHES: readonly { id: Tool; basic: boolean }[] = [
  { id: 'ruler', basic: true },
  { id: 'vectors', basic: true },
  { id: 'protractor', basic: false },
  { id: 'stopwatch', basic: false },
  { id: 'trail', basic: false },
];

/**
 * "Dụng cụ đo" in the tray (docs/BENCH_DESIGN.md §9.4): the measuring tools of the classic stage
 * tool bar as switches, with the same names. The ruler and the protractor are pointer tools (on:
 * that tool, off: back to "Chọn"); the others show or hide something on the stage.
 */
export function ToolSwitches() {
  const t = useT();
  const advanced = useSettingsStore((s) => s.uiMode === 'advanced');
  const { activeTool, setActiveTool, hasSimulation } = useWorkspaceStore(
    useShallow((s) => ({
      activeTool: s.activeTool,
      setActiveTool: s.setActiveTool,
      hasSimulation: s.hasSimulation,
    })),
  );
  const shown = useSimStore(
    useShallow((s) => ({ stopwatch: s.stopwatch, vectors: s.vectors, trail: s.trail })),
  );
  const on = (id: Tool) => (id === 'ruler' || id === 'protractor' ? activeTool === id : shown[id]);
  const toggle = (id: Tool) => {
    if (id === 'ruler' || id === 'protractor') setActiveTool(activeTool === id ? 'select' : id);
    else useSimStore.setState((s) => ({ [id]: !s[id] }));
  };
  return (
    <ul className="tool-switches">
      {/* A tool switched on in Advanced stays listed in Basic, so it can be switched off again. */}
      {SWITCHES.filter((s) => advanced || s.basic || on(s.id)).map((s) => (
        <li key={s.id}>
          <button
            type="button"
            role="switch"
            aria-checked={on(s.id)}
            className="tool-switch"
            disabled={!hasSimulation}
            onClick={() => {
              toggle(s.id);
            }}
          >
            <span className="tool-switch__name">{t(`stage.tools.${s.id}`)}</span>
            <span className="tool-switch__track" aria-hidden="true">
              <span />
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
