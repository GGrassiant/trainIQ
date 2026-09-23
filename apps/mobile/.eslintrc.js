module.exports = {
  root: true,
  extends: '@react-native',
  rules: {
    // Mobile consumes the backend contract, never planning or provider sources.
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: [
              '@trainiq/domain',
              '@trainiq/domain/*',
              '@trainiq/recommendation',
              '@trainiq/recommendation/*',
              '@trainiq/intervals',
              '@trainiq/intervals/*',
              '@trainiq/weather',
              '@trainiq/weather/*',
              '**/packages/domain/**',
              '**/packages/recommendation/**',
              '**/packages/intervals/**',
              '**/packages/weather/**',
              '**/lib/server/**',
              '**/web/trpc-types*',
              '!**/web/dist/trpc/trpc-types',
            ],
            message:
              'Use the tRPC client and its generated declaration contract.',
          },
        ],
      },
    ],
    // react-native-paper components (Card.Title, List.Item, Avatar, ...) use
    // left/right/icon render props, which this rule otherwise flags as
    // "unstable nested components" even though they're a legitimate pattern.
    'react/no-unstable-nested-components': ['warn', { allowAsProps: true }],
  },
};
