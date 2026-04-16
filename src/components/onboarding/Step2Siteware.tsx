import type { ChangeEvent } from "react";
import { useState } from "react";

import { CheckCircle2, Loader2, AlertCircle, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type SitewareConfig = {
  readonly token: string;
  readonly triageAgentId: string;
  readonly replyAgentId: string;
  readonly toneAgentId: string;
};

type Step2SitewareProps = {
  readonly onUpdate: (data: { sitewareConfig: SitewareConfig }) => void;
  readonly onNext: () => void;
};

type TestState = "idle" | "testing" | "success" | "error";

export function Step2Siteware({ onUpdate, onNext }: Step2SitewareProps) {
  const [token, setToken] = useState("");
  const [triageAgentId, setTriageAgentId] = useState("");
  const [replyAgentId, setReplyAgentId] = useState("");
  const [toneAgentId, setToneAgentId] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [testState, setTestState] = useState<TestState>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const isFormValid =
    token.trim() !== "" &&
    triageAgentId.trim() !== "" &&
    replyAgentId.trim() !== "" &&
    toneAgentId.trim() !== "";

  function resetTest() {
    setTestState("idle");
    setErrorMessage("");
  }

  async function handleTestConnection() {
    setTestState("testing");
    setErrorMessage("");

    try {
      const response = await fetch("/api/onboarding/validate-siteware", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: token.trim(),
          triageAgentId: triageAgentId.trim(),
          replyAgentId: replyAgentId.trim(),
          toneAgentId: toneAgentId.trim(),
        }),
      });

      if (!response.ok) {
        setTestState("error");
        setErrorMessage(`Server-Fehler (${response.status})`);
        return;
      }

      const data = (await response.json()) as {
        success: boolean;
        error?: string;
      };

      if (data.success) {
        setTestState("success");
      } else {
        setTestState("error");
        setErrorMessage(data.error ?? "Verbindung fehlgeschlagen");
      }
    } catch {
      setTestState("error");
      setErrorMessage("Netzwerkfehler — Server nicht erreichbar");
    }
  }

  function handleContinue() {
    const sitewareConfig: SitewareConfig = {
      token: token.trim(),
      triageAgentId: triageAgentId.trim(),
      replyAgentId: replyAgentId.trim(),
      toneAgentId: toneAgentId.trim(),
    };
    onUpdate({ sitewareConfig });
    onNext();
  }

  return (
    <div
      className="rounded-[25px] bg-white p-8 shadow-sm"
      style={{ fontFamily: "Archivo, sans-serif" }}
    >
      <h2 className="mb-1 text-xl font-semibold text-gray-900">
        Siteware-Konfiguration
      </h2>
      <p className="mb-6 text-sm text-gray-500">
        Geben Sie Ihre Siteware API-Zugangsdaten ein. Den Token und die
        Agent-IDs finden Sie in Ihrem Siteware-Konto unter Einstellungen →
        API-Zugriffsschlüssel.
      </p>

      <div className="space-y-4">
        {/* API Token */}
        <div className="space-y-2">
          <Label htmlFor="sw-token">API Token</Label>
          <div className="relative">
            <Input
              id="sw-token"
              type={showToken ? "text" : "password"}
              placeholder="Siteware API-Token"
              className="bg-gray-100 pr-10"
              value={token}
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                setToken(e.target.value);
                resetTest();
              }}
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              onClick={() => setShowToken((prev) => !prev)}
              aria-label={showToken ? "Token verbergen" : "Token anzeigen"}
            >
              {showToken ? (
                <EyeOff className="size-4" />
              ) : (
                <Eye className="size-4" />
              )}
            </button>
          </div>
        </div>

        {/* Triage Agent ID */}
        <div className="space-y-2">
          <Label htmlFor="sw-triage">Triage Agent-ID</Label>
          <Input
            id="sw-triage"
            type="text"
            placeholder="z. B. agent_abc123"
            className="bg-gray-100"
            value={triageAgentId}
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              setTriageAgentId(e.target.value);
              resetTest();
            }}
          />
        </div>

        {/* Reply Composer Agent ID */}
        <div className="space-y-2">
          <Label htmlFor="sw-reply">Reply Composer Agent-ID</Label>
          <Input
            id="sw-reply"
            type="text"
            placeholder="z. B. agent_def456"
            className="bg-gray-100"
            value={replyAgentId}
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              setReplyAgentId(e.target.value);
              resetTest();
            }}
          />
        </div>

        {/* Tone Analysis Agent ID */}
        <div className="space-y-2">
          <Label htmlFor="sw-tone">Ton-Analyse Agent-ID</Label>
          <Input
            id="sw-tone"
            type="text"
            placeholder="z. B. agent_ghi789"
            className="bg-gray-100"
            value={toneAgentId}
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              setToneAgentId(e.target.value);
              resetTest();
            }}
          />
        </div>

        {testState === "error" && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          >
            <AlertCircle className="size-4 shrink-0" />
            {errorMessage}
          </div>
        )}

        {testState === "success" && (
          <div
            role="status"
            className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700"
          >
            <CheckCircle2 className="size-4 shrink-0" />
            Alle Agenten erreichbar ✓
          </div>
        )}

        <div className="flex items-center gap-3 pt-2">
          <Button
            variant="outline"
            onClick={handleTestConnection}
            disabled={!isFormValid || testState === "testing"}
          >
            {testState === "testing" && (
              <Loader2 className="size-4 animate-spin" />
            )}
            Verbindung testen
          </Button>

          <Button
            className="bg-[#CC00FF] text-white hover:bg-[#CC00FF]/90"
            disabled={testState !== "success"}
            onClick={handleContinue}
          >
            Weiter
          </Button>
        </div>
      </div>
    </div>
  );
}
