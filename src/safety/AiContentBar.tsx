import { Flag, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { useT } from '@/app/i18n';
import { logIncident } from './safetyStore';
import './safety.css';

/**
 * "Nội dung do AI hỗ trợ" + "Báo cáo nội dung không phù hợp" (PROMPT_PHAN_2 A3; Vietnam AI Law
 * Art. 11: users must be able to tell that content comes from an AI). A report records only
 * the kind and the time in the incident log, never the content.
 */
export function AiContentBar() {
  const t = useT();
  const [reported, setReported] = useState(false);
  return (
    <div className="ai-label">
      <span className="ai-label__tag" data-tip={t('safety.aiLabelHint')}>
        <Sparkles size={12} strokeWidth={2} aria-hidden="true" />
        {t('safety.aiLabel')}
      </span>
      {reported ? (
        <span className="ai-label__done" role="status">
          {t('safety.reported')}
        </span>
      ) : (
        <button
          type="button"
          className="ai-label__report"
          onClick={() => {
            logIncident('userReport');
            setReported(true);
          }}
        >
          <Flag size={12} strokeWidth={2} aria-hidden="true" />
          {t('safety.report')}
        </button>
      )}
    </div>
  );
}
