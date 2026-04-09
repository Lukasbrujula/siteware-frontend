import type { ChangeEvent } from "react";
import { useState } from "react";
import { apiHeaders } from "@/lib/api/headers";
import {
  Card,
  CardContent,
  CardHeader,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { ToneProfileCard } from "./ToneProfileCard";
import type { ToneProfile } from "@/types/tone-profile";

type ManualExamplesStepProps = {
  readonly tenantId: string;
  readonly onComplete: (profile: ToneProfile) => void;
  readonly onBack: () => void;
};

type AnalysisState = "input" | "analyzing" | "done" | "error";

export function ManualExamplesStep({
  tenantId,
  onComplete,
  onBack,
}: ManualExamplesStepProps) {
  const [emails, setEmails] = useState<readonly [string, string, string]>([
    "",
    "",
    "",
  ]);
  const [state, setState] = useState<AnalysisState>("input");
  const [profile, setProfile] = useState<ToneProfile | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const isFormValid = emails.every((e) => e.trim().length >= 20);

  function handleEmailChange(index: number, value: string) {
    setEmails((prev) => {
      const updated = [...prev] as [string, string, string];
      updated[index] = value;
      return updated;
    });
  }

  async function handleAnalyze() {
    setState("analyzing");
    setErrorMessage("");

    try {
      const response = await fetch("/api/onboarding/manual-profile", {
        method: "POST",
        headers: apiHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          tenant_id: tenantId,
          example_emails: emails.map((e) => e.trim()),
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

  if (state === "analyzing") {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Wir analysieren Ihren Schreibstil anhand Ihrer Beispiele...
          </p>
        </CardContent>
      </Card>
    );
  }

  if (state === "done" && profile) {
    return (
      <div className="space-y-4">
        <ToneProfileCard profile={profile} />
        <div className="flex gap-2">
          <Button onClick={handleConfirm}>Profil bestaetigen</Button>
          <Button variant="outline" onClick={() => setState("input")}>
            Beispiele aendern
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardDescription>Beispiel-E-Mails eingeben</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Geben Sie mindestens 3 Beispiel-E-Mails ein, die Sie typischerweise
          versenden. Mindestens 20 Zeichen pro E-Mail.
        </p>

        {[0, 1, 2].map((index) => (
          <div key={index} className="space-y-2">
            <Label htmlFor={`email-${index}`}>E-Mail {index + 1}</Label>
            <Textarea
              id={`email-${index}`}
              placeholder={`Beispiel-E-Mail ${index + 1} eingeben...`}
              rows={4}
              value={emails[index]}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                handleEmailChange(index, e.target.value)
              }
            />
          </div>
        ))}

        {state === "error" && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {errorMessage}
          </div>
        )}

        <div className="flex gap-2">
          <Button onClick={handleAnalyze} disabled={!isFormValid}>
            Analysieren
          </Button>
          <Button variant="outline" onClick={onBack}>
            Zurueck
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
