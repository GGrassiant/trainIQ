module.exports = {
  root: true,
  extends: '@react-native',
  rules: {
    // react-native-paper components (Card.Title, List.Item, Avatar, ...) use
    // left/right/icon render props, which this rule otherwise flags as
    // "unstable nested components" even though they're a legitimate pattern.
    'react/no-unstable-nested-components': ['warn', { allowAsProps: true }],
  },
};
