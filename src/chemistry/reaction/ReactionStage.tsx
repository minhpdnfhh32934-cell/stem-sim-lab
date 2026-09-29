import {
  ArrowRightLeft,
  Info,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Spline,
  Tag,
  TriangleAlert,
} from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useLocalized } from '@/app/i18n/localized';
import type { ScienceCardData } from '@/science-card/types';
import { IconButton } from '@/ui/IconButton';
import { cx } from '@/ui/cx';
import { CSRC, L, usePublishCard } from '../common';
import { MOLECULES, prettyFormula } from '../data/molecules';
import { REACTIONS_SOURCE, reactionById, type Reaction } from '../data/reactions';
import { parseFormula } from '../formula';
import { openTopic } from '@/app/topics';
import { requestMolecule } from '../molecule/store';
import { EquationText } from './Equation';
import { FRAME_KIND, ILLUSTRATIVE } from './labels';
import { MechanismViewer } from './MechanismViewer';
import { useReactionStore } from './store';
import '../chem.css';

function cardFor(r: Reaction): ScienceCardData {
  const mech = r.mechanism;
  return {
    title: r.name,
    model: mech
      ? L(
          `Cơ chế ${mech.type.vi.toLowerCase()} theo tài liệu. Các khung chính (chất đầu, trung gian, sản phẩm) là cấu trúc tối ưu bằng trường lực; trạng thái chuyển tiếp và chuyển động giữa các khung chỉ minh họa.`,
          `${mech.type.en} mechanism from the literature. Key frames (reactants, intermediates, products) are force-field structures; transition states and motion between frames are illustrative.`,
        )
      : L(
          'Phương trình tổng đã cân bằng (kiểm tra bảo toàn nguyên tố và điện tích). Không hiển thị cơ chế.',
          'Balanced overall equation (element and charge conservation checked). No mechanism shown.',
        ),
    equations: [],
    assumptions: [
      ...(mech ? [ILLUSTRATIVE, mech.note] : []),
      L(`Điều kiện: ${r.conditions.vi}`, `Conditions: ${r.conditions.en}`),
    ],
    confidence: 'qualitative',
    confidenceNote: L(
      'Phương trình: đã kiểm tra bảo toàn bằng test tự động. Hình ảnh cơ chế: định tính.',
      'Equation: conservation checked by automated tests. Mechanism pictures: qualitative.',
    ),
    userIntervened: false,
    sources: [...r.sources, REACTIONS_SOURCE, ...(mech ? [CSRC.rdkit] : [])],
    reviewStatus: r.review_status,
  };
}

/** Species of the reaction that exist in the 3D molecule library (link to view them). */
function libraryMolecules(r: Reaction) {
  const sig = (f: string) => {
    const p = parseFormula(f);
    return `${[...p.counts]
      .sort()
      .map(([e, n]) => `${e}${n}`)
      .join('')}${p.charge}`;
  };
  const byFormula = new Map(MOLECULES.map((m) => [sig(m.formula), m]));
  const out: (typeof MOLECULES)[number][] = [];
  for (const t of [...r.reactants, ...r.products]) {
    const m = byFormula.get(sig(t.formula));
    if (m && !out.includes(m)) out.push(m);
  }
  return out;
}

export function ReactionStage() {
  const Lz = useLocalized();
  const st = useReactionStore(
    useShallow((s) => ({
      id: s.id,
      t: s.t,
      playing: s.playing,
      stepPause: s.stepPause,
      arrows: s.arrows,
      labels: s.labels,
    })),
  );
  const r = reactionById(st.id);
  const card = useMemo(() => (r ? cardFor(r) : null), [r]);
  usePublishCard(card);
  const mech = r?.mechanism ?? null;
  const last = mech ? mech.frames.length - 1 : 0;

  // Playback: 0.45 key frames per second, holding 1.2 s on each key frame when requested.
  const hold = useRef(0);
  useEffect(() => {
    if (!st.playing || !mech) return;
    let raf = 0;
    let prev = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - prev) / 1000);
      prev = now;
      const s = useReactionStore.getState();
      if (hold.current > 0) {
        hold.current -= dt;
      } else {
        let next = s.t + dt * 0.45;
        if (Math.floor(next) > Math.floor(s.t) && s.stepPause) {
          next = Math.floor(next);
          hold.current = 1.2;
        }
        if (next >= last) {
          useReactionStore.setState({ t: last, playing: false });
          return;
        }
        useReactionStore.setState({ t: next });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
    };
  }, [st.playing, mech, last]);

  if (!r) return null;
  const frameIndex = Math.round(st.t);
  const atKey = Math.abs(st.t - frameIndex) < 1e-6;
  const frame = mech?.frames[Math.min(last, Math.floor(st.t))];

  if (!mech) {
    const mols = libraryMolecules(r);
    return (
      <div className="chem-view">
        <div className="rx-card">
          <p className="econf__label">{Lz(r.name)}</p>
          <EquationText r={r} className="rx-eq--big" />
          <p>
            <strong>{Lz(L('Điều kiện: ', 'Conditions: '))}</strong>
            {Lz(r.conditions)}
          </p>
          <p>
            <strong>{Lz(L('Hiện tượng / ý nghĩa: ', 'Observation / meaning: '))}</strong>
            {Lz(r.observation)}
          </p>
          {r.no_mechanism_reason && (
            <p className="chem-note" role="note">
              <Info size={15} strokeWidth={1.75} aria-hidden="true" />
              <span>{Lz(r.no_mechanism_reason)}</span>
            </p>
          )}
          {mols.length > 0 && (
            <div
              className="mol-chips"
              role="group"
              aria-label={Lz(L('Xem phân tử 3D', 'View molecules in 3D'))}
            >
              {mols.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    requestMolecule(m.id);
                    void openTopic('molecule3d');
                  }}
                >
                  {prettyFormula(m.display_formula)} · 3D
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="chem-view chem-view--flush">
      <MechanismViewer
        mechanism={mech}
        t={st.t}
        showArrows={st.arrows}
        labels={st.labels}
        ariaLabel={`${Lz(r.name)} — ${Lz(mech.type)}`}
      />
      <div className="chem-overlay">
        <EquationText r={r} className="rx-eq--chip" />
        <span className="chem-chip chem-chip--qual">{Lz(mech.type)}</span>
        <IconButton
          icon={Spline}
          size="sm"
          label={Lz(L('Mũi tên dịch chuyển electron', 'Electron-pushing arrows'))}
          active={st.arrows}
          onClick={() => {
            useReactionStore.setState((s) => ({ arrows: !s.arrows }));
          }}
        />
        <IconButton
          icon={Tag}
          size="sm"
          label={Lz(L('Nhãn nguyên tử', 'Atom labels'))}
          active={st.labels}
          onClick={() => {
            useReactionStore.setState((s) => ({ labels: !s.labels }));
          }}
        />
      </div>
      <div className="rx-status">
        {frame && (
          <span className={cx('chem-chip', frame.kind === 'ts' && 'chem-chip--approx')}>
            {atKey
              ? `${frameIndex + 1}/${last + 1} · ${Lz(frame.label)}`
              : Lz(L('Đang chuyển bước…', 'Moving between steps…'))}
            {atKey &&
              frame.kind === 'ts' &&
              ` ‡${frame.total_charge ? (frame.total_charge > 0 ? '+' : '−') : ''}`}
          </span>
        )}
        {!atKey && (
          <span className="chem-chip chem-chip--approx">
            <TriangleAlert size={13} strokeWidth={1.75} aria-hidden="true" /> {Lz(ILLUSTRATIVE)}
          </span>
        )}
        <span className="chem-chip rx-legend">
          <span className="rx-swatch rx-swatch--break" /> {Lz(L('đứt', 'breaks'))}
          <span className="rx-swatch rx-swatch--form" /> {Lz(L('tạo', 'forms'))}
          <span className="rx-swatch rx-swatch--partial" />{' '}
          {Lz(L('liên kết một phần', 'partial bond'))}
        </span>
      </div>
      <div
        className="rx-player"
        role="group"
        aria-label={Lz(L('Điều khiển cơ chế', 'Mechanism controls'))}
      >
        <IconButton
          icon={SkipBack}
          label={Lz(L('Bước trước', 'Previous step'))}
          disabled={st.t <= 0}
          onClick={() => {
            useReactionStore.setState({ t: Math.max(0, Math.ceil(st.t) - 1), playing: false });
          }}
        />
        <IconButton
          icon={st.playing ? Pause : Play}
          label={st.playing ? Lz(L('Tạm dừng', 'Pause')) : Lz(L('Phát', 'Play'))}
          variant="solid"
          onClick={() => {
            useReactionStore.setState((s) => ({ playing: !s.playing, t: s.t >= last ? 0 : s.t }));
          }}
        />
        <IconButton
          icon={SkipForward}
          label={Lz(L('Bước sau', 'Next step'))}
          disabled={st.t >= last}
          onClick={() => {
            useReactionStore.setState({ t: Math.min(last, Math.floor(st.t) + 1), playing: false });
          }}
        />
        <input
          type="range"
          min={0}
          max={last}
          step={0.01}
          value={st.t}
          aria-label={Lz(L('Tiến trình phản ứng', 'Reaction progress'))}
          onChange={(e) => {
            useReactionStore.setState({ t: Number(e.target.value), playing: false });
          }}
        />
        <IconButton
          icon={ArrowRightLeft}
          size="sm"
          label={Lz(L('Dừng ở mỗi bước khi phát', 'Pause on each step while playing'))}
          active={st.stepPause}
          onClick={() => {
            useReactionStore.setState((s) => ({ stepPause: !s.stepPause }));
          }}
        />
        <span className="rx-player__kind">{frame ? Lz(FRAME_KIND[frame.kind]) : ''}</span>
      </div>
    </div>
  );
}
