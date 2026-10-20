import { translate, type Locale } from '@/app/i18n';
import { SUBJECTS, useWorkspaceStore } from '@/app/workspaceStore';
import { useModuleStore } from '@/modules/moduleStore';
import { useSimStore } from '@/app/sim/simStore';

const localized = (value: { vi: string; en: string }, locale: Locale) => value[locale];

/**
 * Context text of a full-page screen (e.g. Science Studio), built when a question is sent.
 * `maxChars` is the chat's screen budget for that question (undefined = no limit): the source
 * fits its most important facts within it instead of being cut blindly from the end.
 */
export type ScreenContextSource = (locale: Locale, maxChars?: number) => string;

const pageSources = new Set<ScreenContextSource>();

/**
 * A full-page screen that covers the lab describes itself while it is mounted; the lab's state
 * is then not what the learner sees, so it is not shared. Returns the unregister function.
 */
export function provideScreenContext(source: ScreenContextSource): () => void {
  pageSources.add(source);
  return () => {
    pageSources.delete(source);
  };
}

function pageContext(locale: Locale, maxChars?: number): string {
  const parts: string[] = [];
  for (const source of pageSources) {
    try {
      const text = source(locale, maxChars);
      if (text) parts.push(text);
    } catch {
      // A broken source shares nothing rather than stopping the question.
    }
  }
  return parts.join('\n');
}

/** Context taken from app-owned state. No screenshot, clipboard or hidden window data is read. */
export function screenContext(locale: Locale, maxChars?: number): string {
  const page = pageContext(locale, maxChars);
  if (page) return page;
  const workspace = useWorkspaceStore.getState();
  const sim = useSimStore.getState();
  const module = useModuleStore.getState().active;
  let moduleInputs = '';
  try {
    const values = module?.view.state?.get();
    if (values) moduleInputs = JSON.stringify(values).slice(0, 5000);
  } catch {
    moduleInputs = '';
  }
  const topicId = sim.scene?.id ?? module?.id ?? null;
  const topic = topicId
    ? translate(locale, `topics.${topicId}` as Parameters<typeof translate>[1])
    : null;
  const subject = SUBJECTS.includes(workspace.subject) ? workspace.subject : 'physics';
  const chunks = [
    `Môn học: ${translate(locale, `subjects.${subject}` as Parameters<typeof translate>[1])}`,
    topic ? `Chủ đề đang mở: ${topic}` : '',
    sim.scene
      ? `Thông số của mô phỏng (JSON): ${JSON.stringify(sim.params)}; thời gian mô phỏng: ${workspace.simTime.toFixed(3)} s; dữ liệu hợp lệ: ${sim.validation.length === 0 ? 'có' : 'không'}`
      : '',
    sim.problem?.text ? `Đề bài đã dùng để mở mô phỏng: ${sim.problem.text.slice(0, 3000)}` : '',
    workspace.scienceCard
      ? `Thẻ Khoa học: mô hình=${localized(workspace.scienceCard.model, locale)}; giả định=${workspace.scienceCard.assumptions.map((a) => localized(a, locale)).join(' | ')}; mức tin cậy=${workspace.scienceCard.confidence}; nguồn=${workspace.scienceCard.sources.map((s) => s.citation).join(', ')}`
      : '',
    module ? `Mô-đun SimLab đang mở: ${topic ?? module.id}` : '',
    moduleInputs ? `Thông số đầu vào của mô-đun hiện tại (JSON): ${moduleInputs}` : '',
  ].filter(Boolean);
  return chunks.join('\n');
}
