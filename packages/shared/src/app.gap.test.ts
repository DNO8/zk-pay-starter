import { describe, expect, test } from "bun:test";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "../../..");

describe("GAP-6 / GAP-7 / GAP-8", () => {
  test("app: deposit→withdraw", () => {
    const app = join(ROOT, "apps/web/src/pages/AppPage.tsx");
    const src = readFileSync(app, "utf8");
    expect(src.includes("TODO(GAP-6)"), "blank /app shell must be replaced").toBe(false);
    expect(src.includes("deposit"), "UI must offer deposit").toBe(true);
    expect(src.includes("withdraw"), "UI must offer withdraw").toBe(true);
  });

  test("api: openrouter step logged", () => {
    const src = readFileSync(join(ROOT, "apps/api/src/index.ts"), "utf8");
    expect(src.includes("TODO(GAP-7)")).toBe(false);
    expect(src.includes("openrouter") || src.includes("OpenRouter")).toBe(true);
    expect(src.includes("payment") || src.includes("withdraw") || src.includes("memo")).toBe(true);
  });

  test("unlinkability checklist filled", () => {
    const p = join(ROOT, "docs/lessons/UNLINKABILITY.md");
    expect(existsSync(p)).toBe(true);
    const src = readFileSync(p, "utf8");
    expect(src.includes("TODO(GAP-8)")).toBe(false);
    expect(src.includes("[x]") || src.includes("[X]")).toBe(true);
  });
});
