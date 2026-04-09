import { useEffect, useState, useCallback } from "react";
import { apiHeaders } from "@/lib/api/headers";
import { Loader2, AlertCircle, Mail, Info } from "lucide-react";
import { Button } from "@/components/ui/button";

type Credentials = {
  readonly email: string;
  readonly password: string;
  readonly imapHost: string;
  readonly imapPort: number;
  readonly smtpHost: string;
  readonly smtpPort: number;
};

type EmailSample = {
  readonly subject: string;
  readonly body: string;
};

type ScanResult = {
  readonly success: boolean;
  readonly emails_scanned: number;
  readonly subjects?: readonly string[];
  readonly rawEmails?: readonly string[];
  readonly detectedSignature?: string | null;
};

type ScanState = "loading" | "success" | "error";

type SentScanData = {
  readonly emails_scanned: number;
  readonly subjects: readonly string[];
  readonly rawEmails: readonly EmailSample[];
  readonly detectedSignature: string | null;
};

type Step2ScanSentProps = {
  readonly state: { readonly credentials: Credentials };
  readonly onUpdate: (data: { sentScan: SentScanData }) => void;
  readonly onNext: () => void;
};

export function Step2ScanSent({ state, onUpdate, onNext }: Step2ScanSentProps) {
  const [scanState, setScanState] = useState<ScanState>("loading");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const runScan = useCallback(async () => {
    setScanState("loading");
    setErrorMessage("");

    const { credentials } = state;

    try {
      const response = await fetch("/api/onboarding/scan-sent", {
        method: "POST",
        headers: apiHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          imapHost: credentials.imapHost,
          imapPort: credentials.imapPort,
          email: credentials.email,
          password: credentials.password,
        }),
      });

      const data = (await response.json()) as ScanResult & { error?: string };

      if (!response.ok || !data.success) {
        setScanState("error");
        setErrorMessage(data.error ?? "Scan fehlgeschlagen");
        return;
      }

      setResult(data);
      setScanState("success");
    } catch {
      setScanState("error");
      setErrorMessage("Netzwerkfehler — Server nicht erreichbar");
    }
  }, [state]);

  useEffect(() => {
    runScan();
  }, [runScan]);

  function handleContinue() {
    if (!result) return;

    const subjects = result.subjects ?? [];
    const bodies = result.rawEmails ?? [];
    const emailSamples: readonly EmailSample[] = subjects.map((subject, i) => ({
      subject,
      body: bodies[i] ?? "",
    }));

    onUpdate({
      sentScan: {
        emails_scanned: result.emails_scanned,
        subjects,
        rawEmails: emailSamples,
        detectedSignature: result.detectedSignature ?? null,
      },
    });
    onNext();
  }

  return (
    <div
      className="rounded-[25px] bg-white p-8 shadow-sm"
      style={{ fontFamily: "Archivo, sans-serif" }}
    >
      <h2 className="mb-1 text-xl font-semibold text-gray-900">
        Gesendete E-Mails scannen
      </h2>
      <p className="mb-6 text-sm text-gray-500">
        Wir analysieren Ihre gesendeten E-Mails, um Ihren Schreibstil zu
        erkennen.
      </p>

      {scanState === "loading" && (
        <div className="flex flex-col items-center gap-3 py-12">
          <Loader2 className="size-8 animate-spin text-[#CC00FF]" />
          <p className="text-sm text-gray-500">
            Gesendete E-Mails werden gescannt…
          </p>
        </div>
      )}

      {scanState === "error" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="size-4 shrink-0" />
            {errorMessage}
          </div>
          <Button variant="outline" onClick={runScan}>
            Erneut versuchen
          </Button>
        </div>
      )}

      {scanState === "success" && result && (
        <div className="space-y-4">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div className="mb-3 flex items-center gap-2">
              <Mail className="size-5 text-[#CC00FF]" />
              <span className="font-medium text-gray-900">
                {result.emails_scanned} E-Mails gefunden
              </span>
            </div>

            {result.subjects && result.subjects.length > 0 && (
              <ul className="space-y-1 text-sm text-gray-600">
                {result.subjects.slice(0, 5).map((subject) => (
                  <li key={subject} className="flex items-start gap-2">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-gray-400" />
                    <span className="line-clamp-1">{subject}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-700">
            <Info className="mt-0.5 size-4 shrink-0" />
            Diese E-Mails werden zur Tonanalyse verwendet
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
