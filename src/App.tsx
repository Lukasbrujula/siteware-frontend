import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { CategoryTabs } from "@/components/layout/CategoryTabs";
import { useDataStream } from "@/hooks/useDataStream";
import { useAuthStore } from "@/lib/store/auth-store";
import { Loader2 } from "lucide-react";

export default function App() {
  const navigate = useNavigate();
  const checkAuthCalled = useRef(false);
  const isVerified = useAuthStore((s) => s.isVerified);
  const isLoading = useAuthStore((s) => s.isLoading);

  useEffect(() => {
    if (checkAuthCalled.current) return;
    checkAuthCalled.current = true;
    void useAuthStore.getState().checkAuth();
  }, []);

  useEffect(() => {
    if (!isLoading && !isVerified) {
      navigate("/login", { replace: true });
    }
  }, [isLoading, isVerified, navigate]);

  const { isSyncing } = useDataStream({ enabled: isVerified });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8f9fa]">
        <Loader2 className="size-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!isVerified) {
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#f8f9fa]">
      <DashboardHeader isSyncing={isSyncing} />
      <main className="flex flex-1 flex-col">
        <CategoryTabs />
      </main>
      <Toaster />
    </div>
  );
}
