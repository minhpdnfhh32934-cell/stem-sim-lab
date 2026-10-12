import { translate, type Locale } from '@/app/i18n';
import { SUBJECTS, useWorkspaceStore } from '@/app/workspaceStore';
import { useModuleStore } from '@/modules/moduleStore';
import { useSimStore } from '@/app/sim/simStore';

const localized = (value: { vi: string; en: string }, locale: Locale) => value[locale];

/** Context taken from app-owned state. No screenshot, clipboard or hidden window data is read. */
export function screenContext(locale: Locale): string {
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
    module ? `Mô-đun STEM Sim Lab đang mở: ${topic ?? module.id}` : '',
    moduleInputs ? `Thông số đầu vào của mô-đun hiện tại (JSON): ${moduleInputs}` : '',
  ].filter(Boolean);
  return chunks.join('\n');
}
