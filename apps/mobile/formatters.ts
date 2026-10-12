export function formatLocalActivityDate(
  startDateLocal: string,
  locale: string,
): string {
  const calendarFieldsAsUtc = new Date(`${startDateLocal}Z`);

  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(calendarFieldsAsUtc);
}

export function formatActivityDuration(
  seconds: number,
  locale: string,
): string {
  const minutes = Math.round(seconds / 60);

  // Hermes on iOS converts Intl `unit: 'minute'` values to seconds, so the
  // unit is appended to a localized number instead.
  return `${new Intl.NumberFormat(locale).format(minutes)} min`;
}
