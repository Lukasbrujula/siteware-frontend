export function validateApiKey(req: {
  headers: Record<string, string | string[] | undefined>;
}): boolean {
  const apiKey = process.env.API_SECRET_KEY;
  if (!apiKey) return true;
  const provided = req.headers["x-api-key"];
  return provided === apiKey;
}
