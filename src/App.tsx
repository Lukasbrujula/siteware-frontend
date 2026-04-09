import { useEffect, useRef } from "react";
import { Toaster } from "@/components/ui/sonner";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { CategoryTabs } from "@/components/layout/CategoryTabs";
import { DemoToolbar } from "@/components/demo/DemoToolbar";
import { seedStore } from "@/lib/seed-store";
import { useDataStream } from "@/hooks/useDataStream";
import { useAuthStore } from "@/lib/store/auth-store";
import { SESSION_TOKEN_KEY } from "@/lib/constants";
import { Loader2 } from "lucide-react";

const USE_MOCK_DATA = import.meta.env.VITE_USE_MOCK_DATA !== "false";
const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === "true";

export default function App() {
  const seeded = useRef(false);
  const isVerified = useAuthStore((s) => s.isVerified);
  const isLoading = useAuthStore((s) => s.isLoading);
  const authError = useAuthStore((s) => s.error);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenFromUrl = params.get("t");
    const token = tokenFromUrl ?? sessionStorage.getItem(SESSION_TOKEN_KEY);

    if (tokenFromUrl) {
      window.history.replaceState({}, "", window.location.pathname);
    }

    if (!token) {
      useAuthStore.getState().setError("no-token");
      return;
    }

    useAuthStore.getState().setLoading(true);

    fetch(`/api/onboarding/verify?t=${encodeURIComponent(token)}`)
      .then((res) => {
        if (!res.ok) {
          sessionStorage.removeItem(SESSION_TOKEN_KEY);
          useAuthStore.getState().setError("invalid-token");
          return;
        }
        return res.json();
      })
      .then((data: { tenant_id: string; imap_user: string } | undefined) => {
        if (data) {
          sessionStorage.setItem(SESSION_TOKEN_KEY, token);
          useAuthStore.getState().setVerified(data.tenant_id, data.imap_user);
        }
      })
      .catch(() => {
        useAuthStore.getState().setError("network-error");
      });
  }, []);

  useEffect(() => {
    if (USE_MOCK_DATA && !seeded.current) {
      seeded.current = true;
      seedStore();
    }
  }, []);

  const { isSyncing } = useDataStream({
    enabled: isVerified && (!USE_MOCK_DATA || DEMO_MODE),
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8f9fa]">
        <Loader2 className="size-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!isVerified || authError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8f9fa]">
        <div className="max-w-md rounded-2xl bg-white p-8 text-center shadow-sm">
          <p className="text-lg font-medium text-gray-900">Kein Zugang</p>
          <p className="mt-2 text-sm text-gray-500">
            Bitte verwenden Sie Ihren persönlichen Dashboard-Link.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#f8f9fa]">
      <DashboardHeader isSyncing={isSyncing}>
        {DEMO_MODE ? <DemoToolbar /> : null}
      </DashboardHeader>
      <main className="flex flex-1 flex-col">
        <CategoryTabs />
      </main>
      <Toaster />
    </div>
  );
}
