// Runs the visual regression spec (tests/e2e/visual.spec.ts). QITL_VISUAL is set here so the script works the same in cmd,
// PowerShell and bash. Extra arguments go to Playwright: `pnpm test:visual --update-snapshots`, `pnpm test:visual --project=mobile`.
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const cli = path.join(path.dirname(require.resolve("@playwright/test/package.json")), "cli.js");
const r = spawnSync(process.execPath, [cli, "test", "tests/e2e/visual.spec.ts", ...process.argv.slice(2)], { stdio: "inherit", env: { ...process.env, QITL_VISUAL: "1" } });
process.exit(r.status ?? 1);
