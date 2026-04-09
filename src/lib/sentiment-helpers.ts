export function getSentimentColor(score: number): string {
  if (score <= -0.6) return "bg-red-500";
  if (score <= -0.3) return "bg-orange-500";
  if (score <= 0.0) return "bg-amber-400";
  if (score <= 0.3) return "bg-yellow-300";
  if (score <= 0.6) return "bg-lime-400";
  return "bg-green-500";
}

export function getSentimentTextColor(score: number): string {
  if (score <= -0.6) return "text-red-700";
  if (score <= -0.3) return "text-orange-700";
  if (score <= 0.0) return "text-amber-700";
  if (score <= 0.3) return "text-yellow-700";
  if (score <= 0.6) return "text-lime-700";
  return "text-green-700";
}

export function getSentimentLabel(score: number): string {
  if (score <= -0.6) return "Sehr negativ";
  if (score <= -0.3) return "Negativ";
  if (score <= 0.0) return "Leicht negativ";
  if (score <= 0.3) return "Neutral";
  if (score <= 0.6) return "Positiv";
  return "Sehr positiv";
}

export function clampPercent(score: number): number {
  return Math.round(((score + 1) / 2) * 100);
}
