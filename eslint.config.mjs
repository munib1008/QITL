import { FlatCompat } from "@eslint/eslintrc";
const compat = new FlatCompat({ baseDirectory: import.meta.dirname });
const config = [
  { ignores: ["design/reference/**", "design/prototype/**", ".next/**", "node_modules/**", "playwright-report/**", "src/styles/tokens.generated.ts", "next-env.d.ts", "public/sw.js"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
];
export default config;
