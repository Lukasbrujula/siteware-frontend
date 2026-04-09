import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  unlinkSync,
  existsSync,
} from "node:fs";
import { resolve } from "node:path";
import type { ToneProfile } from "../../types/tone-profile.js";

const TENANT_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

let basePath = resolve(process.cwd(), "data", "tone-profiles");

export function __setBasePathForTest(path: string): void {
  basePath = path;
}

function ensureDir(): void {
  mkdirSync(basePath, { recursive: true });
}

function profilePath(tenantId: string): string {
  if (!TENANT_ID_PATTERN.test(tenantId)) {
    throw new Error(
      "Invalid tenant_id: must contain only alphanumeric characters, hyphens, and underscores",
    );
  }
  return resolve(basePath, `${tenantId}.json`);
}

export function saveToneProfile(profile: ToneProfile): void {
  ensureDir();
  const filePath = profilePath(profile.tenant_id);
  writeFileSync(filePath, JSON.stringify(profile, null, 2), "utf-8");
}

export function loadToneProfile(tenantId: string): ToneProfile | null {
  const filePath = profilePath(tenantId);

  if (!existsSync(filePath)) {
    return null;
  }

  const raw = readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as ToneProfile;
}

export function listToneProfiles(): readonly string[] {
  ensureDir();

  const files = readdirSync(basePath);
  return files
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""));
}

export function deleteToneProfile(tenantId: string): boolean {
  const filePath = profilePath(tenantId);

  if (!existsSync(filePath)) {
    return false;
  }

  unlinkSync(filePath);
  return true;
}
