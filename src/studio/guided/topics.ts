/**
 * Catalog topics that are descriptive textbook lessons (`lessons/`), each run as a guided Science
 * Studio lesson inside its own library module. Kept apart from the lesson data so the module
 * registry can name them without loading any lesson; a test checks both lists agree.
 */
export const GUIDED_TOPICS = [
  'levelsOfLife',
  'cellSignalling',
  'metabolismEnergy',
  'breakdownSynthesis',
  'cellTechnology',
  'microbeDiversity',
  'microbeApplications',
  'virusDiseases',
  'organicSeparation',
] as const;
