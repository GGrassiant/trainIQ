/** Rounds TSB to a whole number for user-facing reasoning text. Raw TSB values are never rounded for recommendation calculations. */
export function formatTsb(tsb: number): string {
  return Math.round(tsb).toString();
}
