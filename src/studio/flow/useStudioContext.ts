import { useEffect } from 'react';
import { provideScreenContext } from '@/teacher/chat/context';
import { studioContextText } from '../aiContext';
import type { StudioScenario } from '../scenario';
import { createSession } from '../session';
import { useStudioStore } from '../studioStore';

/**
 * While a lesson is shown, AI Teacher's screen context describes it (built from the stored
 * session when a question is sent, never earlier). Whether it is sent is the chat's
 * "Lấy thông tin từ màn hình" switch, which is off each time the bubble opens.
 */
export function useStudioContext(scenario: StudioScenario): void {
  useEffect(
    () =>
      provideScreenContext((locale) => {
        const session =
          useStudioStore.getState().sessions[scenario.id] ?? createSession(scenario, 0);
        return studioContextText(scenario, session, locale);
      }),
    [scenario],
  );
}
