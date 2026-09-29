import { translate } from '@/app/i18n';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { toast } from '@/ui/toast';
import { openTextFile, saveFile, slugify } from './fileio';
import { parseSnapshot, restoreSnapshot, serializeSnapshot, takeSnapshot } from './snapshot';
import type { MessageKey, MessageParams } from '@/app/i18n';

const tr = (key: MessageKey, params?: MessageParams) =>
  translate(useSettingsStore.getState().locale, key, params);

function topicName(topicId: string): string {
  return tr(`topics.${topicId}` as MessageKey);
}

function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${String(d.getFullYear())}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

/** Saves the open topic and its inputs as a `.stemsim` file. */
export async function saveProject(): Promise<void> {
  const snap = takeSnapshot();
  if (!snap) {
    toast(tr('project.nothingToSave'), 'warn');
    return;
  }
  try {
    const saved = await saveFile({
      name: `${slugify(topicName(snap.topicId))}-${stamp()}.stemsim`,
      filterName: 'STEM Sim Lab',
      extensions: ['stemsim'],
      contents: serializeSnapshot(snap),
    });
    if (saved) toast(tr('project.saved', { name: saved }), 'success');
  } catch (e) {
    console.error(e);
    toast(tr('project.saveFailed'), 'error');
  }
}

/** Opens a `.stemsim` file (validated before anything is changed). */
export async function openProject(): Promise<void> {
  try {
    const file = await openTextFile('STEM Sim Lab', ['stemsim', 'json']);
    if (!file) return;
    await openProjectText(file.text, file.name);
  } catch (e) {
    console.error(e);
    toast(tr('project.openFailed'), 'error');
  }
}

export async function openProjectText(text: string, name: string): Promise<boolean> {
  const r = parseSnapshot(text);
  if (!r.ok) {
    toast(tr(`project.invalid.${r.error}`, { name }), 'error');
    return false;
  }
  await restoreSnapshot(r.snapshot);
  toast(tr('project.opened', { name: topicName(r.snapshot.topicId) }), 'success');
  return true;
}

/** Largest visible canvas of the stage (the simulation, a 3D view or a chart). */
export function stageCanvas(): HTMLCanvasElement | null {
  const stage = document.querySelector('.stage');
  if (!stage) return null;
  let best: HTMLCanvasElement | null = null;
  let bestArea = 0;
  for (const c of stage.querySelectorAll('canvas')) {
    const r = c.getBoundingClientRect();
    const area = r.width * r.height;
    if (area > bestArea && c.width > 0 && c.height > 0) {
      best = c;
      bestArea = area;
    }
  }
  return best;
}

/** Exports the stage as PNG, on the theme background (canvases are transparent). */
export async function exportPng(): Promise<void> {
  const src = stageCanvas();
  const topicId = takeSnapshot()?.topicId;
  if (!src || !topicId) {
    toast(tr('project.noCanvas'), 'warn');
    return;
  }
  const out = document.createElement('canvas');
  out.width = src.width;
  out.height = src.height;
  const ctx = out.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle =
    getComputedStyle(document.documentElement).getPropertyValue('--bg-stage').trim() || '#ffffff';
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(src, 0, 0);
  const blob = await new Promise<Blob | null>((resolve) => {
    out.toBlob(resolve, 'image/png');
  });
  if (!blob) {
    toast(tr('project.saveFailed'), 'error');
    return;
  }
  try {
    const saved = await saveFile({
      name: `${slugify(topicName(topicId))}-${stamp()}.png`,
      filterName: 'PNG',
      extensions: ['png'],
      contents: blob,
    });
    if (saved) toast(tr('project.saved', { name: saved }), 'success');
  } catch (e) {
    console.error(e);
    toast(tr('project.saveFailed'), 'error');
  }
}

/** Saves CSV text (graphs, data table). */
export async function exportCsv(baseName: string, csv: string): Promise<void> {
  try {
    const saved = await saveFile({
      name: `${slugify(baseName)}-${stamp()}.csv`,
      filterName: 'CSV',
      extensions: ['csv'],
      contents: csv,
    });
    if (saved) toast(tr('project.saved', { name: saved }), 'success');
  } catch (e) {
    console.error(e);
    toast(tr('project.saveFailed'), 'error');
  }
}
