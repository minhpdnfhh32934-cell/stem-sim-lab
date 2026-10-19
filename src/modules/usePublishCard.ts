import { useEffect } from 'react';
import { useWorkspaceStore } from '@/app/workspaceStore';
import type { ScienceCardData } from '@/science-card/types';

/**
 * Publishes a module's Science Card to the Inspector while the module is open. When the view
 * goes away (topic closed, Science Studio left), its card goes with it, so the Inspector, the
 * sources page and the AI Teacher's screen context never describe a model that is not shown.
 */
export function usePublishCard(card: ScienceCardData | null): void {
  useEffect(() => {
    useWorkspaceStore.setState({ scienceCard: card });
    return () => {
      if (useWorkspaceStore.getState().scienceCard === card) {
        useWorkspaceStore.setState({ scienceCard: null });
      }
    };
  }, [card]);
}
