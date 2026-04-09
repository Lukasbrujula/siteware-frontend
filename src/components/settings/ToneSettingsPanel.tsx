import { useState, useEffect, useCallback } from "react";
import { Loader2, Save, Check, AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiHeaders } from "@/lib/api/headers";
import { getTenantId } from "@/lib/store/auth-store";
import type {
  ToneProfile,
  Anrede,
  Sprachstil,
  EmailLength,
} from "@/types/tone-profile";
import { SPRACHSTIL_OPTIONS, EMAIL_LENGTH_OPTIONS } from "@/types/tone-profile";

type LoadState = "loading" | "loaded" | "error";
type SaveState = "idle" | "saving" | "saved" | "error";

type EditableState = {
  readonly anrede: Anrede;
  readonly sprachstil: readonly Sprachstil[];
  readonly emailLength: EmailLength;
  readonly signature: string;
  readonly typicalPhrases: readonly string[];
  readonly industryJargon: readonly string[];
  readonly greeting: string;
  readonly closing: string;
};

function profileToEditable(
  profile: ToneProfile,
  signature: string,
): EditableState {
  return {
    anrede:
      profile.anrede ?? (profile.formality_level === "informal" ? "du" : "sie"),
    sprachstil: profile.sprachstil ?? [],
    emailLength: profile.email_length ?? "mittlerer-umfang",
    signature,
    typicalPhrases: [...profile.typical_phrases],
    industryJargon: [...profile.industry_jargon],
    greeting: profile.greeting_style,
    closing: profile.closing_style,
  };
}

function TagInput({
  label,
  tags,
  onChange,
  placeholder,
}: {
  readonly label: string;
  readonly tags: readonly string[];
  readonly onChange: (tags: readonly string[]) => void;
  readonly placeholder: string;
}) {
  const [input, setInput] = useState("");

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if ((e.key === "Enter" || e.key === ",") && input.trim() !== "") {
      e.preventDefault();
      const trimmed = input.trim();
      if (!tags.includes(trimmed)) {
        onChange([...tags, trimmed]);
      }
      setInput("");
    }
    if (e.key === "Backspace" && input === "" && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  }

  function handleRemove(index: number) {
    onChange([...tags.slice(0, index), ...tags.slice(index + 1)]);
  }

  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-foreground">
        {label}
      </label>
      <div className="flex min-h-[42px] flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2">
        {tags.map((tag, i) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground"
          >
            {tag}
            <button
              type="button"
              className="cursor-pointer text-muted-foreground hover:text-foreground"
              onClick={() => handleRemove(i)}
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          type="text"
          className="min-w-[120px] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          placeholder={tags.length === 0 ? placeholder : ""}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
        />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Enter drücken zum Hinzufügen
      </p>
    </div>
  );
}

export function ToneSettingsPanel() {
  const tenantId = getTenantId();
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState("");
  const [state, setState] = useState<EditableState>({
    anrede: "sie",
    sprachstil: [],
    emailLength: "mittlerer-umfang",
    signature: "",
    typicalPhrases: [],
    industryJargon: [],
    greeting: "",
    closing: "",
  });
  const [originalProfile, setOriginalProfile] = useState<ToneProfile | null>(
    null,
  );

  useEffect(() => {
    if (tenantId === "default") {
      setLoadState("error");
      return;
    }

    async function load() {
      try {
        const [profileRes, tenantRes] = await Promise.all([
          fetch(`/api/tone-profile/${encodeURIComponent(tenantId)}`, {
            headers: apiHeaders(),
          }),
          fetch(
            `/api/onboarding/tenant?tenant_id=${encodeURIComponent(tenantId)}`,
            { headers: apiHeaders() },
          ),
        ]);

        if (!profileRes.ok) {
          setLoadState("error");
          return;
        }

        const profileData = (await profileRes.json()) as {
          success: boolean;
          data: ToneProfile;
        };
        const tenantData = tenantRes.ok
          ? ((await tenantRes.json()) as {
              success: boolean;
              data: { email_signature?: string };
            })
          : null;

        const profile = profileData.data;
        const signature = tenantData?.data?.email_signature ?? "";

        setOriginalProfile(profile);
        setState(profileToEditable(profile, signature));
        setLoadState("loaded");
      } catch {
        setLoadState("error");
      }
    }

    load();
  }, [tenantId]);

  const handleSave = useCallback(async () => {
    if (!originalProfile) return;

    setSaveState("saving");
    setSaveError("");

    const now = new Date().toISOString();
    const updatedProfile: ToneProfile = {
      ...originalProfile,
      anrede: state.anrede,
      sprachstil: [...state.sprachstil],
      email_length: state.emailLength,
      formality_level: state.anrede === "du" ? "informal" : "formal",
      greeting_style: state.greeting,
      closing_style: state.closing,
      typical_phrases: [...state.typicalPhrases],
      industry_jargon: [...state.industryJargon],
      updated_at: now,
    };

    try {
      const [profileRes, sigRes] = await Promise.all([
        fetch(`/api/tone-profile/${encodeURIComponent(tenantId)}`, {
          method: "PUT",
          headers: apiHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify(updatedProfile),
        }),
        fetch("/api/onboarding/update-signature", {
          method: "POST",
          headers: apiHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({
            tenant_id: tenantId,
            email_signature: state.signature,
          }),
        }),
      ]);

      if (!profileRes.ok || !sigRes.ok) {
        const errorData = !profileRes.ok
          ? ((await profileRes.json()) as { error?: string })
          : ((await sigRes.json()) as { error?: string });
        setSaveState("error");
        setSaveError(errorData.error ?? "Speichern fehlgeschlagen");
        return;
      }

      setOriginalProfile(updatedProfile);
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2000);
    } catch {
      setSaveState("error");
      setSaveError("Netzwerkfehler — Server nicht erreichbar");
    }
  }, [originalProfile, state, tenantId]);

  function toggleSprachstil(value: Sprachstil) {
    setState((prev) => {
      const current = prev.sprachstil;
      const exists = current.includes(value);
      if (exists) {
        return { ...prev, sprachstil: current.filter((s) => s !== value) };
      }
      if (current.length >= 3) return prev;
      return { ...prev, sprachstil: [...current, value] };
    });
  }

  if (loadState === "loading") {
    return (
      <div className="flex items-center justify-center rounded-lg border bg-background py-16">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (loadState === "error") {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">
        Tonprofil konnte nicht geladen werden. Bitte versuchen Sie es erneut.
      </div>
    );
  }

  return (
    <div className="space-y-6 rounded-lg border bg-background p-6">
      {/* Anrede */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">
          Anrede
        </label>
        <div className="flex gap-2">
          {(["sie", "du"] as const).map((value) => (
            <button
              key={value}
              type="button"
              className={`cursor-pointer rounded-md border px-4 py-2 text-sm font-medium transition-colors ${
                state.anrede === value
                  ? "border-foreground bg-foreground text-background"
                  : "border-input bg-background text-foreground hover:bg-muted"
              }`}
              onClick={() => setState((prev) => ({ ...prev, anrede: value }))}
            >
              {value === "sie" ? "Sie" : "Du"}
            </button>
          ))}
        </div>
      </div>

      {/* Sprachstil */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">
          Sprachstil{" "}
          <span className="font-normal text-muted-foreground">
            (max. 3 auswählen)
          </span>
        </label>
        <div className="flex flex-wrap gap-2">
          {SPRACHSTIL_OPTIONS.map((opt) => {
            const selected = state.sprachstil.includes(opt.value);
            const disabled = !selected && state.sprachstil.length >= 3;
            return (
              <button
                key={opt.value}
                type="button"
                disabled={disabled}
                className={`cursor-pointer rounded-full border px-3 py-1 text-sm transition-colors ${
                  selected
                    ? "border-foreground bg-foreground text-background"
                    : disabled
                      ? "cursor-not-allowed border-input bg-muted/50 text-muted-foreground"
                      : "border-input bg-background text-foreground hover:bg-muted"
                }`}
                onClick={() => toggleSprachstil(opt.value)}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Email Length */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">
          E-Mail-Länge
        </label>
        <select
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
          value={state.emailLength}
          onChange={(e) =>
            setState((prev) => ({
              ...prev,
              emailLength: e.target.value as EmailLength,
            }))
          }
        >
          {EMAIL_LENGTH_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Greeting & Closing */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            Begrüßung
          </label>
          <input
            type="text"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="z.B. Sehr geehrte Damen und Herren"
            value={state.greeting}
            onChange={(e) =>
              setState((prev) => ({ ...prev, greeting: e.target.value }))
            }
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            Abschluss
          </label>
          <input
            type="text"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="z.B. Mit freundlichen Grüßen"
            value={state.closing}
            onChange={(e) =>
              setState((prev) => ({ ...prev, closing: e.target.value }))
            }
          />
        </div>
      </div>

      {/* Signature */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">
          E-Mail-Signatur
        </label>
        <Textarea
          className="min-h-[100px] resize-y bg-background text-sm"
          placeholder="Ihre E-Mail-Signatur..."
          value={state.signature}
          onChange={(e) =>
            setState((prev) => ({ ...prev, signature: e.target.value }))
          }
        />
      </div>

      {/* Keywords / Phrases */}
      <TagInput
        label="Typische Ausdrücke"
        tags={state.typicalPhrases}
        onChange={(tags) =>
          setState((prev) => ({ ...prev, typicalPhrases: tags }))
        }
        placeholder="z.B. Gerne helfen wir Ihnen weiter"
      />

      <TagInput
        label="Fachbegriffe"
        tags={state.industryJargon}
        onChange={(tags) =>
          setState((prev) => ({ ...prev, industryJargon: tags }))
        }
        placeholder="z.B. SLA, Onboarding"
      />

      {/* Save */}
      {saveState === "error" && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="size-4 shrink-0" />
          {saveError}
        </div>
      )}

      <Button
        className="w-full cursor-pointer"
        disabled={saveState === "saving"}
        onClick={handleSave}
      >
        {saveState === "saving" && <Loader2 className="size-4 animate-spin" />}
        {saveState === "saved" && <Check className="size-4" />}
        {saveState !== "saving" && saveState !== "saved" && (
          <Save className="size-4" />
        )}
        {saveState === "saved" ? "Gespeichert" : "Änderungen speichern"}
      </Button>
    </div>
  );
}
