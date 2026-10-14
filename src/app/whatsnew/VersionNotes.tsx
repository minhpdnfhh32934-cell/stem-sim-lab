import {
  CircleCheck,
  CircleDashed,
  Clock3,
  Cpu,
  Dna,
  Gauge,
  GitMerge,
  GraduationCap,
  Hammer,
  LayoutDashboard,
  ShieldCheck,
  Volume2,
  type LucideIcon,
} from 'lucide-react';
import { useT } from '@/app/i18n';
import { useLocalized } from '@/app/i18n/localized';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { STATUS_KEY, formatReleaseDate } from './format';
import type {
  HighlightArea,
  LearnerHighlight,
  NoteCategory,
  ReleaseEntry,
  ReleaseNote,
  ReleaseStatus,
} from './releaseNotes';

/** Pieces shared by the "Có gì mới" box and the "Lịch sử phiên bản" page. */

const AREA_ICON: Record<HighlightArea, LucideIcon> = {
  teacher: GraduationCap,
  voice: Volume2,
  gemma: Cpu,
  bio3d: Dna,
  performance: Gauge,
  ui: LayoutDashboard,
  security: ShieldCheck,
};

const STATUS_ICON: Record<ReleaseStatus, LucideIcon> = {
  released: CircleCheck,
  'merged-not-released': GitMerge,
  'in-review': Clock3,
  development: Hammer,
  unverified: CircleDashed,
};

/** Status label with an icon (the colour is never the only cue). */
export function StatusBadge({ status }: { status: ReleaseStatus }) {
  const t = useT();
  const Icon = STATUS_ICON[status];
  return (
    <span className={`badge release-badge release-badge--${STATUS_KEY[status]}`}>
      <Icon size={13} strokeWidth={2} aria-hidden="true" />
      {t(`whatsnew.status.${STATUS_KEY[status]}`)}
    </span>
  );
}

/** "Ngày phát hành: 13/10/2026", or "chưa xác minh" — a date is never made up. */
export function ReleaseDate({ entry }: { entry: ReleaseEntry }) {
  const t = useT();
  const locale = useSettingsStore((s) => s.locale);
  const date = entry.dates.released;
  return (
    <p className="whatsnew__date">
      {date
        ? t('whatsnew.releasedOn', { date: formatReleaseDate(date, locale) })
        : t('whatsnew.releaseDateUnknown')}
    </p>
  );
}

export function HighlightList({ items }: { items: readonly LearnerHighlight[] }) {
  const L = useLocalized();
  if (!items.length) return null;
  return (
    <ul className="whatsnew__highlights">
      {items.map((h) => {
        const Icon = AREA_ICON[h.area];
        return (
          <li key={h.vi}>
            <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
            <span>{L(h)}</span>
          </li>
        );
      })}
    </ul>
  );
}

export interface NoteGroup {
  category: NoteCategory;
  items: readonly ReleaseNote[];
}

/** Lists of notes under their headings (empty groups are left out). */
export function NoteGroups({ groups }: { groups: readonly NoteGroup[] }) {
  const t = useT();
  const L = useLocalized();
  return (
    <>
      {groups
        .filter((g) => g.items.length > 0)
        .map((g) => (
          <div key={g.category} className="whatsnew__group">
            <h4>{t(`whatsnew.category.${g.category}`)}</h4>
            <ul>
              {g.items.map((n) => (
                <li key={n.vi}>{L(n)}</li>
              ))}
            </ul>
          </div>
        ))}
    </>
  );
}
