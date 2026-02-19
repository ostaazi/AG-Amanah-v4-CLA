module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
    'prettier', // Must be last to override other configs
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  plugins: ['@typescript-eslint', 'react', 'react-hooks'],
  settings: {
    react: {
      version: 'detect',
    },
  },
  rules: {
    // Legacy stabilization: keep lint signal focused on hard failures/security.
    'no-console': 'off',

    // TypeScript-specific rules
    '@typescript-eslint/no-unused-vars': 'off',
    '@typescript-eslint/no-explicit-any': 'off',

    // React-specific rules
    'react/prop-types': 'off', // Using TypeScript for prop validation
    'react/no-children-prop': 'off', // React Router v7 uses children as prop
    'react/no-unescaped-entities': 'off',
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'off',

    // Code quality
    'no-empty': 'off',

    // Security rules (from Phase 1 audit)
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
  },
  ignorePatterns: [
    'dist',
    'dist-ssr',
    'node_modules',
    '*.config.js',
    '*.config.ts',
    'android',
    'android-child',
    'backup-before-auth-fix-*',
    'tmp_*',
    'tmp_backup_*',
    'tmp_restore_*',
    'tmp_docx_source_extract',
    'phase_backups',
    '.env',
    '.env.*',
  ],
};
