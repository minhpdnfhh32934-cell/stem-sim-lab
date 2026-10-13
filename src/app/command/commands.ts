import type { LucideIcon } from 'lucide-react';
import { create } from 'zustand';
import { normalizeForSearch } from '@/app/catalog';

/**
 * Command palette (Ctrl+K, gallery pattern 046): one search box for topics, pages, Settings and
 * quick actions. This file holds the pure parts (ranking) and the open/closed state.
 */

export type CommandGroup = 'topics' | 'go' | 'settings' | 'actions';

export const COMMAND_GROUPS: readonly CommandGroup[] = ['go', 'topics', 'settings', 'actions'];

export interface Command {
  id: string;
  group: CommandGroup;
  label: string;
  /** Second line (subject and chapter, what the page holds…). */
  hint?: string;
  /** Extra words that should find the command (also matched without accents). */
  keywords?: string;
  icon: LucideIcon;
  run: () => void;
}

/** 3: label starts with the query, 2: a word of the label does, 1: found anywhere, 0: no. */
export function matchScore(command: Pick<Command, 'label' | 'hint' | 'keywords'>, query: string) {
  const q = normalizeForSearch(query);
  if (!q) return 1;
  const label = normalizeForSearch(command.label);
  if (label.startsWith(q)) return 3;
  if (label.split(/[\s/()·,–-]+/).some((w) => w.startsWith(q))) return 2;
  const rest = normalizeForSearch(
    `${command.label} ${command.hint ?? ''} ${command.keywords ?? ''}`,
  );
  // Every word of the query somewhere ("ne xien" finds "Ném xiên").
  return q.split(/\s+/).every((w) => rest.includes(w)) ? 1 : 0;
}

/** Matching commands, best first, grouped in COMMAND_GROUPS order; at most `limit`. */
export function rankCommands(commands: readonly Command[], query: string, limit = 40): Command[] {
  const scored = commands.map((c, i) => ({ c, i, s: matchScore(c, query) })).filter((x) => x.s > 0);
  const groupIndex = (g: CommandGroup) => COMMAND_GROUPS.indexOf(g);
  scored.sort((a, b) =>
    normalizeForSearch(query)
      ? b.s - a.s || groupIndex(a.c.group) - groupIndex(b.c.group) || a.i - b.i
      : groupIndex(a.c.group) - groupIndex(b.c.group) || a.i - b.i,
  );
  return scored.slice(0, limit).map((x) => x.c);
}

interface PaletteState {
  open: boolean;
  setOpen: (open: boolean) => void;
}

export const useCommandPalette = create<PaletteState>()((set) => ({
  open: false,
  setOpen: (open) => {
    set({ open });
  },
}));
