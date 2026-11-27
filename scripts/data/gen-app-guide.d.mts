export interface AppGuideText {
  title: string;
  text: string;
}

export interface AppGuideSection {
  id: string;
  source: string;
  vi: AppGuideText;
  en: AppGuideText;
}

export interface AppGuide {
  generatedBy: string;
  reviewStatus: 'pending' | 'verified';
  sections: AppGuideSection[];
}

export function buildAppGuide(): AppGuide;
export function serialize(guide: AppGuide): string;
