import { useState, useCallback } from "react";
import { Toaster } from "@/components/ui/sonner";
import { Step1Credentials } from "@/components/onboarding/Step1Credentials";
import { Step2ScanSent } from "@/components/onboarding/Step2ScanSent";
import { Step3WebsiteScrape } from "@/components/onboarding/Step3WebsiteScrape";
import { Step4ToneAnalysis } from "@/components/onboarding/Step4ToneAnalysis";
import { Step5Confirm } from "@/components/onboarding/Step5Confirm";

type OnboardingState = {
  readonly credentials: {
    readonly email: string;
    readonly password: string;
    readonly imapHost: string;
    readonly imapPort: number;
    readonly smtpHost: string;
    readonly smtpPort: number;
  } | null;
  readonly sentScan: {
    readonly emails_scanned: number;
    readonly subjects: readonly string[];
    readonly rawEmails: readonly {
      readonly subject: string;
      readonly body: string;
    }[];
    readonly detectedSignature: string | null;
  } | null;
  readonly websiteData: {
    readonly success: boolean;
    readonly description: string;
    readonly keywords: readonly string[];
    readonly rawText?: string;
  } | null;
  readonly toneProfile: {
    readonly formality: "formal" | "informal";
    readonly greeting: string;
    readonly closing: string;
    readonly sentenceStyle: string;
    readonly avoidances: readonly string[];
    readonly preferences: readonly string[];
    readonly jargon: readonly string[];
  } | null;
  readonly emailSignature: string;
};

const TOTAL_STEPS = 5;

const STEP_LABELS: readonly string[] = [
  "Zugangsdaten",
  "E-Mail-Scan",
  "Website",
  "Schreibstil",
  "Bestätigung",
];

export function OnboardingView() {
  const [currentStep, setCurrentStep] = useState(1);
  const [state, setState] = useState<OnboardingState>({
    credentials: null,
    sentScan: null,
    websiteData: null,
    toneProfile: null,
    emailSignature: "",
  });

  const handleUpdate = useCallback((partial: Partial<OnboardingState>) => {
    setState((prev) => ({ ...prev, ...partial }));
  }, []);

  const handleNext = useCallback(() => {
    setCurrentStep((prev) => Math.min(prev + 1, TOTAL_STEPS));
  }, []);

  const goToStep = useCallback((step: number) => {
    setCurrentStep(step);
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-[#f8f9fa]">
      <header className="border-b bg-background px-6 py-4">
        <div className="mx-auto max-w-2xl">
          <h1
            className="text-lg font-semibold"
            style={{ fontFamily: "Archivo, sans-serif" }}
          >
            Siteware E-Mail Einrichtung
          </h1>
          <p className="text-sm text-muted-foreground">
            Schritt {currentStep} von {TOTAL_STEPS} —{" "}
            {STEP_LABELS[currentStep - 1]}
          </p>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center px-4 py-8">
        <div className="w-full max-w-2xl space-y-6">
          {/* Step indicator */}
          <div className="flex items-center gap-2">
            {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((n) => (
              <div
                key={n}
                className={`h-2 flex-1 rounded-full ${
                  n <= currentStep ? "bg-[#CC00FF]" : "bg-muted"
                }`}
              />
            ))}
          </div>

          {currentStep === 1 && (
            <Step1Credentials onUpdate={handleUpdate} onNext={handleNext} />
          )}

          {currentStep === 2 && state.credentials && (
            <Step2ScanSent
              state={{ credentials: state.credentials }}
              onUpdate={handleUpdate}
              onNext={handleNext}
            />
          )}

          {currentStep === 3 && (
            <Step3WebsiteScrape onUpdate={handleUpdate} onNext={handleNext} />
          )}

          {currentStep === 4 && state.sentScan && (
            <Step4ToneAnalysis
              state={{
                sentScan: state.sentScan,
                websiteData: state.websiteData,
              }}
              detectedSignature={state.sentScan.detectedSignature ?? ""}
              onUpdate={handleUpdate}
              onNext={handleNext}
            />
          )}

          {currentStep === 5 &&
            state.credentials &&
            state.sentScan &&
            state.toneProfile && (
              <Step5Confirm
                state={{
                  credentials: state.credentials,
                  sentScan: state.sentScan,
                  websiteData: state.websiteData,
                  toneProfile: state.toneProfile,
                  emailSignature: state.emailSignature,
                }}
                onEditTone={() => goToStep(4)}
              />
            )}
        </div>
      </main>

      <Toaster />
    </div>
  );
}
