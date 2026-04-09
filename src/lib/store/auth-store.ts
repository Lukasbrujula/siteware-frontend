import { create } from "zustand";

type User = {
  readonly email: string;
  readonly name?: string;
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
        const data = (await response.json()) as User;
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
