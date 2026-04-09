import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: "happy-dom",
    setupFiles: ["./src/__tests__/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    exclude: ["src/server/**/*.test.ts"],
    env: {
      VITE_N8N_WEBHOOK_BASE_URL: "http://localhost:9999",
    },
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/server/**",
        "src/__tests__/**",
        "src/**/*.test.{ts,tsx}",
        "src/main.tsx",
        "src/App.tsx",
        "src/vite-env.d.ts",
        "src/types/**",
        "src/lib/mock-data.ts",
        "src/lib/seed-store.ts",
        "src/components/ui/**",
        "src/components/layout/**",
        "src/hooks/**",
      ],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
});
