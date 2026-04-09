import { useState } from "react";
import { apiHeaders } from "@/lib/api/headers";
import {
  Card,
  CardContent,
  CardHeader,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { ToneProfileCard } from "./ToneProfileCard";
import type { ToneProfile } from "@/types/tone-profile";

type ImapConfig = {
  readonly host: string;
  readonly port: number;
  readonly user: string;
  readonly password: string;
  readonly tls: boolean;
};

type ToneAnalysisStepProps = {
  readonly imapConfig: ImapConfig;
  readonly tenantId: string;
  readonly onComplete: (profile: ToneProfile) => void;
  readonly onManualFallback: () => void;
};

type AnalysisState = "idle" | "analyzing" | "done" | "error";

export function ToneAnalysisStep({
  imapConfig,
  tenantId,
  onComplete,
  onManualFallback,
}: ToneAnalysisStepProps) {
  const [state, setState] = useState<AnalysisState>("idle");
  const [profile, setProfile] = useState<ToneProfile | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleStartAnalysis() {
    setState("analyzing");
    setErrorMessage("");

    try {
      const response = await fetch("/api/onboarding/scan-sent", {
        method: "POST",
        headers: apiHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          ...imapConfig,
          tenant_id: tenantId,
        }),
      });

      const data = (await response.json()) as {
        success: boolean;
        profile?: ToneProfile;
        error?: string;
      };

      if (data.success && data.profile) {
        setState("done");
        setProfile(data.profile);
      } else {
        setState("error");
        setErrorMessage(data.error ?? "Analyse fehlgeschlagen");
      }
    } catch {
      setState("error");
      setErrorMessage("Netzwerkfehler — Server nicht erreichbar");
    }
  }

  function handleConfirm() {
    if (profile) {
      onComplete(profile);
    }
  }

  return (
    <div className="space-y-4">
      {state === "idle" && (
        <Card>
          <CardHeader>
            <CardDescription>Tonprofil-Analyse</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Wir analysieren Ihre letzten gesendeten E-Mails, um Ihren
              Schreibstil zu erkennen. Die KI erstellt daraus ein Tonprofil fuer
              automatische Antworten.
            </p>
            <div className="flex gap-2">
              <Button onClick={handleStartAnalysis}>Analyse starten</Button>
              <Button variant="outline" onClick={onManualFallback}>
                Beispiele manuell eingeben
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {state === "analyzing" && (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Wir analysieren Ihren Schreibstil anhand Ihrer letzten E-Mails...
            </p>
          </CardContent>
        </Card>
      )}

      {state === "error" && (
        <Card>
          <CardHeader>
            <CardDescription>Analyse fehlgeschlagen</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {errorMessage}
            </div>
            <div className="flex gap-2">
              <Button onClick={handleStartAnalysis}>Erneut versuchen</Button>
              <Button variant="outline" onClick={onManualFallback}>
                Beispiele manuell eingeben
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {state === "done" && profile && (
        <div className="space-y-4">
          <ToneProfileCard profile={profile} />
          <div className="flex gap-2">
            <Button onClick={handleConfirm}>Profil bestaetigen</Button>
            <Button variant="outline" onClick={onManualFallback}>
              Beispiele manuell eingeben
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
