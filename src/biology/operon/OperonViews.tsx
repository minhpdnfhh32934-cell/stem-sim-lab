import { lazy, Suspense } from 'react';
import { useLocalized } from '@/app/i18n/localized';
import { Bio3DToolbar } from '@/biology/view3d/switch';
import { useShow3d } from '@/biology/view3d/support';
import type { LocalizedText } from '@/core/data/dataset';
import { cx } from '@/ui/cx';
import { L, usePublishCard } from '../common';
import { Segmented } from '../ui';
import { OPERON_CARD, OPERON_TITLE } from './card';
import { STRUCTURAL_GENES, operon, type OperonReason, type PartState } from './model';
import { restoreOperon, useOperon } from './store';
import '../bio.css';
import './operon.css';

const Operon3DView = lazy(() =>
  import('./operon3d/Operon3DView').then((m) => ({ default: m.Operon3DView })),
);

const REASON: Record<OperonReason, LocalizedText> = {
  repressed: L(
    'Không có lactose: protein ức chế liên kết với vùng O, RNA polymerase không phiên mã được các gene cấu trúc.',
    'No lactose: the repressor sits on O and RNA polymerase cannot transcribe the structural genes.',
  ),
  lactose: L(
    'Có lactose: allolactose liên kết với protein ức chế, làm nó không liên kết được với vùng O; RNA polymerase phiên mã các gene cấu trúc.',
    'Lactose present: allolactose binds the repressor, which can no longer bind O; RNA polymerase transcribes the structural genes.',
  ),
  lacIBroken: L(
    'Gene lacI bị hỏng: không có protein ức chế hoạt động, vùng O luôn để trống nên các gene cấu trúc luôn được phiên mã.',
    'lacI damaged: no working repressor, O is always free, so the structural genes are always transcribed.',
  ),
  operatorBroken: L(
    'Vùng O bị hỏng: protein ức chế không liên kết được với O nên các gene cấu trúc luôn được phiên mã.',
    'O damaged: the repressor cannot bind O, so the structural genes are always transcribed.',
  ),
};

const PART_OPTIONS: { id: PartState; label: LocalizedText }[] = [
  { id: 'normal', label: L('Bình thường', 'Normal') },
  { id: 'broken', label: L('Bị hỏng', 'Damaged') },
];

/** "Điều hòa biểu hiện gene": the operon drawn as boxes, on or off. */
export function OperonStage() {
  const Lz = useLocalized();
  const input = useOperon();
  const r = operon(input);
  usePublishCard(OPERON_CARD);
  const { show3d } = useShow3d('lacOperon');
  const title = (
    <span className="chem-chip">
      <strong className="stage__hud-title">{Lz(OPERON_TITLE)}</strong>
    </span>
  );
  if (show3d)
    return (
      <Suspense fallback={<div className="bio-view" />}>
        <Operon3DView
          label={Lz(REASON[r.reason])}
          top={
            <>
              {title}
              <span className="chem-chip">
                {Lz(
                  input.lactose
                    ? L('Môi trường có lactose', 'Lactose present')
                    : L('Môi trường không có lactose', 'No lactose'),
                )}
              </span>
              <span className={cx('chem-chip', !r.transcribed && 'chem-chip--approx')}>
                {Lz(
                  r.transcribed
                    ? L('Các gene cấu trúc được phiên mã', 'The structural genes are transcribed')
                    : L(
                        'Các gene cấu trúc không được phiên mã',
                        'The structural genes are not transcribed',
                      ),
                )}
              </span>
            </>
          }
        />
      </Suspense>
    );
  return (
    <div className="bio-view">
      <div className="chem-overlay">
        {title}
        <Bio3DToolbar lesson="lacOperon" />
      </div>
      <div className="bio-scroll operon">
        <p className="operon__env">
          {Lz(
            input.lactose
              ? L('Môi trường có lactose', 'Lactose present')
              : L('Môi trường không có lactose', 'No lactose'),
          )}
        </p>
        <div className="operon__dna" role="img" aria-label={Lz(REASON[r.reason])}>
          <span
            className={cx(
              'operon__gene',
              'operon__gene--reg',
              input.lacI === 'broken' && 'operon__gene--broken',
            )}
          >
            lacI
          </span>
          <span className="operon__gap" />
          <span className="operon__gene operon__gene--p">
            P
            <span className={cx('operon__pol', r.transcribed && 'operon__pol--moving')}>
              RNA polymerase
            </span>
          </span>
          <span
            className={cx(
              'operon__gene',
              'operon__gene--o',
              input.operator === 'broken' && 'operon__gene--broken',
            )}
          >
            O
            {r.repressorOnOperator && (
              <span className="operon__repressor">{Lz(L('Protein ức chế', 'Repressor'))}</span>
            )}
          </span>
          {STRUCTURAL_GENES.map((g) => (
            <span
              key={g.gene}
              className={cx('operon__gene', 'operon__gene--z', r.transcribed && 'operon__gene--on')}
            >
              {g.gene}
            </span>
          ))}
        </div>
        {!r.repressorOnOperator && input.lacI === 'normal' && (
          <p className="operon__free">
            {Lz(
              r.allolactoseOnRepressor
                ? L(
                    'Protein ức chế + allolactose: không liên kết với O',
                    'Repressor + allolactose: does not bind O',
                  )
                : L('Protein ức chế không bám được vào O', 'The repressor cannot hold on to O'),
            )}
          </p>
        )}
        <p
          className={cx(
            'operon__verdict',
            r.transcribed ? 'operon__verdict--on' : 'operon__verdict--off',
          )}
        >
          {Lz(
            r.transcribed
              ? L('Các gene cấu trúc được phiên mã', 'The structural genes are transcribed')
              : L(
                  'Các gene cấu trúc không được phiên mã',
                  'The structural genes are not transcribed',
                ),
          )}
        </p>
        <p className="operon__reason">{Lz(REASON[r.reason])}</p>
        {r.transcribed && (
          <ul
            className="operon__enzymes"
            aria-label={Lz(L('Enzyme được tổng hợp', 'Enzymes made'))}
          >
            {STRUCTURAL_GENES.map((g) => (
              <li key={g.gene}>
                <span className="mono">{g.gene}</span> → {g.enzyme}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function OperonPanel() {
  const Lz = useLocalized();
  const { lactose, lacI, operator } = useOperon();
  return (
    <div className="chem-form operon-panel">
      <div className="operon-panel__field">
        <span className="operon-panel__label">
          {Lz(L('Lactose trong môi trường', 'Lactose in the medium'))}
        </span>
        <Segmented<'yes' | 'no'>
          label={L('Lactose trong môi trường', 'Lactose in the medium')}
          value={lactose ? 'yes' : 'no'}
          options={[
            { id: 'no', label: L('Không có', 'Absent') },
            { id: 'yes', label: L('Có', 'Present') },
          ]}
          onChange={(v) => {
            restoreOperon({ lactose: v === 'yes' });
          }}
        />
      </div>
      <div className="operon-panel__field">
        <span className="operon-panel__label">
          {Lz(L('Gene điều hòa lacI', 'Regulator gene lacI'))}
        </span>
        <Segmented<PartState>
          label={L('Gene điều hòa lacI', 'Regulator gene lacI')}
          value={lacI}
          options={PART_OPTIONS}
          onChange={(v) => {
            restoreOperon({ lacI: v });
          }}
        />
      </div>
      <div className="operon-panel__field">
        <span className="operon-panel__label">{Lz(L('Vùng vận hành O', 'Operator O'))}</span>
        <Segmented<PartState>
          label={L('Vùng vận hành O', 'Operator O')}
          value={operator}
          options={PART_OPTIONS}
          onChange={(v) => {
            restoreOperon({ operator: v });
          }}
        />
      </div>
      <p className="small">
        {Lz(
          L(
            'Thí nghiệm của Monod và Jacob (tr. 18): ở lô không có lactose, các enzyme phân giải lactose xuất hiện với lượng không đáng kể; ở lô có lactose, lượng các enzyme này tăng mạnh. Câu 2 (tr. 21): nếu operon vẫn hoạt động khi không có lactose, bộ phận nào có thể bị hỏng?',
            'Monod and Jacob’s experiment (p. 18): without lactose the lactose enzymes are barely found; with lactose they rise sharply. Question 2 (p. 21): if the operon works without lactose, which part may be damaged?',
          ),
        )}
      </p>
    </div>
  );
}
