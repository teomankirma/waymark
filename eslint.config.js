import js from '@eslint/js'
import stylistic from '@stylistic/eslint-plugin'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores([
    'dist',
    'convex/_generated',
    '.convex',
    '.agents/skills',
    '.claude/skills',
    'test-results',
    'playwright-report',
    'coverage',
  ]),
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx}'],
    plugins: { '@stylistic': stylistic },
    rules: {
      // Prettier handles wrapping; ESLint enforces structural readability.
      curly: ['error', 'all'],
      '@stylistic/lines-between-class-members': ['error', 'always'],
      '@stylistic/padding-line-between-statements': [
        'error',
        { blankLine: 'always', prev: ['const', 'let', 'var'], next: '*' },
        { blankLine: 'always', prev: '*', next: ['const', 'let', 'var'] },
        // Keep related declarations together. Later rules take precedence.
        {
          blankLine: 'any',
          prev: ['const', 'let', 'var'],
          next: ['const', 'let', 'var'],
        },
        {
          blankLine: 'always',
          prev: '*',
          next: ['block-like', 'return', 'throw', 'type', 'interface'],
        },
        {
          blankLine: 'always',
          prev: ['block-like', 'type', 'interface'],
          next: '*',
        },
        { blankLine: 'always', prev: 'import', next: '*' },
        { blankLine: 'any', prev: 'import', next: 'import' },
      ],
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    files: [
      'automation/**/*.ts',
      'server/**/*.ts',
      'tests/**/*.ts',
      'playwright.config.ts',
    ],
    languageOptions: {
      globals: {
        ...Object.fromEntries(
          Object.keys(globals.browser).map((key) => [key, 'off']),
        ),
        ...globals.node,
      },
    },
  },
])
