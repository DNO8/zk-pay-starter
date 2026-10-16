#!/usr/bin/env bun
import { $ } from "bun";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..");
console.log("Starting API :43122 and web :43121");
await Promise.all([
  $`bun --cwd apps/api run dev`.cwd(ROOT),
  $`bun --cwd apps/web run dev`.cwd(ROOT),
]);
