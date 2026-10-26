import type { TourStep } from '@/app/project/Tour';

/** Each step points at the real part of the screen; a part not shown right now gets a centred card. */
export const GUIDE_STEPS: readonly TourStep[] = [
  { title: 'studio.guide.welcomeTitle', body: 'studio.guide.welcomeBody' },
  {
    target: '[data-tour="studio-tabs"]',
    title: 'studio.guide.subjectTitle',
    body: 'studio.guide.subjectBody',
  },
  {
    target: '.studio-scenario',
    title: 'studio.guide.lessonTitle',
    body: 'studio.guide.lessonBody',
  },
  { target: '.studio-steps', title: 'studio.guide.stepsTitle', body: 'studio.guide.stepsBody' },
  { target: '.studio-flow__nav', title: 'studio.guide.nextTitle', body: 'studio.guide.nextBody' },
  { target: '.studio-ask', title: 'studio.guide.askTitle', body: 'studio.guide.askBody' },
  {
    target: '.studio-steps li:last-child .studio-steps__item',
    title: 'studio.guide.reportTitle',
    body: 'studio.guide.reportBody',
  },
  {
    target: '[data-tour="studio-tabs"] [role="tab"][id$="-authoring"]',
    title: 'studio.guide.authoringTitle',
    body: 'studio.guide.authoringBody',
  },
];
