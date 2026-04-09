import * as cheerio from "cheerio";

const MAX_HEADINGS = 10;
const MAX_WORDS = 500;
const MAX_KEYWORDS = 10;
const FETCH_TIMEOUT_MS = 15_000;

// German + English stopwords
const STOPWORDS = new Set([
  "der",
  "die",
  "das",
  "den",
  "dem",
  "des",
  "ein",
  "eine",
  "einer",
  "einem",
  "einen",
  "und",
  "oder",
  "aber",
  "wenn",
  "weil",
  "dass",
  "als",
  "auch",
  "noch",
  "schon",
  "mit",
  "für",
  "auf",
  "von",
  "bei",
  "nach",
  "vor",
  "über",
  "unter",
  "zwischen",
  "ist",
  "sind",
  "war",
  "hat",
  "haben",
  "wird",
  "werden",
  "kann",
  "können",
  "nicht",
  "sich",
  "aus",
  "wie",
  "mehr",
  "nur",
  "sehr",
  "dann",
  "hier",
  "dort",
  "alle",
  "diese",
  "dieser",
  "dieses",
  "jede",
  "jeder",
  "jedes",
  "andere",
  "the",
  "a",
  "an",
  "and",
  "or",
  "but",
  "in",
  "on",
  "at",
  "to",
  "for",
  "of",
  "with",
  "by",
  "from",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "will",
  "would",
  "could",
  "should",
  "may",
  "might",
  "can",
  "not",
  "no",
  "so",
  "if",
  "this",
  "that",
  "it",
  "its",
  "we",
  "our",
  "you",
  "your",
  "they",
  "them",
  "their",
  "he",
  "she",
  "his",
  "her",
  "ich",
  "du",
  "er",
  "sie",
  "es",
  "wir",
  "ihr",
  "uns",
  "mein",
  "dein",
  "sein",
]);

export type ScrapeResult = {
  readonly url: string;
  readonly title: string;
  readonly description: string;
  readonly headings: readonly string[];
  readonly rawText: string;
  readonly brandKeywords: readonly string[];
};

function extractKeywords(text: string): readonly string[] {
  const words = text
    .toLowerCase()
    .replace(/[^a-zäöüß\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));

  const counts = new Map<string, number>();
  for (const word of words) {
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_KEYWORDS)
    .map(([word]) => word);
}

function truncateToWords(text: string, maxWords: number): string {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  return words.slice(0, maxWords).join(" ");
}

export async function scrapeWebsite(url: string): Promise<ScrapeResult> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "SitewareBot/1.0 (Onboarding Scraper)",
      Accept: "text/html",
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  // Remove script, style, nav, footer noise
  $("script, style, noscript, nav, footer, iframe, svg").remove();

  const title = $("title").first().text().trim();
  const description =
    $('meta[name="description"]').attr("content")?.trim() ?? "";

  const headings: string[] = [];
  $("h1, h2").each((_, el) => {
    if (headings.length >= MAX_HEADINGS) return;
    const text = $(el).text().trim();
    if (text !== "") {
      headings.push(text);
    }
  });

  const paragraphs: string[] = [];
  $("p").each((_, el) => {
    const text = $(el).text().trim();
    if (text.length > 10) {
      paragraphs.push(text);
    }
  });

  const rawText = truncateToWords(paragraphs.join(" "), MAX_WORDS);
  const brandKeywords = extractKeywords(
    [title, description, ...headings, rawText].join(" "),
  );

  return {
    url,
    title,
    description,
    headings,
    rawText,
    brandKeywords,
  };
}
