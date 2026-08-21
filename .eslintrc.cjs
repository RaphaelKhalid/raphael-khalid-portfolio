module.exports = {
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
  ],
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  settings: { react: { version: '18.2' } },
  plugins: ['react-refresh'],
  rules: {
    'react-refresh/only-export-components': 'warn',
    // This project has never used prop-types and does not depend on it, so the
    // rule only ever produced noise — 52 errors, none of them a real defect.
    'react/prop-types': 'off',
  },
  overrides: [
    {
      // react-three-fiber's JSX elements are three.js objects, so every prop is
      // "unknown" to the DOM-oriented rule. These files are no longer imported
      // anywhere, but they stay in the tree, and they should not fail the lint.
      files: ['src/components/canvas/**/*.jsx'],
      rules: { 'react/no-unknown-property': 'off' },
    },
  ],
}
