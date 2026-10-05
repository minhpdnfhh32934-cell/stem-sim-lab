import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useT, type MessageKey } from '@/app/i18n';
import { IconButton } from '@/ui/IconButton';
import { closePrivacy, useSafetyStore } from './safetyStore';
import './safety.css';

interface Section {
  title: MessageKey;
  items: MessageKey[];
}

const SECTIONS: Section[] = [
  {
    title: 'safety.privacy.sendTitle',
    items: ['safety.privacy.send1', 'safety.privacy.send2', 'safety.privacy.send3'],
  },
  {
    title: 'safety.privacy.storeTitle',
    items: ['safety.privacy.store1', 'safety.privacy.store2', 'safety.privacy.store3'],
  },
  {
    title: 'safety.privacy.providerTitle',
    items:
      __EDITION__ === 'pilot'
        ? ['safety.privacy.providerClaude', 'safety.privacy.providerGroq', 'safety.privacy.checked']
        : [
            'safety.privacy.providerGemini',
            'safety.privacy.providerClaude',
            'safety.privacy.providerGroq',
            'safety.privacy.checked',
          ],
  },
  {
    title: 'safety.privacy.rulesTitle',
    items: [
      'safety.privacy.rule1',
      'safety.privacy.rule2',
      'safety.privacy.rule3',
      'safety.privacy.rule4',
    ],
  },
  {
    title: 'safety.privacy.tipsTitle',
    items: [
      'safety.privacy.tip1',
      'safety.privacy.tip2',
      'safety.privacy.tip3',
      'safety.privacy.tip4',
      'safety.privacy.tip5',
      'safety.privacy.tip6',
    ],
  },
  ...(__EDITION__ === 'pilot'
    ? [
        {
          title: 'safety.privacy.pilotTitle',
          items: ['safety.privacy.pilot1', 'safety.privacy.pilot2'],
        } satisfies Section,
      ]
    : []),
];

/** "Quyền riêng tư & dùng AI an toàn": privacy, terms summary and the safe-use guide. */
export function PrivacyDialog() {
  const t = useT();
  const open = useSafetyStore((s) => s.privacyOpen);
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="dialog dialog--wide privacy"
      aria-labelledby="privacy-title"
      onClose={closePrivacy}
    >
      <header className="dialog__header">
        <h2 id="privacy-title">{t('safety.privacy.title')}</h2>
        <IconButton icon={X} label={t('safety.privacy.close')} onClick={closePrivacy} />
      </header>
      <div className="dialog__body">
        {SECTIONS.map((s) => (
          <section key={s.title} className="privacy__section">
            <h3>{t(s.title)}</h3>
            <ul>
              {s.items.map((k) => (
                <li key={k}>{t(k)}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <footer className="dialog__footer">
        <button type="button" className="btn btn--accent" onClick={closePrivacy}>
          {t('safety.privacy.close')}
        </button>
      </footer>
    </dialog>
  );
}
