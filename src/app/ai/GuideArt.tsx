import { useT } from '@/app/i18n';

/**
 * Simple drawings for the Gemini key guide (PROMPT_PHAN_2 A2: "hướng dẫn từng bước có ảnh
 * minh họa"). Schematic on purpose (not screenshots): they show where to click and stay correct
 * when the real page changes its look. Colors come from theme tokens (see ai.css).
 */

const W = 300;
const H = 110;

function Frame({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <svg
      className="guide-art"
      viewBox={`0 0 ${W} ${H}`}
      width={W}
      height={H}
      role="img"
      aria-label={label}
    >
      <rect className="guide-art__window" x="1" y="1" width={W - 2} height={H - 2} rx="8" />
      {children}
    </svg>
  );
}

/** Step 3: the AI Studio key page with the "Create API key" button. */
export function ArtCreateKey() {
  const t = useT();
  return (
    <Frame label={t('settings.geminiGuide.art.create')}>
      <rect className="guide-art__bar" x="1" y="1" width={W - 2} height="22" rx="8" />
      <circle className="guide-art__dot" cx="14" cy="12" r="3" />
      <circle className="guide-art__dot" cx="24" cy="12" r="3" />
      <rect className="guide-art__url" x="40" y="6" width="200" height="12" rx="6" />
      <text className="guide-art__text guide-art__text--small" x="48" y="15">
        aistudio.google.com/apikey
      </text>
      <rect className="guide-art__line" x="16" y="36" width="120" height="8" rx="4" />
      <rect className="guide-art__line" x="16" y="52" width="170" height="6" rx="3" />
      <rect className="guide-art__line" x="16" y="64" width="150" height="6" rx="3" />
      <rect className="guide-art__button" x="178" y="78" width="106" height="22" rx="11" />
      <text
        className="guide-art__text guide-art__text--on-accent"
        x="231"
        y="93"
        textAnchor="middle"
      >
        Create API key
      </text>
      <circle className="guide-art__ring" cx="231" cy="89" r="22" />
    </Frame>
  );
}

/** Step 4: the new key with its copy button. */
export function ArtCopyKey() {
  const t = useT();
  return (
    <Frame label={t('settings.geminiGuide.art.copy')}>
      <rect className="guide-art__line" x="16" y="18" width="90" height="8" rx="4" />
      <rect className="guide-art__field" x="16" y="40" width="230" height="28" rx="6" />
      <text className="guide-art__text guide-art__mono" x="28" y="59">
        AIza••••••••••••••••
      </text>
      <g className="guide-art__icon" transform="translate(258 42)">
        <rect x="6" y="6" width="14" height="16" rx="2" />
        <rect x="2" y="2" width="14" height="16" rx="2" />
      </g>
      <circle className="guide-art__ring" cx="269" cy="54" r="17" />
      <rect className="guide-art__line" x="16" y="82" width="140" height="6" rx="3" />
    </Frame>
  );
}

/** Steps 5–6: paste into "Khóa API", save, then "Kiểm tra key". */
export function ArtPasteKey() {
  const t = useT();
  return (
    <Frame label={t('settings.geminiGuide.art.paste')}>
      <text className="guide-art__text" x="16" y="28">
        {t('settings.aiKey')}
      </text>
      <rect className="guide-art__field" x="16" y="36" width="268" height="24" rx="6" />
      <text className="guide-art__text guide-art__mono" x="26" y="53">
        Ctrl+V
      </text>
      <rect className="guide-art__chip" x="16" y="72" width="96" height="24" rx="6" />
      <text className="guide-art__text" x="64" y="88" textAnchor="middle">
        {t('settings.aiKeySave')}
      </text>
      <rect className="guide-art__button" x="122" y="72" width="104" height="24" rx="6" />
      <text
        className="guide-art__text guide-art__text--on-accent"
        x="174"
        y="88"
        textAnchor="middle"
      >
        {t('settings.aiTest')}
      </text>
      <circle className="guide-art__ok" cx="252" cy="84" r="10" />
      <path className="guide-art__check" d="M247 84 l4 4 l7 -8" />
    </Frame>
  );
}
