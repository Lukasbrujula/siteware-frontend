import { create } from "zustand";

type User = {
  readonly id?: string;
  readonly email: string;
  readonly name?: string;
  readonly role?: string;
};

type AuthState = {
  readonly user: User | null;
  readonly isVerified: boolean;
  readonly isLoading: boolean;
  readonly error: string | null;
};

type AuthActions = {
  readonly checkAuth: () => Promise<void>;
  readonly logout: () => Promise<void>;
  readonly setUser: (user: User) => void;
  readonly setLoading: (loading: boolean) => void;
  readonly setError: (error: string) => void;
};

type AuthStore = AuthState & AuthActions;

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  isVerified: false,
  isLoading: true,
  error: null,

  checkAuth: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch("/api/auth/me");
      if (response.ok) {
        const json = (await response.json()) as Record<string, unknown>;
        if (typeof json.email !== "string") {
          set({
            user: null,
            isVerified: false,
            isLoading: false,
            error: "invalid-response",
          });
          return;
        }
        const data: User = {
          id: typeof json.id === "string" ? json.id : undefined,
          email: json.email,
          name: typeof json.name === "string" ? json.name : undefined,
          role: typeof json.role === "string" ? json.role : undefined,
        };
        set({ user: data, isVerified: true, isLoading: false, error: null });
      } else {
        set({ user: null, isVerified: false, isLoading: false, error: null });
      }
    } catch {
      set({
        user: null,
        isVerified: false,
        isLoading: false,
        error: "network-error",
      });
    }
  },

  logout: async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Continue with client-side cleanup regardless
    }
    set({ user: null, isVerified: false, isLoading: false, error: null });
  },

  setUser: (user) =>
    set({ user, isVerified: true, isLoading: false, error: null }),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error, isLoading: false, isVerified: false }),
}));
