export function formatLocalActivityDate(startDateLocal: string, locale: string): string {
  const calendarFieldsAsUtc = new Date(`${startDateLocal}Z`);

  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(calendarFieldsAsUtc);
}
