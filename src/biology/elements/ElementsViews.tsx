import { formatNumber } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { cx } from '@/ui/cx';
import { L, usePublishCard } from '../common';
import { Range, Segmented } from '../ui';
import { ELEMENTS_CARD, WATER_CARD } from './card';
import {
  BODY_WATER_PCT,
  CARBON_ROLE,
  CHON,
  GROUP_NAME,
  GROUP_ROLE,
  SLICES,
  WATER,
  evaporationWarmEquivalent,
  groupShare,
  heatToEvaporate,
  heatToWarm,
  shareOf,
  sliceName,
} from './data';
import { WATER_LIMITS, useElements, type ElementsView } from './store';
import '../bio.css';
import '../sh10.css';

function useNum() {
  const locale = useSettingsStore((s) => s.locale);
  return (v: number, digits = 4) => formatNumber(locale, v, { maximumSignificantDigits: digits });
}

function ViewSwitch() {
  const view = useElements((s) => s.view);
  return (
    <Segmented<ElementsView>
      label={L('Nội dung', 'Content')}
      value={view}
      options={[
        { id: 'elements', label: L('Nguyên tố', 'Elements') },
        { id: 'water', label: L('Nước', 'Water') },
      ]}
      onChange={(v) => {
        useElements.setState({ view: v });
      }}
    />
  );
}

/** "Các nguyên tố hoá học và nước": the element shares, or water's numbers. */
export function ElementsStage() {
  const view = useElements((s) => s.view);
  usePublishCard(view === 'elements' ? ELEMENTS_CARD : WATER_CARD);
  return view === 'elements' ? <SharesView /> : <WaterView />;
}

function SharesView() {
  const Lz = useLocalized();
  const num = useNum();
  const selected = useElements((s) => s.selected);
  const max = Math.max(...SLICES.map((s) => s.share_pct));
  return (
    <div className="bio-view">
      <div className="chem-overlay">
        <ViewSwitch />
        <span className="chem-chip">C + H + O + N = {num(shareOf(CHON))}%</span>
        <span className="chem-chip">
          {Lz(GROUP_NAME.macro)}: {num(groupShare('macro'))}%
        </span>
        <span className="chem-chip">
          {Lz(GROUP_NAME.trace)}: {num(groupShare('trace'))}%
        </span>
      </div>
      <div className="el-chart">
        <ul
          className="el-chart__list"
          aria-label={Lz(L('Tỉ lệ các nguyên tố trong cơ thể người', 'Elements of the human body'))}
        >
          {SLICES.map((s) => {
            const on = s.id === selected;
            const name = Lz(sliceName(s));
            return (
              <li key={s.id}>
                <button
                  type="button"
                  className={cx('el-bar', on && 'is-active')}
                  aria-pressed={on}
                  onClick={() => {
                    useElements.setState({ selected: on ? null : s.id });
                  }}
                >
                  <span>{name}</span>
                  <span className="el-bar__track" aria-hidden="true">
                    <span
                      className={`el-bar__fill el-bar__fill--${s.group}`}
                      style={{ width: `${String((100 * s.share_pct) / max)}%` }}
                    />
                  </span>
                  <span className="el-bar__value">{num(s.share_pct)}%</span>
                </button>
              </li>
            );
          })}
        </ul>
        <p className="el-legend">
          <span>
            <i className="el-bar__fill--macro" aria-hidden="true" />
            {Lz(GROUP_NAME.macro)}
          </span>
          <span>
            <i className="el-bar__fill--trace" aria-hidden="true" />
            {Lz(GROUP_NAME.trace)}
          </span>
        </p>
      </div>
      <p className="bio-caption">
        {Lz(
          L(
            'Tỉ lệ khối lượng trong cơ thể người — số liệu Hình 4.1, SGK Sinh học 10 KNTT (chờ giáo viên duyệt).',
            'Share of the human body by mass — figure 4.1 of SGK Sinh học 10 KNTT (awaiting teacher review).',
          ),
        )}
      </p>
    </div>
  );
}

function WaterView() {
  const Lz = useLocalized();
  const num = useNum();
  const mass = useElements((s) => s.mass);
  const dT = useElements((s) => s.dT);
  const q1 = heatToWarm(mass, dT);
  const q2 = heatToEvaporate(mass);
  return (
    <div className="bio-view">
      <div className="chem-overlay">
        <ViewSwitch />
      </div>
      <div className="water-facts">
        <div className="water-facts__grid">
          <div className="water-facts__item">
            {Lz(L('Nước trong cơ thể người', 'Water in the human body'))}
            <strong>≈ {num(BODY_WATER_PCT)}%</strong>
            <span className="small muted">{Lz(L('SGK tr. 25', 'textbook p. 25'))}</span>
          </div>
          <div className="water-facts__item">
            {Lz(L('Nhiệt dung riêng c (25 °C)', 'Specific heat c (25 °C)'))}
            <strong>{num(WATER.c_specific_j_g_k)} J/(g·°C)</strong>
            <span className="small muted">NIST</span>
          </div>
          <div className="water-facts__item">
            {Lz(L('Nhiệt bay hơi L (25 °C)', 'Heat of vaporization L (25 °C)'))}
            <strong>
              {num(WATER.l_vap_j_g)} J/g ({num(WATER.dvap_h_kj_mol, 3)} kJ/mol)
            </strong>
            <span className="small muted">NIST (CODATA)</span>
          </div>
        </div>
        <p data-testid="water-q1">
          {Lz(L('Làm nóng', 'Warming'))} {num(mass)} g {Lz(L('nước thêm', 'of water by'))} {num(dT)}{' '}
          °C: Q₁ = m·c·ΔT = <strong>{num(q1)} J</strong>
        </p>
        <p data-testid="water-q2">
          {Lz(L('Làm bay hơi', 'Evaporating'))} {num(mass)} g {Lz(L('nước', 'of water'))}: Q₂ = m·L
          = <strong>{num(q2)} J</strong> — {Lz(L('gấp', 'that is'))} {num(q2 / q1, 3)}{' '}
          {Lz(L('lần Q₁', 'times Q₁'))}
        </p>
        <p data-testid="water-equivalent">
          {Lz(
            L(
              'Bay hơi 1 g nước lấy đi lượng nhiệt đủ làm nóng',
              'Evaporating 1 g of water takes away enough heat to warm',
            ),
          )}{' '}
          <strong>{num(evaporationWarmEquivalent(), 3)} g</strong>{' '}
          {Lz(L('nước thêm 1 °C.', 'of water by 1 °C.'))}
        </p>
        <p>
          {Lz(
            L(
              'Phân tử nước phân cực: phía nguyên tử oxygen tích điện âm, phía hai nguyên tử hydrogen tích điện dương. Các phân tử nước hút nhau bằng liên kết hydrogen, nên cần nhiều nhiệt mới làm nước nóng lên hay bay hơi. Nhờ vậy sinh vật dễ giữ nhiệt độ cơ thể ổn định, và sự bay hơi nước làm mát cơ thể.',
              'The water molecule is polar: the oxygen side is negative, the two hydrogen sides positive. Water molecules hold each other by hydrogen bonds, so much heat is needed to warm water or to evaporate it. This helps living things keep a steady body temperature, and evaporating water cools the body.',
            ),
          )}
        </p>
        <p>{Lz(L('Vai trò của nước đối với tế bào:', 'Water’s roles in the cell:'))}</p>
        <ul>
          <li>
            {Lz(
              L(
                'là thành phần chủ yếu cấu tạo nên tế bào và cơ thể;',
                'the main component of cells and the body;',
              ),
            )}
          </li>
          <li>
            {Lz(
              L(
                'là dung môi hoà tan nhiều chất cần cho hoạt động sống của tế bào (nhờ tính phân cực);',
                'a solvent for many substances the cell needs (thanks to its polarity);',
              ),
            )}
          </li>
          <li>
            {Lz(
              L(
                'là nguyên liệu và môi trường của nhiều phản ứng sinh hoá trong tế bào;',
                'a raw material and the medium of many biochemical reactions in the cell;',
              ),
            )}
          </li>
          <li>
            {Lz(
              L(
                'góp phần tạo hình dạng không gian của nhiều phân tử hữu cơ và điều hoà nhiệt độ tế bào, cơ thể.',
                'helps shape many organic molecules in space and regulates the temperature of the cell and the body.',
              ),
            )}
          </li>
        </ul>
        <p className="small muted">
          {Lz(
            L(
              'Nguồn chữ: SGK Sinh học 10 KNTT, tr. 26–27 · chờ giáo viên duyệt',
              'Text: SGK Sinh học 10 KNTT, pp. 26–27 · awaiting teacher review',
            ),
          )}
        </p>
      </div>
    </div>
  );
}

/** Inspector: the picked element group's card, or the water calculator's inputs. */
export function ElementsPanel() {
  const view = useElements((s) => s.view);
  return view === 'elements' ? <SliceCard /> : <WaterInputs />;
}

function SliceCard() {
  const Lz = useLocalized();
  const num = useNum();
  const selected = useElements((s) => s.selected);
  const s = SLICES.find((x) => x.id === selected);
  return (
    <div className="cell-parts" aria-live="polite">
      {s ? (
        <div className="cell-part-card">
          <strong>{Lz(sliceName(s))}</strong>
          <p>
            {Lz(GROUP_NAME[s.group])} · {num(s.share_pct)}%{' '}
            {Lz(L('khối lượng cơ thể người', 'of body mass'))}
          </p>
          <p>{Lz(GROUP_ROLE[s.group])}</p>
          {s.id === 'C' && <p>{Lz(CARBON_ROLE)}</p>}
          <p className="small muted">
            {Lz(L('Nguồn', 'Source'))}: SGK Sinh học 10 KNTT, tr. 24–25 ·{' '}
            {Lz(L('chờ giáo viên duyệt', 'awaiting teacher review'))}
          </p>
        </div>
      ) : (
        <p className="small muted">
          {Lz(
            L(
              'Chọn một thanh để xem nguyên tố đó thuộc nhóm nào và có vai trò gì.',
              'Pick a bar to see which group the element belongs to and what it does.',
            ),
          )}
        </p>
      )}
    </div>
  );
}

function WaterInputs() {
  const Lz = useLocalized();
  const mass = useElements((s) => s.mass);
  const dT = useElements((s) => s.dT);
  return (
    <div className="chem-form">
      <Range
        label={L('Khối lượng nước m', 'Mass of water m')}
        value={mass}
        min={WATER_LIMITS.mass[0]}
        max={WATER_LIMITS.mass[1]}
        step={WATER_LIMITS.mass[2]}
        unit="g"
        onChange={(v) => {
          useElements.setState({ mass: v });
        }}
      />
      <Range
        label={L('Tăng nhiệt độ ΔT', 'Temperature rise ΔT')}
        value={dT}
        min={WATER_LIMITS.dT[0]}
        max={WATER_LIMITS.dT[1]}
        step={WATER_LIMITS.dT[2]}
        unit="°C"
        onChange={(v) => {
          useElements.setState({ dT: v });
        }}
      />
      <p className="small muted">
        {Lz(
          L(
            'c và L của nước ở 25 °C (NIST Chemistry WebBook); kết quả là gần đúng ở nhiệt độ khác.',
            'Water’s c and L at 25 °C (NIST Chemistry WebBook); approximate at other temperatures.',
          ),
        )}
      </p>
    </div>
  );
}
