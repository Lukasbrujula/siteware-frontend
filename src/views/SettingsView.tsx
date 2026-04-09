import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Loader2, Trash2, Plus, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
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

type Tenant = {
  readonly tenant_id: string;
  readonly imap_user: string | null;
  readonly smtp_user: string | null;
  readonly active: number;
  readonly created_at: string;
  readonly updated_at: string;
};

type LoadState = "loading" | "loaded" | "error";

export function SettingsView() {
  const isVerified = useAuthStore((s) => s.isVerified);
  const [tenants, setTenants] = useState<readonly Tenant[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [togglingIds, setTogglingIds] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const [deleteTarget, setDeleteTarget] = useState<Tenant | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchTenants = useCallback(async () => {
    try {
      const response = await fetch("/api/onboarding/tenants");

      if (!response.ok) {
        setLoadState("error");
        return;
      }

      const data = (await response.json()) as {
        success: boolean;
        data: Tenant[];
      };
      if (data.success) {
        setTenants(data.data);
        setLoadState("loaded");
      } else {
        setLoadState("error");
      }
    } catch {
      setLoadState("error");
    }
  }, []);

  useEffect(() => {
    fetchTenants();
  }, [fetchTenants]);

  async function handleToggle(tenantId: string, currentActive: number) {
    setTogglingIds((prev) => {
      const next = new Set(prev);
      next.add(tenantId);
      return next;
    });

    try {
      const response = await fetch("/api/onboarding/tenant-toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: tenantId,
          active: currentActive === 0,
        }),
      });

      if (response.ok) {
        setTenants((prev) =>
          prev.map((t) =>
            t.tenant_id === tenantId
              ? { ...t, active: currentActive === 0 ? 1 : 0 }
              : t,
          ),
        );
      }
    } catch {
      // Network error — state unchanged
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev);
        next.delete(tenantId);
        return next;
      });
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);

    try {
      const response = await fetch("/api/onboarding/tenant-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenant_id: deleteTarget.tenant_id }),
      });

      if (response.ok) {
        setTenants((prev) =>
          prev.filter((t) => t.tenant_id !== deleteTarget.tenant_id),
        );
      }
    } catch {
      // Network error — state unchanged
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
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
            <Link to="/onboarding">
              <Button size="sm" className="cursor-pointer gap-1.5">
                <Plus className="size-4" />
                Neues Konto
              </Button>
            </Link>
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

          {loadState === "loaded" && tenants.length === 0 && (
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
              <Link to="/onboarding">
                <Button className="cursor-pointer gap-1.5">
                  <Plus className="size-4" />
                  E-Mail-Konto verknüpfen
                </Button>
              </Link>
            </div>
          )}

          {loadState === "loaded" && tenants.length > 0 && (
            <div className="divide-y rounded-lg border bg-background">
              {tenants.map((tenant) => (
                <div
                  key={tenant.tenant_id}
                  className="flex items-center justify-between px-5 py-4"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`size-2.5 shrink-0 rounded-full ${
                        tenant.active === 1 ? "bg-green-500" : "bg-gray-300"
                      }`}
                      title={tenant.active === 1 ? "Aktiv" : "Inaktiv"}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {tenant.imap_user ?? tenant.tenant_id}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Erstellt am{" "}
                        {new Date(tenant.created_at).toLocaleDateString(
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
                      aria-checked={tenant.active === 1}
                      aria-label={
                        tenant.active === 1 ? "Deaktivieren" : "Aktivieren"
                      }
                      disabled={togglingIds.has(tenant.tenant_id)}
                      onClick={() =>
                        handleToggle(tenant.tenant_id, tenant.active)
                      }
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
                        tenant.active === 1 ? "bg-green-500" : "bg-gray-200"
                      }`}
                    >
                      <span
                        className={`pointer-events-none block size-5 rounded-full bg-white shadow-sm ring-0 transition-transform ${
                          tenant.active === 1
                            ? "translate-x-5"
                            : "translate-x-0"
                        }`}
                      />
                    </button>

                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="cursor-pointer text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleteTarget(tenant)}
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

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
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
              {deleteTarget.imap_user ?? deleteTarget.tenant_id}
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              className="cursor-pointer"
              disabled={deleting}
              onClick={() => setDeleteTarget(null)}
            >
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              className="cursor-pointer"
              disabled={deleting}
              onClick={handleDelete}
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
