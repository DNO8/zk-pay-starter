#!/usr/bin/env bun
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..");

type Gap = {
  id: string;
  name: string;
  lesson: string;
  marker: string;
  test: string;
};

const GAPS: Gap[] = [
  {
    id: "GAP-1",
    name: "commitment / nullifierHash helpers",
    lesson: "docs/lessons/01.md",
    marker: "TODO(GAP-1)",
    test: "GAP-1 commitment matches vectors",
  },
  {
    id: "GAP-2",
    name: "Noir withdraw circuit",
    lesson: "docs/lessons/02.md",
    marker: "TODO(GAP-2)",
    test: "noir: withdraw proves vector 1",
  },
  {
    id: "GAP-2c",
    name: "Circom withdraw circuit",
    lesson: "docs/lessons/02.md",
    marker: "TODO(GAP-2c)",
    test: "circom: withdraw proves vector 1",
  },
  {
    id: "GAP-3",
    name: "on-chain Merkle insert + root history",
    lesson: "docs/lessons/03.md",
    marker: "TODO(GAP-3)",
    test: "insert_matches_shared_root",
  },
  {
    id: "GAP-4",
    name: "nullifier set",
    lesson: "docs/lessons/05.md",
    marker: "TODO(GAP-4)",
    test: "rejects_reused_nullifier",
  },
  {
    id: "GAP-5",
    name: "public-input wiring",
    lesson: "docs/lessons/04.md",
    marker: "TODO(GAP-5)",
    test: "withdraw_verifies_vector_proof",
  },
  {
    id: "GAP-6",
    name: "real UI /app",
    lesson: "docs/lessons/06.md",
    marker: "TODO(GAP-6)",
    test: "app: deposit→withdraw",
  },
  {
    id: "GAP-7",
    name: "OpenRouter step in the payment flow",
    lesson: "docs/lessons/07.md",
    marker: "TODO(GAP-7)",
    test: "api: openrouter step logged",
  },
  {
    id: "GAP-8",
    name: "unlinkability checklist",
    lesson: "docs/lessons/UNLINKABILITY.md",
    marker: "TODO(GAP-8)",
    test: "unlinkability checklist filled",
  },
];

const scopes: Record<string, string[]> = {
  "GAP-1": ["packages/shared/src/note.ts"],
  "GAP-2": ["circuits/noir/withdraw/src/main.nr"],
  "GAP-2c": ["circuits/circom/withdraw/withdraw.circom"],
  "GAP-3": ["contracts/pool/src/lib.rs"],
  "GAP-4": ["contracts/pool/src/lib.rs"],
  "GAP-5": ["contracts/pool/src/lib.rs"],
  "GAP-6": ["apps/web/src/pages/AppPage.tsx"],
  "GAP-7": ["apps/api/src/index.ts", "apps/api/src/openrouter.ts"],
  "GAP-8": ["docs/lessons/UNLINKABILITY.md"],
};
async function markerPresent(g: Gap): Promise<boolean> {
  for (const path of scopes[g.id]) {
    const source = await readFile(join(ROOT, path), "utf8");
    if (source.includes(g.marker)) return true;
  }
  return false;
}

console.log("zk-pay-starter gap status\n");
console.log(
  "id".padEnd(8),
  "status".padEnd(8),
  "test".padEnd(36),
  "lesson",
);
console.log("-".repeat(88));

let red = 0;
for (const g of GAPS) {
  const todo = await markerPresent(g);
  const status = todo ? "RED" : "NO TODO";
  if (todo) red++;
  const color = todo ? "\x1b[31m" : "\x1b[32m";
  console.log(
    color + g.id.padEnd(8),
    status.padEnd(8) + "\x1b[0m",
    g.name.slice(0, 35).padEnd(36),
    g.lesson,
  );
}

console.log(
  `\n${red}/${GAPS.length} gaps still have ${"TODO(GAP-n)"} markers. Run the named tests with bun run test.`,
);
console.log("A gap is truly green only when its named test passes.\n");

console.log("NO TODO means source scaffold filled, not tests passed or privacy established. Check SOLUTION.md for evidence and pending items.");
