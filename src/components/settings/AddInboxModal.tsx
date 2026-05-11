import type { ChangeEvent } from "react";
import { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

type ProviderPreset = {
  readonly id: ProviderId;
  readonly label: string;
  readonly imapHost: string;
  readonly imapPort: string;
  readonly smtpHost: string;
  readonly smtpPort: string;
};

const PROVIDER_PRESETS: readonly ProviderPreset[] = [
  {
    id: "gmail",
    label: "Gmail",
    imapHost: "imap.gmail.com",
    imapPort: "993",
    smtpHost: "smtp.gmail.com",
    smtpPort: "465",
  },
  {
    id: "outlook",
    label: "Outlook",
    imapHost: "outlook.office365.com",
    imapPort: "993",
    smtpHost: "smtp.office365.com",
    smtpPort: "587",
  },
  {
    id: "icloud",
    label: "iCloud",
    imapHost: "imap.mail.me.com",
    imapPort: "993",
    smtpHost: "smtp.mail.me.com",
    smtpPort: "587",
  },
  {
    id: "yahoo",
    label: "Yahoo",
    imapHost: "imap.mail.yahoo.com",
    imapPort: "993",
    smtpHost: "smtp.mail.yahoo.com",
    smtpPort: "465",
  },
  {
    id: "gmx",
    label: "GMX",
    imapHost: "imap.gmx.net",
    imapPort: "993",
    smtpHost: "mail.gmx.net",
    smtpPort: "587",
  },
  {
    id: "webde",
    label: "Web.de",
    imapHost: "imap.web.de",
    imapPort: "993",
    smtpHost: "smtp.web.de",
    smtpPort: "587",
  },
  {
    id: "ionos",
    label: "IONOS",
    imapHost: "imap.ionos.de",
    imapPort: "993",
    smtpHost: "smtp.ionos.de",
    smtpPort: "587",
  },
  {
    id: "tonline",
    label: "T-Online",
    imapHost: "secureimap.t-online.de",
    imapPort: "993",
    smtpHost: "securesmtp.t-online.de",
    smtpPort: "465",
  },
  {
    id: "custom",
    label: "Andere",
    imapHost: "",
    imapPort: "993",
    smtpHost: "",
    smtpPort: "465",
  },
] as const;

type TestState = "idle" | "testing" | "success" | "error";
type SaveState = "idle" | "saving" | "error";

type AddInboxModalProps = {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSuccess: () => void;
};

export function AddInboxModal({
  open,
  onOpenChange,
  onSuccess,
}: AddInboxModalProps) {
  const [provider, setProvider] = useState<ProviderId>("gmail");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [imapHost, setImapHost] = useState("imap.gmail.com");
  const [imapPort, setImapPort] = useState("993");
  const [smtpHost, setSmtpHost] = useState("smtp.gmail.com");
  const [smtpPort, setSmtpPort] = useState("465");
  const [sitewareToken, setSitewareToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [replyAgentId, setReplyAgentId] = useState("");
  const [testState, setTestState] = useState<TestState>("idle");
  const [testError, setTestError] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState("");

  const isFormValid =
    email.trim() !== "" &&
    password.trim() !== "" &&
    imapHost.trim() !== "" &&
    imapPort.trim() !== "" &&
    smtpHost.trim() !== "" &&
    smtpPort.trim() !== "" &&
    sitewareToken.trim() !== "" &&
    replyAgentId.trim() !== "";

  const busy = testState === "testing" || saveState === "saving";

  function resetState() {
    setProvider("gmail");
    setEmail("");
    setPassword("");
    setShowPassword(false);
    setImapHost("imap.gmail.com");
    setImapPort("993");
    setSmtpHost("smtp.gmail.com");
    setSmtpPort("465");
    setSitewareToken("");
    setShowToken(false);
    setReplyAgentId("");
    setTestState("idle");
    setTestError("");
    setSaveState("idle");
    setSaveError("");
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) resetState();
    onOpenChange(nextOpen);
  }

  function handleProviderSelect(id: ProviderId) {
    const preset =
      PROVIDER_PRESETS.find((p) => p.id === id) ?? PROVIDER_PRESETS[8];
    setProvider(id);
    setImapHost(preset.imapHost);
    setImapPort(preset.imapPort);
    setSmtpHost(preset.smtpHost);
    setSmtpPort(preset.smtpPort);
    setTestState("idle");
    setTestError("");
  }

  async function handleTestConnection() {
    setTestState("testing");
    setTestError("");

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
        setTestError(data.error ?? "Verbindung fehlgeschlagen");
      }
    } catch {
      setTestState("error");
      setTestError("Netzwerkfehler — Server nicht erreichbar");
    }
  }

  async function handleSave() {
    setSaveState("saving");
    setSaveError("");

    try {
      const response = await fetch("/api/onboarding/save-tenant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          credentials: {
            email: email.trim(),
            password,
            imapHost: imapHost.trim(),
            imapPort: Number(imapPort),
            smtpHost: smtpHost.trim(),
            smtpPort: Number(smtpPort),
          },
          siteware_token: sitewareToken.trim(),
          reply_agent_id: replyAgentId.trim(),
          toneProfile: null,
          websiteData: null,
          emailSignature: "",
        }),
      });

      const data = (await response.json()) as {
        success: boolean;
        error?: string;
      };

      if (!response.ok || !data.success) {
        setSaveState("error");
        setSaveError(data.error ?? "Fehler beim Speichern");
        return;
      }

      onSuccess();
      handleOpenChange(false);
    } catch {
      setSaveState("error");
      setSaveError("Netzwerkfehler — Server nicht erreichbar");
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Neues E-Mail-Konto</DialogTitle>
          <DialogDescription>
            Verbinden Sie ein weiteres E-Mail-Postfach mit Siteware.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Provider selector */}
          <div className="space-y-2">
            <Label>E-Mail-Anbieter</Label>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {PROVIDER_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleProviderSelect(p.id)}
                  className={`flex items-center justify-center gap-1.5 rounded-lg border-2 px-2 py-2 text-xs font-medium transition-colors ${
                    provider === p.id
                      ? "border-[#CC00FF] bg-[#CC00FF]/5 text-[#CC00FF]"
                      : "border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300 hover:bg-gray-100"
                  }`}
                >
                  <Mail className="size-3 shrink-0" />
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="ai-email">E-Mail-Adresse</Label>
            <Input
              id="ai-email"
              type="email"
              placeholder="name@example.com"
              className="bg-gray-100"
              value={email}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setEmail(e.target.value)
              }
            />
          </div>

          {/* Password */}
          <div className="space-y-2">
            <Label htmlFor="ai-password">Passwort / App-Passwort</Label>
            <div className="relative">
              <Input
                id="ai-password"
                type={showPassword ? "text" : "password"}
                placeholder="App-Passwort"
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
          </div>

          {/* IMAP */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="ai-imap-host">IMAP Host</Label>
              <Input
                id="ai-imap-host"
                placeholder="imap.example.com"
                className="bg-gray-100"
                value={imapHost}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setImapHost(e.target.value)
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ai-imap-port">IMAP Port</Label>
              <Input
                id="ai-imap-port"
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

          {/* SMTP */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="ai-smtp-host">SMTP Host</Label>
              <Input
                id="ai-smtp-host"
                placeholder="smtp.example.com"
                className="bg-gray-100"
                value={smtpHost}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setSmtpHost(e.target.value)
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ai-smtp-port">SMTP Port</Label>
              <Input
                id="ai-smtp-port"
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

          {/* Siteware API token */}
          <div className="space-y-2 border-t border-gray-100 pt-3">
            <Label htmlFor="ai-token">Siteware API-Schlüssel</Label>
            <div className="relative">
              <Input
                id="ai-token"
                type={showToken ? "text" : "password"}
                placeholder="Siteware API-Token"
                className="bg-gray-100 pr-10"
                value={sitewareToken}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setSitewareToken(e.target.value)
                }
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                onClick={() => setShowToken((prev) => !prev)}
                aria-label={
                  showToken
                    ? "API-Schlüssel verbergen"
                    : "API-Schlüssel anzeigen"
                }
              >
                {showToken ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
          </div>

          {/* Reply Agent ID */}
          <div className="space-y-2">
            <Label htmlFor="ai-reply-agent">Reply Agent ID</Label>
            <Input
              id="ai-reply-agent"
              type="text"
              placeholder="z. B. agent_def456"
              className="bg-gray-100"
              value={replyAgentId}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setReplyAgentId(e.target.value)
              }
            />
          </div>

          {/* Feedback */}
          {testState === "error" && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="size-4 shrink-0" />
              {testError}
            </div>
          )}
          {testState === "success" && (
            <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
              <CheckCircle2 className="size-4 shrink-0" />
              Verbindung erfolgreich — Konto kann jetzt gespeichert werden.
            </div>
          )}
          {saveState === "error" && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="size-4 shrink-0" />
              {saveError}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            className="cursor-pointer"
            disabled={busy}
            onClick={() => handleOpenChange(false)}
          >
            Abbrechen
          </Button>
          <Button
            variant="outline"
            className="cursor-pointer"
            disabled={!isFormValid || busy}
            onClick={() => void handleTestConnection()}
          >
            {testState === "testing" && (
              <Loader2 className="size-4 animate-spin" />
            )}
            Verbindung testen
          </Button>
          <Button
            className="cursor-pointer bg-[#CC00FF] text-white hover:bg-[#CC00FF]/90"
            disabled={testState !== "success" || busy}
            onClick={() => void handleSave()}
          >
            {saveState === "saving" && (
              <Loader2 className="size-4 animate-spin" />
            )}
            Konto hinzufügen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
