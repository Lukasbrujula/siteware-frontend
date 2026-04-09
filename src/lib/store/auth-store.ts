import { create } from "zustand";
import { SESSION_TOKEN_KEY } from "@/lib/constants";

type AuthState = {
  readonly tenantId: string | null;
  readonly imapUser: string | null;
  readonly isVerified: boolean;
  readonly isLoading: boolean;
  readonly error: string | null;
};

type AuthActions = {
  readonly setVerified: (tenantId: string, imapUser: string) => void;
  readonly setLoading: (loading: boolean) => void;
  readonly setError: (error: string) => void;
  readonly reset: () => void;
};

type AuthStore = AuthState & AuthActions;

export const useAuthStore = create<AuthStore>((set) => ({
  tenantId: null,
  imapUser: null,
  isVerified: false,
  isLoading: true,
  error: null,

  setVerified: (tenantId, imapUser) =>
    set({
      tenantId,
      imapUser,
      isVerified: true,
      isLoading: false,
      error: null,
    }),

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error, isLoading: false, isVerified: false }),

  reset: () => {
    sessionStorage.removeItem(SESSION_TOKEN_KEY);
    set({
      tenantId: null,
      imapUser: null,
      isVerified: false,
      isLoading: false,
      error: null,
    });
  },
}));

export function getTenantId(): string {
  return useAuthStore.getState().tenantId ?? "default";
}
