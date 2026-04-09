export function hasPlaceholders(text: string): boolean {
  return /\[BITTE ERGÄNZEN:[^\]]*\]/.test(text);
}

export function getConfidenceColor(confidence: number): string {
  if (confidence > 0.8) return "bg-green-100 text-green-800";
  if (confidence >= 0.5) return "bg-yellow-100 text-yellow-800";
  return "bg-red-100 text-red-800";
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function buildHighlightedHtml(text: string): string {
  const escaped = escapeHtml(text);
  const escapedRegex = /\[BITTE ERG(?:Ä|&Auml;)NZEN:[^\]]*\]/g;
  return escaped.replace(
    escapedRegex,
    (match) =>
      `<mark class="rounded bg-yellow-200 px-0.5 text-yellow-900">${match}</mark>`,
  );
}
