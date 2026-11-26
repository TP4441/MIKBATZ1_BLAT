#!/usr/bin/env node
/**
 * Automated integration test suite for the Mikbatz 1 Cloudflare Worker + D1 API.
 * Run against local `wrangler dev --local` (see instructions in worker/README.md or run via npm/node).
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

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
    assert.equal(typeof b.data.communityVersion, "number");
    assert.ok(b.data.communityVersion >= 1);
    assert.equal(typeof b.data.notes, "object");
    assert.equal(typeof b.data.noteReplies, "object");
    assert.equal(typeof b.data.problems, "object");
    assert.equal(typeof b.data.problemFlags, "object");
    assert.equal(typeof b.data.overrides, "object");
    assert.equal(typeof b.data.takenNames, "object");
    assert.ok(Array.isArray(b.data.onlineUsers));

    const onlineRes = await req("/api/online");
    assert.equal(onlineRes.status, 200);
    assert.equal(onlineRes.data.ok, true);
    assert.equal(onlineRes.data.windowMs, 300000);
    assert.ok(Array.isArray(onlineRes.data.onlineUsers));

    const lbInitRes = await req("/api/leaderboard");
    assert.equal(lbInitRes.status, 200);
    assert.equal(lbInitRes.data.ok, true);
    assert.ok(Array.isArray(lbInitRes.data.entries));
    console.log("✓ Health, bootstrap, online & leaderboard endpoint OK");
  }

  // 2. Admin auth guards (no token / forged token)
  {
    const routes = [
      ["GET", "/api/admin/verify"],
      ["GET", "/api/admin/users"],
      ["GET", "/api/admin/feedback"],
      ["DELETE", "/api/admin/feedback/fb_fake"],
      ["DELETE", "/api/admin/users/u_fake"],
      ["PUT", "/api/admin/overrides/2026_q001", { hidden: true }],
      ["DELETE", "/api/admin/overrides/2026_q001"],
      ["DELETE", "/api/admin/notes/2026_q001/u_fake"],
      ["DELETE", "/api/admin/note-replies/r_fake"],
      ["DELETE", "/api/admin/problems/2026_q001/u_fake"],
      ["DELETE", "/api/admin/problem-flags/2026_q001/u_fake"],
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
    assert.ok(Array.isArray(pingB.data.onlineUsers));
    assert.ok(pingB.data.onlineUsers.some((u) => u.userId === studentA.userId && u.name === studentA.name));
    assert.ok(pingB.data.onlineUsers.some((u) => u.userId === studentB.userId && u.name === studentB.name));

    const onlineCheck = await req("/api/online");
    assert.equal(onlineCheck.status, 200);
    const listedB = onlineCheck.data.onlineUsers.find((u) => u.userId === studentB.userId);
    assert.ok(listedB);
    assert.equal(listedB.name, studentB.name);
    assert.equal(listedB.emoji, studentB.emoji);
    assert.equal(listedB.clientSecret, undefined);
    assert.equal(listedB.client_secret_hash, undefined);
    assert.equal(listedB.sync_code_hash, undefined);

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

    // Student A edits their problem report, then deletes it -> 200
    const editProb = await req("/api/problems/2026_q001", {
      method: "PUT",
      body: {
        userId: studentA.userId,
        clientSecret: studentA.clientSecret,
        type: "question_issue",
        text: "ניסוח מעודכן לבעיה",
        author: studentA.name,
        emoji: studentA.emoji,
        category: studentA.category,
      },
    });
    assert.equal(editProb.status, 200);
    assert.equal(editProb.data.problem.type, "question_issue");
    assert.equal(editProb.data.problem.text, "ניסוח מעודכן לבעיה");

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

  // 8. Cross-device sync, progress merge, guest release, rotate-code & revoke-other-devices
  {
    const authHeader = { Authorization: `Bearer ${adminToken}` };
    const syncCodeA1 = "ABCD-EFGH-JKLM";
    const syncCodeA2 = "NPQR-STUV-WXYZ";
    const deviceBSecret = "secret_device_b_789012";

    // Register sync code for Student A
    const regA = await req("/api/sync/register-code", {
      method: "POST",
      body: {
        userId: studentA.userId,
        clientSecret: studentA.clientSecret,
        syncCode: syncCodeA1,
      },
    });
    assert.equal(regA.status, 200);
    assert.equal(regA.data.registered, true);

    // Idempotent re-register with same code
    const regAIdem = await req("/api/sync/register-code", {
      method: "POST",
      body: {
        userId: studentA.userId,
        clientSecret: studentA.clientSecret,
        syncCode: "abcdefghjklm",
      },
    });
    assert.equal(regAIdem.status, 200);

    // Student C trying to register Student A's sync code -> 409 collision
    const regCollision = await req("/api/sync/register-code", {
      method: "POST",
      body: {
        userId: "u_student_c",
        clientSecret: "secret_ccc_123456",
        syncCode: syncCodeA1,
      },
    });
    assert.equal(regCollision.status, 409);

    // Device A saves progress (including a cleared attempt tombstone on q002 and device_a daily stats)
    const progA = {
      attempts: {
        "2026_q001": { selected: 1, isCorrect: true, ts: 2000 },
        "2026_q003": { selected: 0, isCorrect: false, ts: 1500 },
      },
      clearedAttempts: {
        "2026_q002": 3000,
      },
      flags: { "2026_q001": { star: true } },
      flagUpdatedAt: { "2026_q001": { star: 2000 } },
      dailyStatsByDevice: {
        device_a: { "2026-11-24": { answered: 2, correct: 1 } },
      },
      dailyStatsUpdatedAt: 2000,
    };
    const putProgA = await req("/api/progress", {
      method: "PUT",
      body: {
        userId: studentA.userId,
        clientSecret: studentA.clientSecret,
        progress: progA,
      },
    });
    assert.equal(putProgA.status, 200);
    assert.equal(putProgA.data.progress.attempts["2026_q001"].selected, 1);

    // Device A reads back via GET /api/progress
    const getProgA = await req("/api/progress", {
      headers: {
        "X-User-Id": studentA.userId,
        "X-Client-Secret": studentA.clientSecret,
      },
    });
    assert.equal(getProgA.status, 200);
    assert.equal(getProgA.data.progress.attempts["2026_q001"].selected, 1);
    assert.equal(getProgA.data.progress.dailyStats["2026-11-24"].answered, 2);

    // Device B previews Student A's sync code
    const prevRes = await req("/api/sync/preview", {
      method: "POST",
      body: { syncCode: syncCodeA1 },
    });
    assert.equal(prevRes.status, 200);
    assert.equal(prevRes.data.identity.userId, studentA.userId);
    assert.equal(prevRes.data.identity.name, studentA.name);
    assert.equal(prevRes.data.summary.solvedCount, 2);

    // Guest on Device B has local identity + 1 non-conflicting note + 1 conflicting note + local progress
    const guestUser = {
      userId: "u_guest_temp",
      name: "תות",
      emoji: "🍓",
      category: "פירות",
      clientSecret: "secret_guest_123456",
    };
    assert.equal((await req("/api/identities/ping", { method: "POST", body: guestUser })).status, 200);
    // Student A already has a note on 2026_q010; guest also has one on 2026_q010 (conflict) and one on 2026_q011 (non-conflict)
    assert.equal(
      (
        await req("/api/notes/2026_q010", {
          method: "PUT",
          body: {
            userId: studentA.userId,
            clientSecret: studentA.clientSecret,
            author: studentA.name,
            emoji: studentA.emoji,
            category: studentA.category,
            text: "הערת מקור של תפוח",
          },
        })
      ).status,
      200
    );
    assert.equal(
      (
        await req("/api/notes/2026_q010", {
          method: "PUT",
          body: {
            userId: guestUser.userId,
            clientSecret: guestUser.clientSecret,
            author: guestUser.name,
            emoji: guestUser.emoji,
            category: guestUser.category,
            text: "הערה כפולה של תות",
          },
        })
      ).status,
      200
    );
    assert.equal(
      (
        await req("/api/notes/2026_q011", {
          method: "PUT",
          body: {
            userId: guestUser.userId,
            clientSecret: guestUser.clientSecret,
            author: guestUser.name,
            emoji: guestUser.emoji,
            category: guestUser.category,
            text: "הערה ייחודית של תות שתעבור לתפוח",
          },
        })
      ).status,
      200
    );

    // Link Device B in merge mode
    const localProgB = {
      attempts: {
        "2026_q002": { selected: 2, isCorrect: true, ts: 1000 }, // older than A's clearedAttempts=3000 -> must stay cleared!
        "2026_q003": { selected: 2, isCorrect: true, ts: 4000 }, // newer than A's 1500 -> must win!
        "2026_q004": { selected: 1, isCorrect: true, ts: 2500 }, // new question from B
      },
      flags: { "2026_q004": { unsure: true } },
      flagUpdatedAt: { "2026_q004": { unsure: 2500 } },
      dailyStatsByDevice: {
        device_b: { "2026-11-24": { answered: 3, correct: 2 } },
      },
      dailyStatsUpdatedAt: 4000,
    };
    const linkMerge = await req("/api/sync/link", {
      method: "POST",
      body: {
        syncCode: syncCodeA1,
        newClientSecret: deviceBSecret,
        deviceLabel: "iPad",
        mode: "merge",
        localProgress: localProgB,
        guestUserId: guestUser.userId,
        guestClientSecret: guestUser.clientSecret,
      },
    });
    assert.equal(linkMerge.status, 200);
    assert.equal(linkMerge.data.identity.userId, studentA.userId);
    assert.equal(linkMerge.data.guestReleased, true);
    assert.equal(linkMerge.data.progress.attempts["2026_q001"].selected, 1);
    assert.equal(linkMerge.data.progress.attempts["2026_q002"], undefined, "Older attempt must stay cleared by tombstone");
    assert.equal(linkMerge.data.progress.attempts["2026_q003"].selected, 2, "Newer attempt from Device B must win");
    assert.equal(linkMerge.data.progress.attempts["2026_q004"].selected, 1);
    assert.equal(linkMerge.data.progress.dailyStats["2026-11-24"].answered, 5);
    assert.equal(linkMerge.data.progress.dailyStats["2026-11-24"].correct, 3);

    // Verify guest note on 2026_q011 moved to Student A and guest nickname "תות" was released
    const bootAfterLink = await req("/api/bootstrap");
    assert.equal(bootAfterLink.data.notes["2026_q011"][studentA.userId].text, "הערה ייחודית של תות שתעבור לתפוח");
    assert.equal(bootAfterLink.data.notes["2026_q011"][studentA.userId].author, studentA.name);
    assert.equal(bootAfterLink.data.notes["2026_q010"][studentA.userId].text, "הערת מקור של תפוח");
    assert.equal(bootAfterLink.data.notes["2026_q010"][guestUser.userId], undefined);
    assert.equal(bootAfterLink.data.takenNames["תות"], undefined, "Guest nickname must be released");

    // Verify BOTH Device A and Device B can write notes, ping identity, and read/write progress
    const pingFromB = await req("/api/identities/ping", {
      method: "POST",
      body: { ...studentA, clientSecret: deviceBSecret },
    });
    assert.equal(pingFromB.status, 200);

    const noteFromB = await req("/api/notes/2026_q012", {
      method: "PUT",
      body: {
        userId: studentA.userId,
        clientSecret: deviceBSecret,
        author: studentA.name,
        emoji: studentA.emoji,
        category: studentA.category,
        text: "הערה ממכשיר ב",
      },
    });
    assert.equal(noteFromB.status, 200);

    const noteFromA = await req("/api/notes/2026_q013", {
      method: "PUT",
      body: {
        userId: studentA.userId,
        clientSecret: studentA.clientSecret,
        author: studentA.name,
        emoji: studentA.emoji,
        category: studentA.category,
        text: "הערה ממכשיר א",
      },
    });
    assert.equal(noteFromA.status, 200);

    // Admin users endpoint exposes hasSyncCode and solvedCount safely
    const adminUsersRes = await req("/api/admin/users", { headers: authHeader });
    assert.equal(adminUsersRes.status, 200);
    const adminUserA = adminUsersRes.data.users.find((u) => u.userId === studentA.userId);
    assert.ok(adminUserA);
    assert.equal(adminUserA.hasSyncCode, true);
    assert.equal(adminUserA.solvedCount, 3);
    assert.equal(adminUserA.syncCodeHash, undefined);
    assert.equal(adminUserA.progressJson, undefined);

    // Rotate sync code -> old code returns 404, connected devices keep working, new code works
    const rotRes = await req("/api/sync/rotate-code", {
      method: "POST",
      body: {
        userId: studentA.userId,
        clientSecret: studentA.clientSecret,
        newSyncCode: syncCodeA2,
      },
    });
    assert.equal(rotRes.status, 200);
    assert.equal((await req("/api/sync/preview", { method: "POST", body: { syncCode: syncCodeA1 } })).status, 404);
    assert.equal((await req("/api/sync/preview", { method: "POST", body: { syncCode: syncCodeA2 } })).status, 200);
    assert.equal(
      (
        await req("/api/progress", {
          headers: { "X-User-Id": studentA.userId, "X-Client-Secret": deviceBSecret },
        })
      ).status,
      200
    );

    // Replace mode test with an empty guest -> does not overwrite cloud, releases guest
    const guestEmpty = {
      userId: "u_guest_empty",
      name: "אננס",
      emoji: "🍍",
      category: "פירות",
      clientSecret: "secret_guest_empty_123",
    };
    assert.equal((await req("/api/identities/ping", { method: "POST", body: guestEmpty })).status, 200);
    const deviceCSecret = "secret_device_c_789012";
    const linkReplace = await req("/api/sync/link", {
      method: "POST",
      body: {
        syncCode: syncCodeA2,
        newClientSecret: deviceCSecret,
        deviceLabel: "iPhone",
        mode: "replace",
        localProgress: {
          attempts: { "2026_q999": { selected: 0, isCorrect: true, ts: 999999 } },
        },
        guestUserId: guestEmpty.userId,
        guestClientSecret: guestEmpty.clientSecret,
      },
    });
    assert.equal(linkReplace.status, 200);
    assert.equal(linkReplace.data.guestReleased, true);
    assert.equal(linkReplace.data.progress.attempts["2026_q999"], undefined, "Replace mode must not push local progress");
    assert.equal(linkReplace.data.progress.attempts["2026_q001"].selected, 1);

    // Revoke other devices from Device A -> Device B & C get 403, Device A remains active
    const revokeRes = await req("/api/sync/revoke-other-devices", {
      method: "POST",
      body: {
        userId: studentA.userId,
        clientSecret: studentA.clientSecret,
      },
    });
    assert.equal(revokeRes.status, 200);
    assert.equal(
      (
        await req("/api/progress", {
          headers: { "X-User-Id": studentA.userId, "X-Client-Secret": deviceBSecret },
        })
      ).status,
      403
    );
    assert.equal(
      (
        await req("/api/progress", {
          headers: { "X-User-Id": studentA.userId, "X-Client-Secret": deviceCSecret },
        })
      ).status,
      403
    );
    assert.equal(
      (
        await req("/api/progress", {
          headers: { "X-User-Id": studentA.userId, "X-Client-Secret": studentA.clientSecret },
        })
      ).status,
      200
    );

    // Sync rate-limit test using a dedicated forwarded IP so it doesn't interfere with earlier steps
    const rlHeaders = { "X-Forwarded-For": "203.0.113.77" };
    for (let i = 0; i < 9; i++) {
      const badSync = await req("/api/sync/preview", {
        method: "POST",
        headers: rlHeaders,
        body: { syncCode: "ZZZZ-ZZZZ-ZZZZ" },
      });
      assert.equal(badSync.status, 404, `Sync attempt ${i + 1} should return 404`);
    }
    const lockedSync = await req("/api/sync/preview", {
      method: "POST",
      headers: rlHeaders,
      body: { syncCode: "ZZZZ-ZZZZ-ZZZZ" },
    });
    assert.equal(lockedSync.status, 429, "10th failed sync attempt should trigger 429 rate limit");

    console.log("✓ Cross-device sync, merge, guest release, rotate, revoke & rate-limit OK");
  }

  // 8b. Leaderboard sorting (by answers vs by notes) and privacy checks
  {
    const lbAns = await req("/api/leaderboard?sort=answers");
    assert.equal(lbAns.status, 200);
    assert.equal(lbAns.data.ok, true);
    assert.equal(lbAns.data.sort, "answers");
    assert.ok(Array.isArray(lbAns.data.entries));
    const entryA = lbAns.data.entries.find((e) => e.userId === studentA.userId);
    const entryLegacy = lbAns.data.entries.find((e) => e.userId === "u_legacy_1");
    assert.ok(entryA, "Student A should appear on leaderboard");
    assert.equal(entryA.solvedCount, 3);
    assert.equal(entryA.notesCount, 4);
    assert.equal(entryA.clientSecret, undefined);
    assert.equal(entryA.client_secret_hash, undefined);
    assert.equal(entryA.sync_code_hash, undefined);
    assert.equal(entryA.progressJson, undefined);
    assert.ok(entryLegacy, "Legacy note author should appear on leaderboard");
    assert.equal(entryLegacy.solvedCount, 0);
    assert.equal(entryLegacy.notesCount, 1);
    // In answers sort, Student A (3 solved) must come before Legacy (0 solved)
    assert.ok(
      lbAns.data.entries.findIndex((e) => e.userId === studentA.userId) <
      lbAns.data.entries.findIndex((e) => e.userId === "u_legacy_1")
    );

    const lbNotes = await req("/api/leaderboard?sort=notes");
    assert.equal(lbNotes.status, 200);
    assert.equal(lbNotes.data.sort, "notes");
    for (let idx = 1; idx < lbNotes.data.entries.length; idx++) {
      assert.ok(
        lbNotes.data.entries[idx - 1].notesCount >= lbNotes.data.entries[idx].notesCount,
        "Notes sort must be non-increasing by notesCount"
      );
    }

    // Deleting a note (by user or admin) must decrement leaderboard notesCount and clear user_progress.notes
    await req("/api/progress", {
      method: "PUT",
      body: {
        userId: studentA.userId,
        clientSecret: studentA.clientSecret,
        progress: {
          notes: {
            "2026_q010": "הערת מקור של תפוח",
            "2026_q011": "הערה ייחודית של תות שתעבור לתפוח",
            "2026_q012": "הערה ממכשיר ב",
            "2026_q013": "הערה ממכשיר א",
          },
          noteUpdatedAt: {
            "2026_q010": Date.now(),
            "2026_q011": Date.now(),
            "2026_q012": Date.now(),
            "2026_q013": Date.now(),
          },
        },
      },
    });
    const delUserNote = await req("/api/notes/2026_q012", {
      method: "DELETE",
      body: { userId: studentA.userId, clientSecret: studentA.clientSecret },
    });
    assert.equal(delUserNote.status, 200);
    const delAdminNote = await req(`/api/admin/notes/2026_q013/${studentA.userId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(delAdminNote.status, 200);

    const lbAfterDeletes = await req("/api/leaderboard?sort=notes");
    assert.equal(lbAfterDeletes.status, 200);
    const entryAAfterDeletes = lbAfterDeletes.data.entries.find((e) => e.userId === studentA.userId);
    assert.equal(entryAAfterDeletes.notesCount, 2, "Leaderboard notesCount must reflect only existing notes");

    const progAfterAdminDel = await req("/api/progress", {
      headers: { "X-User-Id": studentA.userId, "X-Client-Secret": studentA.clientSecret },
    });
    assert.equal(progAfterAdminDel.status, 200);
    assert.equal(progAfterAdminDel.data.progress.notes["2026_q012"], undefined);
    assert.equal(progAfterAdminDel.data.progress.notes["2026_q013"], undefined);

    console.log("✓ Leaderboard answers/notes sorting, deletion counts & privacy checks OK");
  }

  // 8c. Conditional smart polling (/api/poll)
  {
    const bootInit = await req("/api/bootstrap");
    assert.equal(bootInit.status, 200);
    const vCommInit = bootInit.data.communityVersion;
    assert.equal(typeof vCommInit, "number");

    const progInit = await req("/api/progress", {
      headers: { "X-User-Id": studentA.userId, "X-Client-Secret": studentA.clientSecret },
    });
    assert.equal(progInit.status, 200);
    const vProgInit = progInit.data.version;
    assert.equal(typeof vProgInit, "number");

    // 1. Poll with matching versions -> no community or progress payloads returned
    const pollIdle = await req(`/api/poll?communityVersion=${vCommInit}&progressVersion=${vProgInit}`, {
      headers: { "X-User-Id": studentA.userId, "X-Client-Secret": studentA.clientSecret },
    });
    assert.equal(pollIdle.status, 200);
    assert.equal(pollIdle.data.ok, true);
    assert.equal(pollIdle.data.communityVersion, vCommInit);
    assert.equal(pollIdle.data.communityChanged, false);
    assert.equal(pollIdle.data.notes, undefined);
    assert.equal(pollIdle.data.problems, undefined);
    assert.equal(pollIdle.data.overrides, undefined);
    assert.equal(pollIdle.data.takenNames, undefined);
    assert.equal(pollIdle.data.progressStatus, 200);
    assert.equal(pollIdle.data.progressChanged, false);
    assert.equal(pollIdle.data.progressVersion, vProgInit);
    assert.equal(pollIdle.data.progress, undefined);
    assert.ok(Array.isArray(pollIdle.data.onlineUsers));

    // 2. Add a community note -> poll with previous communityVersion returns communityChanged: true + new note
    const putPollNote = await req("/api/notes/2026_q014", {
      method: "PUT",
      body: {
        userId: studentA.userId,
        clientSecret: studentA.clientSecret,
        author: studentA.name,
        emoji: studentA.emoji,
        category: studentA.category,
        text: "הערה חדשה לבדיקת poll",
      },
    });
    assert.equal(putPollNote.status, 200);

    const pollAfterNote = await req(`/api/poll?communityVersion=${vCommInit}&progressVersion=${vProgInit}`, {
      headers: { "X-User-Id": studentA.userId, "X-Client-Secret": studentA.clientSecret },
    });
    assert.equal(pollAfterNote.status, 200);
    assert.equal(pollAfterNote.data.communityChanged, true);
    assert.ok(pollAfterNote.data.communityVersion > vCommInit);
    assert.equal(pollAfterNote.data.notes["2026_q014"][studentA.userId].text, "הערה חדשה לבדיקת poll");
    assert.equal(pollAfterNote.data.takenNames, undefined);
    assert.equal(pollAfterNote.data.progressChanged, false);

    // 3. Poll with updated communityVersion -> communityChanged: false again
    const vCommAfterNote = pollAfterNote.data.communityVersion;
    const pollAfterNoteClean = await req(`/api/poll?communityVersion=${vCommAfterNote}&progressVersion=${vProgInit}`, {
      headers: { "X-User-Id": studentA.userId, "X-Client-Secret": studentA.clientSecret },
    });
    assert.equal(pollAfterNoteClean.status, 200);
    assert.equal(pollAfterNoteClean.data.communityChanged, false);
    assert.equal(pollAfterNoteClean.data.notes, undefined);

    // 4. Update progress -> poll with older progressVersion returns progressChanged: true + updated progress
    const putProgPoll = await req("/api/progress", {
      method: "PUT",
      body: {
        userId: studentA.userId,
        clientSecret: studentA.clientSecret,
        progress: {
          attempts: {
            "2026_q020": { selected: 2, isCorrect: true, ts: 9000 },
          },
        },
      },
    });
    assert.equal(putProgPoll.status, 200);
    const vProgNew = putProgPoll.data.version;
    assert.ok(vProgNew > vProgInit);

    const pollAfterProg = await req(`/api/poll?communityVersion=${vCommAfterNote}&progressVersion=${vProgInit}`, {
      headers: { "X-User-Id": studentA.userId, "X-Client-Secret": studentA.clientSecret },
    });
    assert.equal(pollAfterProg.status, 200);
    assert.equal(pollAfterProg.data.communityChanged, false);
    assert.equal(pollAfterProg.data.progressStatus, 200);
    assert.equal(pollAfterProg.data.progressChanged, true);
    assert.equal(pollAfterProg.data.progressVersion, vProgNew);
    assert.equal(pollAfterProg.data.progress.attempts["2026_q020"].selected, 2);

    // 5. Revoked device calling /api/poll receives progressStatus: 403
    const pollRevoked = await req(`/api/poll?communityVersion=${vCommAfterNote}&progressVersion=${vProgInit}&touchPresence=0`, {
      headers: { "X-User-Id": studentA.userId, "X-Client-Secret": "secret_device_b_789012" },
    });
    assert.equal(pollRevoked.status, 200);
    assert.equal(pollRevoked.data.progressStatus, 403);
    assert.equal(pollRevoked.data.progressChanged, false);
    assert.equal(pollRevoked.data.progress, undefined);

    // 6. studySession & activeSim roundtrip + tombstone over PUT/GET /api/progress
    const sessPut = await req("/api/progress", {
      method: "PUT",
      body: {
        userId: studentA.userId,
        clientSecret: studentA.clientSecret,
        progress: {
          studySession: {
            mode: "flashcard",
            filters: { exams: ["2026"], subjects: ["קרדיולוגיה"], statuses: [], search: "", mergePathology: true },
            filterCollapsed: true,
            shuffleOptions: false,
            shuffledOrder: ["2026_q003", "2026_q001"],
            lastQIdByMode: { flashcard: "2026_q001" },
            lastIndexByMode: { flashcard: 1 },
            deviceId: "dev_test_a",
          },
          studySessionUpdatedAt: 12000,
          activeSim: {
            label: "2026 (2 שאלות)",
            questionIds: ["2026_q001", "2026_q002"],
            answers: { "2026_q001": 1 },
            flagged: ["2026_q002"],
            struck: { "2026_q001": [0] },
            currentIndex: 1,
            secondsLeft: 1800,
            hasTimer: true,
            shuffleOpts: false,
            deviceId: "dev_test_a",
          },
          activeSimUpdatedAt: 12000,
        },
      },
    });
    assert.equal(sessPut.status, 200);
    assert.equal(sessPut.data.progress.studySession.mode, "flashcard");
    assert.equal(sessPut.data.progress.activeSim.secondsLeft, 1800);

    const simTombstonePut = await req("/api/progress", {
      method: "PUT",
      body: {
        userId: studentA.userId,
        clientSecret: studentA.clientSecret,
        progress: {
          activeSim: null,
          activeSimUpdatedAt: 13000,
        },
      },
    });
    assert.equal(simTombstonePut.status, 200);
    assert.equal(simTombstonePut.data.progress.activeSim, null);
    assert.equal(simTombstonePut.data.progress.activeSimUpdatedAt, 13000);
    assert.equal(simTombstonePut.data.progress.studySession.lastQIdByMode.flashcard, "2026_q001");

    const sessGet = await req("/api/progress", {
      headers: { "X-User-Id": studentA.userId, "X-Client-Secret": studentA.clientSecret },
    });
    assert.equal(sessGet.status, 200);
    assert.equal(sessGet.data.progress.activeSim, null);
    assert.equal(sessGet.data.progress.studySession.mode, "flashcard");

    console.log("✓ Smart polling (/api/poll) conditional sync & 403 handling OK");
  }

  // 8b. Problem inaccuracy flags + Threaded note replies
  {
    const peer = {
      userId: "u_student_c",
      name: "מנגו",
      emoji: "🥭",
      category: "פירות",
      clientSecret: "secret_ccc_123456",
    };

    // --- Problem inaccuracy flags ---
    const probRes = await req("/api/problems/2026_q010", {
      method: "PUT",
      body: {
        userId: studentA.userId,
        clientSecret: studentA.clientSecret,
        type: "out_of_material",
        text: "ירד מהמיקוד",
        author: studentA.name,
        emoji: studentA.emoji,
        category: studentA.category,
      },
    });
    assert.equal(probRes.status, 200);

    const pollBefore = await req("/api/poll");
    const vBefore = pollBefore.data.communityVersion;

    // Cannot flag own problem report
    const selfProbFlag = await req(`/api/problem-flags/2026_q010/${studentA.userId}`, {
      method: "PUT",
      body: {
        userId: studentA.userId,
        clientSecret: studentA.clientSecret,
        author: studentA.name,
        emoji: studentA.emoji,
        category: studentA.category,
      },
    });
    assert.equal(selfProbFlag.status, 400);

    // Flagging non-existent problem report returns 404
    const missingProbFlag = await req(`/api/problem-flags/2026_q999/${studentA.userId}`, {
      method: "PUT",
      body: {
        userId: peer.userId,
        clientSecret: peer.clientSecret,
        author: peer.name,
        emoji: peer.emoji,
        category: peer.category,
      },
    });
    assert.equal(missingProbFlag.status, 404);

    // Peer flags Student A's problem report
    const flagProbRes = await req(`/api/problem-flags/2026_q010/${studentA.userId}`, {
      method: "PUT",
      body: {
        userId: peer.userId,
        clientSecret: peer.clientSecret,
        author: peer.name,
        emoji: peer.emoji,
        category: peer.category,
      },
    });
    assert.equal(flagProbRes.status, 200);

    const pollAfterProbFlag = await req(`/api/poll?communityVersion=${vBefore}`);
    assert.equal(pollAfterProbFlag.status, 200);
    assert.equal(pollAfterProbFlag.data.communityChanged, true);
    assert.equal(pollAfterProbFlag.data.problemFlags["2026_q010"][studentA.userId][peer.userId].author, peer.name);

    // Unflag + re-flag + admin clear + cascade delete on problem deletion
    const unflagProbRes = await req(`/api/problem-flags/2026_q010/${studentA.userId}`, {
      method: "DELETE",
      body: { userId: peer.userId, clientSecret: peer.clientSecret },
    });
    assert.equal(unflagProbRes.status, 200);
    assert.equal(unflagProbRes.data.deleted, true);

    await req(`/api/problem-flags/2026_q010/${studentA.userId}`, {
      method: "PUT",
      body: {
        userId: peer.userId,
        clientSecret: peer.clientSecret,
        author: peer.name,
        emoji: peer.emoji,
        category: peer.category,
      },
    });
    const adminClearProbRes = await req(`/api/admin/problem-flags/2026_q010/${studentA.userId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(adminClearProbRes.status, 200);

    await req(`/api/problem-flags/2026_q010/${studentA.userId}`, {
      method: "PUT",
      body: {
        userId: peer.userId,
        clientSecret: peer.clientSecret,
        author: peer.name,
        emoji: peer.emoji,
        category: peer.category,
      },
    });
    const delProbRes = await req("/api/problems/2026_q010", {
      method: "DELETE",
      body: { userId: studentA.userId, clientSecret: studentA.clientSecret },
    });
    assert.equal(delProbRes.status, 200);
    const bootAfterProbDel = await req("/api/bootstrap");
    assert.equal(bootAfterProbDel.data.problemFlags["2026_q010"]?.[studentA.userId], undefined);

    // --- Threaded note replies (reply to note + reply to reply) ---
    const reply1 = await req(`/api/note-replies/2026_q010/${studentA.userId}`, {
      method: "POST",
      body: {
        replyId: "r_test_1",
        userId: peer.userId,
        clientSecret: peer.clientSecret,
        author: peer.name,
        emoji: peer.emoji,
        category: peer.category,
        text: "לדעתי זה דווקא א'",
      },
    });
    assert.equal(reply1.status, 200);
    assert.equal(reply1.data.reply.replyId, "r_test_1");

    // Reply on reply1
    const reply2 = await req(`/api/note-replies/2026_q010/${studentA.userId}`, {
      method: "POST",
      body: {
        replyId: "r_test_2",
        parentReplyId: "r_test_1",
        userId: studentA.userId,
        clientSecret: studentA.clientSecret,
        author: studentA.name,
        emoji: studentA.emoji,
        category: studentA.category,
        text: "צודק, בדקתי שוב במצגת!",
      },
    });
    assert.equal(reply2.status, 200);
    assert.equal(reply2.data.reply.parentReplyId, "r_test_1");

    // Peer cannot edit Student A's reply
    const hijackReplyEdit = await req("/api/note-replies/r_test_2", {
      method: "PUT",
      body: {
        userId: peer.userId,
        clientSecret: peer.clientSecret,
        author: peer.name,
        emoji: peer.emoji,
        category: peer.category,
        text: "ניסיון עריכה",
      },
    });
    assert.equal(hijackReplyEdit.status, 403);

    // Student A edits reply2
    const editReply2 = await req("/api/note-replies/r_test_2", {
      method: "PUT",
      body: {
        userId: studentA.userId,
        clientSecret: studentA.clientSecret,
        author: studentA.name,
        emoji: studentA.emoji,
        category: studentA.category,
        text: "צודק לגמרי, עדכנתי!",
      },
    });
    assert.equal(editReply2.status, 200);
    assert.equal(editReply2.data.reply.text, "צודק לגמרי, עדכנתי!");

    const bootAfterReplies = await req("/api/bootstrap");
    const q10Replies = bootAfterReplies.data.noteReplies["2026_q010"]?.[studentA.userId] || [];
    assert.equal(q10Replies.length, 2);
    assert.equal(q10Replies[1].text, "צודק לגמרי, עדכנתי!");

    // Deleting parent reply1 cascades to child reply2
    const delReply1 = await req("/api/note-replies/r_test_1", {
      method: "DELETE",
      body: { userId: peer.userId, clientSecret: peer.clientSecret },
    });
    assert.equal(delReply1.status, 200);
    assert.equal(delReply1.data.deletedIds.length, 2);

    // Create another reply and test parent note deletion cascade
    await req(`/api/note-replies/2026_q010/${studentA.userId}`, {
      method: "POST",
      body: {
        replyId: "r_test_3",
        userId: peer.userId,
        clientSecret: peer.clientSecret,
        author: peer.name,
        emoji: peer.emoji,
        category: peer.category,
        text: "עוד תגובה",
      },
    });
    const delNoteRes = await req("/api/notes/2026_q010", {
      method: "DELETE",
      body: { userId: studentA.userId, clientSecret: studentA.clientSecret },
    });
    assert.equal(delNoteRes.status, 200);
    const bootAfterDelNote = await req("/api/bootstrap");
    assert.equal(bootAfterDelNote.data.noteReplies["2026_q010"]?.[studentA.userId], undefined);

    console.log("✓ Problem inaccuracy flags & threaded note replies OK");
  }

  // 8b. User feedback (suggestions / complaints)
  {
    const studentFb = {
      userId: "u_fb_test_1",
      clientSecret: "fb-secret-12345678",
      name: "מלון",
      emoji: "🍈",
      category: "פירות",
    };

    const emptyFb = await req("/api/feedback", {
      method: "POST",
      body: { ...studentFb, author: studentFb.name, text: "   " },
    });
    assert.equal(emptyFb.status, 400);

    const tooLongFb = await req("/api/feedback", {
      method: "POST",
      body: { ...studentFb, author: studentFb.name, text: "א".repeat(501) },
    });
    assert.equal(tooLongFb.status, 400);

    const validFb = await req("/api/feedback", {
      method: "POST",
      body: { ...studentFb, author: studentFb.name, text: "הצעה מעולה לשיפור האתר!" },
    });
    assert.equal(validFb.status, 200);
    assert.equal(validFb.data.ok, true);
    assert.ok(validFb.data.feedbackId);

    const listFb = await req("/api/admin/feedback", {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(listFb.status, 200);
    const found = listFb.data.feedback.find((f) => f.feedbackId === validFb.data.feedbackId);
    assert.ok(found, "Submitted feedback should appear in admin feedback list");
    assert.equal(found.text, "הצעה מעולה לשיפור האתר!");
    assert.equal(found.author, "מלון");

    const delFb = await req(`/api/admin/feedback/${encodeURIComponent(validFb.data.feedbackId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(delFb.status, 200);

    const listAfterDel = await req("/api/admin/feedback", {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(listAfterDel.status, 200);
    assert.equal(
      listAfterDel.data.feedback.some((f) => f.feedbackId === validFb.data.feedbackId),
      false
    );
    console.log("✓ User feedback submit, list & admin delete OK");
  }

  // 8d. Community Cache & Leaderboard Cache + Invalidation
  {
    const authHeader = { Authorization: `Bearer ${adminToken}` };

    // Community Cache: consecutive /api/bootstrap calls at same version return identical data
    const boot1 = await req("/api/bootstrap");
    const boot2 = await req("/api/bootstrap");
    assert.equal(boot1.status, 200);
    assert.equal(boot2.status, 200);
    assert.equal(boot1.data.communityVersion, boot2.data.communityVersion);
    assert.deepEqual(boot1.data.notes, boot2.data.notes);
    assert.deepEqual(boot1.data.overrides, boot2.data.overrides);

    const prevCommVer = boot1.data.communityVersion;

    // PUT note -> immediately visible in /api/bootstrap and /api/poll
    const putCacheNote = await req("/api/notes/2026_q099", {
      method: "PUT",
      body: {
        userId: studentA.userId,
        clientSecret: studentA.clientSecret,
        author: studentA.name,
        emoji: studentA.emoji,
        category: studentA.category,
        text: "הערה לבדיקת אינוולידציית cache",
      },
    });
    assert.equal(putCacheNote.status, 200);

    const bootAfterPut = await req("/api/bootstrap");
    assert.equal(bootAfterPut.status, 200);
    assert.ok(bootAfterPut.data.communityVersion > prevCommVer);
    assert.equal(
      bootAfterPut.data.notes["2026_q099"]?.[studentA.userId]?.text,
      "הערה לבדיקת אינוולידציית cache"
    );

    const pollAfterPut = await req(`/api/poll?communityVersion=${prevCommVer}`);
    assert.equal(pollAfterPut.status, 200);
    assert.equal(pollAfterPut.data.communityChanged, true);
    assert.equal(
      pollAfterPut.data.notes["2026_q099"]?.[studentA.userId]?.text,
      "הערה לבדיקת אינוולידציית cache"
    );

    // DELETE note -> immediately removed in /api/bootstrap and /api/poll
    const delCacheNote = await req("/api/notes/2026_q099", {
      method: "DELETE",
      body: { userId: studentA.userId, clientSecret: studentA.clientSecret },
    });
    assert.equal(delCacheNote.status, 200);

    const bootAfterDel = await req("/api/bootstrap");
    assert.equal(bootAfterDel.status, 200);
    assert.ok(bootAfterDel.data.communityVersion > bootAfterPut.data.communityVersion);
    assert.equal(bootAfterDel.data.notes["2026_q099"]?.[studentA.userId], undefined);

    const pollAfterDel = await req(`/api/poll?communityVersion=${bootAfterPut.data.communityVersion}`);
    assert.equal(pollAfterDel.status, 200);
    assert.equal(pollAfterDel.data.communityChanged, true);
    assert.equal(pollAfterDel.data.notes["2026_q099"]?.[studentA.userId], undefined);

    // Leaderboard Cache: shared base entries for sort=answers and sort=notes
    const lbAnsCache = await req("/api/leaderboard?sort=answers");
    const lbNotesCache = await req("/api/leaderboard?sort=notes");
    assert.equal(lbAnsCache.status, 200);
    assert.equal(lbNotesCache.status, 200);
    assert.equal(lbAnsCache.data.sort, "answers");
    assert.equal(lbNotesCache.data.sort, "notes");
    for (let i = 1; i < lbAnsCache.data.entries.length; i++) {
      assert.ok(lbAnsCache.data.entries[i - 1].solvedCount >= lbAnsCache.data.entries[i].solvedCount);
    }
    for (let i = 1; i < lbNotesCache.data.entries.length; i++) {
      assert.ok(lbNotesCache.data.entries[i - 1].notesCount >= lbNotesCache.data.entries[i].notesCount);
    }

    const baseEntryA = lbAnsCache.data.entries.find((e) => e.userId === studentA.userId);
    assert.ok(baseEntryA);
    const baseSolvedA = baseEntryA.solvedCount;
    const baseNotesA = baseEntryA.notesCount;

    // PUT /api/progress invalidates leaderboard cache immediately
    const addAttemptRes = await req("/api/progress", {
      method: "PUT",
      body: {
        userId: studentA.userId,
        clientSecret: studentA.clientSecret,
        progress: {
          attempts: {
            "2026_q099": { selected: 0, isCorrect: true, ts: Date.now() },
          },
        },
      },
    });
    assert.equal(addAttemptRes.status, 200);
    const lbAfterProg = await req("/api/leaderboard?sort=answers");
    const afterProgA = lbAfterProg.data.entries.find((e) => e.userId === studentA.userId);
    assert.equal(afterProgA.solvedCount, baseSolvedA + 1);

    // PUT /api/notes & DELETE /api/notes invalidate leaderboard cache immediately
    await req("/api/notes/2026_q098", {
      method: "PUT",
      body: {
        userId: studentA.userId,
        clientSecret: studentA.clientSecret,
        author: studentA.name,
        emoji: studentA.emoji,
        category: studentA.category,
        text: "הערת לידרבורד",
      },
    });
    const lbAfterPutNote = await req("/api/leaderboard?sort=notes");
    assert.equal(lbAfterPutNote.data.entries.find((e) => e.userId === studentA.userId).notesCount, baseNotesA + 1);

    await req("/api/notes/2026_q098", {
      method: "DELETE",
      body: { userId: studentA.userId, clientSecret: studentA.clientSecret },
    });
    const lbAfterDelNote = await req("/api/leaderboard?sort=notes");
    assert.equal(lbAfterDelNote.data.entries.find((e) => e.userId === studentA.userId).notesCount, baseNotesA);

    // DELETE /api/admin/notes invalidates leaderboard cache immediately
    await req("/api/notes/2026_q097", {
      method: "PUT",
      body: {
        userId: "u_student_c",
        clientSecret: "secret_ccc_123456",
        author: "מנגו",
        emoji: "🥭",
        category: "פירות",
        text: "הערה למחיקת מנהל",
      },
    });
    const lbBeforeAdminDel = await req("/api/leaderboard?sort=notes");
    const cBeforeAdminDel = lbBeforeAdminDel.data.entries.find((e) => e.userId === "u_student_c");
    assert.ok(cBeforeAdminDel && cBeforeAdminDel.notesCount >= 1);

    await req("/api/admin/notes/2026_q097/u_student_c", {
      method: "DELETE",
      headers: authHeader,
    });
    const lbAfterAdminDel = await req("/api/leaderboard?sort=notes");
    const cAfterAdminDel = lbAfterAdminDel.data.entries.find((e) => e.userId === "u_student_c");
    assert.equal(cAfterAdminDel?.notesCount || 0, cBeforeAdminDel.notesCount - 1);

    // DELETE /api/admin/users invalidates leaderboard cache immediately
    const tempUser = {
      userId: "u_lb_temp",
      name: "אננס",
      emoji: "🍍",
      category: "פירות",
      clientSecret: "secret_temp_lb_123456",
    };
    const putTempProg = await req("/api/progress", {
      method: "PUT",
      body: {
        userId: tempUser.userId,
        clientSecret: tempUser.clientSecret,
        identity: { name: tempUser.name, emoji: tempUser.emoji, category: tempUser.category },
        progress: {
          attempts: { "2026_q001": { selected: 0, isCorrect: true, ts: Date.now() } },
        },
      },
    });
    assert.equal(putTempProg.status, 200);
    const lbWithTemp = await req("/api/leaderboard?sort=answers");
    assert.ok(lbWithTemp.data.entries.some((e) => e.userId === tempUser.userId));

    const delTempUser = await req(`/api/admin/users/${tempUser.userId}`, {
      method: "DELETE",
      headers: authHeader,
    });
    assert.equal(delTempUser.status, 200);
    const lbWithoutTemp = await req("/api/leaderboard?sort=answers");
    assert.equal(lbWithoutTemp.data.entries.some((e) => e.userId === tempUser.userId), false);

    console.log("✓ Community cache & leaderboard cache + invalidation OK");
  }

  // 8e. User #201+ beyond the 200-nickname catalog (load, register, note/progress save, reload)
  {
    const authHeader = { Authorization: `Bearer ${adminToken}` };
    const appSource = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
    const catalogMatch = appSource.match(/const IDENTITY_CATALOG = (\[[\s\S]*?\n  \]);/);
    assert.ok(catalogMatch, "IDENTITY_CATALOG must exist in app.js");
    const catalog = vm.runInNewContext(catalogMatch[1]);
    assert.equal(catalog.length, 200, "Expected 200 base identities in IDENTITY_CATALOG");
    const bootBeforeFill = await req("/api/bootstrap");
    assert.equal(bootBeforeFill.status, 200);
    const existingTaken = bootBeforeFill.data.takenNames || {};

    // Fill all remaining base names in IDENTITY_CATALOG so 200 base identities are occupied
    const missingItems = catalog.filter((item) => !existingTaken[item.name]);
    const batchSize = 25;
    for (let i = 0; i < missingItems.length; i += batchSize) {
      const chunk = missingItems.slice(i, i + batchSize);
      const responses = await Promise.all(
        chunk.map((item, idx) =>
          req("/api/identities/ping", {
            method: "POST",
            body: {
              userId: `u_fill_${i + idx}`,
              name: item.name,
              emoji: item.emoji,
              category: item.category,
              clientSecret: `secret_fill_${i + idx}_123456`,
            },
          })
        )
      );
      for (const res of responses) {
        assert.equal(res.status, 200, `Filling base identity failed with status ${res.status}`);
      }
    }

    const bootFull = await req("/api/bootstrap");
    assert.equal(bootFull.status, 200);
    for (const item of catalog) {
      assert.ok(bootFull.data.takenNames[item.name], `Base identity "${item.name}" should be marked taken`);
    }

    // User #201 tries claiming a taken base name -> 409 conflict with all 200+ takenNames
    const user201 = {
      userId: "u_student_201",
      name: "תפוח 2",
      emoji: "🍎",
      category: "פירות",
      clientSecret: "secret_201_abcdef1234",
      syncCode: "2345-6789-ABCD",
    };

    const baseAttempt = await req("/api/identities/ping", {
      method: "POST",
      body: { ...user201, name: "תפוח" },
    });
    assert.equal(baseAttempt.status, 409);
    assert.equal(baseAttempt.data.conflict, true);
    assert.ok(Object.keys(baseAttempt.data.takenNames).length >= 200);

    // User #201 registers with suffixed name "תפוח 2"
    const reg201 = await req("/api/identities/ping", {
      method: "POST",
      body: {
        userId: user201.userId,
        name: user201.name,
        emoji: user201.emoji,
        category: user201.category,
        clientSecret: user201.clientSecret,
      },
    });
    assert.equal(reg201.status, 200);
    assert.equal(reg201.data.conflict, false);

    // Register sync code for user #201
    const syncReg201 = await req("/api/sync/register-code", {
      method: "POST",
      body: {
        userId: user201.userId,
        clientSecret: user201.clientSecret,
        syncCode: user201.syncCode,
        name: user201.name,
        emoji: user201.emoji,
        category: user201.category,
      },
    });
    assert.equal(syncReg201.status, 200);

    // User #201 saves a note and progress
    const note201 = await req("/api/notes/2026_q201", {
      method: "PUT",
      body: {
        userId: user201.userId,
        clientSecret: user201.clientSecret,
        author: user201.name,
        emoji: user201.emoji,
        category: user201.category,
        text: "הערה ממשתמש 201 עם סיומת מספרית",
      },
    });
    assert.equal(note201.status, 200);

    const prog201 = await req("/api/progress", {
      method: "PUT",
      body: {
        userId: user201.userId,
        clientSecret: user201.clientSecret,
        identity: {
          name: user201.name,
          emoji: user201.emoji,
          category: user201.category,
        },
        progress: {
          attempts: {
            "2026_q201": { selected: 2, isCorrect: true, ts: Date.now() },
          },
        },
      },
    });
    assert.equal(prog201.status, 200);
    assert.equal(prog201.data.progress.identity.name, "תפוח 2");

    // Simulate reload: ping identity again, pull progress, check bootstrap & admin users list
    const reloadPing = await req("/api/identities/ping", {
      method: "POST",
      body: {
        userId: user201.userId,
        name: user201.name,
        emoji: user201.emoji,
        category: user201.category,
        clientSecret: user201.clientSecret,
      },
    });
    assert.equal(reloadPing.status, 200);
    assert.equal(reloadPing.data.conflict, false);

    const reloadProg = await req("/api/progress", {
      headers: {
        "X-User-Id": user201.userId,
        "X-Client-Secret": user201.clientSecret,
      },
    });
    assert.equal(reloadProg.status, 200);
    assert.equal(reloadProg.data.progress.identity.name, "תפוח 2");
    assert.equal(reloadProg.data.progress.attempts["2026_q201"]?.selected, 2);

    const bootAfter201 = await req("/api/bootstrap");
    assert.equal(bootAfter201.status, 200);
    assert.equal(bootAfter201.data.takenNames["תפוח 2"], user201.userId);
    assert.equal(bootAfter201.data.notes["2026_q201"]?.[user201.userId]?.author, "תפוח 2");
    assert.equal(bootAfter201.data.notes["2026_q201"]?.[user201.userId]?.text, "הערה ממשתמש 201 עם סיומת מספרית");

    const adminUsersAfter201 = await req("/api/admin/users", { headers: authHeader });
    assert.equal(adminUsersAfter201.status, 200);
    assert.ok(adminUsersAfter201.data.users.length >= 201);
    const adminRow201 = adminUsersAfter201.data.users.find((u) => u.userId === user201.userId);
    assert.ok(adminRow201, "User #201 must appear in /api/admin/users");
    assert.equal(adminRow201.name, "תפוח 2");
    assert.equal(adminRow201.notesCount, 1);
    assert.equal(adminRow201.solvedCount, 1);
    assert.equal(adminRow201.hasSyncCode, true);

    // User #202 colliding on "תפוח 2" gets 409, then registers "תפוח 3"
    const conflict202 = await req("/api/identities/ping", {
      method: "POST",
      body: {
        userId: "u_student_202",
        name: "תפוח 2",
        emoji: "🍎",
        category: "פירות",
        clientSecret: "secret_202_abcdef1234",
      },
    });
    assert.equal(conflict202.status, 409);
    assert.equal(conflict202.data.takenNames["תפוח 2"], user201.userId);

    const reg202 = await req("/api/identities/ping", {
      method: "POST",
      body: {
        userId: "u_student_202",
        name: "תפוח 3",
        emoji: "🍎",
        category: "פירות",
        clientSecret: "secret_202_abcdef1234",
      },
    });
    assert.equal(reg202.status, 200);

    console.log("✓ User #201+ suffixed identity, note/progress persistence & reload OK");
  }

  // 9. Rate-limit lockout after 5 consecutive wrong password attempts
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
