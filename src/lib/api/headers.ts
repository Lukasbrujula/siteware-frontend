export function apiHeaders(
  extra?: Record<string, string>,
): Record<string, string> {
  return { ...extra };
}
