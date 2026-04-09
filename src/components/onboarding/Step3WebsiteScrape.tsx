import type { ChangeEvent } from "react";
import { useState } from "react";
import { apiHeaders } from "@/lib/api/headers";
import { Loader2, AlertCircle, Globe, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type WebsiteResult = {
  readonly success: boolean;
  readonly description: string;
  readonly keywords: readonly string[];
  readonly rawText?: string;
};

type Step3WebsiteScrapeProps = {
  readonly onUpdate: (data: { websiteData: WebsiteResult | null }) => void;
  readonly onNext: () => void;
};

type ScrapeState = "idle" | "loading" | "success" | "error";

export function Step3WebsiteScrape({
  onUpdate,
  onNext,
}: Step3WebsiteScrapeProps) {
  const [url, setUrl] = useState("");
  const [scrapeState, setScrapeState] = useState<ScrapeState>("idle");
  const [result, setResult] = useState<WebsiteResult | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [skipped, setSkipped] = useState(false);

  async function handleAnalyze() {
    setScrapeState("loading");
    setErrorMessage("");

    try {
      const response = await fetch("/api/onboarding/scrape-website", {
        method: "POST",
        headers: apiHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ url: url.trim() }),
      });

      const data = (await response.json()) as WebsiteResult & {
        brandKeywords?: readonly string[];
        error?: string;
      };

      if (!response.ok || !data.success) {
        setScrapeState("error");
        setErrorMessage(data.error ?? "Analyse fehlgeschlagen");
        return;
      }

      // API returns brandKeywords; normalize to keywords for the UI
      const normalized: WebsiteResult = {
        success: data.success,
        description: data.description,
        keywords: data.keywords ?? data.brandKeywords ?? [],
        rawText: data.rawText,
      };

      setResult(normalized);
      setScrapeState("success");
      setSkipped(false);
    } catch {
      setScrapeState("error");
      setErrorMessage("Netzwerkfehler — Server nicht erreichbar");
    }
  }

  function handleSkip() {
    setSkipped(true);
    setResult(null);
    setScrapeState("idle");
  }

  function handleContinue() {
    onUpdate({ websiteData: skipped ? null : result });
    onNext();
  }

  const canContinue = scrapeState === "success" || skipped;

  return (
    <div
      className="rounded-[25px] bg-white p-8 shadow-sm"
      style={{ fontFamily: "Archivo, sans-serif" }}
    >
      <h2 className="mb-1 text-xl font-semibold text-gray-900">
        Website analysieren
      </h2>
      <p className="mb-6 text-sm text-gray-500">
        Wir extrahieren Markeninformationen von Ihrer Website für bessere
        E-Mail-Entwürfe.
      </p>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="website-url">Website-URL</Label>
          <Input
            id="website-url"
            type="url"
            placeholder="https://ihrewebsite.de"
            className="bg-gray-100"
            value={url}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setUrl(e.target.value)
            }
            disabled={scrapeState === "loading"}
          />
        </div>

        <Button
          variant="outline"
          onClick={handleAnalyze}
          disabled={url.trim() === "" || scrapeState === "loading"}
        >
          {scrapeState === "loading" && (
            <Loader2 className="size-4 animate-spin" />
          )}
          Analysieren
        </Button>

        {scrapeState === "loading" && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="size-8 animate-spin text-[#CC00FF]" />
            <p className="text-sm text-gray-500">Website wird analysiert…</p>
          </div>
        )}

        {scrapeState === "error" && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="size-4 shrink-0" />
            {errorMessage}
          </div>
        )}

        {scrapeState === "success" && result && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div className="mb-3 flex items-center gap-2">
              <Globe className="size-5 text-[#CC00FF]" />
              <span className="font-medium text-gray-900">Ergebnis</span>
            </div>

            <p className="mb-3 text-sm text-gray-600">{result.description}</p>

            {result.keywords.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                  <Tag className="size-3.5" />
                  Marken-Keywords
                </div>
                <div className="flex flex-wrap gap-2">
                  {result.keywords.map((keyword) => (
                    <span
                      key={keyword}
                      className="rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-700 ring-1 ring-gray-200"
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-3 pt-2">
          <Button
            className="rounded-full bg-[#CC00FF] px-6 text-white hover:bg-[#CC00FF]/90"
            disabled={!canContinue}
            onClick={handleContinue}
          >
            Weiter
          </Button>

          {!skipped && scrapeState !== "success" && (
            <button
              type="button"
              className="text-sm text-gray-400 hover:text-gray-600"
              onClick={handleSkip}
            >
              Überspringen
            </button>
          )}

          {skipped && (
            <span className="text-sm text-gray-400">Übersprungen</span>
          )}
        </div>
      </div>
    </div>
  );
}
