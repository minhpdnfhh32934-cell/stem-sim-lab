import { ChevronLeft, ChevronRight, Pause, Play, TriangleAlert } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { useLocalized } from '@/app/i18n/localized';
import { cx } from '@/ui/cx';
import { IconButton } from '@/ui/IconButton';
import { L, usePublishCard } from '../common';
import {
  GENETIC_CODE,
  analyzeMutation,
  codingToMrna,
  codonEntry,
  complement,
  mutatedTranslation,
  translate,
  type MutationEffect,
  type Translation,
} from './dogma';
import { EFFECT, dogmaCard, mutationOf, parseInput, useDogmaStore } from './state';
import '../bio.css';

function CodonTrack({
  mrna,
  t,
  active,
  changedFrom,
}: {
  mrna: string;
  t: Translation;
  active?: number | undefined;
  changedFrom?: number | undefined;
}) {
  const Lz = useLocalized();
  if (t.start < 0) {
    return <span className="seq seq-dim">{mrna}</span>;
  }
  const before = mrna.slice(0, t.start);
  const lastEnd = t.codons.length ? (t.codons.at(-1)?.pos ?? 0) + 3 : t.start;
  const after = mrna.slice(lastEnd);
  return (
    <div className="seq-track seq">
      {before && <span className="seq-dim seq-codon">{before}</span>}
      {t.codons.map((c) => (
        <span
          key={c.index}
          className={cx(
            'seq-codon',
            c.entry?.start && c.index === 0 && 'seq-codon--start',
            c.entry?.stop && 'seq-codon--stop',
            active === c.index && 'seq-codon--active',
            changedFrom !== undefined &&
              changedFrom >= 0 &&
              c.index >= changedFrom &&
              !c.entry?.stop &&
              'seq-codon--changed',
          )}
        >
          <span>{c.codon}</span>
          <span className="seq-codon__aa">
            {c.entry?.stop ? Lz(L('KT', 'Stop')) : (c.entry?.three ?? '?')}
          </span>
        </span>
      ))}
      {after && <span className="seq-dim seq-codon">{after}</span>}
    </div>
  );
}

function ProteinChain({ t, upTo }: { t: Translation; upTo?: number | undefined }) {
  const Lz = useLocalized();
  const list = t.codons.filter((c) => !c.entry?.stop && (upTo === undefined || c.index <= upTo));
  if (t.start < 0)
    return (
      <span className="muted">{Lz(L('Không có bộ ba mở đầu AUG.', 'No AUG start codon.'))}</span>
    );
  return (
    <span className="seq">
      {list.map((c) => c.entry?.three ?? '?').join('–')}
      {t.stopIndex < 0 && upTo === undefined && (
        <span className="muted">
          {' '}
          {Lz(L('(không gặp bộ ba kết thúc)', '(no stop codon reached)'))}
        </span>
      )}
    </span>
  );
}

export function DogmaStage({ mode }: { mode: 'dogma' | 'mutation' }) {
  const Lz = useLocalized();
  const card = useMemo(() => dogmaCard(mode), [mode]);
  usePublishCard(card);
  const st = useDogmaStore();
  const parsed = useMemo(() => parseInput(st.input, st.strand), [st.input, st.strand]);

  const coding = parsed.ok ? parsed.coding : '';
  const mrna = codingToMrna(coding);
  const t = useMemo(() => translate(mrna), [mrna]);
  const steps = t.codons.length;

  useEffect(() => {
    if (!st.playing) return;
    const id = window.setInterval(() => {
      const s = useDogmaStore.getState();
      if (s.step >= steps - 1) useDogmaStore.setState({ playing: false });
      else useDogmaStore.setState({ step: s.step + 1 });
    }, 900);
    return () => {
      window.clearInterval(id);
    };
  }, [st.playing, steps]);

  if (!parsed.ok) {
    return (
      <div className="bio-scroll">
        <p className="chem-note chem-note--warn" role="alert">
          <TriangleAlert size={15} aria-hidden="true" />
          <span>
            {Lz(L('Trình tự không hợp lệ: ', 'Invalid sequence: '))}
            {parsed.error}
          </span>
        </p>
      </div>
    );
  }

  if (mode === 'mutation') {
    const m = mutationOf(st, coding.length);
    const a = m ? analyzeMutation(coding, m) : null;
    const mt = m ? mutatedTranslation(coding, m) : null;
    const mutated = mt ? mt.t : null;
    return (
      <div className="bio-scroll">
        <div className="seq-row">
          <span className="seq-row__label">
            {Lz(L('ADN bình thường (mạch bổ sung)', 'Normal DNA (coding strand)'))}
          </span>
          <span className="seq">5′-{coding}-3′</span>
        </div>
        {m && (
          <div className="seq-row">
            <span className="seq-row__label">{Lz(L('ADN đột biến', 'Mutated DNA'))}</span>
            <span className="seq">
              5′-
              <MutatedStrand coding={coding} m={m} />
              -3′
            </span>
          </div>
        )}
        <div className="seq-row">
          <span className="seq-row__label">{Lz(L('mARN bình thường', 'Normal mRNA'))}</span>
          <CodonTrack mrna={mrna} t={t} />
        </div>
        {mt && a && (
          <div className="seq-row">
            <span className="seq-row__label">{Lz(L('mARN đột biến', 'Mutated mRNA'))}</span>
            <CodonTrack mrna={mt.mrna} t={mt.t} changedFrom={a.firstChange} />
          </div>
        )}
        <div className="seq-row">
          <span className="seq-row__label">{Lz(L('Protein bình thường', 'Normal protein'))}</span>
          <ProteinChain t={t} />
        </div>
        {mutated && (
          <div className="seq-row">
            <span className="seq-row__label">{Lz(L('Protein đột biến', 'Mutated protein'))}</span>
            <ProteinChain t={mutated} />
          </div>
        )}
        {a && <EffectNote effect={a.effect} />}
      </div>
    );
  }

  const active = Math.min(st.step, Math.max(0, steps - 1));
  return (
    <div className="bio-scroll">
      <div className="chem-toolbar">
        <IconButton
          icon={ChevronLeft}
          label={Lz(L('Bộ ba trước', 'Previous codon'))}
          disabled={active <= 0}
          onClick={() => {
            useDogmaStore.setState({ step: Math.max(0, active - 1), playing: false });
          }}
        />
        <IconButton
          icon={st.playing ? Pause : Play}
          label={
            st.playing
              ? Lz(L('Tạm dừng', 'Pause'))
              : Lz(L('Dịch mã từng bước', 'Translate step by step'))
          }
          variant="solid"
          disabled={steps === 0}
          onClick={() => {
            useDogmaStore.setState((s) => ({
              playing: !s.playing,
              step: s.step >= steps - 1 ? 0 : s.step,
            }));
          }}
        />
        <IconButton
          icon={ChevronRight}
          label={Lz(L('Bộ ba sau', 'Next codon'))}
          disabled={active >= steps - 1}
          onClick={() => {
            useDogmaStore.setState({ step: Math.min(steps - 1, active + 1), playing: false });
          }}
        />
        <span className="chem-chip">
          {steps
            ? Lz(
                L(
                  `Ribosome ở bộ ba thứ ${active + 1}/${steps}`,
                  `Ribosome at codon ${active + 1}/${steps}`,
                ),
              )
            : Lz(L('Không có bộ ba mở đầu AUG', 'No AUG start codon'))}
        </span>
      </div>
      <div className="seq-row">
        <span className="seq-row__label">
          {Lz(L('Mạch bổ sung (5′→3′)', 'Coding strand (5′→3′)'))}
        </span>
        <span className="seq">5′-{coding}-3′</span>
      </div>
      <div className="seq-row">
        <span className="seq-row__label">
          {Lz(L('Mạch mã gốc (3′→5′)', 'Template strand (3′→5′)'))}
        </span>
        <span className="seq">3′-{complement(coding)}-5′</span>
      </div>
      <p className="small muted">
        {Lz(
          L(
            'Phiên mã: ARN pôlimeraza đọc mạch mã gốc theo chiều 3′→5′, tổng hợp mARN 5′→3′ theo nguyên tắc bổ sung (A–U, T–A, G–C, C–G; C còn được viết là X).',
            'Transcription: RNA polymerase reads the template 3′→5′ and builds mRNA 5′→3′ by base pairing (A–U, T–A, G–C, C–G).',
          ),
        )}
      </p>
      <div className="seq-row">
        <span className="seq-row__label">{Lz(L('mARN (5′→3′)', 'mRNA (5′→3′)'))}</span>
        <CodonTrack mrna={mrna} t={t} active={steps ? active : undefined} />
      </div>
      <div className="seq-row">
        <span className="seq-row__label">{Lz(L('Chuỗi pôlipeptit', 'Polypeptide'))}</span>
        <ProteinChain t={t} upTo={steps ? active : undefined} />
      </div>
      {t.codons[active] && (
        <p className="small">
          {Lz(L('Bộ ba ', 'Codon '))}
          <strong className="mono">{t.codons[active].codon}</strong>
          {' → '}
          {t.codons[active].entry?.stop
            ? Lz(
                L(
                  'bộ ba kết thúc: không có axit amin, chuỗi được giải phóng.',
                  'stop codon: no amino acid, the chain is released.',
                ),
              )
            : `${t.codons[active].entry?.three ?? '?'} (${t.codons[active].entry?.name ?? ''})`}
          {'. '}
          {Lz(L('Anticodon của tARN: ', 'tRNA anticodon: '))}
          <span className="mono">
            {t.codons[active].codon.replace(
              /./g,
              (b) => ({ A: 'U', U: 'A', G: 'C', C: 'G' })[b] ?? b,
            )}
          </span>
        </p>
      )}
    </div>
  );
}

function MutatedStrand({
  coding,
  m,
}: {
  coding: string;
  m: NonNullable<ReturnType<typeof mutationOf>>;
}) {
  if (m.kind === 'substitution') {
    return (
      <>
        {coding.slice(0, m.pos)}
        <span className="seq-base--mut">{m.base}</span>
        {coding.slice(m.pos + 1)}
      </>
    );
  }
  if (m.kind === 'insertion') {
    return (
      <>
        {coding.slice(0, m.pos)}
        <span className="seq-base--mut">{m.bases}</span>
        {coding.slice(m.pos)}
      </>
    );
  }
  return (
    <>
      {coding.slice(0, m.pos)}
      <span className="seq-base--mut">{'−'.repeat(m.count)}</span>
      {coding.slice(m.pos + m.count)}
    </>
  );
}

function EffectNote({ effect }: { effect: MutationEffect }) {
  const Lz = useLocalized();
  const e = EFFECT[effect];
  return (
    <p
      className={cx(
        'chem-note',
        effect !== 'silent' && effect !== 'outsideCds' && 'chem-note--warn',
      )}
      role="note"
    >
      <TriangleAlert size={15} aria-hidden="true" />
      <span>
        <strong>{Lz(e.name)}:</strong> {Lz(e.desc)}
      </span>
    </p>
  );
}

export function DogmaPanel({ mode }: { mode: 'dogma' | 'mutation' }) {
  const Lz = useLocalized();
  const st = useDogmaStore();
  const parsed = parseInput(st.input, st.strand);
  const len = parsed.ok ? parsed.coding.length : 0;
  return (
    <div className="chem-form">
      <label className="rx-input">
        <span className="econf__label">{Lz(L('Trình tự ADN', 'DNA sequence'))}</span>
        <textarea
          rows={3}
          spellCheck={false}
          value={st.input}
          onChange={(e) => {
            useDogmaStore.setState({ input: e.target.value, step: 0, playing: false });
          }}
        />
      </label>
      <div
        className="segmented"
        role="radiogroup"
        aria-label={Lz(L('Mạch đã nhập', 'Strand entered'))}
      >
        {(
          [
            ['coding', L('Mạch bổ sung 5′→3′', 'Coding 5′→3′')],
            ['template', L('Mạch mã gốc 3′→5′', 'Template 3′→5′')],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={st.strand === id}
            className="segmented__item"
            onClick={() => {
              useDogmaStore.setState({ strand: id, step: 0 });
            }}
          >
            {Lz(label)}
          </button>
        ))}
      </div>
      {mode === 'mutation' && (
        <>
          <label>
            <span>{Lz(L('Dạng đột biến', 'Mutation type'))}</span>
            <select
              value={st.kind}
              onChange={(e) => {
                useDogmaStore.setState({
                  kind: e.target.value as 'substitution' | 'insertion' | 'deletion',
                });
              }}
            >
              <option value="substitution">
                {Lz(L('Thay thế 1 cặp nuclêôtit', 'Substitution'))}
              </option>
              <option value="insertion">{Lz(L('Thêm nuclêôtit', 'Insertion'))}</option>
              <option value="deletion">{Lz(L('Mất nuclêôtit', 'Deletion'))}</option>
            </select>
          </label>
          <label>
            <span>
              {Lz(L('Vị trí (tính từ 1)', 'Position (from 1)'))} / {len}
            </span>
            <input
              type="number"
              min={1}
              max={Math.max(1, len)}
              value={st.pos}
              onChange={(e) => {
                useDogmaStore.setState({
                  pos: Math.max(1, Math.min(len, Number(e.target.value) || 1)),
                });
              }}
            />
          </label>
          {st.kind !== 'deletion' ? (
            <label>
              <span>
                {st.kind === 'substitution'
                  ? Lz(L('Nuclêôtit mới', 'New base'))
                  : Lz(L('Nuclêôtit thêm vào', 'Inserted bases'))}
              </span>
              <input
                type="text"
                value={st.bases}
                maxLength={st.kind === 'substitution' ? 1 : 6}
                onChange={(e) => {
                  useDogmaStore.setState({
                    bases: e.target.value.toUpperCase().replace(/[^ATGC]/g, ''),
                  });
                }}
              />
            </label>
          ) : (
            <label>
              <span>{Lz(L('Số nuclêôtit mất', 'Bases deleted'))}</span>
              <input
                type="number"
                min={1}
                max={6}
                value={st.count}
                onChange={(e) => {
                  useDogmaStore.setState({
                    count: Math.max(1, Math.min(6, Number(e.target.value) || 1)),
                  });
                }}
              />
            </label>
          )}
        </>
      )}
      <p className="small muted">
        {Lz(
          L(
            'Dùng bảng mã di truyền chuẩn (NCBI, bảng 1). Dịch mã bắt đầu ở AUG đầu tiên. Có thể dán trình tự có khoảng trắng, số thứ tự hoặc 5′/3′.',
            'Standard genetic code (NCBI table 1). Translation starts at the first AUG. Spaces, numbers and 5′/3′ marks are ignored.',
          ),
        )}
      </p>
    </div>
  );
}

const BASES = ['U', 'C', 'A', 'G'];

/** The 64-codon table with the codons of the current mRNA highlighted. */
export function CodeTableBottom() {
  const Lz = useLocalized();
  const st = useDogmaStore();
  const parsed = parseInput(st.input, st.strand);
  const used = new Set(
    parsed.ok ? translate(codingToMrna(parsed.coding)).codons.map((c) => c.codon) : [],
  );
  return (
    <div className="chem-block">
      <table className="code-table" aria-label={Lz(L('Bảng mã di truyền', 'Genetic code table'))}>
        <thead>
          <tr>
            <th scope="col">1 \ 2</th>
            {BASES.map((b) => (
              <th key={b} scope="col">
                {b}
              </th>
            ))}
            <th scope="col">3</th>
          </tr>
        </thead>
        <tbody>
          {BASES.map((b1) =>
            BASES.map((b3, k) => (
              <tr key={b1 + b3}>
                {k === 0 && (
                  <th scope="row" rowSpan={4}>
                    {b1}
                  </th>
                )}
                {BASES.map((b2) => {
                  const codon = b1 + b2 + b3;
                  const e = codonEntry(codon);
                  return (
                    <td
                      key={codon}
                      className={cx(used.has(codon) && 'is-used', e?.stop && 'is-stop')}
                    >
                      {codon} {e?.stop ? Lz(L('KT', 'Stop')) : e?.three}
                    </td>
                  );
                })}
                <th scope="row">{b3}</th>
              </tr>
            )),
          )}
        </tbody>
      </table>
      <p className="small muted">
        {GENETIC_CODE.length}{' '}
        {Lz(L('bộ ba · KT = bộ ba kết thúc (UAA, UAG, UGA)', 'codons · Stop = UAA, UAG, UGA'))}
      </p>
    </div>
  );
}
