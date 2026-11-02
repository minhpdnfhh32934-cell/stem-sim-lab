import { PanelRightClose, SlidersHorizontal } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useT } from '@/app/i18n';
import { InspectorBody } from '@/app/layout/Inspector';
import { LAYOUT_LIMITS, useLayoutStore } from '@/app/layout/layoutStore';
import { Splitter } from '@/app/layout/Splitter';
import { IconButton } from '@/ui/IconButton';

/**
 * The tray on the right ("Điều chỉnh"): what the learner changes. It folds to a 64 px spine and
 * never to nothing (user decision 2026-11-02); its landmark keeps "Bảng thuộc tính" in its name.
 */
export function Tray() {
  const t = useT();
  const { folded, width, setFolded, setSize } = useLayoutStore(
    useShallow((s) => ({
      folded: s.trayFolded,
      width: s.trayWidth,
      setFolded: s.setTrayFolded,
      setSize: s.setSize,
    })),
  );
  // Folding swaps the button under the keyboard focus: hand the focus to the one that appears.
  const aside = useRef<HTMLElement>(null);
  const moved = useRef(false);
  useEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    const selector = folded ? '.tray__spine' : '.panel__header button';
    aside.current?.querySelector<HTMLButtonElement>(selector)?.focus();
  }, [folded]);
  const fold = (on: boolean) => {
    moved.current = true;
    setFolded(on);
  };

  return (
    <aside
      ref={aside}
      className="tray"
      aria-label={t('bench.trayRegion')}
      data-tour="inspector"
      data-folded={folded || undefined}
    >
      {folded ? (
        <button
          type="button"
          className="tray__spine"
          aria-label={t('bench.openTray')}
          onClick={() => {
            fold(false);
          }}
        >
          <SlidersHorizontal size={20} strokeWidth={1.75} aria-hidden="true" />
          <span aria-hidden="true">{t('bench.trayTitle')}</span>
        </button>
      ) : (
        <>
          <Splitter
            orientation="vertical"
            value={width}
            min={LAYOUT_LIMITS.tray.min}
            max={LAYOUT_LIMITS.tray.max}
            direction={-1}
            onResize={(px) => {
              setSize('tray', px);
            }}
            onReset={() => {
              setSize('tray', LAYOUT_LIMITS.tray.default);
            }}
            label={t('bench.resizeTray')}
          />
          <div className="panel tray__panel">
            <header className="panel__header">
              <h2 className="panel__title">{t('bench.trayTitle')}</h2>
              <IconButton
                icon={PanelRightClose}
                label={t('bench.foldTray')}
                onClick={() => {
                  fold(true);
                }}
              />
            </header>
            <div className="panel__scroll">
              <InspectorBody />
            </div>
          </div>
        </>
      )}
    </aside>
  );
}
