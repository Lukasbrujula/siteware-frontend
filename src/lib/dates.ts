/**
 * Convert a value that might be a Unix-seconds integer, a millisecond timestamp,
 * or an ISO string into a valid ISO date string.
 */
export function toIsoDate(value: unknown): string {
  if (value == null) return new Date().toISOString();
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) return parsed.toISOString();
  }
  const num = Number(value);
  if (!isNaN(num) && num > 0) {
    // Unix seconds are < 10_000_000_000; milliseconds are >= that threshold
    const ms = num < 10_000_000_000 ? num * 1000 : num;
    return new Date(ms).toISOString();
  }
  return new Date().toISOString();
}
