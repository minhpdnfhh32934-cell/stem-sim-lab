import { useMemo } from 'react';
import { formatNumber } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import type { LocalizedText } from '@/core/data/dataset';
import { usePublishCard } from '@/modules/usePublishCard';
import { ActionRow, ChoiceGroup } from '@/ui/ModuleControls';
import { AlphaCanvas } from './AlphaCanvas';
import { L, METAL_TITLE, metalCard } from './card';
import { volts } from './format';
import {
  CONDUCTORS,
  COUPLES,
  LIGHT_METAL_MAX_DENSITY,
  METAL_FACTS,
  REAGENTS,
  SALT_METALS,
  TEST_METALS,
  couple,
  coupleLabel,
  metalWith,
  reactionText,
  termText,
  type Couple,
  type Reagent,
} from './model';
import { METAL_TABS, setMetal, useMetalStore, type MetalTab } from './metalStore';
import './electrochem.css';

const TAB_NAME: Record<MetalTab, LocalizedText> = {
  reactions: L('Kim loại phản ứng', 'Reactions'),
  physical: L('Tính chất vật lí', 'Physical properties'),
};

const REAGENT_NAME: Record<Reagent, LocalizedText> = {
  water: L('Nước', 'Water'),
  acid: L('Dung dịch HCl, H₂SO₄ loãng', 'Dilute HCl, H₂SO₄'),
  salt: L('Dung dịch muối', 'Salt solution'),
};

const FACT_NAME: Record<string, LocalizedText> = {
  lightest: L('Kim loại nhẹ nhất', 'Lightest metal'),
  heaviest: L('Kim loại nặng nhất', 'Heaviest metal'),
  highest_mp: L('Nhiệt độ nóng chảy cao nhất', 'Highest melting point'),
  lowest_mp: L('Kim loại duy nhất ở thể lỏng (điều kiện thường)', 'The only liquid metal'),
  hardest: L('Kim loại cứng nhất (cắt được kính)', 'Hardest metal (cuts glass)'),
  best_conductor: L('Dẫn điện tốt nhất', 'Best electrical conductor'),
};

/** The book's examples (tr. 92–93). */
const EXAMPLES = [
  {
    id: 'na-water',
    metal: 'Na',
    reagent: 'water',
    salt: 'Cu',
    name: L('Na + nước (tr. 92)', 'Na + water (p. 92)'),
  },
  {
    id: 'fe-acid',
    metal: 'Fe',
    reagent: 'acid',
    salt: 'Cu',
    name: L('Fe + H₂SO₄ loãng (tr. 93)', 'Fe + dilute H₂SO₄ (p. 93)'),
  },
  {
    id: 'cu-ag',
    metal: 'Cu',
    reagent: 'salt',
    salt: 'Ag',
    name: L('Cu + AgNO₃ (tr. 93)', 'Cu + AgNO₃ (p. 93)'),
  },
  {
    id: 'fe-cu',
    metal: 'Fe',
    reagent: 'salt',
    salt: 'Cu',
    name: L('Fe + CuSO₄ (tr. 93)', 'Fe + CuSO₄ (p. 93)'),
  },
] as const;

const metalLabel = (c: Couple, v: string) => `${c.element} (${coupleLabel(c)}, ${v} V)`;

function ReactionsView() {
  const Lz = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const { metal, reagent, salt } = useMetalStore();
  const m = couple(metal);
  const s = couple(salt);
  const water = m.reacts_with_water_lesson;
  if (reagent === 'salt' && water !== undefined) {
    return (
      <div className="ec-view">
        <p className="ec-note metal-note">
          {Lz(
            L(
              `${m.element} tác dụng với nước ở nhiệt độ thường (Bài ${water}), nên bài này không xét ${m.element} với dung dịch muối.`,
              `${m.element} reacts with water at room temperature (Lesson ${water}), so this lesson does not try it with a salt solution.`,
            ),
          )}
        </p>
      </div>
    );
  }
  const test = metalWith(m, reagent, s);
  if (!test) {
    return (
      <div className="ec-view">
        <p className="ec-note metal-note">
          {Lz(
            L(
              'Hãy chọn dung dịch muối của một kim loại khác.',
              'Choose the salt solution of another metal.',
            ),
          )}
        </p>
      </div>
    );
  }
  const against = test.against;
  const compare = `E°(${coupleLabel(m)}) = ${volts(locale, m)} V ${test.reacts ? '<' : '>'} E°(${coupleLabel(against)}) = ${volts(locale, against)} V`;
  const what =
    reagent === 'salt'
      ? L(`dung dịch chứa ${termText(s.label[0])}`, `a solution of ${termText(s.label[0])}`)
      : REAGENT_NAME[reagent];
  return (
    <div className="ec-view">
      <h3 className="metal-view__head">{`${m.element} + ${Lz(what)}`}</h3>
      <AlphaCanvas
        first={m}
        second={against}
        r={test.reaction}
        label={Lz(L(`So sánh thế điện cực: ${compare}`, `Comparing potentials: ${compare}`))}
      />
      <dl className="ec-result">
        <dt>{Lz(L('Kết luận', 'Verdict'))}</dt>
        <dd className="metal-verdict">
          {Lz(test.reacts ? L('Có phản ứng', 'Reacts') : L('Không phản ứng', 'No reaction'))}
        </dd>
        <dt>{Lz(L('Vì', 'Because'))}</dt>
        <dd>{compare}</dd>
        {test.reaction && (
          <>
            <dt>{Lz(L('Phương trình ion', 'Ionic equation'))}</dt>
            <dd className="ec-result__eq">{reactionText(test.reaction)}</dd>
          </>
        )}
      </dl>
      {reagent === 'water' && water !== undefined && (
        <p className="ec-note">
          {Lz(
            L(
              `Sách (Bài ${water}) cũng nêu ${m.element} tác dụng với nước ở nhiệt độ thường.`,
              `The book (Lesson ${water}) also says ${m.element} reacts with water at room temperature.`,
            ),
          )}
        </p>
      )}
      {reagent === 'water' && m.id === 'Mg' && (
        <p className="ec-note">
          {Lz(
            L(
              'Bảng 25.3 (tr. 119): Mg phản ứng chậm với nước ở nhiệt độ thường, nhanh hơn khi đun nóng.',
              'Table 25.3 (p. 119): Mg reacts slowly with water at room temperature, faster when heated.',
            ),
          )}
        </p>
      )}
    </div>
  );
}

function PhysicalView() {
  const Lz = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const n = (v: number) => formatNumber(locale, v, { maximumFractionDigits: 3 });
  return (
    <div className="ec-view">
      <ul className="metal-facts">
        {METAL_FACTS.map((f) => (
          <li key={f.id} className="metal-fact">
            <span className="metal-fact__what">{Lz(FACT_NAME[f.id] ?? L(f.id, f.id))}</span>
            <strong className="metal-fact__metal">{`${Lz(f.name)} (${f.metal})`}</strong>
            {f.value !== null && (
              <span className="metal-fact__value">
                {f.unit === 'g/cm3'
                  ? `D = ${n(f.value)} g/cm³ · ${Lz(f.value < LIGHT_METAL_MAX_DENSITY ? L('kim loại nhẹ', 'light metal') : L('kim loại nặng', 'heavy metal'))}`
                  : Lz(L(`nóng chảy ở ${n(f.value)} °C`, `melts at ${n(f.value)} °C`))}
              </span>
            )}
            <span className="metal-fact__page">{Lz(L(`tr. ${f.page}`, `p. ${f.page}`))}</span>
          </li>
        ))}
      </ul>
      <p className="ec-note">
        {Lz(
          L(
            `Dẫn điện tốt nhất là ${CONDUCTORS.join(', ')}, theo thứ tự đó (tr. 90). Kim loại có khối lượng riêng nhỏ hơn ${n(LIGHT_METAL_MAX_DENSITY)} g/cm³ là kim loại nhẹ, từ ${n(LIGHT_METAL_MAX_DENSITY)} g/cm³ trở lên là kim loại nặng (tr. 91).`,
            `The best conductors are ${CONDUCTORS.join(', ')}, in this order (p. 90). Metals below ${n(LIGHT_METAL_MAX_DENSITY)} g/cm³ are light, from ${n(LIGHT_METAL_MAX_DENSITY)} g/cm³ up heavy (p. 91).`,
          ),
        )}
      </p>
    </div>
  );
}

export function MetalStage() {
  const Lz = useLocalized();
  const tab = useMetalStore((s) => s.tab);
  const card = useMemo(() => metalCard(), []);
  usePublishCard(card);
  return (
    <div className="chem-view electrochem">
      <div className="chem-overlay">
        <span className="chem-chip">
          <strong className="stage__hud-title">{Lz(METAL_TITLE)}</strong>
        </span>
        <span className="chem-chip">{Lz(TAB_NAME[tab])}</span>
      </div>
      {tab === 'reactions' ? <ReactionsView /> : <PhysicalView />}
    </div>
  );
}

function MetalSelect({
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
  const locale = useSettingsStore((s) => s.locale);
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
            {metalLabel(c, volts(locale, c))}
          </option>
        ))}
      </select>
    </label>
  );
}

function ReactionsPanel() {
  const Lz = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const { metal, reagent, salt } = useMetalStore();
  const water = couple('H2O');
  const byRule = COUPLES.filter((c) => c.metal && c.E_V < water.E_V).map((c) => c.element);
  return (
    <>
      <MetalSelect
        label={Lz(L('Kim loại', 'Metal'))}
        value={metal}
        items={TEST_METALS}
        onPick={(id) => {
          setMetal({ metal: id });
        }}
      />
      <ChoiceGroup
        label={Lz(L('Tác dụng với', 'React with'))}
        items={REAGENTS}
        value={reagent}
        name={(r) => Lz(REAGENT_NAME[r])}
        onPick={(r) => {
          setMetal({ reagent: r });
        }}
      />
      {reagent === 'salt' && (
        <MetalSelect
          label={Lz(L('Dung dịch muối của', 'Salt solution of'))}
          value={salt}
          items={SALT_METALS}
          onPick={(id) => {
            setMetal({ salt: id });
          }}
        />
      )}
      <ActionRow
        label={Lz(L('Ví dụ trong sách', 'Examples in the book'))}
        items={EXAMPLES.map((e) => e.id)}
        name={(id) => Lz(EXAMPLES.find((e) => e.id === id)?.name ?? L(id, id))}
        onPick={(id) => {
          const e = EXAMPLES.find((x) => x.id === id);
          if (e) setMetal({ metal: e.metal, reagent: e.reagent, salt: e.salt });
        }}
      />
      {reagent === 'water' && (
        <p className="small metal-panel__rule">
          {Lz(
            L(
              `Câu 6 (tr. 92): theo quy tắc E° < ${volts(locale, water)} V, các kim loại trong Bảng 15.1 có thể đẩy hydrogen ra khỏi nước là ${byRule.join(', ')}.`,
              `Question 6 (p. 92): by the rule E° < ${volts(locale, water)} V, the metals of Table 15.1 that can push hydrogen out of water are ${byRule.join(', ')}.`,
            ),
          )}
        </p>
      )}
      {reagent === 'acid' && (
        <p className="small">
          {Lz(
            L(
              'Câu 7 (tr. 93): các kim loại từ Cu đến Au có thế điện cực chuẩn lớn hơn 0 nên không đẩy được hydrogen ra khỏi dung dịch HCl, H₂SO₄ loãng.',
              'Question 7 (p. 93): the metals from Cu to Au have standard potentials above 0, so they do not push hydrogen out of dilute HCl or H₂SO₄.',
            ),
          )}
        </p>
      )}
    </>
  );
}

function PhysicalPanel() {
  const Lz = useLocalized();
  return (
    <ul className="ec-panel__acid">
      <li>
        {Lz(
          L(
            'Ở điều kiện thường, các kim loại đều ở thể rắn (trừ thủy ngân), có tính dẻo, dẫn điện, dẫn nhiệt và có ánh kim.',
            'At ordinary conditions metals are solid (except mercury), malleable, conduct electricity and heat, and are shiny.',
          ),
        )}
      </li>
      <li>
        {Lz(
          L(
            'Các tính chất này do electron tự do trong mạng tinh thể kim loại gây ra.',
            'These properties come from the free electrons in the metal lattice.',
          ),
        )}
      </li>
      <li>
        {Lz(
          L(
            'Kim loại có tính dẻo cao: Au, Ag, Al, Cu, Sn; vàng có thể dát thành lá rất mỏng.',
            'Highly malleable metals: Au, Ag, Al, Cu, Sn; gold can be beaten into very thin leaf.',
          ),
        )}
      </li>
    </ul>
  );
}

export function MetalPanel() {
  const Lz = useLocalized();
  const tab = useMetalStore((s) => s.tab);
  return (
    <div className="chem-form electrochem-panel">
      <ChoiceGroup
        label={Lz(L('Phần bài học', 'Part'))}
        items={METAL_TABS}
        value={tab}
        name={(t) => Lz(TAB_NAME[t])}
        onPick={(t) => {
          setMetal({ tab: t });
        }}
        segmented
      />
      {tab === 'reactions' ? <ReactionsPanel /> : <PhysicalPanel />}
    </div>
  );
}
