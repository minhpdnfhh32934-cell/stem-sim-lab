import { useEffect } from 'react';
import { useWorkspaceStore } from '@/app/workspaceStore';
import type { ScienceCardData } from '@/science-card/types';

/** Publishes a module's Science Card to the Inspector while the module is open. */
export function usePublishCard(card: ScienceCardData | null): void {
  useEffect(() => {
    useWorkspaceStore.setState({ scienceCard: card });
  }, [card]);
}
