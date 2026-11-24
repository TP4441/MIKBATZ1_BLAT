#!/usr/bin/env node
/**
 * Automated integration test suite for the Mikbatz 1 Cloudflare Worker + D1 API.
 * Run against local `wrangler dev --local` (see instructions in worker/README.md or run via npm/node).
 */

import assert from "node:assert/strict";

const BASE_URL = (process.argv[2] || process.env.TEST_WORKER_URL || "http://127.0.0.1:8799").replace(/\/+$/, "");
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || "test-admin-pass-123";

async function req(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body && typeof options.body === "object" && !(options.body instanceof Uint8Array)) {
    headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(options.body);
  }
  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function run() {
  console.log(`Testing Worker at ${BASE_URL}...`);

  // 1. Health & bootstrap
  {
    const h = await req("/api/health");
    assert.equal(h.status, 200);
    assert.equal(h.data.ok, true);

    const b = await req("/api/bootstrap");
    assert.equal(b.status, 200);
    assert.equal(b.data.ok, true);
    assert.equal(typeof b.data.notes, "object");
    assert.equal(typeof b.data.problems, "object");
    assert.equal(typeof b.data.overrides, "object");
    assert.equal(typeof b.data.takenNames, "object");
    console.log("✓ Health & bootstrap OK");
  }

  // 2. Admin auth guards (no token / forged token)
  {
    const routes = [
      ["GET", "/api/admin/verify"],
      ["GET", "/api/admin/users"],
      ["DELETE", "/api/admin/users/u_fake"],
      ["PUT", "/api/admin/overrides/2026_q001", { hidden: true }],
      ["DELETE", "/api/admin/overrides/2026_q001"],
      ["DELETE", "/api/admin/notes/2026_q001/u_fake"],
      ["DELETE", "/api/admin/problems/2026_q001/u_fake"],
      ["POST", "/api/admin/import-legacy", { notes: {}, problems: {} }],
    ];
    for (const [method, path, body] of routes) {
      const noAuth = await req(path, { method, body });
      assert.equal(noAuth.status, 401, `Expected 401 without token on ${method} ${path}`);

      const badAuth = await req(path, {
        method,
        body,
        headers: { Authorization: "Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImV4cCI6OTk5OTk5OTk5OTk5OX0.invalidsig" },
      });
      assert.equal(badAuth.status, 401, `Expected 401 with forged token on ${method} ${path}`);
    }
    console.log("✓ All /api/admin/* endpoints reject missing/forged tokens with 401");
  }

  // 3. Admin login: wrong password (401), then valid password resets attempts and returns token
  let adminToken;
  {
    const badOnce = await req("/api/admin/login", {
      method: "POST",
      body: { password: "wrong-password" },
    });
    assert.equal(badOnce.status, 401, "Wrong password should return 401");

    const login = await req("/api/admin/login", {
      method: "POST",
      body: { password: ADMIN_PASSWORD },
    });
    assert.equal(login.status, 200);
    assert.equal(login.data.ok, true);
    assert.ok(login.data.token);
    adminToken = login.data.token;

    const verify = await req("/api/admin/verify", {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(verify.status, 200);
    assert.equal(verify.data.admin, true);
    console.log("✓ Wrong password returns 401 & valid admin login/verify OK");
  }

  // 5. Student identity registration, conflict detection & clientSecret ownership enforcement
  const studentA = {
    userId: "u_student_a",
    name: "תפוח",
    emoji: "🍎",
    category: "פירות",
    clientSecret: "secret_aaa_123456",
  };
  const studentB = {
    userId: "u_student_b",
    name: "מנגו",
    emoji: "🥭",
    category: "פירות",
    clientSecret: "secret_bbb_123456",
  };

  {
    const pingA = await req("/api/identities/ping", { method: "POST", body: studentA });
    assert.equal(pingA.status, 200);
    assert.equal(pingA.data.conflict, false);

    // Student B trying to claim Student A's nickname -> 409 conflict
    const pingConflict = await req("/api/identities/ping", {
      method: "POST",
      body: { ...studentB, name: "תפוח", emoji: "🍎" },
    });
    assert.equal(pingConflict.status, 409);
    assert.equal(pingConflict.data.conflict, true);
    assert.equal(pingConflict.data.takenNames["תפוח"], "u_student_a");

    const pingB = await req("/api/identities/ping", { method: "POST", body: studentB });
    assert.equal(pingB.status, 200);

    // Student A creates note and problem report
    const putNote = await req("/api/notes/2026_q001", {
      method: "PUT",
      body: {
        userId: studentA.userId,
        clientSecret: studentA.clientSecret,
        author: studentA.name,
        emoji: studentA.emoji,
        category: studentA.category,
        text: "הערה חשובה של סטודנט א",
      },
    });
    assert.equal(putNote.status, 200);

    const putProb = await req("/api/problems/2026_q001", {
      method: "PUT",
      body: {
        userId: studentA.userId,
        clientSecret: studentA.clientSecret,
        type: "distractor_issue",
        text: "מסיח ב לא מדויק",
        author: studentA.name,
        emoji: studentA.emoji,
        category: studentA.category,
      },
    });
    assert.equal(putProb.status, 200);

    // Student B attempts to overwrite or delete Student A's note/problem -> 403 Forbidden
    const hijackNotePut = await req("/api/notes/2026_q001", {
      method: "PUT",
      body: {
        userId: studentA.userId,
        clientSecret: studentB.clientSecret,
        author: studentA.name,
        emoji: studentA.emoji,
        category: studentA.category,
        text: "השחתה",
      },
    });
    assert.equal(hijackNotePut.status, 403);

    const hijackNoteDel = await req("/api/notes/2026_q001", {
      method: "DELETE",
      body: { userId: studentA.userId, clientSecret: studentB.clientSecret },
    });
    assert.equal(hijackNoteDel.status, 403);

    const hijackProbDel = await req("/api/problems/2026_q001", {
      method: "DELETE",
      body: { userId: studentA.userId, clientSecret: studentB.clientSecret },
    });
    assert.equal(hijackProbDel.status, 403);

    // Student A deletes their own note & problem -> 200
    const delOwnNote = await req("/api/notes/2026_q001", {
      method: "DELETE",
      body: { userId: studentA.userId, clientSecret: studentA.clientSecret },
    });
    assert.equal(delOwnNote.status, 200);
    assert.equal(delOwnNote.data.deleted, true);

    const delOwnProb = await req("/api/problems/2026_q001", {
      method: "DELETE",
      body: { userId: studentA.userId, clientSecret: studentA.clientSecret },
    });
    assert.equal(delOwnProb.status, 200);
    assert.equal(delOwnProb.data.deleted, true);

    console.log("✓ Student identity conflict & clientSecret ownership enforcement OK");
  }

  // 6. Admin moderation of other users' notes/problems + question overrides (edit/hide/restore/reset) + users list/release
  {
    const authHeader = { Authorization: `Bearer ${adminToken}` };

    // Student B posts inappropriate note & problem
    await req("/api/notes/2026_q002", {
      method: "PUT",
      body: {
        userId: studentB.userId,
        clientSecret: studentB.clientSecret,
        author: studentB.name,
        emoji: studentB.emoji,
        category: studentB.category,
        text: "תגובה לא הולמת",
      },
    });
    await req("/api/problems/2026_q002", {
      method: "PUT",
      body: {
        userId: studentB.userId,
        clientSecret: studentB.clientSecret,
        type: "question_issue",
        text: "דיווח שגוי",
        author: studentB.name,
        emoji: studentB.emoji,
        category: studentB.category,
      },
    });

    // Admin moderates (deletes) them
    const modNote = await req(`/api/admin/notes/2026_q002/${studentB.userId}`, {
      method: "DELETE",
      headers: authHeader,
    });
    assert.equal(modNote.status, 200);

    const modProb = await req(`/api/admin/problems/2026_q002/${studentB.userId}`, {
      method: "DELETE",
      headers: authHeader,
    });
    assert.equal(modProb.status, 200);

    // Admin edits question 2026_q001
    const editRes = await req("/api/admin/overrides/2026_q001", {
      method: "PUT",
      headers: authHeader,
      body: {
        hidden: false,
        stem: "שאלה מעודכנת על אסתמה",
        options: [
          { letter: "א", text: "מסיח א מעודכן" },
          { letter: "ב", text: "מסיח ב מעודכן" },
          { letter: "ג", text: "מסיח ג מעודכן" },
        ],
        correct: [1],
        allAccepted: false,
        appealNote: "הערת מנהל",
        subject: "ריאות",
      },
    });
    assert.equal(editRes.status, 200);
    assert.equal(editRes.data.override.stem, "שאלה מעודכנת על אסתמה");

    // Admin hides 2026_q001
    const hideRes = await req("/api/admin/overrides/2026_q001", {
      method: "PUT",
      headers: authHeader,
      body: { hidden: true },
    });
    assert.equal(hideRes.status, 200);
    assert.equal(hideRes.data.override.hidden, true);
    assert.equal(hideRes.data.override.stem, "שאלה מעודכנת על אסתמה");

    // Admin restores 2026_q001
    const restoreRes = await req("/api/admin/overrides/2026_q001", {
      method: "PUT",
      headers: authHeader,
      body: { hidden: false },
    });
    assert.equal(restoreRes.status, 200);
    assert.equal(restoreRes.data.override.hidden, false);

    // Admin resets 2026_q001 to original
    const resetRes = await req("/api/admin/overrides/2026_q001", {
      method: "DELETE",
      headers: authHeader,
    });
    assert.equal(resetRes.status, 200);

    // Admin users list & release nickname
    const usersRes = await req("/api/admin/users", { headers: authHeader });
    assert.equal(usersRes.status, 200);
    assert.ok(usersRes.data.users.some((u) => u.userId === "u_student_a"));
    assert.ok(usersRes.data.users.some((u) => u.userId === "u_student_b"));

    const releaseRes = await req("/api/admin/users/u_student_b", {
      method: "DELETE",
      headers: authHeader,
    });
    assert.equal(releaseRes.status, 200);

    // Verify "מנגו" can now be claimed by Student C
    const pingC = await req("/api/identities/ping", {
      method: "POST",
      body: {
        userId: "u_student_c",
        name: "מנגו",
        emoji: "🥭",
        category: "פירות",
        clientSecret: "secret_ccc_123456",
      },
    });
    assert.equal(pingC.status, 200);

    console.log("✓ Admin moderation, question overrides & user nickname release OK");
  }

  // 7. Legacy import simulation
  {
    const authHeader = { Authorization: `Bearer ${adminToken}` };
    const imp = await req("/api/admin/import-legacy", {
      method: "POST",
      headers: authHeader,
      body: {
        notes: {
          "2026_q005": {
            u_legacy_1: {
              author: "קיווי",
              emoji: "🥝",
              category: "פירות",
              text: "הערה ישנה מ-textdb",
              updatedAt: 1700000000000,
            },
          },
        },
        problems: {
          "2026_q006": {
            u_legacy_2: {
              type: "out_of_material",
              text: "ירד מהסילבוס",
              author: "שזיף",
              emoji: "🍑",
              category: "פירות",
              updatedAt: 1700000001000,
            },
          },
        },
      },
    });
    assert.equal(imp.status, 200);
    assert.equal(imp.data.notesImported, 1);
    assert.equal(imp.data.problemsImported, 1);
    assert.equal(imp.data.identitiesSeeded, 2);

    const boot = await req("/api/bootstrap");
    assert.equal(boot.data.notes["2026_q005"]["u_legacy_1"].text, "הערה ישנה מ-textdb");
    assert.equal(boot.data.problems["2026_q006"]["u_legacy_2"].type, "out_of_material");
    assert.equal(boot.data.takenNames["קיווי"], "u_legacy_1");

    console.log("✓ Legacy import simulation OK");
  }

  // 8. Rate-limit lockout after 5 consecutive wrong password attempts
  {
    for (let i = 0; i < 4; i++) {
      const bad = await req("/api/admin/login", {
        method: "POST",
        body: { password: "wrong-password" },
      });
      assert.equal(bad.status, 401, `Attempt ${i + 1} should return 401`);
    }
    const locked = await req("/api/admin/login", {
      method: "POST",
      body: { password: "wrong-password" },
    });
    assert.equal(locked.status, 429, "5th failed attempt should trigger 429 rate limit");
    console.log("✓ Rate limit triggers 429 after 5 consecutive failed logins");
  }

  console.log("\nALL WORKER TESTS PASSED!");
}

run().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
