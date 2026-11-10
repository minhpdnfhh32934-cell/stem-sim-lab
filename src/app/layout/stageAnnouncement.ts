import { formatNumber, type Locale, type TFunction } from '@/app/i18n';

export interface StageStatus {
  title: string;
  playing: boolean;
  finished: boolean;
  replay: boolean;
  intervened: boolean;
  /** Engine time (s) when the status changed. */
  time: number;
}

/**
 * What a screen reader hears when the simulation's state changes (never on every frame: the time
 * itself is the scrubber's aria-valuetext). Built only from the engine's time, through formatNumber.
 */
export function stageAnnouncement(s: StageStatus, t: TFunction, locale: Locale): string {
  const time = formatNumber(locale, s.time, { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  const vars = { title: s.title, t: time };
  const state = s.finished
    ? t('stage.announce.finished', vars)
    : s.replay
      ? t('stage.announce.replay', vars)
      : s.playing
        ? t('stage.announce.playing', vars)
        : s.time > 0
          ? t('stage.announce.paused', vars)
          : '';
  return s.intervened && state ? `${state} ${t('science.intervened')}` : state;
}
