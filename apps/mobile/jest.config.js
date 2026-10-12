// Run far from UTC so tests catch calendar dates shifted by the device time zone.
process.env.TZ = 'Pacific/Kiritimati';

module.exports = {
  preset: '@react-native/jest-preset',
};
