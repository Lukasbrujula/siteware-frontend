export function apiHeaders(
  extra?: Record<string, string>,
): Record<string, string> {
  return {
    ...extra,
    "X-API-Key": import.meta.env.VITE_API_SECRET_KEY ?? "",
  };
}
