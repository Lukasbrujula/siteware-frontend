import type { ChangeEvent } from "react";
import { useEffect, useState, useCallback } from "react";
import { apiHeaders } from "@/lib/api/headers";
import { Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TagInput } from "./TagInput";
import { SPRACHSTIL_OPTIONS } from "@/types/tone-profile";

type EditableToneProfile = {
  formality: "formal" | "informal";
  greeting: string;
  closing: string;
  sentenceStyle: string;
  avoidances: readonly string[];
  preferences: readonly string[];
  jargon: readonly string[];
};

type AnalysisResponse = {
  readonly success: boolean;
  readonly profile?: {
    readonly formality: string;
    readonly greeting: string;
    readonly closing: string;
    readonly sentenceStyle: string;
    readonly avoid: readonly string[];
    readonly prefer: readonly string[];
    readonly industryTerms: readonly string[];
  };
  readonly error?: string;
};

type EmailSample = {
  readonly subject: string;
  readonly body: string;
};

type ScanResult = {
  readonly emails_scanned: number;
  readonly rawEmails?: readonly EmailSample[];
};

type WebsiteData = {
  readonly rawText?: string;
} | null;

type Step4ToneAnalysisProps = {
  readonly state: {
    readonly sentScan: ScanResult;
    readonly websiteData: WebsiteData;
  };
  readonly detectedSignature: string;
  readonly onUpdate: (data: {
    toneProfile: EditableToneProfile;
    emailSignature?: string;
  }) => void;
  readonly onNext: () => void;
};

type AnalysisState = "loading" | "success" | "error";

function toFormality(value: string): "formal" | "informal" {
  return value === "informal_du" || value === "informal"
    ? "informal"
    : "formal";
}

export function Step4ToneAnalysis({
  state,
  detectedSignature,
  onUpdate,
  onNext,
}: Step4ToneAnalysisProps) {
  const [analysisState, setAnalysisState] = useState<AnalysisState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [emailSignature, setEmailSignature] = useState(detectedSignature);
  const [profile, setProfile] = useState<EditableToneProfile>({
    formality: "formal",
    greeting: "Sehr geehrte/r",
    closing: "Mit freundlichen Grüßen",
    sentenceStyle: "Prägnant und direkt",
    avoidances: [],
    preferences: [],
    jargon: [],
  });

  const runAnalysis = useCallback(async () => {
    setAnalysisState("loading");
    setErrorMessage("");

    try {
      const response = await fetch("/api/onboarding/analyze-tone", {
        method: "POST",
        headers: apiHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          sentEmails: state.sentScan.rawEmails ?? [],
          websiteContent: state.websiteData?.rawText ?? null,
          tenantId: "default",
        }),
      });

      const data = (await response.json()) as AnalysisResponse;

      if (!response.ok || !data.success || !data.profile) {
        setAnalysisState("error");
        setErrorMessage(data.error ?? "Analyse fehlgeschlagen");
        return;
      }

      const p = data.profile;
      setProfile({
        formality: toFormality(p.formality),
        greeting: p.greeting,
        closing: p.closing,
        sentenceStyle: p.sentenceStyle,
        avoidances: [...p.avoid],
        preferences: [...p.prefer],
        jargon: [...p.industryTerms],
      });
      setAnalysisState("success");
    } catch {
      setAnalysisState("error");
      setErrorMessage("Netzwerkfehler — Server nicht erreichbar");
    }
  }, [state.sentScan.rawEmails, state.websiteData]);

  useEffect(() => {
    runAnalysis();
  }, [runAnalysis]);

  function updateField<K extends keyof EditableToneProfile>(
    key: K,
    value: EditableToneProfile[K],
  ) {
    setProfile((prev) => ({ ...prev, [key]: value }));
  }

  function handleContinue() {
    onUpdate({ toneProfile: profile, emailSignature });
    onNext();
  }

  return (
    <div
      className="rounded-[25px] bg-white p-8 shadow-sm"
      style={{ fontFamily: "Archivo, sans-serif" }}
    >
      <h2 className="mb-1 text-xl font-semibold text-gray-900">
        Schreibstil-Analyse
      </h2>
      <p className="mb-6 text-sm text-gray-500">
        Überprüfen und passen Sie Ihr erkanntes Tonprofil an.
      </p>

      {analysisState === "loading" && (
        <div className="flex flex-col items-center gap-3 py-12">
          <Loader2 className="size-8 animate-spin text-[#CC00FF]" />
          <p className="text-sm text-gray-500">Schreibstil wird analysiert…</p>
        </div>
      )}

      {analysisState === "error" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="size-4 shrink-0" />
            {errorMessage}
          </div>
          <Button variant="outline" onClick={runAnalysis}>
            Erneut versuchen
          </Button>
        </div>
      )}

      {analysisState === "success" && (
        <div className="space-y-5">
          {/* Formalität */}
          <div className="space-y-2">
            <Label htmlFor="tone-formality">Formalität</Label>
            <select
              id="tone-formality"
              className="w-full rounded-md border border-gray-200 bg-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#CC00FF]/40"
              value={profile.formality}
              onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                updateField(
                  "formality",
                  e.target.value as "formal" | "informal",
                )
              }
            >
              <option value="formal">Formell / Sie</option>
              <option value="informal">Informell / Du</option>
            </select>
          </div>

          {/* Begrüßung */}
          <div className="space-y-2">
            <Label htmlFor="tone-greeting">Begrüßung</Label>
            <Input
              id="tone-greeting"
              className="bg-gray-100"
              placeholder="Sehr geehrte/r"
              value={profile.greeting}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                updateField("greeting", e.target.value)
              }
            />
          </div>

          {/* Abschluss */}
          <div className="space-y-2">
            <Label htmlFor="tone-closing">Abschluss</Label>
            <Input
              id="tone-closing"
              className="bg-gray-100"
              placeholder="Mit freundlichen Grüßen"
              value={profile.closing}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                updateField("closing", e.target.value)
              }
            />
          </div>

          {/* Satzstil */}
          <div className="space-y-2">
            <Label htmlFor="tone-sentence-style">Satzstil</Label>
            <Input
              id="tone-sentence-style"
              className="bg-gray-100"
              placeholder="Prägnant und direkt"
              value={profile.sentenceStyle}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                updateField("sentenceStyle", e.target.value)
              }
            />
          </div>

          {/* Sprachstil suggestions */}
          <div className="space-y-2">
            <Label>
              Sprachstil{" "}
              <span className="font-normal text-gray-400">
                (max. 3 auswählen)
              </span>
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {SPRACHSTIL_OPTIONS.map((opt) => {
                const selected = profile.preferences.includes(opt.label);
                const atMax =
                  !selected &&
                  profile.preferences.filter((p) =>
                    SPRACHSTIL_OPTIONS.some((o) => o.label === p),
                  ).length >= 3;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={atMax}
                    className={`cursor-pointer rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
                      selected
                        ? "border-[#CC00FF] bg-[#CC00FF]/10 text-[#CC00FF]"
                        : atMax
                          ? "cursor-not-allowed border-gray-200 bg-gray-50 text-gray-300"
                          : "border-gray-200 bg-white text-gray-600 hover:border-[#CC00FF]/40 hover:text-[#CC00FF]"
                    }`}
                    onClick={() => {
                      if (selected) {
                        updateField(
                          "preferences",
                          profile.preferences.filter((p) => p !== opt.label),
                        );
                      } else {
                        updateField("preferences", [
                          ...profile.preferences,
                          opt.label,
                        ]);
                      }
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Vermeiden */}
          <div className="space-y-2">
            <Label htmlFor="tone-avoidances">Vermeiden</Label>
            <TagInput
              id="tone-avoidances"
              tags={profile.avoidances}
              onChange={(tags) => updateField("avoidances", tags)}
              placeholder="Begriff eingeben + Enter"
            />
          </div>

          {/* Bevorzugen */}
          <div className="space-y-2">
            <Label htmlFor="tone-preferences">Bevorzugen</Label>
            <TagInput
              id="tone-preferences"
              tags={profile.preferences}
              onChange={(tags) => updateField("preferences", tags)}
              placeholder="Begriff eingeben + Enter"
            />
          </div>

          {/* Fachbegriffe */}
          <div className="space-y-2">
            <Label htmlFor="tone-jargon">Fachbegriffe</Label>
            <TagInput
              id="tone-jargon"
              tags={profile.jargon}
              onChange={(tags) => updateField("jargon", tags)}
              placeholder="Fachbegriff eingeben + Enter"
            />
          </div>

          {/* E-Mail-Signatur */}
          <div className="space-y-2">
            <Label htmlFor="tone-signature">E-Mail-Signatur</Label>
            <textarea
              id="tone-signature"
              className="w-full rounded-md border border-gray-200 bg-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#CC00FF]/40"
              rows={5}
              placeholder={
                "Mit freundlichen Grüßen\nMax Mustermann\nMusterfirma GmbH\nTel: +49 123 456789"
              }
              value={emailSignature}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                setEmailSignature(e.target.value)
              }
            />
            <p className="text-xs text-gray-400">
              Wird an jede automatisch erstellte E-Mail angehängt.
            </p>
          </div>

          <Button
            className="rounded-full bg-[#CC00FF] px-6 text-white hover:bg-[#CC00FF]/90"
            onClick={handleContinue}
          >
            Weiter
          </Button>
        </div>
      )}
    </div>
  );
}
