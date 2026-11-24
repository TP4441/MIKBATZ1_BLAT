#!/usr/bin/env node
/**
 * One-time migration script:
 * Pulls existing community notes & problem reports from textdb.dev
 * and imports them into the Cloudflare Worker + D1 backend via POST /api/admin/import-legacy.
 *
 * Usage:
 *   node worker/migrate_textdb.mjs --api https://<your-worker>.workers.dev --password <ADMIN_PASSWORD>
 *   (or set WORKER_URL and ADMIN_PASSWORD environment variables)
 */

const LEGACY_NOTES_URL =
  "https://textdb.dev/api/data/mikbatz1_blat_notes_1b014a75-b087-45fc-9cea-c4749561ae4e";
const LEGACY_PROBLEMS_URL =
  "https://textdb.dev/api/data/mikbatz1_blat_problems_a9f3e2c1-7d4b-4e8a-9c2f-31d5e8a4b210";

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    if (k === "--api" && argv[i + 1]) args.api = argv[++i];
    else if (k === "--password" && argv[i + 1]) args.password = argv[++i];
  }
  return args;
}

async function fetchJsonOrEmpty(url, key) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: HTTP ${res.status}`);
  }
  const text = await res.text();
  if (!text || !text.trim()) return {};
  const parsed = JSON.parse(text);
  return parsed && typeof parsed[key] === "object" ? parsed[key] : {};
}

async function main() {
  const args = parseArgs(process.argv);
  const apiBase = (args.api || process.env.WORKER_URL || "").replace(/\/+$/, "");
  const password = args.password || process.env.ADMIN_PASSWORD || "";

  if (!apiBase || !password) {
    console.error(
      "Usage: node worker/migrate_textdb.mjs --api https://<worker-url> --password <ADMIN_PASSWORD>"
    );
    process.exit(1);
  }

  console.log("Fetching legacy data from textdb.dev...");
  const [notes, problems] = await Promise.all([
    fetchJsonOrEmpty(LEGACY_NOTES_URL, "notes"),
    fetchJsonOrEmpty(LEGACY_PROBLEMS_URL, "problems"),
  ]);

  console.log(
    `Fetched ${Object.keys(notes).length} noted questions and ${Object.keys(problems).length} problem-reported questions.`
  );

  console.log(`Logging in to ${apiBase}/api/admin/login...`);
  const loginRes = await fetch(`${apiBase}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  const loginData = await loginRes.json();
  if (!loginRes.ok || !loginData.token) {
    throw new Error(`Admin login failed (${loginRes.status}): ${loginData.error || "Unknown error"}`);
  }

  console.log("Importing legacy data into D1...");
  const importRes = await fetch(`${apiBase}/api/admin/import-legacy`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${loginData.token}`,
    },
    body: JSON.stringify({ notes, problems }),
  });
  const importData = await importRes.json();
  if (!importRes.ok || !importData.ok) {
    throw new Error(`Import failed (${importRes.status}): ${importData.error || "Unknown error"}`);
  }

  console.log("Migration complete:", importData);
}

main().catch((err) => {
  console.error("Migration error:", err.message);
  process.exit(1);
});
