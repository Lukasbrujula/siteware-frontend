import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiHeaders } from "@/lib/api/headers";
import {
  Loader2,
  AlertCircle,
  Mail,
  Globe,
  Pen,
  Shield,
  FileSignature,
  Copy,
  Check,
  Link,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type Credentials = {
  readonly email: string;
  readonly password: string;
  readonly imapHost: string;
  readonly imapPort: number;
  readonly smtpHost: string;
  readonly smtpPort: number;
};

type ScanResult = {
  readonly emails_scanned: number;
};

type WebsiteData = {
  readonly description?: string;
  readonly keywords?: readonly string[];
} | null;

type ToneProfile = {
  readonly formality: "formal" | "informal";
  readonly greeting: string;
  readonly closing: string;
  readonly sentenceStyle: string;
  readonly avoidances: readonly string[];
  readonly preferences: readonly string[];
  readonly jargon: readonly string[];
};

type OnboardingState = {
  readonly credentials: Credentials;
  readonly sentScan: ScanResult;
  readonly websiteData: WebsiteData;
  readonly toneProfile: ToneProfile;
  readonly emailSignature: string;
};

type Step5ConfirmProps = {
  readonly state: OnboardingState;
  readonly onEditTone?: () => void;
};

type SaveState = "idle" | "saving" | "error" | "success";

const FORMALITY_LABELS: Record<ToneProfile["formality"], string> = {
  formal: "Formell / Sie",
  informal: "Informell / Du",
};

export function Step5Confirm({ state, onEditTone }: Step5ConfirmProps) {
  const navigate = useNavigate();
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [dashboardUrl, setDashboardUrl] = useState("");
  const [copied, setCopied] = useState(false);

  async function handleSave() {
    setSaveState("saving");
    setErrorMessage("");

    try {
      const response = await fetch("/api/onboarding/save-tenant", {
        method: "POST",
        headers: apiHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          credentials: {
            email: state.credentials.email,
            imapHost: state.credentials.imapHost,
            imapPort: state.credentials.imapPort,
            smtpHost: state.credentials.smtpHost,
            smtpPort: state.credentials.smtpPort,
            password: state.credentials.password,
          },
          toneProfile: state.toneProfile,
          websiteData: state.websiteData,
          emailSignature: state.emailSignature,
        }),
      });

      const data = (await response.json()) as {
        success: boolean;
        tenantId?: string;
        accessToken?: string;
        error?: string;
      };

      if (!response.ok || !data.success) {
        setSaveState("error");
        setErrorMessage(data.error ?? "Speichern fehlgeschlagen");
        return;
      }

      if (data.accessToken) {
        const origin = window.location.origin;
        setDashboardUrl(`${origin}?t=${data.accessToken}`);
        setSaveState("success");

        // Fire-and-forget: backfill INBOX so the tenant sees recent emails
        // immediately instead of waiting for the next poller cycle
        if (data.tenantId) {
          fetch("/api/onboarding/backfill-inbox", {
            method: "POST",
            headers: apiHeaders({ "Content-Type": "application/json" }),
            body: JSON.stringify({ tenantId: data.tenantId }),
          }).catch(() => {
            // Backfill failure is non-critical — poller will pick up emails later
          });
        }
      } else {
        navigate("/");
      }
    } catch {
      setSaveState("error");
      setErrorMessage("Netzwerkfehler — Server nicht erreichbar");
    }
  }

  function handleCopyUrl() {
    void navigator.clipboard.writeText(dashboardUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleGoToDashboard() {
    const params = new URLSearchParams(dashboardUrl.split("?")[1] ?? "");
    const token = params.get("t") ?? "";
    // Full page reload — navigate() would race with location.href and
    // cause an aborted verify fetch, resulting in "Kein Zugang"
    window.location.href = `/?t=${token}`;
  }

  const { credentials, sentScan, websiteData, toneProfile } = state;

  if (saveState === "success" && dashboardUrl) {
    return (
      <div
        className="rounded-[25px] bg-white p-8 shadow-sm"
        style={{ fontFamily: "Archivo, sans-serif" }}
      >
        <h2 className="mb-1 text-xl font-semibold text-gray-900">
          Einrichtung abgeschlossen
        </h2>
        <p className="mb-6 text-sm text-gray-500">
          Ihr persönlicher Dashboard-Link wurde erstellt. Speichern Sie diesen
          Link — er ist Ihr Zugang zum Dashboard.
        </p>

        <div className="space-y-4">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div className="mb-2 flex items-center gap-2">
              <Link className="size-4 text-[#CC00FF]" />
              <span className="text-sm font-medium text-gray-900">
                Ihr persönlicher Dashboard-Link
              </span>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 break-all rounded bg-white px-3 py-2 text-xs text-gray-700 ring-1 ring-gray-200">
                {dashboardUrl}
              </code>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={handleCopyUrl}
              >
                {copied ? (
                  <Check className="size-4 text-green-600" />
                ) : (
                  <Copy className="size-4" />
                )}
              </Button>
            </div>
          </div>

          <Button
            className="w-full rounded-full bg-[#CC00FF] text-white hover:bg-[#CC00FF]/90"
            onClick={handleGoToDashboard}
          >
            Zum Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-[25px] bg-white p-8 shadow-sm"
      style={{ fontFamily: "Archivo, sans-serif" }}
    >
      <h2 className="mb-1 text-xl font-semibold text-gray-900">
        Zusammenfassung
      </h2>
      <p className="mb-6 text-sm text-gray-500">
        Überprüfen Sie Ihre Einstellungen und schließen Sie die Einrichtung ab.
      </p>

      <div className="space-y-4">
        {/* Credentials */}
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <div className="mb-2 flex items-center gap-2">
            <Shield className="size-4 text-[#CC00FF]" />
            <span className="text-sm font-medium text-gray-900">
              E-Mail-Verbindung
            </span>
          </div>
          <p className="text-sm text-gray-600">{credentials.email}</p>
          <p className="text-xs text-gray-400">
            IMAP: {credentials.imapHost}:{credentials.imapPort} · SMTP:{" "}
            {credentials.smtpHost}:{credentials.smtpPort}
          </p>
        </div>

        {/* Sent scan */}
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <div className="mb-2 flex items-center gap-2">
            <Mail className="size-4 text-[#CC00FF]" />
            <span className="text-sm font-medium text-gray-900">
              Gesendete E-Mails
            </span>
          </div>
          <p className="text-sm text-gray-600">
            {sentScan.emails_scanned} E-Mails gescannt
          </p>
        </div>

        {/* Website */}
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <div className="mb-2 flex items-center gap-2">
            <Globe className="size-4 text-[#CC00FF]" />
            <span className="text-sm font-medium text-gray-900">Website</span>
          </div>
          {websiteData ? (
            <div>
              {websiteData.description && (
                <p className="text-sm text-gray-600">
                  {websiteData.description}
                </p>
              )}
              {websiteData.keywords && websiteData.keywords.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {websiteData.keywords.map((kw) => (
                    <span
                      key={kw}
                      className="rounded-full bg-white px-2.5 py-0.5 text-xs text-gray-600 ring-1 ring-gray-200"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm italic text-gray-400">Übersprungen</p>
          )}
        </div>

        {/* Tone profile */}
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Pen className="size-4 text-[#CC00FF]" />
              <span className="text-sm font-medium text-gray-900">
                Schreibstil
              </span>
            </div>
            {onEditTone && (
              <button
                type="button"
                className="cursor-pointer text-xs font-medium text-[#CC00FF] hover:underline"
                onClick={onEditTone}
              >
                Bearbeiten
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <div>
              <span className="text-gray-400">Formalität:</span>{" "}
              <span className="text-gray-700">
                {FORMALITY_LABELS[toneProfile.formality]}
              </span>
            </div>
            <div>
              <span className="text-gray-400">Begrüßung:</span>{" "}
              <span className="text-gray-700">{toneProfile.greeting}</span>
            </div>
            <div>
              <span className="text-gray-400">Abschluss:</span>{" "}
              <span className="text-gray-700">{toneProfile.closing}</span>
            </div>
            <div>
              <span className="text-gray-400">Satzstil:</span>{" "}
              <span className="text-gray-700">{toneProfile.sentenceStyle}</span>
            </div>
          </div>
          {toneProfile.avoidances.length > 0 && (
            <div className="mt-2">
              <span className="text-xs text-gray-400">Vermeiden: </span>
              <span className="text-xs text-gray-600">
                {toneProfile.avoidances.join(", ")}
              </span>
            </div>
          )}
          {toneProfile.preferences.length > 0 && (
            <div className="mt-1">
              <span className="text-xs text-gray-400">Bevorzugen: </span>
              <span className="text-xs text-gray-600">
                {toneProfile.preferences.join(", ")}
              </span>
            </div>
          )}
          {toneProfile.jargon.length > 0 && (
            <div className="mt-1">
              <span className="text-xs text-gray-400">Fachbegriffe: </span>
              <span className="text-xs text-gray-600">
                {toneProfile.jargon.join(", ")}
              </span>
            </div>
          )}
        </div>

        {/* Email signature */}
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <div className="mb-2 flex items-center gap-2">
            <FileSignature className="size-4 text-[#CC00FF]" />
            <span className="text-sm font-medium text-gray-900">
              E-Mail-Signatur
            </span>
          </div>
          {state.emailSignature ? (
            <pre className="whitespace-pre-wrap text-sm text-gray-600">
              {state.emailSignature}
            </pre>
          ) : (
            <p className="text-sm italic text-gray-400">
              Keine Signatur konfiguriert
            </p>
          )}
        </div>

        {saveState === "error" && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="size-4 shrink-0" />
            {errorMessage}
          </div>
        )}

        <Button
          className="w-full rounded-full bg-[#CC00FF] text-white hover:bg-[#CC00FF]/90"
          disabled={saveState === "saving"}
          onClick={handleSave}
        >
          {saveState === "saving" && (
            <Loader2 className="size-4 animate-spin" />
          )}
          Speichern und starten
        </Button>
      </div>
    </div>
  );
}
