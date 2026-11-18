import { lazy, Suspense } from 'react';
import { formatNumber } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import type { LocalizedText } from '@/core/data/dataset';
import { Bio3DToolbar } from '@/biology/view3d/switch';
import { useShow3d } from '@/biology/view3d/support';
import { ActionRow } from '@/ui/ModuleControls';
import { L, usePublishCard } from '../common';
import { SEXLINKED_CARD, SEXLINKED_TITLE } from '../heredityCards';
import { Segmented } from '../ui';
import {
  BOOK_CROSSES,
  FATHERS,
  MOTHERS,
  cross,
  gameteText,
  genotype,
  motherGametes,
  sonShare,
  type Father,
  type Mother,
} from './model';

const SexLinked3DView = lazy(() =>
  import('./sexlinked3d/SexLinked3DView').then((m) => ({ default: m.SexLinked3DView })),
);
import { restoreSexLinked, useSexLinked } from './store';
import '../bio.css';
import '../heredity.css';

const motherText = (m: Mother) => genotype(m, false);
const fatherText = (f: Father) => genotype(f, true);

const TRAIT = { dominant: L('mắt đỏ', 'red eyes'), recessive: L('mắt trắng', 'white eyes') };
const CROSS_NAME: Record<string, LocalizedText> = {
  'forward-p': L('Lai thuận: P', 'Forward: P'),
  'forward-f1': L('Lai thuận: F1 × F1', 'Forward: F1 × F1'),
  'reciprocal-p': L('Lai nghịch: P', 'Reciprocal: P'),
  'reciprocal-f1': L('Lai nghịch: F1 × F1', 'Reciprocal: F1 × F1'),
};

export function SexLinkedStage() {
  const Lz = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const { mother, father } = useSexLinked();
  usePublishCard(SEXLINKED_CARD);
  const children = cross(mother, father);
  const pct = (x: number) => `${formatNumber(locale, 100 * x, { maximumFractionDigits: 1 })} %`;
  const eggs = motherGametes(mother);
  const sperms = [father, 'Y'] as const;
  const { show3d } = useShow3d('sexLinkage');
  const title = (
    <span className="chem-chip">
      <strong className="stage__hud-title">{Lz(SEXLINKED_TITLE)}</strong>
    </span>
  );
  if (show3d)
    return (
      <Suspense fallback={<div className="bio-view" />}>
        <SexLinked3DView
          label={`♀ ${genotype(mother, false)} × ♂ ${genotype(father, true)}`}
          top={
            <>
              {title}
              <span className="chem-chip mono">{`♀ ${genotype(mother, false)} × ♂ ${genotype(father, true)}`}</span>
            </>
          }
        />
      </Suspense>
    );
  return (
    <div className="bio-view">
      <div className="chem-overlay">
        {title}
        <Bio3DToolbar lesson="sexLinkage" />
      </div>
      <div className="bio-scroll heredity">
        <p className="heredity__cross">{`♀ ${motherText(mother)} × ♂ ${fatherText(father)}`}</p>
        <table className="heredity__punnett">
          <caption>
            {Lz(L('Sơ đồ lai (mỗi giao tử chiếm 1/2)', 'The cross (each gamete 1/2)'))}
          </caption>
          <thead>
            <tr>
              <th scope="col">{Lz(L('Trứng / tinh trùng', 'Egg / sperm'))}</th>
              {sperms.map((s, j) => (
                <th key={j} scope="col">
                  {gameteText(s)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {eggs.map((e, i) => (
              <tr key={i}>
                <th scope="row">{gameteText(e)}</th>
                {sperms.map((s, j) => {
                  const male = s === 'Y';
                  const alleles = male ? e : [e, s].sort().join('');
                  const dominant = alleles.includes('A');
                  return (
                    <td
                      key={j}
                      className={dominant ? 'heredity__cell' : 'heredity__cell heredity__cell--rec'}
                    >
                      <span>{`${male ? '♂' : '♀'} ${genotype(alleles, male)}`}</span>
                      <span className="heredity__trait">
                        {Lz(dominant ? TRAIT.dominant : TRAIT.recessive)}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <ul className="heredity__result" aria-label={Lz(L('Kết quả đời con', 'Offspring'))}>
          {children.map((c) => (
            <li key={`${c.sex}${c.alleles}`}>
              <span className="mono">{pct(c.fraction)}</span>{' '}
              {`${c.sex === 'male' ? '♂' : '♀'} ${genotype(c.alleles, c.sex === 'male')}`}:{' '}
              {Lz(c.dominant ? TRAIT.dominant : TRAIT.recessive)}
            </li>
          ))}
        </ul>
        <p className="heredity__note">
          {Lz(
            L(
              `Con đực : con cái = ${pct(sonShare(children))} : ${pct(1 - sonShare(children))}, tức 1 : 1.`,
              `Males : females = ${pct(sonShare(children))} : ${pct(1 - sonShare(children))}, that is 1 : 1.`,
            ),
          )}
        </p>
      </div>
    </div>
  );
}

export function SexLinkedPanel() {
  const Lz = useLocalized();
  const { mother, father } = useSexLinked();
  return (
    <div className="chem-form">
      <div className="heredity-field">
        <span className="heredity-field__label">{Lz(L('Con cái (mẹ)', 'Female (mother)'))}</span>
        <Segmented<Mother>
          label={L('Kiểu gene của con cái', 'Female genotype')}
          value={mother}
          options={MOTHERS.map((m) => ({ id: m, label: L(motherText(m), motherText(m)) }))}
          onChange={(m) => {
            restoreSexLinked({ mother: m });
          }}
        />
      </div>
      <div className="heredity-field">
        <span className="heredity-field__label">{Lz(L('Con đực (bố)', 'Male (father)'))}</span>
        <Segmented<Father>
          label={L('Kiểu gene của con đực', 'Male genotype')}
          value={father}
          options={FATHERS.map((f) => ({ id: f, label: L(fatherText(f), fatherText(f)) }))}
          onChange={(f) => {
            restoreSexLinked({ father: f });
          }}
        />
      </div>
      <ActionRow
        label={Lz(L('Phép lai của Morgan (Hình 10.2)', 'Morgan’s crosses (Figure 10.2)'))}
        items={BOOK_CROSSES.map((c) => c.id)}
        name={(id) => Lz(CROSS_NAME[id] ?? L(id, id))}
        onPick={(id) => {
          const c = BOOK_CROSSES.find((x) => x.id === id);
          if (c) restoreSexLinked({ mother: c.mother, father: c.father });
        }}
      />
      <p className="small">
        {Lz(
          L(
            'Bảng 10.1: kiểu XX – XY (người, ruồi giấm…), ZZ – ZW (chim, một số loài cá, côn trùng), XX – XO (châu chấu, dế…). Ở kiểu ZZ – ZW, con cái là ZW.',
            'Table 10.1: XX – XY (humans, Drosophila…), ZZ – ZW (birds, some fish and insects), XX – XO (grasshoppers, crickets…). With ZZ – ZW the female is ZW.',
          ),
        )}
      </p>
    </div>
  );
}
