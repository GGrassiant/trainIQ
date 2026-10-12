module.exports = {
  root: true,
  extends: '@react-native',
  overrides: [
    {
      files: ['*.ts', '*.tsx'],
      rules: {
        '@typescript-eslint/no-use-before-define': [
          'error',
          { functions: true },
        ],
      },
    },
  ],
};
