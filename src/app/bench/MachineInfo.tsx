import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { formatNumber, useT } from '@/app/i18n';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { effectiveTier, usePerfStore } from '@/perf/perfStore';
import { IconButton } from '@/ui/IconButton';

/**
 * Tệp → "Thông tin máy" (Advanced, #201): the render quality with its measurement, the frame
 * rate and the memory the classic status bar showed (B8 removed it; the bench edge's columns are
 * fixed, §8). The numbers change all the time, so nothing here is a live region; a missing one is
 * a dash, never a guess. Esc or "Đóng" closes it; the caller puts the focus back on Tệp.
 */
export function MachineInfoDialog({ onClose }: { onClose: () => void }) {
  const t = useT();
  const locale = useSettingsStore((s) => s.locale);
  const preference = usePerfStore((s) => s.preference);
  const tier = usePerfStore(effectiveTier);
  const benchmarking = usePerfStore((s) => s.benchmarking);
  const benchmark = usePerfStore((s) => s.benchmark);
  const fps = usePerfStore((s) => s.fps);
  const memoryMB = usePerfStore((s) => s.memoryMB);
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    return () => {
      if (d?.open) d.close();
    };
  }, []);

  // The same words the classic status bar used for the tier.
  const quality = benchmarking
    ? t('quality.measuring')
    : preference === 'auto'
      ? benchmark
        ? t('quality.autoWith', { tier: t(`quality.${tier}`) })
        : t('status.qualityNotMeasured')
      : t(`quality.${tier}`);
  const when = benchmark
    ? new Intl.DateTimeFormat(locale === 'vi' ? 'vi-VN' : 'en-GB', {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(new Date(benchmark.measuredAt))
    : null;
  const whole = (v: number) => formatNumber(locale, v, { maximumFractionDigits: 0 });
  // Closed first: while the modal is open everything behind it is inert, so the caller could not
  // put the focus back on Tệp.
  const close = () => {
    ref.current?.close();
    onClose();
  };

  return (
    <dialog
      ref={ref}
      className="dialog machine-info"
      aria-labelledby="machine-info-title"
      // Esc as a cancel, not the close event: the effect's cleanup closes the dialog too (React
      // runs it twice in development), and a close listener would then unmount it at once.
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
    >
      <header className="dialog__header">
        <h2 id="machine-info-title">{t('project.machineInfo')}</h2>
        <IconButton
          icon={X}
          label={t('project.machineInfoClose')}
          onClick={close}
          tooltipSide="left"
        />
      </header>
      <dl className="dialog__body machine-info__list">
        <dt>{t('status.quality')}</dt>
        <dd>
          <span>{quality}</span>
          {when && <span className="muted">{t('project.machineInfoMeasured', { when })}</span>}
        </dd>
        <dt>{t('status.fps')}</dt>
        <dd className="mono">{fps === null ? '—' : whole(fps)}</dd>
        <dt>{t('status.memory')}</dt>
        <dd className="mono">
          {memoryMB === null ? '—' : t('perf.memory', { mb: whole(memoryMB) })}
        </dd>
      </dl>
    </dialog>
  );
}
