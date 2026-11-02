export function testTitles(source: string, options?: { runs?: boolean }): string[];
export function missingTitles(classic: string, bench: string): string[];
export function parityReport(e2eDir: string): { spec: string; missing: string[] }[];
