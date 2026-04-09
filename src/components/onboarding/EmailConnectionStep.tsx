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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle2, Loader2, AlertCircle } from "lucide-react";

type ImapConfig = {
  readonly host: string;
  readonly port: number;
  readonly user: string;
  readonly password: string;
  readonly tls: boolean;
};

type EmailConnectionStepProps = {
  readonly onSuccess: (config: ImapConfig, folder: string) => void;
};

type TestState = "idle" | "testing" | "success" | "error";

export function EmailConnectionStep({ onSuccess }: EmailConnectionStepProps) {
  const [host, setHost] = useState("");
  const [port, setPort] = useState("993");
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [tls, setTls] = useState(true);
  const [testState, setTestState] = useState<TestState>("idle");
  const [folder, setFolder] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const isFormValid =
    host.trim() !== "" && user.trim() !== "" && password.trim() !== "";

  async function handleTestConnection() {
    setTestState("testing");
    setErrorMessage("");

    try {
      const response = await fetch("/api/onboarding/test-connection", {
        method: "POST",
        headers: apiHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          host: host.trim(),
          port: Number(port),
          user: user.trim(),
          password,
          tls,
        }),
      });

      const data = (await response.json()) as {
        success: boolean;
        folder?: string;
        error?: string;
      };

      if (data.success && data.folder) {
        setTestState("success");
        setFolder(data.folder);
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
    onSuccess(
      {
        host: host.trim(),
        port: Number(port),
        user: user.trim(),
        password,
        tls,
      },
      folder,
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardDescription>IMAP-Verbindung einrichten</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="host">IMAP-Host</Label>
            <Input
              id="host"
              placeholder="imap.example.com"
              value={host}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setHost(e.target.value)
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="port">Port</Label>
            <Input
              id="port"
              type="number"
              placeholder="993"
              value={port}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setPort(e.target.value)
              }
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="user">Benutzername / E-Mail</Label>
          <Input
            id="user"
            placeholder="user@example.com"
            value={user}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setUser(e.target.value)
            }
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Passwort</Label>
          <Input
            id="password"
            type="password"
            placeholder="IMAP-Passwort"
            value={password}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setPassword(e.target.value)
            }
          />
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="tls"
            checked={tls}
            onCheckedChange={(checked: boolean | "indeterminate") =>
              setTls(checked === true)
            }
          />
          <Label htmlFor="tls" className="text-sm font-normal">
            TLS/SSL verwenden
          </Label>
        </div>

        {testState === "error" && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {errorMessage}
          </div>
        )}

        {testState === "success" && (
          <div className="flex items-center gap-2 rounded-md border border-green-500/50 bg-green-500/10 p-3 text-sm text-green-700">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Verbindung erfolgreich — Gesendet-Ordner: {folder}
          </div>
        )}

        <div className="flex gap-2">
          <Button
            onClick={handleTestConnection}
            disabled={!isFormValid || testState === "testing"}
          >
            {testState === "testing" && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Verbindung testen
          </Button>

          {testState === "success" && (
            <Button onClick={handleContinue} variant="default">
              Weiter
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
