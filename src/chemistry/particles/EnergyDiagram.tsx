import { formatNumber } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { L } from '../common';
import { diagramGeometry, diagramLabels, energyLevels, type PlacedLabel } from './energyLevels';

const KIND = {
  exothermic: L('tỏa nhiệt', 'exothermic'),
  endothermic: L('thu nhiệt', 'endothermic'),
  none: L('không tỏa, không thu nhiệt', 'neither exothermic nor endothermic'),
};

/**
 * Energy diagram of the learner's reaction: the three levels come from Eₐ(thuận) and Eₐ(nghịch)
 * (kept to scale), the curve between them is a qualitative drawing and is labelled as such.
 */
export function EnergyDiagram({ eaf, ear }: { eaf: number; ear: number }) {
  const Lz = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const l = energyLevels(eaf, ear);
  const g = diagramGeometry(l, 22, 146);
  const kj = (j: number) =>
    `${formatNumber(locale, j / 1000, { maximumSignificantDigits: 3 }).replace(/^-/, '−')} kJ/mol`;
  const text = {
    reactants: Lz(L('Chất đầu', 'Reactants')),
    products: Lz(L('Sản phẩm', 'Products')),
    dH: 'ΔH',
    eaf: Lz(L('Eₐ(thuận)', 'Eₐ(forward)')),
    ear: Lz(L('Eₐ(nghịch)', 'Eₐ(reverse)')),
  };
  const at = diagramLabels(g, text);
  const label = (id: keyof typeof text, p: PlacedLabel) => (
    <text className="eq-energy__text" x={p.x} y={p.y} textAnchor={p.anchor}>
      {text[id]}
    </text>
  );
  const summary = Lz(
    L(
      `Giản đồ năng lượng: Eₐ(thuận) = ${kj(eaf)}, Eₐ(nghịch) = ${kj(ear)}, ΔH = ${kj(l.dH)} (${KIND[l.kind].vi})`,
      `Energy diagram: Eₐ(forward) = ${kj(eaf)}, Eₐ(reverse) = ${kj(ear)}, ΔH = ${kj(l.dH)} (${KIND[l.kind].en})`,
    ),
  );
  return (
    <figure className="eq-energy">
      <figcaption className="eq-energy__head">
        <span className="econf__label">{Lz(L('Giản đồ năng lượng', 'Energy diagram'))}</span>
        <span className="chem-chip chem-chip--qual">
          {Lz(
            L('Hình dạng đường cong: minh họa định tính', 'Curve shape: qualitative illustration'),
          )}
        </span>
      </figcaption>
      <svg className="eq-energy__svg" viewBox="0 0 320 176" role="img" aria-label={summary}>
        <path className="eq-energy__axis" d="M12 160 L12 12 M12 160 L312 160" />
        <text className="eq-energy__text" x="16" y="14">
          E
        </text>
        <text className="eq-energy__text" x="310" y="172" textAnchor="end">
          {Lz(L('Tiến trình phản ứng', 'Reaction progress'))}
        </text>
        <path className="eq-energy__ref" d={`M90 ${String(g.yr)} L306 ${String(g.yr)}`} />
        <path className="eq-energy__curve" d={g.d} />
        <path className="eq-energy__span" d={`M110 ${String(g.yr)} L110 ${String(g.yp)}`} />
        {label('eaf', at.eaf)}
        <path className="eq-energy__span" d={`M215 ${String(g.yq)} L215 ${String(g.yp)}`} />
        {label('ear', at.ear)}
        <path className="eq-energy__span" d={`M302 ${String(g.yr)} L302 ${String(g.yq)}`} />
        {label('dH', at.dH)}
        {label('reactants', at.reactants)}
        {label('products', at.products)}
      </svg>
    </figure>
  );
}
