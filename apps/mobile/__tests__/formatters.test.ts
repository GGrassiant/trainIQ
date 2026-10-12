import { formatActivityDuration, formatLocalActivityDate } from '../formatters';

describe('formatLocalActivityDate', () => {
  it("keeps the activity's calendar date regardless of the device time zone", () => {
    expect(formatLocalActivityDate('2026-10-11T00:30:00', 'en-US')).toBe(
      'Oct 11',
    );
    expect(formatLocalActivityDate('2026-10-11T23:30:00', 'en-US')).toBe(
      'Oct 11',
    );
  });
});

describe('formatActivityDuration', () => {
  it('shows total minutes rounded to the nearest minute', () => {
    expect(formatActivityDuration(3827, 'en-US')).toBe('64 min');
  });
});
