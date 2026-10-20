/**
 * Stage stepping of a division view: on mount the stored stage is kept when it is this
 * division's (back from another view, a restored file), else it starts at the first stage;
 * "Phát" steps through the stages every 1.6 s.
 */
import { useEffect } from 'react';
import type { Division } from './division';
import { claimStageIndex, setDivisionState } from './stageIndex';
import { useDivisionStore } from './state';

export function useDivisionPlay(kind: Division, stageCount: number): void {
  const playing = useDivisionStore((s) => s.playing);
  useEffect(() => {
    claimStageIndex(kind);
    useDivisionStore.setState({ playing: false });
  }, [kind]);
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      const st = useDivisionStore.getState();
      if (st.index >= stageCount - 1) useDivisionStore.setState({ playing: false });
      else setDivisionState(kind, { index: st.index + 1 });
    }, 1600);
    return () => {
      window.clearInterval(id);
    };
  }, [playing, stageCount, kind]);
}
