import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// Vitest config (PLAN §15.6). Tests are pure-function + schema only — no live DB,
// no jsdom — so they run anywhere (local + CI) with zero infra. `vite-tsconfig-paths`
// resolves the `@/*` alias from tsconfig.json so tests import app modules the same
// way the app does.
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    globals: false,
  },
});
