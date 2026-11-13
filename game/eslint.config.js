import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Game logic must stay headless (no DOM, no three.js) so it can be unit-tested in Node and
// reused by any future shell. Only src/platform and src/main.ts may touch the browser.
const browserOnly = [
  { group: ['three', 'three/*'], message: 'Only src/platform may use three.js.' },
  { group: ['**/platform/**'], message: 'Game logic must not depend on the platform layer.' },
];
// Rapier is an implementation detail of src/physics; everything else sees its plain API.
const physicsOnly = [{ group: ['@dimforge/*'], message: 'Only src/physics may use Rapier.' }];
const domGlobals = ['window', 'document', 'localStorage', 'navigator', 'requestAnimationFrame'];

export default tseslint.config(
  {
    ignores: ['dist', 'dist-app', 'node_modules', 'test-results', 'playwright-report', '.claude/'],
  },
  {
    files: ['**/*.ts'],
    extends: [js.configs.recommended, ...tseslint.configs.strictTypeChecked],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-confusing-void-expression': ['error', { ignoreArrowShorthand: true }],
      eqeqeq: ['error', 'always'],
      'no-console': 'error',
    },
  },
  {
    files: ['src/**/*.ts'],
    ignores: ['src/platform/**', 'src/main.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [...browserOnly, ...physicsOnly] }],
      'no-restricted-globals': ['error', ...domGlobals],
    },
  },
  {
    files: ['src/platform/**/*.ts', 'src/main.ts'],
    rules: { 'no-restricted-imports': ['error', { patterns: physicsOnly }] },
  },
  {
    files: ['src/physics/**/*.ts'],
    rules: { 'no-restricted-imports': ['error', { patterns: browserOnly }] },
  },
  {
    // core is the bottom layer: it may not know about any game module.
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            ...browserOnly,
            ...physicsOnly,
            {
              group: [
                '**/game/**',
                '**/gameplay/**',
                '**/world/**',
                '**/simulation/**',
                '**/physics/**',
              ],
              message: 'src/core must stay generic.',
            },
            { group: ['**/persistence/**'], message: 'src/core must stay generic.' },
          ],
        },
      ],
    },
  },
  {
    // The lab pack (experiments, topics, models) and the results panel are chunks of their own,
    // loaded on demand (Game.loadLab, Hud): a static import would put them back in the menu.
    files: ['src/**/*.ts'],
    ignores: [
      '**/*.test.ts',
      'src/content/**',
      'src/game/labPack.ts',
      'src/game/benchFixture.ts',
      'src/simulation/**',
      'src/platform/ui/ResultsPanel.ts',
    ],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex:
                '(^|/)\\.\\./content$|(^|/)(content/index|content/lab|labPack|simulation/models|simulation/csv|ResultsPanel)$',
              allowTypeImports: true,
              message:
                'Loaded on demand: reach it through import() only, or the menu downloads it.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.test.ts', 'e2e/**/*.ts'],
    rules: { '@typescript-eslint/no-non-null-assertion': 'off' },
  },
  { files: ['*.config.{js,ts}'], extends: [tseslint.configs.disableTypeChecked] },
);
