export function formatActivityDuration(seconds: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: "unit",
    unit: "minute",
    unitDisplay: "short",
  }).format(Math.round(seconds / 60));
}
