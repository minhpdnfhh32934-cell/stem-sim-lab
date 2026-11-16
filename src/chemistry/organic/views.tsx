import { useEffect, useMemo, useState } from 'react';
import { formatNumber } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import type { LocalizedText } from '@/core/data/dataset';
import { usePublishCard } from '@/modules/usePublishCard';
import { useCanvas } from '@/ui/canvas/useCanvas';
import { NumberField } from '@/ui/NumberField';
import { L } from '../common';
import { formatFormula } from '../formula';
import { inspectSmiles } from '../molecule/rdkit';
import { organicCard, TITLE } from './card';
import {
  BOILING,
  ELEMENTS,
  GROUPS,
  ISOMERS,
  PROBLEMS,
  formulaText,
  molecularFormula,
  type El,
  type FormulaResult,
} from './model';
import { TABS, setOrganic, useOrganicStore, type Tab } from './store';
import './organic.css';

const TAB_NAME: Record<Tab, LocalizedText> = {
  groups: L('Nhóm chức (Bài 10)', 'Functional groups (lesson 10)'),
  formula: L('Lập công thức (Bài 12)', 'Molecular formula (lesson 12)'),
  isomers: L('Đồng phân (Bài 13)', 'Isomers (lesson 13)'),
};

const REFUSAL: Record<Exclude<FormulaResult, { ok: true }>['reason'], LocalizedText> = {
  sum: L(
    'Tổng phần trăm khối lượng phải bằng 100 %.',
    'The mass percentages must add up to 100 %.',
  ),
  empty: L(
    'Chỉ được để trống một nguyên tố ("còn lại").',
    'Only one element may be left as "the rest".',
  ),
  noWhole: L(
    'Không tìm được tỉ lệ số nguyên tối giản: hãy kiểm tra lại phần trăm khối lượng.',
    'No simple whole-number ratio fits: check the mass percentages.',
  ),
  notMultiple: L(
    'Phân tử khối không phải là bội của khối lượng công thức đơn giản nhất: hãy kiểm tra lại M.',
    'The molar mass is not a multiple of the simplest formula’s mass: check M.',
  ),
};

/** IR wavenumbers drawn from 4000 down to 500 cm⁻¹, as spectra are printed (Hình 10.2). */
function IrBands({ groupId }: { groupId: string }) {
  const Lz = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const ref = useCanvas(
    ({ ctx, width, height, css }) => {
      // Below the overlay chips; the rows share the height that is left.
      const pad = { l: 40, r: 24, t: 72, b: 56 };
      const w = width - pad.l - pad.r;
      const X = (nu: number) => pad.l + ((4000 - nu) / 3500) * w;
      const rows = GROUPS.filter((g) => g.ir.length > 0);
      const rowH = Math.min(56, Math.max(24, (height - pad.t - pad.b) / rows.length));
      ctx.font = '12px system-ui, sans-serif';
      ctx.strokeStyle = css('--border');
      ctx.fillStyle = css('--text-muted');
      ctx.textAlign = 'center';
      for (let nu = 4000; nu >= 500; nu -= 500) {
        ctx.beginPath();
        ctx.moveTo(X(nu), pad.t - 6);
        ctx.lineTo(X(nu), pad.t + rows.length * rowH);
        ctx.stroke();
        ctx.fillText(formatNumber(locale, nu), X(nu), pad.t + rows.length * rowH + 16);
      }
      ctx.fillText(
        Lz(L('Số sóng (cm⁻¹)', 'Wavenumber (cm⁻¹)')),
        pad.l + w / 2,
        pad.t + rows.length * rowH + 34,
      );
      rows.forEach((g, i) => {
        const y = pad.t + i * rowH;
        const on = g.id === groupId;
        ctx.textAlign = 'left';
        ctx.fillStyle = on ? css('--text') : css('--text-muted');
        ctx.fillText(Lz(g.name), X(4000) + 4, y + rowH * 0.62);
        for (const b of g.ir) {
          ctx.fillStyle = on ? css('--chart-1') : css('--bg-sunken');
          ctx.fillRect(X(b.high), y + 4, X(b.low) - X(b.high), rowH - 8);
          ctx.fillStyle = on ? css('--text-on-data') : css('--text-muted');
          ctx.textAlign = 'center';
          if (X(b.low) - X(b.high) > 34)
            ctx.fillText(b.bond, (X(b.low) + X(b.high)) / 2, y + rowH * 0.62);
        }
      });
    },
    false,
    [groupId, locale],
  );
  return (
    <canvas
      ref={ref}
      className="chem-canvas"
      role="img"
      aria-label={Lz(
        L(
          'Vùng số sóng hấp thụ đặc trưng của các nhóm chức (Bảng 10.2)',
          'Characteristic absorption bands of functional groups (Table 10.2)',
        ),
      )}
    />
  );
}

function FormulaSteps() {
  const Lz = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const { C, H, O, M } = useOrganicStore();
  const r = molecularFormula({ percent: { C, H, O }, M });
  const n = (v: number, d = 4) => formatNumber(locale, Number(v.toPrecision(d)));
  if (!r.ok) return <p className="organic-steps__error">{Lz(REFUSAL[r.reason])}</p>;
  const present = ELEMENTS.filter((e) => r.percent[e] > 0);
  const row = (f: (e: El) => string) => present.map(f).join(' : ');
  return (
    <ol className="organic-steps" aria-live="polite">
      <li>
        x : y : z = {row((e) => `${n(r.percent[e])}/${e === 'C' ? '12' : e === 'H' ? '1' : '16'}`)}{' '}
        = <span className="mono">{row((e) => n(r.moles[e]))}</span>
      </li>
      <li>
        {Lz(L('Chia cho số nhỏ nhất: ', 'Divide by the smallest: '))}
        <span className="mono">{row((e) => n(r.ratio[e], 3))}</span>
        {r.k > 1 && (
          <>
            {Lz(L(`, nhân với ${String(r.k)}: `, `, times ${String(r.k)}: `))}
            <span className="mono">{row((e) => n(r.ratio[e] * r.k, 3))}</span>
          </>
        )}
      </li>
      <li>
        {Lz(L('Công thức đơn giản nhất: ', 'Simplest formula: '))}
        <strong>{formatFormula(formulaText(r.simplest))}</strong> (M = {n(r.simplestMass)})
      </li>
      <li>
        n = {n(M)} / {n(r.simplestMass)} = {r.n}
        {' → '}
        <strong className="organic-steps__answer">{formatFormula(formulaText(r.molecular))}</strong>
      </li>
    </ol>
  );
}

function IsomerCard({ name, smiles }: { name: string; smiles: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    // Without RDKit (it failed to load) the SMILES text stays as the picture.
    inspectSmiles(smiles)
      .then((info) => {
        if (live) setSvg(info?.svg ?? null);
      })
      .catch(() => {
        if (live) setSvg(null);
      });
    return () => {
      live = false;
    };
  }, [smiles]);
  return (
    <figure className="organic-isomer">
      {svg ? (
        // As an image, like the molecule lesson: scripts inside an SVG image never run.
        <img
          className="organic-isomer__svg"
          alt=""
          src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`}
        />
      ) : (
        <div className="organic-isomer__svg mono" aria-hidden="true">
          {smiles}
        </div>
      )}
      <figcaption>{name}</figcaption>
    </figure>
  );
}

export function OrganicStage() {
  const Lz = useLocalized();
  const { tab, group, isomerSet } = useOrganicStore();
  const card = useMemo(() => organicCard(), []);
  usePublishCard(card);
  const set = ISOMERS.find((i) => i.formula === isomerSet);
  return (
    <div className="chem-view organic">
      <div className="chem-overlay">
        <span className="chem-chip">
          <strong className="stage__hud-title">{Lz(TITLE)}</strong>
        </span>
        <span className="chem-chip">{Lz(TAB_NAME[tab])}</span>
      </div>
      {tab === 'groups' && <IrBands groupId={group} />}
      {tab === 'formula' && (
        <div className="organic-stage__body">
          <FormulaSteps />
        </div>
      )}
      {tab === 'isomers' && set && (
        <div className="organic-stage__body">
          <p>
            {Lz(
              L(
                `Các đồng phân có cùng công thức phân tử ${formatFormula(set.formula)} (${set.book}):`,
                `Isomers sharing the molecular formula ${formatFormula(set.formula)} (${set.book}):`,
              ),
            )}
          </p>
          <div className="organic-isomers" role="list">
            {set.structures.map((s) => (
              <div role="listitem" key={s.smiles}>
                <IsomerCard name={s.name} smiles={s.smiles} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function OrganicPanel() {
  const Lz = useLocalized();
  const { tab, group, C, H, O, M, isomerSet } = useOrganicStore();
  const g = GROUPS.find((x) => x.id === group);
  const pctField = (e: El, v: number | null) => (
    <label key={e}>
      <span>%{e}</span>
      <NumberField
        label={`%${e}`}
        // "The rest" shows what is left of 100 %, rounded as the inputs are.
        value={v ?? Number((100 - [C, H, O].reduce<number>((a, b) => a + (b ?? 0), 0)).toFixed(2))}
        min={0}
        max={100}
        onChange={(x) => {
          setOrganic({ [e]: x });
        }}
      />
      <button
        type="button"
        className="btn btn--ghost"
        aria-pressed={v === null}
        onClick={() => {
          setOrganic({ [e]: v === null ? 0 : null });
        }}
      >
        {Lz(L('còn lại', 'the rest'))}
      </button>
    </label>
  );
  return (
    <div className="chem-form organic-panel">
      <div className="segmented" role="radiogroup" aria-label={Lz(L('Phần bài học', 'Part'))}>
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={tab === t}
            className="segmented__item"
            onClick={() => {
              setOrganic({ tab: t });
            }}
          >
            {Lz(TAB_NAME[t])}
          </button>
        ))}
      </div>
      {tab === 'groups' && (
        <>
          <div
            className="organic-panel__list"
            role="radiogroup"
            aria-label={Lz(L('Nhóm chức', 'Functional group'))}
          >
            {GROUPS.map((x) => (
              <button
                key={x.id}
                type="button"
                role="radio"
                aria-checked={group === x.id}
                className="btn btn--ghost"
                onClick={() => {
                  setOrganic({ group: x.id });
                }}
              >
                {Lz(x.name)}
              </button>
            ))}
          </div>
          {g && (
            <dl className="organic-panel__facts">
              <dt>{Lz(L('Nhóm chức', 'Group'))}</dt>
              <dd className="mono">{g.group}</dd>
              <dt>{Lz(L('Ví dụ', 'Example'))}</dt>
              <dd className="mono">{formatFormula(g.example)}</dd>
              <dt>{Lz(L('Số sóng IR', 'IR band'))}</dt>
              <dd>
                {g.ir.length
                  ? g.ir.map((b) => `${b.bond}: ${String(b.low)}–${String(b.high)} cm⁻¹`).join('; ')
                  : Lz(L('Bảng 10.2 không ghi', 'Not in Table 10.2'))}
              </dd>
            </dl>
          )}
        </>
      )}
      {tab === 'formula' && (
        <>
          <div className="organic-panel__presets">
            {PROBLEMS.map((p) => (
              <button
                key={p.id}
                type="button"
                className="btn btn--ghost"
                onClick={() => {
                  setOrganic({ problem: p.id });
                }}
              >
                {Lz(p.name)} ({p.book})
              </button>
            ))}
          </div>
          {pctField('C', C)}
          {pctField('H', H)}
          {pctField('O', O)}
          <label>
            <span>{Lz(L('Phân tử khối M (peak [M⁺])', 'Molar mass M (peak [M⁺])'))}</span>
            <NumberField
              label="M"
              value={M}
              min={1}
              max={2000}
              onChange={(x) => {
                setOrganic({ M: x });
              }}
            />
          </label>
        </>
      )}
      {tab === 'isomers' && (
        <div
          className="organic-panel__list"
          role="radiogroup"
          aria-label={Lz(L('Công thức phân tử', 'Molecular formula'))}
        >
          {ISOMERS.map((i) => (
            <button
              key={i.formula}
              type="button"
              role="radio"
              aria-checked={isomerSet === i.formula}
              className="btn btn--ghost"
              onClick={() => {
                setOrganic({ isomerSet: i.formula });
              }}
            >
              {formatFormula(i.formula)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function OrganicBottom() {
  const Lz = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const { tab } = useOrganicStore();
  if (tab === 'isomers')
    return (
      <table className="organic-table">
        <caption>
          {Lz(L('Nhiệt độ sôi theo cấu tạo (tr. 75)', 'Boiling points and structure (p. 75)'))}
        </caption>
        <tbody>
          {BOILING.map((b) => (
            <tr key={b.formula}>
              <th scope="row" className="mono">
                {formatFormula(b.formula)}
              </th>
              <td className="mono">{formatNumber(locale, b.bp_C)} °C</td>
              <td>{Lz(b.note)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  return (
    <table className="organic-table">
      <caption>
        {Lz(
          L(
            'Bảng 10.1: một số nhóm chức cơ bản (tr. 60)',
            'Table 10.1: basic functional groups (p. 60)',
          ),
        )}
      </caption>
      <tbody>
        {GROUPS.map((g) => (
          <tr key={g.id}>
            <th scope="row">{Lz(g.name)}</th>
            <td className="mono">{g.group}</td>
            <td className="mono">{formatFormula(g.example)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
