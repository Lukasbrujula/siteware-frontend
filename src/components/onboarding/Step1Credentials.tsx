import type { ChangeEvent } from "react";
import { useState } from "react";

import {
  CheckCircle2,
  Loader2,
  AlertCircle,
  Eye,
  EyeOff,
  Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Credentials = {
  readonly email: string;
  readonly password: string;
  readonly imapHost: string;
  readonly imapPort: number;
  readonly smtpHost: string;
  readonly smtpPort: number;
};

type Step1CredentialsProps = {
  readonly onUpdate: (data: { credentials: Credentials }) => void;
  readonly onNext: () => void;
};

type TestState = "idle" | "testing" | "success" | "error";

type ProviderId =
  | "gmail"
  | "outlook"
  | "icloud"
  | "yahoo"
  | "gmx"
  | "webde"
  | "ionos"
  | "tonline"
  | "custom";

type ProviderConfig = {
  readonly id: ProviderId;
  readonly label: string;
  readonly imapHost: string;
  readonly imapPort: string;
  readonly smtpHost: string;
  readonly smtpPort: string;
  readonly helpText: string;
  readonly helpUrl?: string;
  readonly helpLinkLabel?: string;
};

const PROVIDERS: readonly ProviderConfig[] = [
  {
    id: "gmail",
    label: "Gmail",
    imapHost: "imap.gmail.com",
    imapPort: "993",
    smtpHost: "smtp.gmail.com",
    smtpPort: "465",
    helpText:
      "Gmail erfordert ein App-Passwort. Normales Passwort funktioniert nicht.",
    helpUrl: "https://myaccount.google.com/apppasswords",
    helpLinkLabel: "App-Passwort erstellen",
  },
  {
    id: "outlook",
    label: "Outlook / Microsoft 365",
    imapHost: "outlook.office365.com",
    imapPort: "993",
    smtpHost: "smtp.office365.com",
    smtpPort: "587",
    helpText:
      "Verwenden Sie Ihr normales Microsoft-Passwort oder ein App-Passwort wenn 2FA aktiviert ist.",
  },
  {
    id: "icloud",
    label: "iCloud",
    imapHost: "imap.mail.me.com",
    imapPort: "993",
    smtpHost: "smtp.mail.me.com",
    smtpPort: "587",
    helpText: "iCloud erfordert ein App-Passwort.",
    helpUrl: "https://appleid.apple.com",
    helpLinkLabel: "App-Passwort erstellen",
  },
  {
    id: "yahoo",
    label: "Yahoo",
    imapHost: "imap.mail.yahoo.com",
    imapPort: "993",
    smtpHost: "smtp.mail.yahoo.com",
    smtpPort: "465",
    helpText: "Yahoo erfordert ein App-Passwort.",
    helpUrl: "https://login.yahoo.com/account/security",
    helpLinkLabel: "App-Passwort erstellen",
  },
  {
    id: "gmx",
    label: "GMX",
    imapHost: "imap.gmx.net",
    imapPort: "993",
    smtpHost: "mail.gmx.net",
    smtpPort: "587",
    helpText: "Bitte IMAP-Passwort Ihres GMX-Kontos verwenden.",
  },
  {
    id: "webde",
    label: "Web.de",
    imapHost: "imap.web.de",
    imapPort: "993",
    smtpHost: "smtp.web.de",
    smtpPort: "587",
    helpText: "Bitte IMAP-Passwort Ihres Web.de-Kontos verwenden.",
  },
  {
    id: "ionos",
    label: "IONOS (1&1)",
    imapHost: "imap.ionos.de",
    imapPort: "993",
    smtpHost: "smtp.ionos.de",
    smtpPort: "587",
    helpText: "Bitte IMAP-Passwort Ihres IONOS-Kontos verwenden.",
  },
  {
    id: "tonline",
    label: "T-Online",
    imapHost: "secureimap.t-online.de",
    imapPort: "993",
    smtpHost: "securesmtp.t-online.de",
    smtpPort: "465",
    helpText: "Bitte IMAP-Passwort Ihres T-Online-Kontos verwenden.",
  },
  {
    id: "custom",
    label: "Andere",
    imapHost: "",
    imapPort: "993",
    smtpHost: "",
    smtpPort: "465",
    helpText: "Bitte IMAP-Passwort Ihres E-Mail-Anbieters verwenden.",
  },
] as const;

function getProviderById(id: ProviderId): ProviderConfig {
  return PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[8];
}

export function Step1Credentials({ onUpdate, onNext }: Step1CredentialsProps) {
  const [selectedProvider, setSelectedProvider] = useState<ProviderId>("gmail");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [imapHost, setImapHost] = useState("imap.gmail.com");
  const [imapPort, setImapPort] = useState("993");
  const [smtpHost, setSmtpHost] = useState("smtp.gmail.com");
  const [smtpPort, setSmtpPort] = useState("465");
  const [testState, setTestState] = useState<TestState>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const provider = getProviderById(selectedProvider);

  const isFormValid =
    email.trim() !== "" &&
    password.trim() !== "" &&
    imapHost.trim() !== "" &&
    imapPort.trim() !== "" &&
    smtpHost.trim() !== "" &&
    smtpPort.trim() !== "";

  function handleProviderSelect(id: ProviderId) {
    const config = getProviderById(id);
    setSelectedProvider(id);
    setImapHost(config.imapHost);
    setImapPort(config.imapPort);
    setSmtpHost(config.smtpHost);
    setSmtpPort(config.smtpPort);
    setTestState("idle");
    setErrorMessage("");
  }

  async function handleTestConnection() {
    setTestState("testing");
    setErrorMessage("");

    try {
      const response = await fetch("/api/onboarding/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          imapHost: imapHost.trim(),
          imapPort: Number(imapPort),
          smtpHost: smtpHost.trim(),
          smtpPort: Number(smtpPort),
        }),
      });

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
    const credentials: Credentials = {
      email: email.trim(),
      password,
      imapHost: imapHost.trim(),
      imapPort: Number(imapPort),
      smtpHost: smtpHost.trim(),
      smtpPort: Number(smtpPort),
    };
    onUpdate({ credentials });
    onNext();
  }

  return (
    <div
      className="rounded-[25px] bg-white p-8 shadow-sm"
      style={{ fontFamily: "Archivo, sans-serif" }}
    >
      <h2 className="mb-1 text-xl font-semibold text-gray-900">
        E-Mail-Verbindung
      </h2>
      <p className="mb-6 text-sm text-gray-500">
        Wählen Sie Ihren E-Mail-Anbieter und geben Sie Ihre Zugangsdaten ein.
      </p>

      {/* Provider selector */}
      <div className="mb-6">
        <Label className="mb-2 block">E-Mail-Anbieter</Label>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {PROVIDERS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => handleProviderSelect(p.id)}
              className={`flex items-center justify-center gap-1.5 rounded-lg border-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                selectedProvider === p.id
                  ? "border-[#CC00FF] bg-[#CC00FF]/5 text-[#CC00FF]"
                  : "border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300 hover:bg-gray-100"
              }`}
            >
              <Mail className="size-4 shrink-0" />
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="cred-email">E-Mail-Adresse</Label>
          <Input
            id="cred-email"
            type="email"
            placeholder="name@example.com"
            className="bg-gray-100"
            value={email}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setEmail(e.target.value)
            }
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="cred-password">Passwort</Label>
          <div className="relative">
            <Input
              id="cred-password"
              type={showPassword ? "text" : "password"}
              placeholder={
                selectedProvider === "custom" ? "Passwort" : "App-Passwort"
              }
              className="bg-gray-100 pr-10"
              value={password}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setPassword(e.target.value)
              }
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={
                showPassword ? "Passwort verbergen" : "Passwort anzeigen"
              }
            >
              {showPassword ? (
                <EyeOff className="size-4" />
              ) : (
                <Eye className="size-4" />
              )}
            </button>
          </div>
          {/* Provider-specific help note */}
          <p className="text-xs text-gray-500">
            {provider.helpText}
            {provider.helpUrl && (
              <>
                {" "}
                <a
                  href={provider.helpUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-[#CC00FF] underline hover:text-[#CC00FF]/80"
                >
                  {provider.helpLinkLabel}
                </a>
              </>
            )}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="cred-imap-host">IMAP Host</Label>
            <Input
              id="cred-imap-host"
              placeholder="imap.example.com"
              className="bg-gray-100"
              value={imapHost}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setImapHost(e.target.value)
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cred-imap-port">IMAP Port</Label>
            <Input
              id="cred-imap-port"
              type="number"
              placeholder="993"
              className="bg-gray-100"
              value={imapPort}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setImapPort(e.target.value)
              }
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="cred-smtp-host">SMTP Host</Label>
            <Input
              id="cred-smtp-host"
              placeholder="smtp.example.com"
              className="bg-gray-100"
              value={smtpHost}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setSmtpHost(e.target.value)
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cred-smtp-port">SMTP Port</Label>
            <Input
              id="cred-smtp-port"
              type="number"
              placeholder="465"
              className="bg-gray-100"
              value={smtpPort}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setSmtpPort(e.target.value)
              }
            />
          </div>
        </div>

        {testState === "error" && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="size-4 shrink-0" />
            {errorMessage}
          </div>
        )}

        {testState === "success" && (
          <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
            <CheckCircle2 className="size-4 shrink-0" />
            Verbindung erfolgreich
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
