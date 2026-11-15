import { ChevronLeft, ChevronRight, Tags } from 'lucide-react';
import { lazy, Suspense, useMemo } from 'react';
import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { useCanvas } from '@/ui/canvas/useCanvas';
import { cx } from '@/ui/cx';
import { IconButton } from '@/ui/IconButton';
import { L, usePublishCard } from '../common';
import { Segmented } from '../ui';
import { Bio3DToolbar } from '../view3d/switch';
import { useShow3d } from '../view3d/support';
import { VIRUS_CARD, VIRUS_ILLUSTRATION } from './card';
import { drawVirus } from './draw2d';
import { PART_TEXT, STAGES, STAGE_TEXT, partsShown } from './parts';
import { setEnveloped, setStage, useVirus } from './store';
import '../bio.css';
import '../sh10.css';

const Virus3DView = lazy(() => import('./Virus3DView').then((m) => ({ default: m.Virus3DView })));

/** "Hiện tên": the learner's choice, else on in Basic mode. */
function useShowNames(): boolean {
  const choice = useVirus((s) => s.labels);
  const basic = useSettingsStore((s) => s.uiMode === 'basic');
  return choice ?? basic;
}

/** Names of the parts this virus shows ("Hiện tên"), or null. */
function useNames(): Record<string, string> | null {
  const Lz = useLocalized();
  const enveloped = useVirus((s) => s.enveloped);
  const show = useShowNames();
  return useMemo(
    () =>
      show
        ? Object.fromEntries(partsShown(enveloped).map((p) => [p, Lz(PART_TEXT[p].short)]))
        : null,
    [show, enveloped, Lz],
  );
}

function NamesButton() {
  const Lz = useLocalized();
  const on = useShowNames();
  return (
    <IconButton
      icon={Tags}
      size="lg"
      active={on}
      label={Lz(L('Hiện tên các phần', 'Show part names'))}
      onClick={() => {
        useVirus.setState({ labels: !on });
      }}
    />
  );
}

function useLabel(): string {
  const Lz = useLocalized();
  const enveloped = useVirus((s) => s.enveloped);
  return Lz(
    enveloped
      ? L('Hình minh họa virus có vỏ ngoài', 'Illustration of an enveloped virus')
      : L('Hình minh họa virus không có vỏ ngoài', 'Illustration of a virus without an envelope'),
  );
}

/**
 * "Khái quát về virus": the 3D virus (loaded when shown), or the 2D picture on a weak device,
 * without WebGL 2, after a lost context or by the learner's choice.
 */
export function VirusStage() {
  const { show3d } = useShow3d('virusStructure');
  const names = useNames();
  const label = useLabel();
  usePublishCard(VIRUS_CARD);
  if (show3d)
    return (
      <Suspense fallback={<div className="bio-view" />}>
        <Virus3DView tools={<NamesButton />} names={names} label={label} />
      </Suspense>
    );
  return <Virus2D names={names} label={label} />;
}

function Virus2D({ names, label }: { names: Record<string, string> | null; label: string }) {
  const Lz = useLocalized();
  const enveloped = useVirus((s) => s.enveloped);
  const selected = useVirus((s) => s.selected);
  const ref = useCanvas(
    (d) => {
      drawVirus(d, enveloped, names, selected);
    },
    false,
    [enveloped, names, selected],
  );
  return (
    <div className="bio-view">
      <canvas ref={ref} className="chem-canvas" role="img" aria-label={label} />
      <div className="chem-overlay">
        <NamesButton />
        <span className="chem-chip chem-chip--qual">{Lz(L('Định tính', 'Qualitative'))}</span>
        <Bio3DToolbar lesson="virusStructure" />
      </div>
      <p className="bio-caption">{Lz(VIRUS_ILLUSTRATION)}</p>
    </div>
  );
}

/** Inspector: with or without an envelope, then the parts (a click opens the part's card). */
export function VirusPanel() {
  const Lz = useLocalized();
  const enveloped = useVirus((s) => s.enveloped);
  const selected = useVirus((s) => s.selected);
  const info = selected ? PART_TEXT[selected] : null;
  const title = Lz(L('Các phần của virus', 'Parts of the virus'));
  return (
    <div className="cell-parts">
      <Segmented<'yes' | 'no'>
        label={L('Vỏ ngoài', 'Envelope')}
        value={enveloped ? 'yes' : 'no'}
        options={[
          { id: 'yes', label: L('Có vỏ ngoài', 'Enveloped') },
          { id: 'no', label: L('Không có vỏ ngoài', 'No envelope') },
        ]}
        onChange={(v) => {
          setEnveloped(v === 'yes');
        }}
      />
      <h4 className="m3d-parts__title">{title}</h4>
      <div className="m3d-parts__list" role="group" aria-label={title}>
        {partsShown(enveloped).map((id) => {
          const on = selected === id;
          return (
            <button
              key={id}
              type="button"
              className={cx('m3d-parts__item', on && 'is-active')}
              aria-pressed={on}
              onClick={() => {
                useVirus.setState({ selected: on ? null : id });
              }}
            >
              {Lz(PART_TEXT[id].name)}
            </button>
          );
        })}
      </div>
      <div aria-live="polite">
        {info ? (
          <div className="cell-part-card">
            <strong>{Lz(info.name)}</strong>
            <p>{Lz(info.text)}</p>
            <p className="small muted">
              {Lz(L('Nguồn', 'Source'))}: {info.source.citation} ·{' '}
              {Lz(L('chờ giáo viên duyệt', 'awaiting teacher review'))}
            </p>
          </div>
        ) : (
          <p className="small muted">
            {Lz(
              L(
                'Chọn một phần để xem tên và đặc điểm của nó.',
                'Pick a part to see its name and what it is.',
              ),
            )}
          </p>
        )}
      </div>
    </div>
  );
}

/** Bottom panel: the five stages of multiplication, one at a time (text only). */
export function VirusBottom() {
  const Lz = useLocalized();
  const stage = useVirus((s) => s.stage);
  const id = STAGES[stage] ?? STAGES[0];
  return (
    <div className="virus-steps">
      <div className="virus-steps__nav">
        <IconButton
          icon={ChevronLeft}
          size="lg"
          label={Lz(L('Giai đoạn trước', 'Previous stage'))}
          disabled={stage === 0}
          onClick={() => {
            setStage(stage - 1);
          }}
        />
        <Segmented<string>
          label={L('Giai đoạn nhân lên', 'Stage of multiplication')}
          value={id}
          options={STAGES.map((s, i) => ({
            id: s,
            label: L(
              `${String(i + 1)}. ${STAGE_TEXT[s].name.vi}`,
              `${String(i + 1)}. ${STAGE_TEXT[s].name.en}`,
            ),
          }))}
          onChange={(v) => {
            setStage(STAGES.indexOf(v as (typeof STAGES)[number]));
          }}
        />
        <IconButton
          icon={ChevronRight}
          size="lg"
          label={Lz(L('Giai đoạn sau', 'Next stage'))}
          disabled={stage === STAGES.length - 1}
          onClick={() => {
            setStage(stage + 1);
          }}
        />
      </div>
      <p aria-live="polite">
        <strong>
          {Lz(L('Giai đoạn', 'Stage'))} {stage + 1}: {Lz(STAGE_TEXT[id].name)}.
        </strong>{' '}
        {Lz(STAGE_TEXT[id].text)}
      </p>
      <p className="small muted">
        {Lz(
          L(
            'Virus nhân lên trong tế bào chủ qua năm giai đoạn; mỗi loại virus có cơ chế riêng. Nguồn: SGK Sinh học 10 KNTT, tr. 143–144 · chờ giáo viên duyệt.',
            'A virus multiplies inside its host cell in five stages; each kind of virus has its own way. Source: SGK Sinh học 10 KNTT, pp. 143–144 · awaiting teacher review.',
          ),
        )}
      </p>
    </div>
  );
}
