// Flat ESLint config (PLAN §15.6). Runs `eslint` directly (Next 15.5 deprecates
// `next lint`). Composes eslint-config-next's flat presets + @typescript-eslint's
// recommended rules. Prettier owns formatting, so eslint-config-prettier turns
// off every stylistic rule that would fight it.
import { FlatCompat } from "@eslint/eslintrc";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

const config = [
  {
    ignores: [".next/**", "node_modules/**", "out/**", "build/**", "next-env.d.ts"],
  },
  // Next core-web-vitals + TypeScript presets (still distributed as eslintrc-style).
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  // TypeScript recommended (non-type-checked: keeps `npm run lint` fast and DB-free).
  ...tseslint.configs.recommended,
  {
    rules: {
      // Allow intentionally-unused args prefixed with _ (e.g. parked handlers).
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  // Must be LAST: disable formatting rules so Prettier is the single source of truth.
  prettier,
];

export default config;
