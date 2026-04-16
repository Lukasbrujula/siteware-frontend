import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { useAuthStore } from "@/lib/store/auth-store";
import { Step1Credentials } from "@/components/onboarding/Step1Credentials";
import { Step2Siteware } from "@/components/onboarding/Step2Siteware";
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
  readonly sitewareConfig: {
    readonly token: string;
    readonly triageAgentId: string;
    readonly replyAgentId: string;
    readonly toneAgentId: string;
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

const TOTAL_STEPS = 6;

const STEP_LABELS: readonly string[] = [
  "Zugangsdaten",
  "Siteware",
  "E-Mail-Scan",
  "Website",
  "Schreibstil",
  "Bestätigung",
];

export function OnboardingView() {
  const navigate = useNavigate();
  const checkAuthCalled = useRef(false);
  const isVerified = useAuthStore((s) => s.isVerified);
  const isLoading = useAuthStore((s) => s.isLoading);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (checkAuthCalled.current) return;
    checkAuthCalled.current = true;
    // Skip if App.tsx already resolved auth (e.g. navigating from /)
    const { isVerified, isLoading } = useAuthStore.getState();
    if (!isVerified && !isLoading) {
      void useAuthStore.getState().checkAuth();
    }
  }, []);

  useEffect(() => {
    if (isLoading) return;
    if (!isVerified) {
      navigate("/login", { replace: true });
      return;
    }
    if (user?.role?.toLowerCase() !== "admin") {
      navigate("/", { replace: true });
    }
  }, [isLoading, isVerified, user, navigate]);

  const [currentStep, setCurrentStep] = useState(1);
  const [state, setState] = useState<OnboardingState>({
    credentials: null,
    sitewareConfig: null,
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

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8f9fa]">
        <Loader2 className="size-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!isVerified || user?.role?.toLowerCase() !== "admin") {
    return null;
  }

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

          {currentStep === 2 && (
            <Step2Siteware onUpdate={handleUpdate} onNext={handleNext} />
          )}

          {currentStep === 3 && state.credentials && (
            <Step2ScanSent
              state={{ credentials: state.credentials }}
              onUpdate={handleUpdate}
              onNext={handleNext}
            />
          )}

          {currentStep === 4 && (
            <Step3WebsiteScrape onUpdate={handleUpdate} onNext={handleNext} />
          )}

          {currentStep === 5 && state.sentScan && (
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

          {currentStep === 6 &&
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
                onEditTone={() => goToStep(5)}
              />
            )}
        </div>
      </main>

      <Toaster />
    </div>
  );
}
