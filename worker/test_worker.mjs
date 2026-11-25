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
    assert.equal(typeof b.data.communityVersion, "number");
    assert.ok(b.data.communityVersion >= 1);
    assert.equal(typeof b.data.notes, "object");
    assert.equal(typeof b.data.noteFlags, "object");
    assert.equal(typeof b.data.problems, "object");
    assert.equal(typeof b.data.overrides, "object");
    assert.equal(typeof b.data.takenNames, "object");
    assert.ok(Array.isArray(b.data.onlineUsers));

    const onlineRes = await req("/api/online");
    assert.equal(onlineRes.status, 200);
    assert.equal(onlineRes.data.ok, true);
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
      ["DELETE", "/api/admin/users/u_fake"],
      ["PUT", "/api/admin/overrides/2026_q001", { hidden: true }],
      ["DELETE", "/api/admin/overrides/2026_q001"],
      ["DELETE", "/api/admin/notes/2026_q001/u_fake"],
      ["DELETE", "/api/admin/note-flags/2026_q001/u_fake"],
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

  // 8b. Community note inaccuracy flags
  {
    const flagger = {
      userId: "u_student_c",
      name: "מנגו",
      emoji: "🥭",
      category: "פירות",
      clientSecret: "secret_ccc_123456",
    };
    const pollBefore = await req("/api/poll");
    const vBefore = pollBefore.data.communityVersion;

    // Student A cannot flag own note (2026_q010 created in step 8)
    const selfFlag = await req(`/api/note-flags/2026_q010/${studentA.userId}`, {
      method: "PUT",
      body: {
        userId: studentA.userId,
        clientSecret: studentA.clientSecret,
        author: studentA.name,
        emoji: studentA.emoji,
        category: studentA.category,
      },
    });
    assert.equal(selfFlag.status, 400, "Cannot flag own note");

    // Flagging non-existent note returns 404
    const missingNoteFlag = await req(`/api/note-flags/2026_q999/${studentA.userId}`, {
      method: "PUT",
      body: {
        userId: flagger.userId,
        clientSecret: flagger.clientSecret,
        author: flagger.name,
        emoji: flagger.emoji,
        category: flagger.category,
      },
    });
    assert.equal(missingNoteFlag.status, 404);

    // Flagger flags Student A's note
    const flagRes = await req(`/api/note-flags/2026_q010/${studentA.userId}`, {
      method: "PUT",
      body: {
        userId: flagger.userId,
        clientSecret: flagger.clientSecret,
        author: flagger.name,
        emoji: flagger.emoji,
        category: flagger.category,
      },
    });
    assert.equal(flagRes.status, 200);
    assert.equal(flagRes.data.ok, true);

    const pollAfterFlag = await req(`/api/poll?communityVersion=${vBefore}`);
    assert.equal(pollAfterFlag.status, 200);
    assert.equal(pollAfterFlag.data.communityChanged, true);
    assert.equal(pollAfterFlag.data.noteFlags["2026_q010"][studentA.userId][flagger.userId].author, flagger.name);

    // Flagger unflags Student A's note
    const unflagRes = await req(`/api/note-flags/2026_q010/${studentA.userId}`, {
      method: "DELETE",
      body: {
        userId: flagger.userId,
        clientSecret: flagger.clientSecret,
      },
    });
    assert.equal(unflagRes.status, 200);
    assert.equal(unflagRes.data.deleted, true);

    // Re-flag then test admin clear flags + note deletion cascade
    await req(`/api/note-flags/2026_q010/${studentA.userId}`, {
      method: "PUT",
      body: {
        userId: flagger.userId,
        clientSecret: flagger.clientSecret,
        author: flagger.name,
        emoji: flagger.emoji,
        category: flagger.category,
      },
    });
    const adminClearRes = await req(`/api/admin/note-flags/2026_q010/${studentA.userId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(adminClearRes.status, 200);
    const bootAfterClear = await req("/api/bootstrap");
    assert.equal(bootAfterClear.data.noteFlags["2026_q010"]?.[studentA.userId], undefined);

    // Re-flag then delete note -> flags cascade-deleted
    await req(`/api/note-flags/2026_q010/${studentA.userId}`, {
      method: "PUT",
      body: {
        userId: flagger.userId,
        clientSecret: flagger.clientSecret,
        author: flagger.name,
        emoji: flagger.emoji,
        category: flagger.category,
      },
    });
    const delNoteRes = await req("/api/notes/2026_q010", {
      method: "DELETE",
      body: { userId: studentA.userId, clientSecret: studentA.clientSecret },
    });
    assert.equal(delNoteRes.status, 200);
    const bootAfterDelNote = await req("/api/bootstrap");
    assert.equal(bootAfterDelNote.data.noteFlags["2026_q010"]?.[studentA.userId], undefined);

    console.log("✓ Community note inaccuracy flags (flag/unflag/admin-clear/cascade) OK");
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
