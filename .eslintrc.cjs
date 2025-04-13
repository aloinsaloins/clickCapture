module.exports = {
  env: {
    browser: true,
    es2021: true,
    webextensions: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:prettier/recommended',
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  plugins: [
    'prettier',
  ],
  rules: {
    'prettier/prettier': 'error',
  },
  globals: {
    chrome: 'readonly',
  },
}; 