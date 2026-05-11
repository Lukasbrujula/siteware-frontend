import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Loader2, Trash2, Plus, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddInboxModal } from "@/components/settings/AddInboxModal";
import { ToneSettingsPanel } from "@/components/settings/ToneSettingsPanel";
import { useAuthStore } from "@/lib/store/auth-store";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Inbox = {
  readonly id: string;
  readonly tenant_id: string;
  readonly email: string;
  readonly label: string;
  readonly imap_host: string;
  readonly imap_port: number;
  readonly imap_user: string;
  readonly smtp_host: string;
  readonly smtp_port: number;
  readonly smtp_user: string;
  readonly is_active: number;
  readonly last_polled_at: string | null;
  readonly last_poll_error: string | null;
  readonly created_at: string;
};

type LoadState = "loading" | "loaded" | "error";

export function SettingsView() {
  const isVerified = useAuthStore((s) => s.isVerified);
  const [inboxes, setInboxes] = useState<readonly Inbox[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [togglingIds, setTogglingIds] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const [deleteTarget, setDeleteTarget] = useState<Inbox | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [addInboxOpen, setAddInboxOpen] = useState(false);

  const fetchInboxes = useCallback(async () => {
    try {
      const response = await fetch("/api/inboxes");

      if (!response.ok) {
        setLoadState("error");
        return;
      }

      const data = (await response.json()) as { inboxes: Inbox[] };
      if (Array.isArray(data.inboxes)) {
        setInboxes(data.inboxes);
        setLoadState("loaded");
      } else {
        setLoadState("error");
      }
    } catch {
      setLoadState("error");
    }
  }, []);

  useEffect(() => {
    fetchInboxes();
  }, [fetchInboxes]);

  async function handleToggle(inboxId: string, currentIsActive: number) {
    setTogglingIds((prev) => {
      const next = new Set(prev);
      next.add(inboxId);
      return next;
    });

    try {
      const response = await fetch("/api/onboarding/tenant-toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: inboxId,
          active: currentIsActive === 0,
        }),
      });

      if (response.ok) {
        setInboxes((prev) =>
          prev.map((inbox) =>
            inbox.id === inboxId
              ? { ...inbox, is_active: currentIsActive === 0 ? 1 : 0 }
              : inbox,
          ),
        );
      }
    } catch {
      // Network error — state unchanged
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev);
        next.delete(inboxId);
        return next;
      });
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError("");

    try {
      const response = await fetch(`/api/inboxes/${deleteTarget.id}`, {
        method: "DELETE",
      });

      if (response.status === 409) {
        const data = (await response.json()) as { code?: string };
        if (data.code === "LAST_INBOX") {
          setDeleteError(
            "Dies ist Ihr letztes Postfach und kann nicht gelöscht werden.",
          );
        }
        return;
      }

      if (response.status === 204 || response.ok) {
        setInboxes((prev) => prev.filter((i) => i.id !== deleteTarget.id));
        setDeleteTarget(null);
      }
    } catch {
      // Network error — state unchanged
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#f8f9fa]">
      <header className="border-b bg-background px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <Link
            to="/"
            className="cursor-pointer rounded-md p-1 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <h1 className="text-lg font-semibold">Einstellungen</h1>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center px-4 py-8">
        <div className="w-full max-w-3xl space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                Verbundene E-Mail-Konten
              </h2>
              <p className="text-sm text-muted-foreground">
                Verwalten Sie Ihre E-Mail-Konten und deren Status.
              </p>
            </div>
            <Button
              size="sm"
              className="cursor-pointer gap-1.5"
              onClick={() => setAddInboxOpen(true)}
            >
              <Plus className="size-4" />
              Neues Konto
            </Button>
          </div>

          {loadState === "loading" && (
            <div className="flex items-center justify-center rounded-lg border bg-background py-16">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {loadState === "error" && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">
              Konten konnten nicht geladen werden. Bitte versuchen Sie es
              erneut.
            </div>
          )}

          {loadState === "loaded" && inboxes.length === 0 && (
            <div className="flex flex-col items-center gap-4 rounded-lg border bg-background py-16">
              <Mail className="size-10 text-muted-foreground" />
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">
                  Noch keine E-Mail-Konten verbunden.
                </p>
                <p className="text-sm text-muted-foreground">
                  Verknüpfen Sie Ihr erstes E-Mail-Konto, um loszulegen.
                </p>
              </div>
              <Button
                className="cursor-pointer gap-1.5"
                onClick={() => setAddInboxOpen(true)}
              >
                <Plus className="size-4" />
                E-Mail-Konto verknüpfen
              </Button>
            </div>
          )}

          {loadState === "loaded" && inboxes.length > 0 && (
            <div className="divide-y rounded-lg border bg-background">
              {inboxes.map((inbox) => (
                <div
                  key={inbox.id}
                  className="flex items-center justify-between px-5 py-4"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`size-2.5 shrink-0 rounded-full ${
                        inbox.is_active === 1 ? "bg-green-500" : "bg-gray-300"
                      }`}
                      title={inbox.is_active === 1 ? "Aktiv" : "Inaktiv"}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {inbox.label || inbox.email}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {inbox.email} &middot; Erstellt am{" "}
                        {new Date(inbox.created_at).toLocaleDateString(
                          "de-DE",
                          {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                          },
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={inbox.is_active === 1}
                      aria-label={
                        inbox.is_active === 1 ? "Deaktivieren" : "Aktivieren"
                      }
                      disabled={togglingIds.has(inbox.id)}
                      onClick={() => handleToggle(inbox.id, inbox.is_active)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
                        inbox.is_active === 1 ? "bg-green-500" : "bg-gray-200"
                      }`}
                    >
                      <span
                        className={`pointer-events-none block size-5 rounded-full bg-white shadow-sm ring-0 transition-transform ${
                          inbox.is_active === 1
                            ? "translate-x-5"
                            : "translate-x-0"
                        }`}
                      />
                    </button>

                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="cursor-pointer text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleteTarget(inbox)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {isVerified && (
            <div className="pt-4 border-t">
              <div className="mb-4">
                <h2 className="text-base font-semibold text-foreground">
                  Tonprofil & Signatur
                </h2>
                <p className="text-sm text-muted-foreground">
                  Passen Sie Ihren Schreibstil und Ihre E-Mail-Signatur an.
                </p>
              </div>
              <ToneSettingsPanel />
            </div>
          )}
        </div>
      </main>

      <AddInboxModal
        open={addInboxOpen}
        onOpenChange={setAddInboxOpen}
        onSuccess={fetchInboxes}
      />

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
            setDeleteError("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Konto entfernen</DialogTitle>
            <DialogDescription>
              Möchten Sie dieses Konto wirklich entfernen? Alle E-Mails und das
              Tonprofil werden unwiderruflich gelöscht.
            </DialogDescription>
          </DialogHeader>
          {deleteTarget && (
            <p className="text-sm font-medium text-foreground">
              {deleteTarget.email}
            </p>
          )}
          {deleteError && (
            <p className="text-sm text-destructive">{deleteError}</p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              className="cursor-pointer"
              disabled={deleting}
              onClick={() => {
                setDeleteTarget(null);
                setDeleteError("");
              }}
            >
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              className="cursor-pointer"
              disabled={deleting}
              onClick={() => void handleDelete()}
            >
              {deleting && <Loader2 className="size-4 animate-spin" />}
              Endgültig löschen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
