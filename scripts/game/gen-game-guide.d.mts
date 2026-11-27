export interface GameGuideText {
  title: string;
  text: string;
}

export interface GameGuideSection {
  id: string;
  source: string;
  vi: GameGuideText;
  en: GameGuideText;
}

export interface GameGuide {
  generatedBy: string;
  reviewStatus: 'pending' | 'verified';
  sections: GameGuideSection[];
}

export function buildGameGuide(): GameGuide;
export function serialize(guide: GameGuide): string;
