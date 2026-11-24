const TOKEN_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days
const RATE_LIMIT_MAX_ATTEMPTS = 5;
const RATE_LIMIT_LOCK_MS = 10 * 60 * 1000; // 10 minutes
const SYNC_RATE_LIMIT_MAX_ATTEMPTS = 10;
const SYNC_RATE_LIMIT_LOCK_MS = 10 * 60 * 1000; // 10 minutes
const SYNC_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const SYNC_CODE_REGEX = /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{12}$/;
const MAX_PROGRESS_JSON_BYTES = 1500 * 1024;
const VALID_PROBLEM_TYPES = new Set(["question_issue", "distractor_issue", "out_of_material"]);
const ONLINE_WINDOW_MS = 3 * 60 * 1000; // 3 minutes active presence window
const PRESENCE_TOUCH_INTERVAL_MS = 60 * 1000; // Throttle last_seen_at writes to once per minute

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-User-Id, X-Client-Secret",
  "Access-Control-Max-Age": "86400",
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...CORS_HEADERS,
    },
  });
}

function errorResponse(message, status = 400, extra = {}) {
  return jsonResponse({ ok: false, error: message, ...extra }, status);
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function toBase64Url(bytes) {
  let binary = "";
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i++) {
    binary += String.fromCharCode(arr[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(str) {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((str.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function sha256Bytes(value) {
  const buf = await crypto.subtle.digest("SHA-256", textEncoder.encode(String(value)));
  return new Uint8Array(buf);
}

async function sha256Hex(value) {
  const bytes = await sha256Bytes(value);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

async function getHmacKey(env) {
  const secretSource = env.TOKEN_SECRET || `mikbatz1-hmac-v1:${env.ADMIN_PASSWORD || ""}`;
  const rawKey = await sha256Bytes(secretSource);
  return crypto.subtle.importKey(
    "raw",
    rawKey,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

async function issueAdminToken(env) {
  const now = Date.now();
  const expiresAt = now + TOKEN_TTL_MS;
  const headerB64 = toBase64Url(textEncoder.encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const payloadB64 = toBase64Url(textEncoder.encode(JSON.stringify({ sub: "admin", iat: now, exp: expiresAt })));
  const signingInput = `${headerB64}.${payloadB64}`;
  const key = await getHmacKey(env);
  const sig = await crypto.subtle.sign("HMAC", key, textEncoder.encode(signingInput));
  return {
    token: `${signingInput}.${toBase64Url(sig)}`,
    expiresAt,
  };
}

async function verifyAdminToken(request, env) {
  if (!env.ADMIN_PASSWORD || !String(env.ADMIN_PASSWORD).trim()) {
    return { valid: false, status: 503, error: "ADMIN_PASSWORD is not configured on server" };
  }
  const authHeader = request.headers.get("Authorization") || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return { valid: false, status: 401, error: "Missing Authorization token" };
  }
  const parts = match[1].trim().split(".");
  if (parts.length !== 3) {
    return { valid: false, status: 401, error: "Malformed token" };
  }
  const [headerB64, payloadB64, sigB64] = parts;
  let sigBytes;
  try {
    sigBytes = fromBase64Url(sigB64);
  } catch {
    return { valid: false, status: 401, error: "Invalid token encoding" };
  }
  const key = await getHmacKey(env);
  const ok = await crypto.subtle.verify(
    "HMAC",
    key,
    sigBytes,
    textEncoder.encode(`${headerB64}.${payloadB64}`)
  );
  if (!ok) {
    return { valid: false, status: 401, error: "Invalid token signature" };
  }
  try {
    const payload = JSON.parse(textDecoder.decode(fromBase64Url(payloadB64)));
    if (payload?.sub !== "admin" || typeof payload.exp !== "number" || payload.exp <= Date.now()) {
      return { valid: false, status: 401, error: "Token expired" };
    }
    return { valid: true, expiresAt: payload.exp };
  } catch {
    return { valid: false, status: 401, error: "Invalid token payload" };
  }
}

async function readJsonBody(request) {
  try {
    const text = await request.text();
    if (!text || !text.trim()) return {};
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function getClientIp(request) {
  return (
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
    "local-dev"
  );
}

function parseJsonSafe(raw, fallback) {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function formatOverrideRow(row) {
  if (!row) return null;
  const obj = {
    hidden: Boolean(row.hidden),
    updatedAt: Number(row.updated_at) || 0,
  };
  if (row.stem !== null && row.stem !== undefined) obj.stem = row.stem;
  if (row.options_json !== null && row.options_json !== undefined) {
    const parsed = parseJsonSafe(row.options_json, null);
    if (Array.isArray(parsed)) obj.options = parsed;
  }
  if (row.correct_json !== null && row.correct_json !== undefined) {
    const parsed = parseJsonSafe(row.correct_json, null);
    if (Array.isArray(parsed)) obj.correct = parsed;
  }
  if (row.all_accepted !== null && row.all_accepted !== undefined) {
    obj.allAccepted = Boolean(row.all_accepted);
  }
  if (row.appeal_note !== null && row.appeal_note !== undefined) {
    obj.appealNote = row.appeal_note;
  }
  if (row.subject !== null && row.subject !== undefined) {
    obj.subject = row.subject;
  }
  return obj;
}

async function getTakenNamesMap(db) {
  const { results } = await db.prepare("SELECT user_id, name FROM identities").all();
  const takenNames = {};
  for (const row of results || []) {
    if (row.name && row.user_id) {
      takenNames[row.name] = row.user_id;
    }
  }
  return takenNames;
}

async function getOnlineUsersList(db, now = Date.now()) {
  const cutoff = now - ONLINE_WINDOW_MS;
  const { results } = await db
    .prepare(
      `SELECT user_id, name, emoji, category, last_seen_at
       FROM identities
       WHERE last_seen_at >= ? AND name != ''
       ORDER BY last_seen_at DESC`
    )
    .bind(cutoff)
    .all();
  return (results || []).map((row) => ({
    userId: row.user_id,
    name: row.name,
    emoji: row.emoji,
    category: row.category || "",
    lastSeenAt: Number(row.last_seen_at) || 0,
  }));
}

function normalizeSyncCode(raw) {
  if (typeof raw !== "string") return null;
  let str = raw.trim();
  const hashMatch = str.match(/#sync=([^&\s]+)/i);
  if (hashMatch) str = hashMatch[1];
  const clean = str.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return SYNC_CODE_REGEX.test(clean) ? clean : null;
}

function summarizeProgress(prog) {
  const safe = prog && typeof prog === "object" ? prog : {};
  const solvedCount = safe.attempts && typeof safe.attempts === "object" ? Object.keys(safe.attempts).length : 0;
  const notesCount = safe.notes && typeof safe.notes === "object"
    ? Object.values(safe.notes).filter((t) => typeof t === "string" && t.trim()).length
    : 0;
  const flagsCount = safe.flags && typeof safe.flags === "object"
    ? Object.values(safe.flags).filter((f) => f && (f.star || f.unsure || f.problem)).length
    : 0;
  return { solvedCount, notesCount, flagsCount };
}

function mergeProgressPayloads(base, incoming) {
  const b = base && typeof base === "object" ? base : {};
  const i = incoming && typeof incoming === "object" ? incoming : {};
  const resetAt = Math.max(Number(b.resetAt) || 0, Number(i.resetAt) || 0);

  const merged = {
    identity: i.identity || b.identity || null,
    attempts: {},
    clearedAttempts: {},
    flags: {},
    flagUpdatedAt: {},
    notes: {},
    noteUpdatedAt: {},
    struck: {},
    struckUpdatedAt: {},
    drillStreak: {},
    drillStreakUpdatedAt: {},
    dailyStats: {},
    dailyStatsByDevice: {},
    dailyStatsUpdatedAt: 0,
    resetAt,
  };

  // 1. Attempts + clearedAttempts tombstones
  const attemptIds = new Set([
    ...Object.keys(b.attempts || {}),
    ...Object.keys(i.attempts || {}),
    ...Object.keys(b.clearedAttempts || {}),
    ...Object.keys(i.clearedAttempts || {}),
  ]);
  for (const qId of attemptIds) {
    const bAtt = b.attempts?.[qId];
    const iAtt = i.attempts?.[qId];
    const bAttTs = bAtt && typeof bAtt === "object" && bAtt.selected !== undefined ? Number(bAtt.ts) || 1 : 0;
    const iAttTs = iAtt && typeof iAtt === "object" && iAtt.selected !== undefined ? Number(iAtt.ts) || 1 : 0;
    const bestAtt = iAttTs >= bAttTs ? (iAttTs > 0 ? { ...iAtt, ts: iAttTs } : null) : { ...bAtt, ts: bAttTs };
    const bestAttTs = bestAtt ? bestAtt.ts : 0;

    const bClr = Number(b.clearedAttempts?.[qId]) || 0;
    const iClr = Number(i.clearedAttempts?.[qId]) || 0;
    const maxItemClr = Math.max(bClr, iClr);
    const effectiveClr = Math.max(resetAt, maxItemClr);

    if (bestAtt && bestAttTs > effectiveClr) {
      merged.attempts[qId] = bestAtt;
    } else if (maxItemClr > resetAt) {
      merged.clearedAttempts[qId] = maxItemClr;
    }
  }

  // 2. Flags (star, unsure, problem) per-flag timestamp
  const flagKeys = ["star", "unsure", "problem"];
  const flagQIds = new Set([
    ...Object.keys(b.flags || {}),
    ...Object.keys(i.flags || {}),
    ...Object.keys(b.flagUpdatedAt || {}),
    ...Object.keys(i.flagUpdatedAt || {}),
  ]);
  for (const qId of flagQIds) {
    const outFlags = {};
    const outTs = {};
    for (const fk of flagKeys) {
      const bVal = Boolean(b.flags?.[qId]?.[fk]);
      const bRawTs = Number(b.flagUpdatedAt?.[qId]?.[fk]) || 0;
      const bTs = bRawTs > 0 ? bRawTs : bVal ? 1 : 0;

      const iVal = Boolean(i.flags?.[qId]?.[fk]);
      const iRawTs = Number(i.flagUpdatedAt?.[qId]?.[fk]) || 0;
      const iTs = iRawTs > 0 ? iRawTs : iVal ? 1 : 0;

      const winTs = Math.max(bTs, iTs);
      if (winTs <= resetAt) continue;
      const winVal = iTs >= bTs ? iVal : bVal;
      if (winVal) outFlags[fk] = true;
      outTs[fk] = winTs;
    }
    if (Object.keys(outFlags).length > 0) merged.flags[qId] = outFlags;
    if (Object.keys(outTs).length > 0) merged.flagUpdatedAt[qId] = outTs;
  }

  // 3. Struck options per question
  const struckQIds = new Set([
    ...Object.keys(b.struck || {}),
    ...Object.keys(i.struck || {}),
    ...Object.keys(b.struckUpdatedAt || {}),
    ...Object.keys(i.struckUpdatedAt || {}),
  ]);
  for (const qId of struckQIds) {
    const bArr = Array.isArray(b.struck?.[qId]) ? b.struck[qId] : null;
    const bRawTs = Number(b.struckUpdatedAt?.[qId]) || 0;
    const bTs = bRawTs > 0 ? bRawTs : bArr && bArr.length > 0 ? 1 : 0;

    const iArr = Array.isArray(i.struck?.[qId]) ? i.struck[qId] : null;
    const iRawTs = Number(i.struckUpdatedAt?.[qId]) || 0;
    const iTs = iRawTs > 0 ? iRawTs : iArr && iArr.length > 0 ? 1 : 0;

    const winTs = Math.max(bTs, iTs);
    if (winTs <= resetAt) continue;
    const winArr = iTs >= bTs ? iArr : bArr;
    if (winArr && winArr.length > 0) {
      merged.struck[qId] = Array.from(new Set(winArr));
    }
    merged.struckUpdatedAt[qId] = winTs;
  }

  // 4. Drill streak per question
  const streakQIds = new Set([
    ...Object.keys(b.drillStreak || {}),
    ...Object.keys(i.drillStreak || {}),
    ...Object.keys(b.drillStreakUpdatedAt || {}),
    ...Object.keys(i.drillStreakUpdatedAt || {}),
  ]);
  for (const qId of streakQIds) {
    const bVal = Number(b.drillStreak?.[qId]) || 0;
    const bRawTs = Number(b.drillStreakUpdatedAt?.[qId]) || 0;
    const bTs = bRawTs > 0 ? bRawTs : bVal > 0 ? 1 : 0;

    const iVal = Number(i.drillStreak?.[qId]) || 0;
    const iRawTs = Number(i.drillStreakUpdatedAt?.[qId]) || 0;
    const iTs = iRawTs > 0 ? iRawTs : iVal > 0 ? 1 : 0;

    const winTs = Math.max(bTs, iTs);
    if (winTs <= resetAt) continue;
    const winVal = iTs >= bTs ? iVal : bVal;
    if (winVal > 0) merged.drillStreak[qId] = winVal;
    merged.drillStreakUpdatedAt[qId] = winTs;
  }

  // 5. Personal notes per question
  const noteQIds = new Set([
    ...Object.keys(b.notes || {}),
    ...Object.keys(i.notes || {}),
    ...Object.keys(b.noteUpdatedAt || {}),
    ...Object.keys(i.noteUpdatedAt || {}),
  ]);
  for (const qId of noteQIds) {
    const bVal = typeof b.notes?.[qId] === "string" ? b.notes[qId] : "";
    const bRawTs = Number(b.noteUpdatedAt?.[qId]) || 0;
    const bTs = bRawTs > 0 ? bRawTs : bVal.trim() ? 1 : 0;

    const iVal = typeof i.notes?.[qId] === "string" ? i.notes[qId] : "";
    const iRawTs = Number(i.noteUpdatedAt?.[qId]) || 0;
    const iTs = iRawTs > 0 ? iRawTs : iVal.trim() ? 1 : 0;

    const winTs = Math.max(bTs, iTs);
    if (winTs <= resetAt) continue;
    const winVal = iTs >= bTs ? iVal : bVal;
    if (winVal.trim()) merged.notes[qId] = winVal;
    merged.noteUpdatedAt[qId] = winTs;
  }

  // 6. Daily stats per device -> summed into dailyStats
  const getSideDailyByDevice = (side) => {
    const rawByDev = side.dailyStatsByDevice && typeof side.dailyStatsByDevice === "object"
      ? side.dailyStatsByDevice
      : {};
    const hasByDev = Object.keys(rawByDev).length > 0;
    const rawDaily = side.dailyStats && typeof side.dailyStats === "object" ? side.dailyStats : {};
    const hasDaily = Object.keys(rawDaily).length > 0;
    const sideTs = Number(side.dailyStatsUpdatedAt) || (hasByDev || hasDaily ? 1 : 0);
    if (sideTs <= resetAt) return { byDev: {}, ts: 0 };
    if (hasByDev) return { byDev: rawByDev, ts: sideTs };
    if (hasDaily) return { byDev: { _legacy: rawDaily }, ts: sideTs };
    return { byDev: {}, ts: sideTs };
  };

  const bDaily = getSideDailyByDevice(b);
  const iDaily = getSideDailyByDevice(i);
  merged.dailyStatsUpdatedAt = Math.max(bDaily.ts, iDaily.ts);

  for (const devMap of [bDaily.byDev, iDaily.byDev]) {
    for (const [devId, byDate] of Object.entries(devMap)) {
      if (!byDate || typeof byDate !== "object") continue;
      if (!merged.dailyStatsByDevice[devId]) merged.dailyStatsByDevice[devId] = {};
      for (const [dateKey, entry] of Object.entries(byDate)) {
        if (!entry || typeof entry !== "object") continue;
        const ans = Math.max(0, Number(entry.answered) || 0);
        const cor = Math.max(0, Math.min(ans, Number(entry.correct) || 0));
        const cur = merged.dailyStatsByDevice[devId][dateKey] || { answered: 0, correct: 0 };
        merged.dailyStatsByDevice[devId][dateKey] = {
          answered: Math.max(cur.answered, ans),
          correct: Math.max(cur.correct, cor),
        };
      }
    }
  }

  for (const byDate of Object.values(merged.dailyStatsByDevice)) {
    for (const [dateKey, entry] of Object.entries(byDate)) {
      if (!merged.dailyStats[dateKey]) {
        merged.dailyStats[dateKey] = { answered: 0, correct: 0 };
      }
      merged.dailyStats[dateKey].answered += entry.answered;
      merged.dailyStats[dateKey].correct += entry.correct;
    }
  }

  return merged;
}

async function verifyAgainstExistingIdentity(db, existing, userId, secretHash, touchPresence = true) {
  const now = Date.now();
  const identityStale = now - Number(existing.last_seen_at || 0) >= PRESENCE_TOUCH_INTERVAL_MS;

  if (existing.client_secret_hash && existing.client_secret_hash === secretHash) {
    if (touchPresence && identityStale) {
      await db.prepare("UPDATE identities SET last_seen_at = ? WHERE user_id = ?").bind(now, userId).run();
    }
    return { ok: true, secretHash, identity: existing };
  }

  const deviceRow = await db
    .prepare("SELECT secret_hash, last_seen_at FROM user_device_secrets WHERE secret_hash = ? AND user_id = ?")
    .bind(secretHash, userId)
    .first();

  if (deviceRow) {
    if (touchPresence) {
      const updates = [];
      if (now - Number(deviceRow.last_seen_at || 0) >= PRESENCE_TOUCH_INTERVAL_MS) {
        updates.push(
          db.prepare("UPDATE user_device_secrets SET last_seen_at = ? WHERE secret_hash = ?").bind(now, secretHash).run()
        );
      }
      if (identityStale) {
        updates.push(db.prepare("UPDATE identities SET last_seen_at = ? WHERE user_id = ?").bind(now, userId).run());
      }
      if (updates.length > 0) {
        await Promise.all(updates);
      }
    }
    return { ok: true, secretHash, identity: existing };
  }

  if (!existing.client_secret_hash) {
    await db
      .prepare("UPDATE identities SET client_secret_hash = ?, last_seen_at = ? WHERE user_id = ?")
      .bind(secretHash, now, userId)
      .run();
    return { ok: true, secretHash, identity: existing };
  }

  return { ok: false, status: 403, error: "Forbidden: clientSecret mismatch" };
}

async function verifyExistingClientSecret(db, userId, clientSecret, options = {}) {
  const { touchPresence = true } = options || {};
  if (!userId || typeof userId !== "string" || userId.length > 80) {
    return { ok: false, status: 400, error: "Invalid userId" };
  }
  if (!clientSecret || typeof clientSecret !== "string" || clientSecret.length < 8 || clientSecret.length > 256) {
    return { ok: false, status: 403, error: "Missing or invalid clientSecret" };
  }

  const secretHash = await sha256Hex(clientSecret);
  const existing = await db
    .prepare(
      "SELECT user_id, name, emoji, category, client_secret_hash, sync_code_hash, last_seen_at FROM identities WHERE user_id = ?"
    )
    .bind(userId)
    .first();

  if (!existing) {
    return { ok: false, status: 404, error: "Identity not found" };
  }

  return verifyAgainstExistingIdentity(db, existing, userId, secretHash, touchPresence);
}

async function verifyOrBindClientSecret(db, userId, clientSecret, identityInfo = null, options = {}) {
  const { touchPresence = true } = options || {};
  if (!userId || typeof userId !== "string" || userId.length > 80) {
    return { ok: false, status: 400, error: "Invalid userId" };
  }
  if (!clientSecret || typeof clientSecret !== "string" || clientSecret.length < 8 || clientSecret.length > 256) {
    return { ok: false, status: 403, error: "Missing or invalid clientSecret" };
  }

  const secretHash = await sha256Hex(clientSecret);
  const existing = await db
    .prepare(
      "SELECT user_id, name, emoji, category, client_secret_hash, sync_code_hash, last_seen_at FROM identities WHERE user_id = ?"
    )
    .bind(userId)
    .first();

  if (existing) {
    return verifyAgainstExistingIdentity(db, existing, userId, secretHash, touchPresence);
  }

  // First time seeing this userId — create identity row if info is provided
  const now = Date.now();
  const name = String(identityInfo?.name || "").trim();
  const emoji = String(identityInfo?.emoji || "👤").trim();
  const category = String(identityInfo?.category || "").trim();
  if (name) {
    const conflictRow = await db
      .prepare("SELECT user_id FROM identities WHERE name = ? AND user_id != ?")
      .bind(name, userId)
      .first();
    if (conflictRow) {
      return { ok: false, status: 409, conflict: true, error: "Nickname already taken" };
    }
    await db
      .prepare(
        `INSERT INTO identities (user_id, name, emoji, category, client_secret_hash, first_seen_at, last_seen_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(userId, name, emoji, category, secretHash, now, now)
      .run();
    const created = await db
      .prepare(
        "SELECT user_id, name, emoji, category, client_secret_hash, sync_code_hash, last_seen_at FROM identities WHERE user_id = ?"
      )
      .bind(userId)
      .first();
    return { ok: true, secretHash, identity: created };
  }
  return { ok: true, secretHash, identity: null };
}

async function getCommunityVersion(db) {
  const row = await db.prepare("SELECT community_version FROM sync_meta WHERE id = 1").first();
  return Number(row?.community_version) || 1;
}

async function bumpCommunityVersion(db, now = Date.now()) {
  await db
    .prepare(
      `INSERT INTO sync_meta (id, community_version, updated_at)
       VALUES (1, 2, ?)
       ON CONFLICT(id) DO UPDATE SET
         community_version = community_version + 1,
         updated_at = excluded.updated_at`
    )
    .bind(now)
    .run();
}

async function fetchCommunityData(db) {
  const [notesRes, probsRes, overridesRes] = await Promise.all([
    db.prepare("SELECT q_id, user_id, author, emoji, category, text, updated_at FROM community_notes").all(),
    db.prepare("SELECT q_id, user_id, type, text, author, emoji, category, updated_at FROM community_problems").all(),
    db.prepare(
      "SELECT q_id, hidden, stem, options_json, correct_json, all_accepted, appeal_note, subject, updated_at FROM question_overrides"
    ).all(),
  ]);

  const notes = {};
  for (const r of notesRes.results || []) {
    if (!notes[r.q_id]) notes[r.q_id] = {};
    notes[r.q_id][r.user_id] = {
      author: r.author,
      emoji: r.emoji,
      category: r.category,
      text: r.text,
      updatedAt: Number(r.updated_at) || 0,
    };
  }

  const problems = {};
  for (const r of probsRes.results || []) {
    if (!problems[r.q_id]) problems[r.q_id] = {};
    problems[r.q_id][r.user_id] = {
      type: r.type,
      text: r.text,
      author: r.author,
      emoji: r.emoji,
      category: r.category,
      updatedAt: Number(r.updated_at) || 0,
    };
  }

  const overrides = {};
  for (const r of overridesRes.results || []) {
    overrides[r.q_id] = formatOverrideRow(r);
  }

  return { notes, problems, overrides };
}

async function handleBootstrap(env) {
  const now = Date.now();
  const [communityVersion, communityData, takenNames, onlineUsers] = await Promise.all([
    getCommunityVersion(env.DB),
    fetchCommunityData(env.DB),
    getTakenNamesMap(env.DB),
    getOnlineUsersList(env.DB, now),
  ]);

  return jsonResponse({
    ok: true,
    communityVersion,
    ...communityData,
    takenNames,
    onlineUsers,
    serverTime: now,
  });
}

async function handlePoll(request, env) {
  const url = new URL(request.url);
  const clientCommunityVersion = Math.max(0, Number.parseInt(url.searchParams.get("communityVersion") || "0", 10) || 0);
  const clientProgressVersion = Math.max(0, Number.parseInt(url.searchParams.get("progressVersion") || "0", 10) || 0);
  const touchPresence = url.searchParams.get("touchPresence") !== "0";

  const userId = String(request.headers.get("X-User-Id") || "").trim();
  const clientSecret = String(request.headers.get("X-Client-Secret") || "");
  const hasAuthHeaders = Boolean(userId && clientSecret);

  const [serverCommunityVersion, auth] = await Promise.all([
    getCommunityVersion(env.DB),
    hasAuthHeaders ? verifyExistingClientSecret(env.DB, userId, clientSecret, { touchPresence }) : Promise.resolve(null),
  ]);

  const now = Date.now();
  const communityChanged = serverCommunityVersion !== clientCommunityVersion;

  const [onlineUsers, communityData, progressRow] = await Promise.all([
    getOnlineUsersList(env.DB, now),
    communityChanged ? fetchCommunityData(env.DB) : Promise.resolve(null),
    auth && auth.ok
      ? env.DB
          .prepare(
            `SELECT
               version,
               updated_at,
               CASE WHEN version != ? THEN progress_json ELSE NULL END AS progress_json
             FROM user_progress
             WHERE user_id = ?`
          )
          .bind(clientProgressVersion, userId)
          .first()
      : Promise.resolve(null),
  ]);

  const payload = {
    ok: true,
    serverTime: now,
    communityVersion: serverCommunityVersion,
    communityChanged,
    onlineUsers,
  };

  if (communityChanged && communityData) {
    payload.notes = communityData.notes;
    payload.problems = communityData.problems;
    payload.overrides = communityData.overrides;
  }

  if (hasAuthHeaders && auth) {
    if (!auth.ok) {
      if (auth.status === 404) {
        payload.progressStatus = 200;
        payload.progressChanged = false;
        payload.progressVersion = 0;
        payload.progressUpdatedAt = 0;
        payload.hasServerProgress = false;
      } else {
        payload.progressStatus = auth.status;
        payload.progressChanged = false;
        payload.progressError = auth.error;
      }
    } else if (!progressRow) {
      payload.progressStatus = 200;
      payload.progressChanged = false;
      payload.progressVersion = 0;
      payload.progressUpdatedAt = 0;
      payload.hasServerProgress = false;
    } else {
      const serverProgressVersion = Number(progressRow.version) || 1;
      const progressChanged = serverProgressVersion !== clientProgressVersion;
      payload.progressStatus = 200;
      payload.progressChanged = progressChanged;
      payload.progressVersion = serverProgressVersion;
      payload.progressUpdatedAt = Number(progressRow.updated_at) || 0;
      payload.hasServerProgress = true;
      if (progressChanged) {
        payload.progress = parseJsonSafe(progressRow.progress_json, {});
      }
    }
  }

  return jsonResponse(payload);
}

async function handleOnlineUsers(env) {
  const now = Date.now();
  const onlineUsers = await getOnlineUsersList(env.DB, now);
  return jsonResponse({
    ok: true,
    onlineUsers,
    windowMs: ONLINE_WINDOW_MS,
    serverTime: now,
  });
}

async function handleLeaderboard(env, sortBy = "answers") {
  const now = Date.now();
  const { results } = await env.DB
    .prepare(
      `SELECT
         i.user_id AS userId,
         i.name,
         i.emoji,
         i.category,
         i.last_seen_at AS lastSeenAt,
         up.progress_json AS progressJson,
         COALESCE(n.cnt, 0) AS notesCount
       FROM identities i
       LEFT JOIN user_progress up
         ON i.user_id = up.user_id
       LEFT JOIN (
         SELECT user_id, COUNT(*) AS cnt
         FROM community_notes
         WHERE TRIM(text) != ''
         GROUP BY user_id
       ) n
         ON i.user_id = n.user_id
       WHERE i.name != ''`
    )
    .all();

  const entries = [];
  for (const r of results || []) {
    const parsed = r.progressJson ? parseJsonSafe(r.progressJson, null) : null;
    const solvedCount = parsed?.attempts && typeof parsed.attempts === "object"
      ? Object.keys(parsed.attempts).length
      : 0;
    const notesCount = Number(r.notesCount) || 0;
    if (solvedCount <= 0 && notesCount <= 0) continue;
    const lastSeenAt = Number(r.lastSeenAt) || 0;
    entries.push({
      userId: r.userId,
      name: r.name,
      emoji: String(r.emoji || "👤").trim(),
      category: String(r.category || "").trim(),
      solvedCount,
      notesCount,
      lastSeenAt,
      isOnline: now - lastSeenAt <= ONLINE_WINDOW_MS,
    });
  }

  entries.sort((a, b) => {
    if (sortBy === "notes") {
      return (
        b.notesCount - a.notesCount ||
        b.solvedCount - a.solvedCount ||
        b.lastSeenAt - a.lastSeenAt ||
        a.name.localeCompare(b.name, "he")
      );
    }
    return (
      b.solvedCount - a.solvedCount ||
      b.notesCount - a.notesCount ||
      b.lastSeenAt - a.lastSeenAt ||
      a.name.localeCompare(b.name, "he")
    );
  });

  return jsonResponse({
    ok: true,
    sort: sortBy === "notes" ? "notes" : "answers",
    entries,
    totalParticipants: entries.length,
    serverTime: now,
  });
}

async function handleIdentityPing(request, env) {
  const body = await readJsonBody(request);
  if (!body) return errorResponse("Invalid JSON", 400);

  const userId = String(body.userId || "").trim();
  const name = String(body.name || "").trim();
  const emoji = String(body.emoji || "").trim();
  const category = String(body.category || "").trim();
  const clientSecret = typeof body.clientSecret === "string" ? body.clientSecret : "";

  if (!userId || userId.length > 80 || !name || name.length > 64 || !emoji) {
    return errorResponse("Missing required identity fields", 400);
  }
  if (!clientSecret || clientSecret.length < 8 || clientSecret.length > 256) {
    return errorResponse("Missing or invalid clientSecret", 403);
  }

  const secretHash = await sha256Hex(clientSecret);
  const existing = await env.DB
    .prepare("SELECT user_id, client_secret_hash FROM identities WHERE user_id = ?")
    .bind(userId)
    .first();

  let matchedDeviceSecret = false;
  if (existing && existing.client_secret_hash && existing.client_secret_hash !== secretHash) {
    const devRow = await env.DB
      .prepare("SELECT secret_hash FROM user_device_secrets WHERE secret_hash = ? AND user_id = ?")
      .bind(secretHash, userId)
      .first();
    if (!devRow) {
      return errorResponse("Forbidden: clientSecret mismatch", 403);
    }
    matchedDeviceSecret = true;
  }

  const conflictRow = await env.DB
    .prepare("SELECT user_id FROM identities WHERE name = ? AND user_id != ?")
    .bind(name, userId)
    .first();

  if (conflictRow) {
    const takenNames = await getTakenNamesMap(env.DB);
    return jsonResponse({ ok: false, conflict: true, takenNames }, 409);
  }

  const now = Date.now();
  if (existing) {
    await env.DB
      .prepare(
        `UPDATE identities
         SET name = ?, emoji = ?, category = ?, client_secret_hash = COALESCE(client_secret_hash, ?), last_seen_at = ?
         WHERE user_id = ?`
      )
      .bind(name, emoji, category, secretHash, now, userId)
      .run();
    if (matchedDeviceSecret) {
      await env.DB
        .prepare("UPDATE user_device_secrets SET last_seen_at = ? WHERE secret_hash = ?")
        .bind(now, secretHash)
        .run();
    }
  } else {
    await env.DB
      .prepare(
        `INSERT INTO identities (user_id, name, emoji, category, client_secret_hash, first_seen_at, last_seen_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(userId, name, emoji, category, secretHash, now, now)
      .run();
  }

  const onlineUsers = await getOnlineUsersList(env.DB, now);
  return jsonResponse({ ok: true, conflict: false, lastSeenAt: now, onlineUsers, serverTime: now });
}

async function handlePutNote(request, env, qId) {
  const body = await readJsonBody(request);
  if (!body) return errorResponse("Invalid JSON", 400);

  const userId = String(body.userId || "").trim();
  const author = String(body.author || "").trim();
  const emoji = String(body.emoji || "💬").trim();
  const category = String(body.category || "").trim();
  const text = typeof body.text === "string" ? body.text : "";
  const clientSecret = typeof body.clientSecret === "string" ? body.clientSecret : "";

  const auth = await verifyOrBindClientSecret(env.DB, userId, clientSecret, {
    name: author,
    emoji,
    category,
  });
  if (!auth.ok) {
    if (auth.conflict) {
      const takenNames = await getTakenNamesMap(env.DB);
      return jsonResponse({ ok: false, conflict: true, takenNames, error: auth.error }, 409);
    }
    return errorResponse(auth.error, auth.status);
  }

  const trimmed = text.trim();
  if (!trimmed) {
    const delRes = await env.DB
      .prepare("DELETE FROM community_notes WHERE q_id = ? AND user_id = ?")
      .bind(qId, userId)
      .run();
    if ((delRes?.meta?.changes ?? 1) > 0) {
      await bumpCommunityVersion(env.DB);
    }
    return jsonResponse({ ok: true, deleted: true });
  }

  if (text.length > 8000) {
    return errorResponse("Note is too long (max 8000 chars)", 400);
  }

  const updatedAt = Date.now();
  await env.DB
    .prepare(
      `INSERT INTO community_notes (q_id, user_id, author, emoji, category, text, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(q_id, user_id) DO UPDATE SET
         author = excluded.author,
         emoji = excluded.emoji,
         category = excluded.category,
         text = excluded.text,
         updated_at = excluded.updated_at`
    )
    .bind(qId, userId, author || "אנונימי", emoji, category, text, updatedAt)
    .run();
  await bumpCommunityVersion(env.DB, updatedAt);

  return jsonResponse({
    ok: true,
    note: { author: author || "אנונימי", emoji, category, text, updatedAt },
  });
}

async function handleDeleteNote(request, env, qId) {
  const body = await readJsonBody(request);
  if (body === null) return errorResponse("Invalid JSON", 400);

  const userId = String(body.userId || request.headers.get("X-User-Id") || "").trim();
  const clientSecret = String(body.clientSecret || request.headers.get("X-Client-Secret") || "");

  const auth = await verifyOrBindClientSecret(env.DB, userId, clientSecret);
  if (!auth.ok) return errorResponse(auth.error, auth.status);

  // Prevent creating a bogus empty identity from deleting a non-existent note, or deleting someone else's
  const existingNote = await env.DB
    .prepare("SELECT user_id FROM community_notes WHERE q_id = ? AND user_id = ?")
    .bind(qId, userId)
    .first();

  if (existingNote) {
    await env.DB
      .prepare("DELETE FROM community_notes WHERE q_id = ? AND user_id = ?")
      .bind(qId, userId)
      .run();
    await bumpCommunityVersion(env.DB);
  }

  return jsonResponse({ ok: true, deleted: Boolean(existingNote) });
}

async function handlePutProblem(request, env, qId) {
  const body = await readJsonBody(request);
  if (!body) return errorResponse("Invalid JSON", 400);

  const userId = String(body.userId || "").trim();
  const type = String(body.type || "").trim();
  const text = typeof body.text === "string" ? body.text.trim() : "";
  const author = String(body.author || "").trim();
  const emoji = String(body.emoji || "⚠️").trim();
  const category = String(body.category || "").trim();
  const clientSecret = typeof body.clientSecret === "string" ? body.clientSecret : "";

  if (!VALID_PROBLEM_TYPES.has(type)) {
    return errorResponse("Invalid problem type", 400);
  }
  if (type !== "out_of_material" && !text) {
    return errorResponse("Problem detail is required for this type", 400);
  }
  if (text.length > 4000) {
    return errorResponse("Problem description is too long", 400);
  }

  const auth = await verifyOrBindClientSecret(env.DB, userId, clientSecret, {
    name: author,
    emoji,
    category,
  });
  if (!auth.ok) {
    if (auth.conflict) {
      const takenNames = await getTakenNamesMap(env.DB);
      return jsonResponse({ ok: false, conflict: true, takenNames, error: auth.error }, 409);
    }
    return errorResponse(auth.error, auth.status);
  }

  const updatedAt = Date.now();
  await env.DB
    .prepare(
      `INSERT INTO community_problems (q_id, user_id, type, text, author, emoji, category, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(q_id, user_id) DO UPDATE SET
         type = excluded.type,
         text = excluded.text,
         author = excluded.author,
         emoji = excluded.emoji,
         category = excluded.category,
         updated_at = excluded.updated_at`
    )
    .bind(qId, userId, type, text, author || "אנונימי", emoji, category, updatedAt)
    .run();
  await bumpCommunityVersion(env.DB, updatedAt);

  return jsonResponse({
    ok: true,
    problem: { type, text, author: author || "אנונימי", emoji, category, updatedAt },
  });
}

async function handleDeleteProblem(request, env, qId) {
  const body = await readJsonBody(request);
  if (body === null) return errorResponse("Invalid JSON", 400);

  const userId = String(body.userId || request.headers.get("X-User-Id") || "").trim();
  const clientSecret = String(body.clientSecret || request.headers.get("X-Client-Secret") || "");

  const auth = await verifyOrBindClientSecret(env.DB, userId, clientSecret);
  if (!auth.ok) return errorResponse(auth.error, auth.status);

  const existing = await env.DB
    .prepare("SELECT user_id FROM community_problems WHERE q_id = ? AND user_id = ?")
    .bind(qId, userId)
    .first();

  if (existing) {
    await env.DB
      .prepare("DELETE FROM community_problems WHERE q_id = ? AND user_id = ?")
      .bind(qId, userId)
      .run();
    await bumpCommunityVersion(env.DB);
  }

  return jsonResponse({ ok: true, deleted: Boolean(existing) });
}

async function checkSyncRateLimit(db, ipHash, now) {
  const rateRow = await db
    .prepare("SELECT attempts, locked_until FROM sync_rate_limit WHERE ip_hash = ?")
    .bind(ipHash)
    .first();
  if (rateRow && Number(rateRow.locked_until) > now) {
    const retryAfterSec = Math.ceil((Number(rateRow.locked_until) - now) / 1000);
    return { locked: true, retryAfterSec, rateRow };
  }
  return { locked: false, rateRow };
}

async function recordSyncRateFailure(db, ipHash, rateRow, now) {
  const prevAttempts = rateRow && Number(rateRow.locked_until) === 0 ? Number(rateRow.attempts) : 0;
  const nextAttempts = prevAttempts + 1;
  const lockedUntil = nextAttempts >= SYNC_RATE_LIMIT_MAX_ATTEMPTS ? now + SYNC_RATE_LIMIT_LOCK_MS : 0;
  await db
    .prepare(
      `INSERT INTO sync_rate_limit (ip_hash, attempts, locked_until)
       VALUES (?, ?, ?)
       ON CONFLICT(ip_hash) DO UPDATE SET
         attempts = excluded.attempts,
         locked_until = excluded.locked_until`
    )
    .bind(ipHash, lockedUntil > 0 ? 0 : nextAttempts, lockedUntil)
    .run();
  if (lockedUntil > 0) {
    return { locked: true, retryAfterSec: Math.ceil(SYNC_RATE_LIMIT_LOCK_MS / 1000) };
  }
  return { locked: false };
}

async function clearSyncRateLimit(db, ipHash) {
  await db.prepare("DELETE FROM sync_rate_limit WHERE ip_hash = ?").bind(ipHash).run();
}

async function handleGetProgress(request, env) {
  const userId = String(request.headers.get("X-User-Id") || "").trim();
  const clientSecret = String(request.headers.get("X-Client-Secret") || "");

  const auth = await verifyExistingClientSecret(env.DB, userId, clientSecret);
  if (!auth.ok) {
    if (auth.status === 404) {
      return jsonResponse({ ok: true, progress: null, updatedAt: 0, version: 1 });
    }
    return errorResponse(auth.error, auth.status);
  }

  const row = await env.DB
    .prepare("SELECT progress_json, updated_at, version FROM user_progress WHERE user_id = ?")
    .bind(userId)
    .first();

  if (!row) {
    return jsonResponse({ ok: true, progress: null, updatedAt: 0, version: 1 });
  }

  const parsed = parseJsonSafe(row.progress_json, {});
  return jsonResponse({
    ok: true,
    progress: parsed,
    updatedAt: Number(row.updated_at) || 0,
    version: Number(row.version) || 1,
  });
}

async function handlePutProgress(request, env) {
  const body = await readJsonBody(request);
  if (!body) return errorResponse("Invalid JSON", 400);

  const userId = String(body.userId || request.headers.get("X-User-Id") || "").trim();
  const clientSecret = String(body.clientSecret || request.headers.get("X-Client-Secret") || "");
  const incomingProgress = body.progress;
  const replace = Boolean(body.replace);

  if (!incomingProgress || typeof incomingProgress !== "object" || Array.isArray(incomingProgress)) {
    return errorResponse("Missing or invalid progress object", 400);
  }

  const identInfo = body.identity || incomingProgress.identity || null;
  const auth = await verifyOrBindClientSecret(env.DB, userId, clientSecret, identInfo);
  if (!auth.ok) {
    if (auth.conflict) {
      const takenNames = await getTakenNamesMap(env.DB);
      return jsonResponse({ ok: false, conflict: true, takenNames, error: auth.error }, 409);
    }
    return errorResponse(auth.error, auth.status);
  }

  const existingRow = await env.DB
    .prepare("SELECT progress_json, version FROM user_progress WHERE user_id = ?")
    .bind(userId)
    .first();

  const serverProgress = !replace && existingRow ? parseJsonSafe(existingRow.progress_json, {}) : {};
  const merged = mergeProgressPayloads(serverProgress, incomingProgress);
  if (auth.identity) {
    merged.identity = {
      userId: auth.identity.user_id,
      name: auth.identity.name,
      emoji: auth.identity.emoji,
      category: auth.identity.category,
    };
  }

  const serialized = JSON.stringify(merged);
  if (serialized.length > MAX_PROGRESS_JSON_BYTES) {
    return errorResponse("Progress payload too large", 413);
  }

  const now = Date.now();
  const nextVersion = (Number(existingRow?.version) || 0) + 1;
  await env.DB
    .prepare(
      `INSERT INTO user_progress (user_id, progress_json, updated_at, version)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         progress_json = excluded.progress_json,
         updated_at = excluded.updated_at,
         version = excluded.version`
    )
    .bind(userId, serialized, now, nextVersion)
    .run();

  return jsonResponse({
    ok: true,
    progress: merged,
    updatedAt: now,
    version: nextVersion,
  });
}

async function handleSyncRegisterCode(request, env) {
  const body = await readJsonBody(request);
  if (!body) return errorResponse("Invalid JSON", 400);

  const userId = String(body.userId || "").trim();
  const clientSecret = typeof body.clientSecret === "string" ? body.clientSecret : "";
  const normalizedCode = normalizeSyncCode(body.syncCode);
  if (!normalizedCode) {
    return errorResponse("Invalid sync code format", 400);
  }

  const auth = await verifyOrBindClientSecret(env.DB, userId, clientSecret, {
    name: body.name,
    emoji: body.emoji,
    category: body.category,
  });
  if (!auth.ok) {
    if (auth.conflict) {
      const takenNames = await getTakenNamesMap(env.DB);
      return jsonResponse({ ok: false, conflict: true, takenNames, error: auth.error }, 409);
    }
    return errorResponse(auth.error, auth.status);
  }

  if (!auth.identity) {
    return errorResponse("Identity must exist or provide name/emoji to register sync code", 400);
  }

  const syncCodeHash = await sha256Hex(normalizedCode);

  if (auth.identity.sync_code_hash) {
    if (auth.identity.sync_code_hash === syncCodeHash) {
      return jsonResponse({ ok: true, registered: true });
    }
    return errorResponse("Sync code already registered; use rotate-code", 409, { alreadyRegistered: true });
  }

  const collision = await env.DB
    .prepare("SELECT user_id FROM identities WHERE sync_code_hash = ? AND user_id != ?")
    .bind(syncCodeHash, userId)
    .first();
  if (collision) {
    return errorResponse("Sync code already in use", 409, { codeConflict: true });
  }

  const now = Date.now();
  await env.DB
    .prepare("UPDATE identities SET sync_code_hash = ?, last_seen_at = ? WHERE user_id = ?")
    .bind(syncCodeHash, now, userId)
    .run();

  return jsonResponse({ ok: true, registered: true });
}

async function handleSyncRotateCode(request, env) {
  const body = await readJsonBody(request);
  if (!body) return errorResponse("Invalid JSON", 400);

  const userId = String(body.userId || "").trim();
  const clientSecret = typeof body.clientSecret === "string" ? body.clientSecret : "";
  const normalizedCode = normalizeSyncCode(body.newSyncCode);
  if (!normalizedCode) {
    return errorResponse("Invalid newSyncCode format", 400);
  }

  const auth = await verifyExistingClientSecret(env.DB, userId, clientSecret);
  if (!auth.ok) return errorResponse(auth.error, auth.status);

  const newHash = await sha256Hex(normalizedCode);
  const collision = await env.DB
    .prepare("SELECT user_id FROM identities WHERE sync_code_hash = ? AND user_id != ?")
    .bind(newHash, userId)
    .first();
  if (collision) {
    return errorResponse("Sync code already in use", 409, { codeConflict: true });
  }

  const now = Date.now();
  await env.DB
    .prepare("UPDATE identities SET sync_code_hash = ?, last_seen_at = ? WHERE user_id = ?")
    .bind(newHash, now, userId)
    .run();

  return jsonResponse({ ok: true, rotated: true });
}

async function handleSyncRevokeOtherDevices(request, env) {
  const body = await readJsonBody(request);
  if (!body) return errorResponse("Invalid JSON", 400);

  const userId = String(body.userId || "").trim();
  const clientSecret = typeof body.clientSecret === "string" ? body.clientSecret : "";

  const auth = await verifyExistingClientSecret(env.DB, userId, clientSecret);
  if (!auth.ok) return errorResponse(auth.error, auth.status);

  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare("UPDATE identities SET client_secret_hash = ?, last_seen_at = ? WHERE user_id = ?").bind(
      auth.secretHash,
      now,
      userId
    ),
    env.DB.prepare("DELETE FROM user_device_secrets WHERE user_id = ?").bind(userId),
  ]);

  return jsonResponse({ ok: true, revoked: true });
}

async function handleSyncPreview(request, env) {
  const body = await readJsonBody(request);
  if (!body) return errorResponse("Invalid JSON", 400);

  const ipHash = await sha256Hex(`sync:${getClientIp(request)}`);
  const now = Date.now();
  const limitState = await checkSyncRateLimit(env.DB, ipHash, now);
  if (limitState.locked) {
    return errorResponse(
      `יותר מדי ניסיונות כושלים. נסה שוב בעוד ${limitState.retryAfterSec} שניות.`,
      429,
      { retryAfterSec: limitState.retryAfterSec }
    );
  }

  const normalizedCode = normalizeSyncCode(body.syncCode);
  if (!normalizedCode) {
    const fail = await recordSyncRateFailure(env.DB, ipHash, limitState.rateRow, now);
    if (fail.locked) {
      return errorResponse("יותר מדי ניסיונות שגויים. הגישה ננעלה זמנית ל-10 דקות.", 429, {
        retryAfterSec: fail.retryAfterSec,
      });
    }
    return errorResponse("קוד סנכרון לא תקין", 400);
  }

  const syncCodeHash = await sha256Hex(normalizedCode);
  const target = await env.DB
    .prepare("SELECT user_id, name, emoji, category FROM identities WHERE sync_code_hash = ?")
    .bind(syncCodeHash)
    .first();

  if (!target) {
    const fail = await recordSyncRateFailure(env.DB, ipHash, limitState.rateRow, now);
    if (fail.locked) {
      return errorResponse("יותר מדי ניסיונות שגויים. הגישה ננעלה זמנית ל-10 דקות.", 429, {
        retryAfterSec: fail.retryAfterSec,
      });
    }
    return errorResponse("קוד סנכרון לא נמצא", 404);
  }

  await clearSyncRateLimit(env.DB, ipHash);

  const progRow = await env.DB
    .prepare("SELECT progress_json, updated_at FROM user_progress WHERE user_id = ?")
    .bind(target.user_id)
    .first();

  const parsed = progRow ? parseJsonSafe(progRow.progress_json, {}) : {};
  const summary = summarizeProgress(parsed);

  return jsonResponse({
    ok: true,
    identity: {
      userId: target.user_id,
      name: target.name,
      emoji: target.emoji,
      category: target.category,
    },
    summary: {
      ...summary,
      updatedAt: Number(progRow?.updated_at) || 0,
    },
  });
}

async function handleSyncLink(request, env) {
  const body = await readJsonBody(request);
  if (!body) return errorResponse("Invalid JSON", 400);

  const ipHash = await sha256Hex(`sync:${getClientIp(request)}`);
  const now = Date.now();
  const limitState = await checkSyncRateLimit(env.DB, ipHash, now);
  if (limitState.locked) {
    return errorResponse(
      `יותר מדי ניסיונות כושלים. נסה שוב בעוד ${limitState.retryAfterSec} שניות.`,
      429,
      { retryAfterSec: limitState.retryAfterSec }
    );
  }

  const newClientSecret = typeof body.newClientSecret === "string" ? body.newClientSecret : "";
  if (!newClientSecret || newClientSecret.length < 8 || newClientSecret.length > 256) {
    return errorResponse("Missing or invalid newClientSecret", 400);
  }

  const mode = body.mode === "replace" ? "replace" : "merge";
  const deviceLabel = String(body.deviceLabel || "").trim().slice(0, 64);

  const normalizedCode = normalizeSyncCode(body.syncCode);
  if (!normalizedCode) {
    const fail = await recordSyncRateFailure(env.DB, ipHash, limitState.rateRow, now);
    if (fail.locked) {
      return errorResponse("יותר מדי ניסיונות שגויים. הגישה ננעלה זמנית ל-10 דקות.", 429, {
        retryAfterSec: fail.retryAfterSec,
      });
    }
    return errorResponse("קוד סנכרון לא תקין", 400);
  }

  const syncCodeHash = await sha256Hex(normalizedCode);
  const target = await env.DB
    .prepare("SELECT user_id, name, emoji, category FROM identities WHERE sync_code_hash = ?")
    .bind(syncCodeHash)
    .first();

  if (!target) {
    const fail = await recordSyncRateFailure(env.DB, ipHash, limitState.rateRow, now);
    if (fail.locked) {
      return errorResponse("יותר מדי ניסיונות שגויים. הגישה ננעלה זמנית ל-10 דקות.", 429, {
        retryAfterSec: fail.retryAfterSec,
      });
    }
    return errorResponse("קוד סנכרון לא נמצא", 404);
  }

  await clearSyncRateLimit(env.DB, ipHash);

  const newSecretHash = await sha256Hex(newClientSecret);
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO user_device_secrets (secret_hash, user_id, device_label, created_at, last_seen_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(secret_hash) DO UPDATE SET
         user_id = excluded.user_id,
         device_label = excluded.device_label,
         last_seen_at = excluded.last_seen_at`
    ).bind(newSecretHash, target.user_id, deviceLabel, now, now),
    env.DB.prepare("UPDATE identities SET last_seen_at = ? WHERE user_id = ?").bind(now, target.user_id),
  ]);

  // Merge or fetch progress
  const existingRow = await env.DB
    .prepare("SELECT progress_json, updated_at, version FROM user_progress WHERE user_id = ?")
    .bind(target.user_id)
    .first();

  const serverProgress = existingRow ? parseJsonSafe(existingRow.progress_json, {}) : {};
  let finalProgress;
  let finalUpdatedAt = Number(existingRow?.updated_at) || now;
  let finalVersion = Number(existingRow?.version) || 1;

  if (mode === "replace") {
    finalProgress = mergeProgressPayloads({}, serverProgress);
    finalProgress.identity = {
      userId: target.user_id,
      name: target.name,
      emoji: target.emoji,
      category: target.category,
    };
  } else {
    const incomingLocal = body.localProgress && typeof body.localProgress === "object" ? body.localProgress : {};
    finalProgress = mergeProgressPayloads(serverProgress, incomingLocal);
    finalProgress.identity = {
      userId: target.user_id,
      name: target.name,
      emoji: target.emoji,
      category: target.category,
    };
    const serialized = JSON.stringify(finalProgress);
    if (serialized.length > MAX_PROGRESS_JSON_BYTES) {
      return errorResponse("Progress payload too large", 413);
    }
    finalUpdatedAt = now;
    finalVersion = (Number(existingRow?.version) || 0) + 1;
    await env.DB
      .prepare(
        `INSERT INTO user_progress (user_id, progress_json, updated_at, version)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET
           progress_json = excluded.progress_json,
           updated_at = excluded.updated_at,
           version = excluded.version`
      )
      .bind(target.user_id, serialized, finalUpdatedAt, finalVersion)
      .run();
  }

  // Transfer or release temporary guest identity if provided
  let guestReleased = false;
  const guestUserId = String(body.guestUserId || "").trim();
  const guestClientSecret = typeof body.guestClientSecret === "string" ? body.guestClientSecret : "";
  if (guestUserId && guestUserId !== target.user_id && guestClientSecret) {
    const guestAuth = await verifyExistingClientSecret(env.DB, guestUserId, guestClientSecret);
    if (guestAuth.ok) {
      if (mode === "merge") {
        const [guestNotesRes, targetNotesRes, guestProbsRes, targetProbsRes] = await Promise.all([
          env.DB.prepare("SELECT q_id, text, updated_at FROM community_notes WHERE user_id = ?").bind(guestUserId).all(),
          env.DB.prepare("SELECT q_id FROM community_notes WHERE user_id = ?").bind(target.user_id).all(),
          env.DB.prepare("SELECT q_id, type, text, updated_at FROM community_problems WHERE user_id = ?").bind(guestUserId).all(),
          env.DB.prepare("SELECT q_id FROM community_problems WHERE user_id = ?").bind(target.user_id).all(),
        ]);

        const targetNoteQIds = new Set((targetNotesRes.results || []).map((r) => r.q_id));
        const targetProbQIds = new Set((targetProbsRes.results || []).map((r) => r.q_id));
        const stmts = [];

        for (const gn of guestNotesRes.results || []) {
          if (!targetNoteQIds.has(gn.q_id)) {
            stmts.push(
              env.DB
                .prepare(
                  `INSERT INTO community_notes (q_id, user_id, author, emoji, category, text, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?)`
                )
                .bind(gn.q_id, target.user_id, target.name, target.emoji, target.category, gn.text, gn.updated_at)
            );
          }
          stmts.push(
            env.DB.prepare("DELETE FROM community_notes WHERE q_id = ? AND user_id = ?").bind(gn.q_id, guestUserId)
          );
        }

        for (const gp of guestProbsRes.results || []) {
          if (!targetProbQIds.has(gp.q_id)) {
            stmts.push(
              env.DB
                .prepare(
                  `INSERT INTO community_problems (q_id, user_id, type, text, author, emoji, category, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
                )
                .bind(
                  gp.q_id,
                  target.user_id,
                  gp.type,
                  gp.text,
                  target.name,
                  target.emoji,
                  target.category,
                  gp.updated_at
                )
            );
          }
          stmts.push(
            env.DB.prepare("DELETE FROM community_problems WHERE q_id = ? AND user_id = ?").bind(gp.q_id, guestUserId)
          );
        }

        if (stmts.length > 0) {
          const CHUNK_SIZE = 50;
          for (let idx = 0; idx < stmts.length; idx += CHUNK_SIZE) {
            await env.DB.batch(stmts.slice(idx, idx + CHUNK_SIZE));
          }
          await bumpCommunityVersion(env.DB, now);
        }
      }

      const [remNotes, remProbs] = await Promise.all([
        env.DB.prepare("SELECT COUNT(*) AS cnt FROM community_notes WHERE user_id = ?").bind(guestUserId).first(),
        env.DB.prepare("SELECT COUNT(*) AS cnt FROM community_problems WHERE user_id = ?").bind(guestUserId).first(),
      ]);
      const remainingCount = (Number(remNotes?.cnt) || 0) + (Number(remProbs?.cnt) || 0);
      if (remainingCount === 0) {
        await env.DB.batch([
          env.DB.prepare("DELETE FROM identities WHERE user_id = ?").bind(guestUserId),
          env.DB.prepare("DELETE FROM user_progress WHERE user_id = ?").bind(guestUserId),
          env.DB.prepare("DELETE FROM user_device_secrets WHERE user_id = ?").bind(guestUserId),
        ]);
        guestReleased = true;
      }
    }
  }

  return jsonResponse({
    ok: true,
    identity: {
      userId: target.user_id,
      name: target.name,
      emoji: target.emoji,
      category: target.category,
    },
    progress: finalProgress,
    updatedAt: finalUpdatedAt,
    version: finalVersion,
    guestReleased,
  });
}

async function handleAdminLogin(request, env) {
  if (!env.ADMIN_PASSWORD || !String(env.ADMIN_PASSWORD).trim()) {
    return errorResponse("ADMIN_PASSWORD is not configured on server", 503);
  }

  const body = await readJsonBody(request);
  if (!body) return errorResponse("Invalid JSON", 400);

  const ipHash = await sha256Hex(getClientIp(request));
  const now = Date.now();
  const rateRow = await env.DB
    .prepare("SELECT attempts, locked_until FROM admin_rate_limit WHERE ip_hash = ?")
    .bind(ipHash)
    .first();

  if (rateRow && Number(rateRow.locked_until) > now) {
    const retryAfterSec = Math.ceil((Number(rateRow.locked_until) - now) / 1000);
    return errorResponse(`יותר מדי ניסיונות כושלים. נסה שוב בעוד ${retryAfterSec} שניות.`, 429, {
      retryAfterSec,
    });
  }

  const password = typeof body.password === "string" ? body.password : "";
  const [inputHash, expectedHash] = await Promise.all([
    sha256Bytes(password),
    sha256Bytes(String(env.ADMIN_PASSWORD)),
  ]);

  if (!password || !constantTimeEqual(inputHash, expectedHash)) {
    const prevAttempts = rateRow && Number(rateRow.locked_until) === 0 ? Number(rateRow.attempts) : 0;
    const nextAttempts = prevAttempts + 1;
    const lockedUntil = nextAttempts >= RATE_LIMIT_MAX_ATTEMPTS ? now + RATE_LIMIT_LOCK_MS : 0;
    await env.DB
      .prepare(
        `INSERT INTO admin_rate_limit (ip_hash, attempts, locked_until)
         VALUES (?, ?, ?)
         ON CONFLICT(ip_hash) DO UPDATE SET
           attempts = excluded.attempts,
           locked_until = excluded.locked_until`
      )
      .bind(ipHash, lockedUntil > 0 ? 0 : nextAttempts, lockedUntil)
      .run();

    if (lockedUntil > 0) {
      return errorResponse("יותר מדי ניסיונות שגויים. החשבון ננעל זמנית ל-10 דקות.", 429, {
        retryAfterSec: Math.ceil(RATE_LIMIT_LOCK_MS / 1000),
      });
    }
    return errorResponse("סיסמת מנהל שגויה", 401);
  }

  await env.DB.prepare("DELETE FROM admin_rate_limit WHERE ip_hash = ?").bind(ipHash).run();
  const { token, expiresAt } = await issueAdminToken(env);
  return jsonResponse({ ok: true, token, expiresAt });
}

async function handleAdminUsers(env) {
  const { results } = await env.DB
    .prepare(
      `SELECT
         i.user_id AS userId,
         i.name,
         i.emoji,
         i.category,
         i.first_seen_at AS firstSeenAt,
         i.last_seen_at AS lastSeenAt,
         CASE WHEN i.sync_code_hash IS NOT NULL AND i.sync_code_hash != '' THEN 1 ELSE 0 END AS hasSyncCode,
         up.progress_json AS progressJson,
         COALESCE(n.cnt, 0) AS notesCount,
         COALESCE(p.cnt, 0) AS problemsCount
       FROM identities i
       LEFT JOIN user_progress up
         ON i.user_id = up.user_id
       LEFT JOIN (SELECT user_id, COUNT(*) AS cnt FROM community_notes GROUP BY user_id) n
         ON i.user_id = n.user_id
       LEFT JOIN (SELECT user_id, COUNT(*) AS cnt FROM community_problems GROUP BY user_id) p
         ON i.user_id = p.user_id
       ORDER BY i.last_seen_at DESC`
    )
    .all();

  const users = (results || []).map((r) => {
    const parsed = r.progressJson ? parseJsonSafe(r.progressJson, null) : null;
    const solvedCount = parsed?.attempts && typeof parsed.attempts === "object"
      ? Object.keys(parsed.attempts).length
      : 0;
    return {
      userId: r.userId,
      name: r.name,
      emoji: r.emoji,
      category: r.category,
      firstSeenAt: r.firstSeenAt,
      lastSeenAt: r.lastSeenAt,
      notesCount: Number(r.notesCount) || 0,
      problemsCount: Number(r.problemsCount) || 0,
      hasSyncCode: Boolean(r.hasSyncCode),
      solvedCount,
    };
  });

  return jsonResponse({ ok: true, users });
}

async function handleAdminPutOverride(request, env, qId) {
  const body = await readJsonBody(request);
  if (!body) return errorResponse("Invalid JSON", 400);

  const existingRow = await env.DB
    .prepare(
      "SELECT q_id, hidden, stem, options_json, correct_json, all_accepted, appeal_note, subject FROM question_overrides WHERE q_id = ?"
    )
    .bind(qId)
    .first();

  const hidden = body.hidden !== undefined ? (body.hidden ? 1 : 0) : existingRow ? existingRow.hidden : 0;
  const stem = body.stem !== undefined ? (body.stem === null ? null : String(body.stem)) : existingRow?.stem ?? null;

  let optionsJson = existingRow?.options_json ?? null;
  if (body.options !== undefined) {
    if (body.options === null) {
      optionsJson = null;
    } else if (Array.isArray(body.options) && body.options.length >= 2 && body.options.length <= 6) {
      const letters = ["א", "ב", "ג", "ד", "ה", "ו"];
      const sanitized = body.options.map((opt, idx) => ({
        letter: letters[idx] || String(opt?.letter || ""),
        text: String(opt?.text ?? opt ?? "").trim(),
      }));
      optionsJson = JSON.stringify(sanitized);
    } else {
      return errorResponse("options must be an array of 2..6 items", 400);
    }
  }

  let correctJson = existingRow?.correct_json ?? null;
  if (body.correct !== undefined) {
    if (body.correct === null) {
      correctJson = null;
    } else if (Array.isArray(body.correct) && body.correct.length >= 1) {
      const sanitized = Array.from(
        new Set(body.correct.map((x) => Number(x)).filter((x) => Number.isInteger(x) && x >= 0 && x < 6))
      ).sort((a, b) => a - b);
      if (sanitized.length === 0) return errorResponse("At least one valid correct index required", 400);
      correctJson = JSON.stringify(sanitized);
    } else {
      return errorResponse("correct must be a non-empty array of indices", 400);
    }
  }

  const allAccepted =
    body.allAccepted !== undefined
      ? body.allAccepted === null
        ? null
        : body.allAccepted
        ? 1
        : 0
      : existingRow?.all_accepted ?? null;

  const appealNote =
    body.appealNote !== undefined
      ? body.appealNote === null
        ? null
        : String(body.appealNote)
      : existingRow?.appeal_note ?? null;

  const subject =
    body.subject !== undefined
      ? body.subject === null
        ? null
        : String(body.subject).trim()
      : existingRow?.subject ?? null;

  const updatedAt = Date.now();

  await env.DB
    .prepare(
      `INSERT INTO question_overrides
         (q_id, hidden, stem, options_json, correct_json, all_accepted, appeal_note, subject, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(q_id) DO UPDATE SET
         hidden = excluded.hidden,
         stem = excluded.stem,
         options_json = excluded.options_json,
         correct_json = excluded.correct_json,
         all_accepted = excluded.all_accepted,
         appeal_note = excluded.appeal_note,
         subject = excluded.subject,
         updated_at = excluded.updated_at`
    )
    .bind(qId, hidden, stem, optionsJson, correctJson, allAccepted, appealNote, subject, updatedAt)
    .run();
  await bumpCommunityVersion(env.DB, updatedAt);

  const savedRow = await env.DB
    .prepare(
      "SELECT q_id, hidden, stem, options_json, correct_json, all_accepted, appeal_note, subject, updated_at FROM question_overrides WHERE q_id = ?"
    )
    .bind(qId)
    .first();

  return jsonResponse({ ok: true, qId, override: formatOverrideRow(savedRow) });
}

async function handleAdminImportLegacy(request, env) {
  const body = await readJsonBody(request);
  if (!body) return errorResponse("Invalid JSON", 400);

  const notes = body.notes && typeof body.notes === "object" ? body.notes : {};
  const problems = body.problems && typeof body.problems === "object" ? body.problems : {};
  const now = Date.now();
  const statements = [];
  const seenUsers = new Map();

  let notesImported = 0;
  let problemsImported = 0;

  for (const [qId, byUser] of Object.entries(notes)) {
    if (!byUser || typeof byUser !== "object") continue;
    for (const [userId, entry] of Object.entries(byUser)) {
      if (!entry || typeof entry !== "object") continue;
      const text = typeof entry.text === "string" ? entry.text : "";
      if (!text.trim()) continue;
      const author = String(entry.author || "אנונימי").trim();
      const emoji = String(entry.emoji || "💬").trim();
      const category = String(entry.category || "").trim();
      const updatedAt = Number(entry.updatedAt) || now;

      statements.push(
        env.DB
          .prepare(
            `INSERT INTO community_notes (q_id, user_id, author, emoji, category, text, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(q_id, user_id) DO UPDATE SET
               author = excluded.author,
               emoji = excluded.emoji,
               category = excluded.category,
               text = excluded.text,
               updated_at = excluded.updated_at
             WHERE excluded.updated_at >= community_notes.updated_at`
          )
          .bind(qId, userId, author, emoji, category, text, updatedAt)
      );
      notesImported++;

      if (!seenUsers.has(userId)) {
        seenUsers.set(userId, { name: author, emoji, category, ts: updatedAt });
      }
    }
  }

  for (const [qId, byUser] of Object.entries(problems)) {
    if (!byUser || typeof byUser !== "object") continue;
    for (const [userId, entry] of Object.entries(byUser)) {
      if (!entry || typeof entry !== "object") continue;
      const type = String(entry.type || "").trim();
      if (!VALID_PROBLEM_TYPES.has(type)) continue;
      const text = typeof entry.text === "string" ? entry.text.trim() : "";
      if (type !== "out_of_material" && !text) continue;
      const author = String(entry.author || "אנונימי").trim();
      const emoji = String(entry.emoji || "⚠️").trim();
      const category = String(entry.category || "").trim();
      const updatedAt = Number(entry.updatedAt) || now;

      statements.push(
        env.DB
          .prepare(
            `INSERT INTO community_problems (q_id, user_id, type, text, author, emoji, category, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(q_id, user_id) DO UPDATE SET
               type = excluded.type,
               text = excluded.text,
               author = excluded.author,
               emoji = excluded.emoji,
               category = excluded.category,
               updated_at = excluded.updated_at
             WHERE excluded.updated_at >= community_problems.updated_at`
          )
          .bind(qId, userId, type, text, author, emoji, category, updatedAt)
      );
      problemsImported++;

      if (!seenUsers.has(userId)) {
        seenUsers.set(userId, { name: author, emoji, category, ts: updatedAt });
      }
    }
  }

  for (const [userId, info] of seenUsers.entries()) {
    statements.push(
      env.DB
        .prepare(
          `INSERT OR IGNORE INTO identities (user_id, name, emoji, category, client_secret_hash, first_seen_at, last_seen_at)
           VALUES (?, ?, ?, ?, NULL, ?, ?)`
        )
        .bind(userId, info.name, info.emoji, info.category, info.ts, info.ts)
    );
  }

  // D1 batch executes in chunks safely
  const CHUNK_SIZE = 50;
  for (let i = 0; i < statements.length; i += CHUNK_SIZE) {
    await env.DB.batch(statements.slice(i, i + CHUNK_SIZE));
  }
  if (notesImported > 0 || problemsImported > 0) {
    await bumpCommunityVersion(env.DB, now);
  }

  return jsonResponse({
    ok: true,
    notesImported,
    problemsImported,
    identitiesSeeded: seenUsers.size,
  });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    const method = request.method.toUpperCase();

    try {
      if (method === "GET" && path === "/api/health") {
        return jsonResponse({ ok: true });
      }

      if (method === "GET" && path === "/api/bootstrap") {
        return await handleBootstrap(env);
      }

      if (method === "GET" && path === "/api/poll") {
        return await handlePoll(request, env);
      }

      if (method === "GET" && path === "/api/online") {
        return await handleOnlineUsers(env);
      }

      if (method === "GET" && path === "/api/leaderboard") {
        const sortParam = url.searchParams.get("sort") === "notes" ? "notes" : "answers";
        return await handleLeaderboard(env, sortParam);
      }

      if (method === "POST" && path === "/api/identities/ping") {
        return await handleIdentityPing(request, env);
      }

      if (path === "/api/progress") {
        if (method === "GET") return await handleGetProgress(request, env);
        if (method === "PUT") return await handlePutProgress(request, env);
      }

      if (method === "POST" && path === "/api/sync/register-code") {
        return await handleSyncRegisterCode(request, env);
      }
      if (method === "POST" && path === "/api/sync/rotate-code") {
        return await handleSyncRotateCode(request, env);
      }
      if (method === "POST" && path === "/api/sync/revoke-other-devices") {
        return await handleSyncRevokeOtherDevices(request, env);
      }
      if (method === "POST" && path === "/api/sync/preview") {
        return await handleSyncPreview(request, env);
      }
      if (method === "POST" && path === "/api/sync/link") {
        return await handleSyncLink(request, env);
      }

      const noteMatch = path.match(/^\/api\/notes\/([^/]+)$/);
      if (noteMatch) {
        const qId = decodeURIComponent(noteMatch[1]);
        if (method === "PUT") return await handlePutNote(request, env, qId);
        if (method === "DELETE") return await handleDeleteNote(request, env, qId);
      }

      const problemMatch = path.match(/^\/api\/problems\/([^/]+)$/);
      if (problemMatch) {
        const qId = decodeURIComponent(problemMatch[1]);
        if (method === "PUT") return await handlePutProblem(request, env, qId);
        if (method === "DELETE") return await handleDeleteProblem(request, env, qId);
      }

      if (method === "POST" && path === "/api/admin/login") {
        return await handleAdminLogin(request, env);
      }

      // All other /api/admin/* endpoints require valid Bearer HMAC token
      if (path.startsWith("/api/admin/")) {
        const auth = await verifyAdminToken(request, env);
        if (!auth.valid) {
          return errorResponse(auth.error, auth.status);
        }

        if (method === "GET" && path === "/api/admin/verify") {
          return jsonResponse({ ok: true, admin: true, expiresAt: auth.expiresAt });
        }

        if (method === "GET" && path === "/api/admin/users") {
          return await handleAdminUsers(env);
        }

        const adminUserMatch = path.match(/^\/api\/admin\/users\/([^/]+)$/);
        if (adminUserMatch && method === "DELETE") {
          const userId = decodeURIComponent(adminUserMatch[1]);
          await env.DB.batch([
            env.DB.prepare("DELETE FROM identities WHERE user_id = ?").bind(userId),
            env.DB.prepare("DELETE FROM user_device_secrets WHERE user_id = ?").bind(userId),
            env.DB.prepare("DELETE FROM user_progress WHERE user_id = ?").bind(userId),
          ]);
          return jsonResponse({ ok: true, releasedUserId: userId });
        }

        const adminNoteMatch = path.match(/^\/api\/admin\/notes\/([^/]+)\/([^/]+)$/);
        if (adminNoteMatch && method === "DELETE") {
          const qId = decodeURIComponent(adminNoteMatch[1]);
          const userId = decodeURIComponent(adminNoteMatch[2]);
          const delRes = await env.DB
            .prepare("DELETE FROM community_notes WHERE q_id = ? AND user_id = ?")
            .bind(qId, userId)
            .run();
          if ((delRes?.meta?.changes ?? 1) > 0) {
            await bumpCommunityVersion(env.DB);
          }
          return jsonResponse({ ok: true, qId, userId });
        }

        const adminProblemMatch = path.match(/^\/api\/admin\/problems\/([^/]+)\/([^/]+)$/);
        if (adminProblemMatch && method === "DELETE") {
          const qId = decodeURIComponent(adminProblemMatch[1]);
          const userId = decodeURIComponent(adminProblemMatch[2]);
          const delRes = await env.DB
            .prepare("DELETE FROM community_problems WHERE q_id = ? AND user_id = ?")
            .bind(qId, userId)
            .run();
          if ((delRes?.meta?.changes ?? 1) > 0) {
            await bumpCommunityVersion(env.DB);
          }
          return jsonResponse({ ok: true, qId, userId });
        }

        const adminOverrideMatch = path.match(/^\/api\/admin\/overrides\/([^/]+)$/);
        if (adminOverrideMatch) {
          const qId = decodeURIComponent(adminOverrideMatch[1]);
          if (method === "PUT") return await handleAdminPutOverride(request, env, qId);
          if (method === "DELETE") {
            const delRes = await env.DB.prepare("DELETE FROM question_overrides WHERE q_id = ?").bind(qId).run();
            if ((delRes?.meta?.changes ?? 1) > 0) {
              await bumpCommunityVersion(env.DB);
            }
            return jsonResponse({ ok: true, reset: qId });
          }
        }

        if (method === "POST" && path === "/api/admin/import-legacy") {
          return await handleAdminImportLegacy(request, env);
        }
      }

      return errorResponse("Not found", 404);
    } catch (err) {
      return errorResponse(err?.message || "Internal server error", 500);
    }
  },
};

export { mergeProgressPayloads, normalizeSyncCode };
