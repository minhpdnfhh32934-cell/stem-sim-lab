import { Dna, FlaskConical, Orbit, type LucideIcon } from 'lucide-react';
import type { Subject } from './workspaceStore';

export const SUBJECT_ICON: Record<Subject, LucideIcon> = {
  physics: Orbit,
  chemistry: FlaskConical,
  biology: Dna,
};
