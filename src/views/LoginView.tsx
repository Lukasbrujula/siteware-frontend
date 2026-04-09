import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/lib/store/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

type Step = "email" | "code";

export function LoginView() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (response.ok) {
        setStep("code");
      } else {
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(data.error ?? "Code konnte nicht gesendet werden.");
      }
    } catch {
      setError("Netzwerkfehler — Server nicht erreichbar.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token: code }),
      });

      if (response.ok) {
        const data = (await response.json()) as {
          email: string;
          name?: string;
        };
        useAuthStore.getState().setUser(data);
        navigate("/", { replace: true });
      } else {
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(data.error ?? "Ungültiger oder abgelaufener Code.");
      }
    } catch {
      setError("Netzwerkfehler — Server nicht erreichbar.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f8f9fa]">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-lg font-bold lowercase text-foreground">
            siteware
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            E-Mail Automation
          </p>
        </div>

        {step === "email" ? (
          <form onSubmit={handleRequestOtp} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-Mail-Adresse</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@firma.de"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                autoComplete="email"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            )}

            <Button
              type="submit"
              className="w-full cursor-pointer"
              disabled={isSubmitting || !email}
            >
              {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
              Code anfordern
            </Button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Wir haben einen 6-stelligen Code an{" "}
              <span className="font-medium text-foreground">{email}</span>{" "}
              gesendet.
            </p>

            <div className="space-y-2">
              <Label htmlFor="code">Bestätigungscode</Label>
              <Input
                id="code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                required
                autoFocus
                autoComplete="one-time-code"
                className="text-center text-lg tracking-[0.3em]"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            )}

            <Button
              type="submit"
              className="w-full cursor-pointer"
              disabled={isSubmitting || code.length !== 6}
            >
              {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
              Anmelden
            </Button>

            <button
              type="button"
              className="w-full cursor-pointer text-sm text-muted-foreground hover:text-foreground"
              onClick={() => {
                setStep("email");
                setCode("");
                setError("");
              }}
            >
              Andere E-Mail verwenden
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
