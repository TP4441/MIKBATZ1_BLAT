#!/usr/bin/env node
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mergeProgressPayloads, normalizeSyncCode } from "./src/index.js";

const require = createRequire(import.meta.url);
const QrSvg = require("../qr.js");

console.log("Running QR & mergeProgressPayloads unit tests...");

// 1. Sync code normalization
assert.equal(normalizeSyncCode("abcd-efgh-jklm"), "ABCDEFGHJKLM");
assert.equal(normalizeSyncCode("https://example.github.io/site/#sync=abcd-efgh-jklm"), "ABCDEFGHJKLM");
assert.equal(normalizeSyncCode("01OI-EFGH-JKLM"), null, "Ambiguous 0/1/O/I chars must be rejected");
assert.equal(normalizeSyncCode("ABCD-EFGH"), null, "Short codes must be rejected");

// 2. QR Code SVG structural & encoding checks across Versions 1..10
const payloads = [
  "https://a.co/#sync=ABCD-EFGH-JKLM",
  "https://tal-studiz.github.io/mikbatz1/#sync=2345-ABCD-WXYZ",
  "https://example.org/very/long/path/with/query?foo=bar#sync=2345-6789-ABCD-EFGH-extra-padding-to-test-v7-version-info",
];

for (const payload of payloads) {
  const mat = QrSvg.encodeMatrix(payload);
  assert.ok(mat.version >= 1 && mat.version <= 10);
  const n = mat.size;
  assert.equal(n, mat.version * 4 + 17);

  // Dark module at (4*version + 9, 8) == (n - 8, 8)
  assert.equal(mat.modules[n - 8][8], 1, "Dark module must be 1");

  // Top-left finder pattern center (3,3) and border (0,0..6)
  for (let i = 0; i < 7; i++) {
    assert.equal(mat.modules[0][i], 1);
    assert.equal(mat.modules[6][i], 1);
    assert.equal(mat.modules[i][0], 1);
    assert.equal(mat.modules[i][6], 1);
  }
  assert.equal(mat.modules[3][3], 1);
  assert.equal(mat.modules[1][1], 0);

  // Timing patterns alternating
  for (let i = 8; i < n - 8; i++) {
    assert.equal(mat.modules[6][i], i % 2 === 0 ? 1 : 0);
    assert.equal(mat.modules[i][6], i % 2 === 0 ? 1 : 0);
  }

  const svg = QrSvg.renderSvg(payload, { size: 196 });
  assert.ok(svg.startsWith("<svg "));
  assert.ok(svg.includes('fill="#FFFFFF"'));
  assert.ok(svg.includes('fill="#111827"'));
  assert.ok(!svg.includes("http://") || !svg.includes("cdn"), "QR SVG must be offline with no external refs");
}
console.log("✓ Offline QR SVG unit checks OK");

// 3. mergeProgressPayloads edge cases
{
  // Legacy flag without timestamp gets priority 1; explicit un-flag with ts=500 wins
  const base = {
    attempts: { q1: { selected: 1, isCorrect: true, ts: 100 } },
    flags: { q1: { star: true }, q2: { unsure: true } },
    struck: { q1: [0, 2] },
    notes: { q1: "old note" },
    dailyStats: { "2026-11-24": { answered: 2, correct: 1 } },
  };
  const incoming = {
    attempts: { q1: { selected: 2, isCorrect: false, ts: 200 } },
    clearedAttempts: { q1: 250 },
    flags: { q1: { star: false } },
    flagUpdatedAt: { q1: { star: 500 } },
    struck: { q1: [] },
    struckUpdatedAt: { q1: 600 },
    notes: { q1: "" },
    noteUpdatedAt: { q1: 700 },
    dailyStatsByDevice: {
      dev_b: { "2026-11-24": { answered: 3, correct: 3 } },
    },
    dailyStatsUpdatedAt: 700,
  };
  const m = mergeProgressPayloads(base, incoming);
  assert.equal(m.attempts.q1, undefined, "q1 cleared at 250 > 200");
  assert.equal(m.clearedAttempts.q1, 250);
  assert.equal(m.flags.q1, undefined, "star un-flagged at 500 > legacy 1");
  assert.equal(m.flags.q2.unsure, true, "q2 legacy flag preserved");
  assert.equal(m.struck.q1, undefined, "struck cleared at 600 > legacy 1");
  assert.equal(m.notes.q1, undefined, "note deleted at 700 > legacy 1");
  assert.equal(m.dailyStats["2026-11-24"].answered, 5, "legacy + dev_b summed");
  assert.equal(m.dailyStats["2026-11-24"].correct, 4);

  // Full resetAt clears older attempts, flags, notes, and dailyStats, while keeping newer items
  const afterReset = mergeProgressPayloads(m, {
    resetAt: 1000,
    attempts: { q3: { selected: 0, isCorrect: true, ts: 1200 } },
    dailyStatsByDevice: { dev_a: { "2026-11-24": { answered: 1, correct: 1 } } },
    dailyStatsUpdatedAt: 1200,
  });
  assert.equal(afterReset.flags.q2, undefined, "Older legacy flag wiped by resetAt=1000");
  assert.equal(afterReset.attempts.q3.selected, 0, "Newer attempt after reset preserved");
  assert.equal(afterReset.dailyStats["2026-11-24"].answered, 1, "Older dailyStats wiped by resetAt=1000");

  // 4. studySession LWW across devices + resetAt
  const desktopSess = {
    mode: "practice",
    filters: { exams: ["2025", "2026"], subjects: ["קרדיולוגיה"], statuses: ["unsolved"], search: "לב", mergePathology: false },
    filterCollapsed: true,
    shuffleOptions: true,
    shuffledOrder: ["2025_q10", "2025_q37"],
    drillFilters: { exams: ["2025"], subjects: ["קרדיולוגיה"], search: "" },
    drillShuffledOrder: ["2025_q37", "2025_q10"],
    lastQIdByMode: { practice: "2025_q37", flashcard: "2024_q12" },
    lastIndexByMode: { practice: 1, flashcard: 5 },
    deviceId: "dev_desktop",
  };
  const phoneSess = {
    mode: "flashcard",
    filters: { exams: ["2024"], subjects: [], statuses: [], search: "", mergePathology: true },
    filterCollapsed: false,
    shuffleOptions: false,
    shuffledOrder: null,
    lastQIdByMode: { flashcard: "2024_q01" },
    lastIndexByMode: { flashcard: 0 },
    deviceId: "dev_phone",
  };
  const mergedSessNewerDesktop = mergeProgressPayloads(
    { studySession: phoneSess, studySessionUpdatedAt: 1500 },
    { studySession: desktopSess, studySessionUpdatedAt: 2000 }
  );
  assert.equal(mergedSessNewerDesktop.studySession.mode, "practice");
  assert.equal(mergedSessNewerDesktop.studySession.deviceId, "dev_desktop");
  assert.equal(mergedSessNewerDesktop.studySession.lastQIdByMode.practice, "2025_q37");
  assert.deepEqual(mergedSessNewerDesktop.studySession.shuffledOrder, ["2025_q10", "2025_q37"]);
  assert.deepEqual(mergedSessNewerDesktop.studySession.drillFilters, { exams: ["2025"], subjects: ["קרדיולוגיה"], search: "" });
  assert.deepEqual(mergedSessNewerDesktop.studySession.drillShuffledOrder, ["2025_q37", "2025_q10"]);
  assert.equal(mergedSessNewerDesktop.studySession.filters.mergePathology, false);
  assert.equal(mergedSessNewerDesktop.studySessionUpdatedAt, 2000);

  // Older incoming session must not overwrite newer base session
  const mergedSessStaleIncoming = mergeProgressPayloads(
    mergedSessNewerDesktop,
    { studySession: phoneSess, studySessionUpdatedAt: 1800 }
  );
  assert.equal(mergedSessStaleIncoming.studySession.deviceId, "dev_desktop");
  assert.equal(mergedSessStaleIncoming.studySessionUpdatedAt, 2000);

  // 5. activeSim LWW + Tombstone deletion + resetAt
  const simObj = {
    label: "2026 (100 שאלות)",
    questionIds: ["2026_q01", "2026_q02", "2026_q03"],
    answers: { "2026_q01": 2 },
    flagged: ["2026_q02"],
    struck: { "2026_q01": [0, 3, 99] }, // invalid index 99 should be sanitized out
    currentIndex: 1,
    secondsLeft: 3852,
    hasTimer: true,
    shuffleOpts: false,
    deviceId: "dev_desktop",
  };
  const simMerged = mergeProgressPayloads(
    { activeSim: { ...simObj, currentIndex: 0, secondsLeft: 4000 }, activeSimUpdatedAt: 1500 },
    { activeSim: simObj, activeSimUpdatedAt: 2000 }
  );
  assert.equal(simMerged.activeSim.currentIndex, 1);
  assert.equal(simMerged.activeSim.secondsLeft, 3852);
  assert.deepEqual(simMerged.activeSim.struck["2026_q01"], [0, 3]);
  assert.equal(simMerged.activeSimUpdatedAt, 2000);

  // Tombstone from another device deletes activeSim and prevents stale device from resurrecting it
  const simDeleted = mergeProgressPayloads(
    simMerged,
    { activeSim: null, activeSimUpdatedAt: 2500 }
  );
  assert.equal(simDeleted.activeSim, null, "Tombstone at 2500 must clear activeSim");
  assert.equal(simDeleted.activeSimUpdatedAt, 2500);

  const simNoResurrect = mergeProgressPayloads(
    simDeleted,
    { activeSim: simObj, activeSimUpdatedAt: 2200 }
  );
  assert.equal(simNoResurrect.activeSim, null, "Stale activeSim (2200) must not resurrect tombstone (2500)");
  assert.equal(simNoResurrect.activeSimUpdatedAt, 2500);

  // resetAt wipes both studySession and activeSim when older than resetAt
  const wipedAll = mergeProgressPayloads(
    {
      studySession: desktopSess,
      studySessionUpdatedAt: 2000,
      activeSim: simObj,
      activeSimUpdatedAt: 2400,
    },
    { resetAt: 3000 }
  );
  assert.equal(wipedAll.studySession, null, "resetAt=3000 must wipe older studySession");
  assert.equal(wipedAll.studySessionUpdatedAt, 0);
  assert.equal(wipedAll.activeSim, null, "resetAt=3000 must wipe older activeSim");
  assert.equal(wipedAll.activeSimUpdatedAt, 0);
}
console.log("✓ mergeProgressPayloads unit checks OK");
