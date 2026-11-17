import { useMemo } from 'react';
import type { Locale } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import type { LocalizedText } from '@/core/data/dataset';
import { usePublishCard } from '@/modules/usePublishCard';
import { useCanvas } from '@/ui/canvas/useCanvas';
import { ActionRow, ChoiceGroup } from '@/ui/ModuleControls';
import { AlphaCanvas } from './AlphaCanvas';
import { EC_TITLE, L, electrochemCard } from './card';
import { emfText, volts } from './format';
import {
  BOOK_CELLS,
  COUPLES,
  ELECTRODES,
  PAIRABLE,
  anodeText,
  cathodeText,
  cell,
  couple,
  coupleLabel,
  halfText,
  reaction,
  reactionText,
  reactsWithAcid,
  termText,
  type Couple,
} from './model';
import { EC_TABS, setElectrochem, useElectrochemStore, type EcTab } from './store';
import './electrochem.css';

const TAB_NAME: Record<EcTab, LocalizedText> = {
  series: L('Dãy điện hóa', 'Electrochemical series'),
  cell: L('Pin Galvani', 'Galvanic cell'),
};

/** The book's questions on two couples (tr. 72). */
const BOOK_PAIRS = [
  { id: 'r2', a: 'Cu', b: 'Ag', name: L('Phản ứng (2), tr. 72', 'Reaction (2), p. 72') },
  { id: 'q5a', a: 'Ni', b: 'H', name: L('Câu 5a', 'Question 5a') },
  { id: 'q5b', a: 'Fe', b: 'Cu', name: L('Câu 5b', 'Question 5b') },
  { id: 'q5c', a: 'Zn', b: 'Au', name: L('Câu 5c', 'Question 5c') },
] as const;

function useLocale(): Locale {
  return useSettingsStore((s) => s.locale);
}

/* ───────── Dãy điện hóa: the α rule ───────── */

function SeriesView() {
  const Lz = useLocalized();
  const locale = useLocale();
  const { a, b } = useElectrochemStore();
  const ca = couple(a);
  const cb = couple(b);
  const r = reaction(ca, cb);
  return (
    <div className="ec-view">
      <AlphaCanvas
        first={ca}
        second={cb}
        r={r}
        label={Lz(
          L(
            `Dãy điện hóa: ${coupleLabel(ca)} ${volts(locale, ca)} V, ${coupleLabel(cb)} ${volts(locale, cb)} V`,
            `Electrochemical series: ${coupleLabel(ca)} ${volts(locale, ca)} V, ${coupleLabel(cb)} ${volts(locale, cb)} V`,
          ),
        )}
      />
      {r ? (
        <dl className="ec-result">
          <dt>{Lz(L('Chất khử mạnh hơn', 'Stronger reductant'))}</dt>
          <dd>{termText(r.reductant.label[1])}</dd>
          <dt>{Lz(L('Chất oxi hóa mạnh hơn', 'Stronger oxidant'))}</dt>
          <dd>{termText(r.oxidant.label[0])}</dd>
          <dt>{Lz(L('Phản ứng', 'Reaction'))}</dt>
          <dd className="ec-result__eq">{reactionText(r)}</dd>
        </dl>
      ) : (
        <p className="ec-note">
          {Lz(L('Hãy chọn hai cặp khác nhau.', 'Choose two different couples.'))}
        </p>
      )}
    </div>
  );
}

/* ───────── Pin Galvani ───────── */

function CellView() {
  const Lz = useLocalized();
  const locale = useLocale();
  const { x, y } = useElectrochemStore();
  const c = cell(couple(x), couple(y));
  const ref = useCanvas(
    ({ ctx, width, css }) => {
      if (!c) return;
      const xl = width * 0.28;
      const xr = width * 0.72;
      const bw = 150;
      const top = 170;
      const bottom = 320;
      const liquid = 205;
      ctx.lineWidth = 2;
      for (const [xc, side] of [
        [xl, c.anode],
        [xr, c.cathode],
      ] as const) {
        // Beaker, solution of the metal's ion at 1 M, electrode.
        ctx.fillStyle = css('--chart-1');
        ctx.globalAlpha = 0.15;
        ctx.fillRect(xc - bw / 2, liquid, bw, bottom - liquid);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = css('--text-muted');
        ctx.beginPath();
        ctx.moveTo(xc - bw / 2, top);
        ctx.lineTo(xc - bw / 2, bottom);
        ctx.lineTo(xc + bw / 2, bottom);
        ctx.lineTo(xc + bw / 2, top);
        ctx.stroke();
        ctx.fillStyle = css('--text-muted');
        ctx.fillRect(xc - 11, 130, 22, 160);
        ctx.fillStyle = css('--text');
        ctx.font = '16px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(side.element, xc - 30, 150);
        ctx.font = '13px system-ui, sans-serif';
        ctx.fillText(`${termText(side.ox[0]?.[1] ?? '')} 1 M`, xc, bottom - 14);
      }
      // Salt bridge.
      ctx.strokeStyle = css('--text-muted');
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.moveTo(xl + 45, 250);
      ctx.lineTo(xl + 45, 150);
      ctx.lineTo(xr - 45, 150);
      ctx.lineTo(xr - 45, 250);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = css('--text-muted');
      ctx.font = '12px system-ui, sans-serif';
      ctx.fillText(Lz(L('Cầu muối', 'Salt bridge')), width / 2, 140);
      // Wire and voltmeter.
      const cx = width / 2;
      ctx.strokeStyle = css('--text');
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(xl, 130);
      ctx.lineTo(xl, 60);
      ctx.lineTo(cx - 60, 60);
      ctx.moveTo(cx + 60, 60);
      ctx.lineTo(xr, 60);
      ctx.lineTo(xr, 130);
      ctx.stroke();
      ctx.strokeRect(cx - 60, 38, 120, 44);
      ctx.fillStyle = css('--text');
      ctx.font = 'bold 18px system-ui, sans-serif';
      ctx.fillText(`${emfText(locale, c.emf)} V`, cx, 66);
      // Electrons leave the anode through the wire.
      ctx.strokeStyle = css('--accent');
      ctx.fillStyle = css('--accent');
      ctx.lineWidth = 2;
      for (const [from, to] of [
        [xl + 14, cx - 74],
        [cx + 74, xr - 14],
      ] as const) {
        ctx.beginPath();
        ctx.moveTo(from, 46);
        ctx.lineTo(to, 46);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(to, 46);
        ctx.lineTo(to - 9, 41);
        ctx.lineTo(to - 9, 51);
        ctx.closePath();
        ctx.fill();
      }
      ctx.font = '14px system-ui, sans-serif';
      ctx.fillText('e', (xl + cx) / 2, 36);
      ctx.fillText('e', (xr + cx) / 2, 36);
      ctx.fillStyle = css('--text');
      ctx.font = '15px system-ui, sans-serif';
      ctx.fillText(Lz(L('Anode (−)', 'Anode (−)')), xl, bottom + 26);
      ctx.fillText(Lz(L('Cathode (+)', 'Cathode (+)')), xr, bottom + 26);
      ctx.font = '14px system-ui, sans-serif';
      ctx.fillText(anodeText(c.anode), xl, bottom + 48);
      ctx.fillText(cathodeText(c.cathode), xr, bottom + 48);
    },
    false,
    [x, y, locale],
  );
  if (!c) {
    return (
      <div className="ec-view">
        <p className="ec-note">
          {Lz(L('Hãy chọn hai kim loại khác nhau.', 'Choose two different metals.'))}
        </p>
      </div>
    );
  }
  return (
    <div className="ec-view">
      <canvas
        ref={ref}
        className="ec-canvas ec-canvas--cell"
        role="img"
        aria-label={Lz(
          L(
            `Pin ${c.anode.element} – ${c.cathode.element}: anode ${c.anode.element}, cathode ${c.cathode.element}, E°pin = ${emfText(locale, c.emf)} V`,
            `${c.anode.element} – ${c.cathode.element} cell: anode ${c.anode.element}, cathode ${c.cathode.element}, E°cell = ${emfText(locale, c.emf)} V`,
          ),
        )}
      />
      <dl className="ec-result">
        <dt>{Lz(L('Phản ứng trong pin', 'Cell reaction'))}</dt>
        <dd className="ec-result__eq">{reactionText(c.reaction)}</dd>
        <dt>{Lz(L('Sức điện động chuẩn', 'Standard EMF'))}</dt>
        <dd className="ec-result__emf">
          {`E°pin = ${volts(locale, c.cathode)} − (${volts(locale, c.anode)}) = ${emfText(locale, c.emf)} V`}
        </dd>
      </dl>
    </div>
  );
}

export function ElectrochemStage() {
  const Lz = useLocalized();
  const tab = useElectrochemStore((s) => s.tab);
  const card = useMemo(() => electrochemCard(), []);
  usePublishCard(card);
  return (
    <div className="chem-view electrochem">
      <div className="chem-overlay">
        <span className="chem-chip">
          <strong className="stage__hud-title">{Lz(EC_TITLE)}</strong>
        </span>
        <span className="chem-chip">{Lz(TAB_NAME[tab])}</span>
      </div>
      {tab === 'series' ? <SeriesView /> : <CellView />}
    </div>
  );
}

/* ───────── Panel ───────── */

function CoupleSelect({
  label,
  value,
  items,
  onPick,
}: {
  label: string;
  value: string;
  items: readonly Couple[];
  onPick: (id: string) => void;
}) {
  const locale = useLocale();
  return (
    <label>
      <span>{label}</span>
      <select
        value={value}
        onChange={(e) => {
          onPick(e.target.value);
        }}
      >
        {items.map((c) => (
          <option key={c.id} value={c.id}>
            {`${coupleLabel(c)} (${volts(locale, c)} V)`}
          </option>
        ))}
      </select>
    </label>
  );
}

function SeriesPanel() {
  const Lz = useLocalized();
  const { a, b } = useElectrochemStore();
  const metals = [couple(a), couple(b)].filter((c) => c.metal);
  return (
    <>
      <CoupleSelect
        label={Lz(L('Cặp thứ nhất', 'First couple'))}
        value={a}
        items={PAIRABLE}
        onPick={(id) => {
          setElectrochem({ a: id });
        }}
      />
      <CoupleSelect
        label={Lz(L('Cặp thứ hai', 'Second couple'))}
        value={b}
        items={PAIRABLE}
        onPick={(id) => {
          setElectrochem({ b: id });
        }}
      />
      <ActionRow
        label={Lz(L('Câu hỏi trong sách', 'Questions in the book'))}
        items={BOOK_PAIRS.map((p) => p.id)}
        name={(id) => Lz(BOOK_PAIRS.find((p) => p.id === id)?.name ?? L(id, id))}
        onPick={(id) => {
          const p = BOOK_PAIRS.find((q) => q.id === id);
          if (p) setElectrochem({ a: p.a, b: p.b });
        }}
      />
      {metals.length > 0 && (
        <ul className="ec-panel__acid">
          {metals.map((c) => (
            <li key={c.id}>
              {Lz(
                reactsWithAcid(c)
                  ? L(
                      `${c.element} tác dụng được với dung dịch acid (H⁺) vì E°(${coupleLabel(c)}) < 0.`,
                      `${c.element} reacts with an acid (H⁺) since E°(${coupleLabel(c)}) < 0.`,
                    )
                  : L(
                      `${c.element} không tác dụng với dung dịch acid (H⁺) vì E°(${coupleLabel(c)}) > 0.`,
                      `${c.element} does not react with an acid (H⁺) since E°(${coupleLabel(c)}) > 0.`,
                    ),
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="small">
        {Lz(
          L(
            'Quy tắc α (tr. 72): chất khử của cặp có thế điện cực chuẩn nhỏ hơn tác dụng với chất oxi hóa của cặp có thế lớn hơn.',
            'The α rule (p. 72): the reductant of the couple with the lower standard potential reacts with the oxidant of the couple with the higher one.',
          ),
        )}
      </p>
    </>
  );
}

function CellPanel() {
  const Lz = useLocalized();
  const locale = useLocale();
  const { x, y } = useElectrochemStore();
  const c = cell(couple(x), couple(y));
  return (
    <>
      <CoupleSelect
        label={Lz(L('Điện cực thứ nhất', 'First electrode'))}
        value={x}
        items={ELECTRODES}
        onPick={(id) => {
          setElectrochem({ x: id });
        }}
      />
      <CoupleSelect
        label={Lz(L('Điện cực thứ hai', 'Second electrode'))}
        value={y}
        items={ELECTRODES}
        onPick={(id) => {
          setElectrochem({ y: id });
        }}
      />
      <ActionRow
        label={Lz(L('Pin trong sách', 'Cells in the book'))}
        items={BOOK_CELLS.map((b) => `${b.anode}-${b.cathode}`)}
        name={(id) => {
          const b = BOOK_CELLS.find((q) => `${q.anode}-${q.cathode}` === id);
          return b
            ? Lz(
                L(
                  `Pin ${b.anode} – ${b.cathode} (tr. ${b.page})`,
                  `${b.anode} – ${b.cathode} cell (p. ${b.page})`,
                ),
              )
            : id;
        }}
        onPick={(id) => {
          const b = BOOK_CELLS.find((q) => `${q.anode}-${q.cathode}` === id);
          if (b) setElectrochem({ x: b.anode, y: b.cathode });
        }}
      />
      {c && (
        <dl className="ec-facts">
          <dt>{Lz(L('Anode (cực âm)', 'Anode (negative)'))}</dt>
          <dd className="ec-panel__anode">{c.anode.element}</dd>
          <dt>{Lz(L('Cathode (cực dương)', 'Cathode (positive)'))}</dt>
          <dd className="ec-panel__cathode">{c.cathode.element}</dd>
          <dt>E°pin</dt>
          <dd className="mono ec-panel__emf">{`${emfText(locale, c.emf)} V`}</dd>
          <dt>{Lz(L('Electron đi qua dây dẫn', 'Electrons in the wire'))}</dt>
          <dd>
            {Lz(
              L(
                `từ ${c.anode.element} sang ${c.cathode.element}`,
                `from ${c.anode.element} to ${c.cathode.element}`,
              ),
            )}
          </dd>
        </dl>
      )}
      <p className="small">
        {Lz(
          L(
            'Li, Na, K tác dụng với nước ở điều kiện thường (Bài 24); Ca, Ba tác dụng mạnh với nước ở nhiệt độ thường (Bài 25), nên không dùng làm điện cực nhúng trong dung dịch.',
            'Li, Na and K react with water at ordinary conditions (Lesson 24); Ca and Ba react strongly with water at room temperature (Lesson 25), so they are not used as electrodes in a solution.',
          ),
        )}
      </p>
    </>
  );
}

export function ElectrochemPanel() {
  const Lz = useLocalized();
  const tab = useElectrochemStore((s) => s.tab);
  return (
    <div className="chem-form electrochem-panel">
      <ChoiceGroup
        label={Lz(L('Phần bài học', 'Part'))}
        items={EC_TABS}
        value={tab}
        name={(t) => Lz(TAB_NAME[t])}
        onPick={(t) => {
          setElectrochem({ tab: t });
        }}
        segmented
      />
      {tab === 'series' ? <SeriesPanel /> : <CellPanel />}
    </div>
  );
}

/* ───────── Bottom: Bảng 15.1 ───────── */

export function ElectrochemBottom() {
  const Lz = useLocalized();
  const locale = useLocale();
  return (
    <table className="ec-table">
      <caption>{Lz(L('Bảng 15.1 (SGK)', 'Table 15.1 (textbook)'))}</caption>
      <thead>
        <tr>
          <th scope="col">{Lz(L('Nguyên tố', 'Element'))}</th>
          <th scope="col">{Lz(L('Bán phản ứng', 'Half-reaction'))}</th>
          <th scope="col">{Lz(L('Thế điện cực chuẩn E° (V)', 'Standard potential E° (V)'))}</th>
        </tr>
      </thead>
      <tbody>
        {COUPLES.map((c) => (
          <tr key={c.id}>
            <th scope="row">{termText(c.element)}</th>
            <td>{halfText(c)}</td>
            <td className="mono">
              {volts(locale, c)}
              {c.at_pH7 ? Lz(L(' (tại pH = 7)', ' (at pH 7)')) : ''}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
