const TOKEN_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days
const RATE_LIMIT_MAX_ATTEMPTS = 5;
const RATE_LIMIT_LOCK_MS = 10 * 60 * 1000; // 10 minutes
const SYNC_RATE_LIMIT_MAX_ATTEMPTS = 10;
const SYNC_RATE_LIMIT_LOCK_MS = 10 * 60 * 1000; // 10 minutes
const SYNC_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const SYNC_CODE_REGEX = /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{12}$/;
const MAX_PROGRESS_JSON_BYTES = 1500 * 1024;
const MAX_FEEDBACK_CHARS = 500;
const VALID_PROBLEM_TYPES = new Set(["question_issue", "distractor_issue", "out_of_material"]);
const ONLINE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes active presence window (was 3m)
const PRESENCE_TOUCH_INTERVAL_MS = 3 * 60 * 1000; // Throttle last_seen_at writes to once per 3 minutes (was 1m)
const ADMIN_SESSION_TOUCH_INTERVAL_MS = 60 * 1000; // Throttle admin session last_seen_at writes to once per minute
const UNUSED_PHANTOM_MAX_SPAN_MS = 15 * 1000; // Short-lived empty visits (< 15s) eligible for manual cleanup
const UNUSED_PHANTOM_GRACE_MS = ONLINE_WINDOW_MS; // Never clean up a visitor seen within active online window
const UNUSED_STALE_INACTIVE_MS = 24 * 60 * 60 * 1000; // Empty profiles inactive >= 24h eligible for manual cleanup
const LEADERBOARD_CACHE_TTL_MS = 45 * 1000; // 45 seconds in-memory leaderboard cache
const VALID_USER_ROLES = new Set(["user", "supervisor"]);

const WORKER_VERSION = "2026.11.26.4";
const WORKER_SCHEMA_VERSION = 9;
const GITHUB_REPO_OWNER = "TP4441";
const GITHUB_REPO_NAME = "MIKBATZ1_BLAT";
const DEFAULT_CF_ACCOUNT_ID = "e612e80b92d2545210e838c4825c5ca0";
const DEFAULT_D1_DATABASE_ID = "60baa58e-1b62-4a62-9d03-999465bbc05a";
const TELEMETRY_FLUSH_INTERVAL_MS = 60 * 1000;
const TELEMETRY_FLUSH_REQUESTS = 25;
const EXTERNAL_METRICS_CACHE_TTL_MS = 60 * 1000;

const CLOUDFLARE_FREE_QUOTAS = {
  workerRequestsPerDay: 100000,
  d1RowsReadPerDay: 5000000,
  d1RowsWrittenPerDay: 100000,
  d1StorageBytes: 500 * 1024 * 1024, // 500 MB per D1 database
  workerCpuMsPerRequest: 10,
};

const GITHUB_FREE_QUOTAS = {
  pagesSiteSizeKb: 1024 * 1024, // 1 GB
  pagesBandwidthGbPerMonth: 100,
  pagesBuildsPerHour: 10,
};

// In-memory per-isolate telemetry accumulator (flushed periodically to D1 to keep writes near-zero)
let telemetryState = {
  dayUtc: "",
  requestsTotal: 0,
  errors4xx: 0,
  errors5xx: 0,
  d1RowsRead: 0,
  d1RowsWritten: 0,
  endpoints: {},
  lastFlushAt: 0,
  flushing: null,
};

let githubMetricsCache = { fetchedAt: 0, data: null };
let githubVersionsCache = { fetchedAt: 0, data: null };
let cfAnalyticsCache = { fetchedAt: 0, data: null };

// In-memory per-isolate caches (safe across isolates: community cache is keyed by authoritative D1 community_version)
let communityCache = { version: 0, data: null };
let communityCacheInFlight = { version: 0, promise: null };
let communityInvalidationEpoch = 0;

let leaderboardCache = { entries: null, fetchedAt: 0 };
let leaderboardInFlight = null;
let leaderboardInvalidationEpoch = 0;

function invalidateCommunityCache() {
  communityInvalidationEpoch += 1;
  communityCache = { version: 0, data: null };
  communityCacheInFlight = { version: 0, promise: null };
}

function invalidateLeaderboardCache() {
  leaderboardInvalidationEpoch += 1;
  leaderboardCache = { entries: null, fetchedAt: 0 };
  leaderboardInFlight = null;
}

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

function normalizeUserRole(raw) {
  return raw === "supervisor" ? "supervisor" : "user";
}

async function issueAdminToken(env, sessionId = null) {
  const now = Date.now();
  const expiresAt = now + TOKEN_TTL_MS;
  const headerB64 = toBase64Url(textEncoder.encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const payloadObj = { sub: "admin", iat: now, exp: expiresAt };
  if (sessionId) payloadObj.sid = sessionId;
  const payloadB64 = toBase64Url(textEncoder.encode(JSON.stringify(payloadObj)));
  const signingInput = `${headerB64}.${payloadB64}`;
  const key = await getHmacKey(env);
  const sig = await crypto.subtle.sign("HMAC", key, textEncoder.encode(signingInput));
  return {
    token: `${signingInput}.${toBase64Url(sig)}`,
    expiresAt,
  };
}

async function verifyAdminToken(request, env, options = {}) {
  const { touchPresence = true } = options || {};
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
    const now = Date.now();
    if (payload?.sub !== "admin" || typeof payload.exp !== "number" || payload.exp <= now) {
      return { valid: false, status: 401, error: "Token expired" };
    }
    const sid = typeof payload.sid === "string" && payload.sid.trim() ? payload.sid.trim() : null;
    if (sid) {
      const sess = await env.DB
        .prepare(
          `SELECT s.session_id, s.user_id, s.user_name, s.user_emoji, s.last_seen_at, s.expires_at, s.revoked_at,
                  i.name AS identity_name, i.emoji AS identity_emoji
           FROM admin_sessions s
           LEFT JOIN identities i ON i.user_id = s.user_id AND s.user_id != ''
           WHERE s.session_id = ?`
        )
        .bind(sid)
        .first();
      if (!sess || Number(sess.revoked_at) > 0 || Number(sess.expires_at) <= now) {
        return { valid: false, status: 401, error: "Admin session expired or revoked" };
      }
      if (touchPresence && now - Number(sess.last_seen_at || 0) >= ADMIN_SESSION_TOUCH_INTERVAL_MS) {
        await env.DB
          .prepare("UPDATE admin_sessions SET last_seen_at = ? WHERE session_id = ?")
          .bind(now, sid)
          .run();
      }
      return {
        valid: true,
        expiresAt: payload.exp,
        sessionId: sid,
        userId: sess.user_id || "",
        userName: sess.identity_name || sess.user_name || "",
        userEmoji: sess.identity_emoji || sess.user_emoji || "",
      };
    }
    return { valid: true, expiresAt: payload.exp, sessionId: null, userId: "", userName: "", userEmoji: "" };
  } catch {
    return { valid: false, status: 401, error: "Invalid token payload" };
  }
}

async function verifyAdminOrSupervisor(request, env) {
  const authHeader = request.headers.get("Authorization") || "";
  if (authHeader.trim()) {
    const adminAuth = await verifyAdminToken(request, env);
    if (!adminAuth.valid) {
      return { ok: false, status: adminAuth.status, error: adminAuth.error };
    }
    return { ok: true, actorType: "admin", adminAuth };
  }

  const userId = String(request.headers.get("X-User-Id") || "").trim();
  const clientSecret = String(request.headers.get("X-Client-Secret") || "");
  if (userId || clientSecret) {
    const auth = await verifyExistingClientSecret(env.DB, userId, clientSecret, { touchPresence: true });
    if (!auth.ok) {
      return {
        ok: false,
        status: auth.status === 404 ? 401 : auth.status,
        error: auth.error,
        blocked: auth.blocked,
        blockedReason: auth.blockedReason,
      };
    }
    if (normalizeUserRole(auth.identity?.role) !== "supervisor") {
      return { ok: false, status: 403, error: "Forbidden: supervisor role required" };
    }
    return { ok: true, actorType: "supervisor", userId, identity: auth.identity };
  }

  return { ok: false, status: 401, error: "Missing Authorization token" };
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
  if (row.updated_by_user_id) {
    obj.updatedByUserId = String(row.updated_by_user_id);
  }
  if (row.updated_by_name) {
    obj.updatedByName = String(row.updated_by_name);
  }
  if (row.updated_by_emoji) {
    obj.updatedByEmoji = String(row.updated_by_emoji);
  }
  if (row.updated_by_role) {
    obj.updatedByRole = String(row.updated_by_role);
  }
  return obj;
}

async function getCustomIdentitiesList(db) {
  try {
    const { results } = await db
      .prepare("SELECT name, emoji, category, created_at FROM custom_identities ORDER BY created_at ASC")
      .all();
    return (results || []).map((row) => ({
      name: row.name,
      emoji: row.emoji,
      category: row.category,
      createdAt: Number(row.created_at) || 0,
      custom: true,
    }));
  } catch {
    return [];
  }
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
       WHERE last_seen_at >= ?
         AND name != ''
         AND COALESCE(blocked, 0) = 0
         AND user_id NOT IN (SELECT user_id FROM blocked_users)
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

const VALID_STUDY_MODES = new Set(["practice", "flashcard", "drill"]);
const MAX_SESSION_ARRAY_LEN = 2000;
const MAX_SIM_HISTORY_LEN = 100;

function sanitizeStudySession(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const mode = VALID_STUDY_MODES.has(raw.mode) ? raw.mode : "practice";
  const rawFilters = raw.filters && typeof raw.filters === "object" && !Array.isArray(raw.filters) ? raw.filters : {};
  const rawDrillFilters = raw.drillFilters && typeof raw.drillFilters === "object" && !Array.isArray(raw.drillFilters) ? raw.drillFilters : {};
  const toStrArray = (val) =>
    Array.isArray(val)
      ? val.filter((x) => typeof x === "string" && x.length > 0 && x.length <= 120).slice(0, MAX_SESSION_ARRAY_LEN)
      : [];

  const lastQIdByMode = {};
  if (raw.lastQIdByMode && typeof raw.lastQIdByMode === "object" && !Array.isArray(raw.lastQIdByMode)) {
    for (const m of VALID_STUDY_MODES) {
      const qid = raw.lastQIdByMode[m];
      if (typeof qid === "string" && qid.length > 0 && qid.length <= 120) {
        lastQIdByMode[m] = qid;
      }
    }
  }

  const lastIndexByMode = {};
  if (raw.lastIndexByMode && typeof raw.lastIndexByMode === "object" && !Array.isArray(raw.lastIndexByMode)) {
    for (const m of VALID_STUDY_MODES) {
      const n = Number(raw.lastIndexByMode[m]);
      if (Number.isFinite(n) && n >= 0) {
        lastIndexByMode[m] = Math.floor(n);
      }
    }
  }

  return {
    mode,
    filters: {
      exams: toStrArray(rawFilters.exams),
      subjects: toStrArray(rawFilters.subjects),
      statuses: toStrArray(rawFilters.statuses),
      search: typeof rawFilters.search === "string" ? rawFilters.search.slice(0, 500) : "",
      mergePathology: rawFilters.mergePathology !== undefined ? Boolean(rawFilters.mergePathology) : true,
    },
    filterCollapsed: Boolean(raw.filterCollapsed),
    shuffleOptions: Boolean(raw.shuffleOptions),
    shuffledOrder: Array.isArray(raw.shuffledOrder) ? toStrArray(raw.shuffledOrder) : null,
    drillFilters: {
      exams: toStrArray(rawDrillFilters.exams),
      subjects: toStrArray(rawDrillFilters.subjects),
      search: typeof rawDrillFilters.search === "string" ? rawDrillFilters.search.slice(0, 500) : "",
    },
    drillShuffledOrder: Array.isArray(raw.drillShuffledOrder) ? toStrArray(raw.drillShuffledOrder) : null,
    lastQIdByMode,
    lastIndexByMode,
    deviceId: typeof raw.deviceId === "string" ? raw.deviceId.slice(0, 80) : "",
  };
}

function sanitizeActiveSim(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const questionIds = Array.isArray(raw.questionIds)
    ? raw.questionIds.filter((x) => typeof x === "string" && x.length > 0 && x.length <= 120).slice(0, MAX_SESSION_ARRAY_LEN)
    : [];
  if (questionIds.length === 0) return null;

  const answers = {};
  if (raw.answers && typeof raw.answers === "object" && !Array.isArray(raw.answers)) {
    for (const [qId, val] of Object.entries(raw.answers).slice(0, MAX_SESSION_ARRAY_LEN)) {
      const idx = Number(val);
      if (typeof qId === "string" && qId.length > 0 && qId.length <= 120 && Number.isInteger(idx) && idx >= 0 && idx < 10) {
        answers[qId] = idx;
      }
    }
  }

  const flagged = Array.isArray(raw.flagged)
    ? Array.from(
        new Set(raw.flagged.filter((x) => typeof x === "string" && x.length > 0 && x.length <= 120))
      ).slice(0, MAX_SESSION_ARRAY_LEN)
    : [];

  const struck = {};
  if (raw.struck && typeof raw.struck === "object" && !Array.isArray(raw.struck)) {
    for (const [qId, arr] of Object.entries(raw.struck).slice(0, MAX_SESSION_ARRAY_LEN)) {
      if (typeof qId !== "string" || qId.length === 0 || qId.length > 120 || !Array.isArray(arr)) continue;
      const cleanArr = Array.from(
        new Set(arr.map((x) => Number(x)).filter((x) => Number.isInteger(x) && x >= 0 && x < 10))
      );
      if (cleanArr.length > 0) struck[qId] = cleanArr;
    }
  }

  const rawIdx = Number(raw.currentIndex);
  const currentIndex = Number.isFinite(rawIdx)
    ? Math.max(0, Math.min(questionIds.length - 1, Math.floor(rawIdx)))
    : 0;
  const hasTimer = Boolean(raw.hasTimer);
  const rawSec = Number(raw.secondsLeft);
  const secondsLeft = hasTimer && Number.isFinite(rawSec) ? Math.max(0, Math.floor(rawSec)) : 0;
  const rawInitSec = Number(raw.initialSeconds);
  const initialSeconds = hasTimer && Number.isFinite(rawInitSec) ? Math.max(0, Math.floor(rawInitSec)) : 0;
  const rawElapsedSec = Number(raw.elapsedSeconds);
  const elapsedSeconds = Number.isFinite(rawElapsedSec) ? Math.max(0, Math.floor(rawElapsedSec)) : 0;

  return {
    label: typeof raw.label === "string" ? raw.label.slice(0, 160) : "",
    simType: raw.simType === "custom" ? "custom" : "full",
    examName: typeof raw.examName === "string" ? raw.examName.slice(0, 80) : "",
    questionIds,
    answers,
    flagged,
    struck,
    currentIndex,
    secondsLeft,
    initialSeconds,
    elapsedSeconds,
    hasTimer,
    timerHidden: Boolean(raw.timerHidden),
    shuffleOpts: Boolean(raw.shuffleOpts),
    deviceId: typeof raw.deviceId === "string" ? raw.deviceId.slice(0, 80) : "",
  };
}

function sanitizeSimHistoryEntry(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const id = typeof raw.id === "string" ? raw.id.trim().slice(0, 80) : "";
  if (!id) return null;

  const questionIds = Array.isArray(raw.questionIds)
    ? raw.questionIds.filter((x) => typeof x === "string" && x.length > 0 && x.length <= 120).slice(0, MAX_SESSION_ARRAY_LEN)
    : [];
  if (questionIds.length === 0) return null;
  const qIdSet = new Set(questionIds);

  const answers = {};
  if (raw.answers && typeof raw.answers === "object" && !Array.isArray(raw.answers)) {
    for (const [qId, val] of Object.entries(raw.answers)) {
      const idx = Number(val);
      if (qIdSet.has(qId) && Number.isInteger(idx) && idx >= 0 && idx < 10) {
        answers[qId] = idx;
      }
    }
  }

  const cleanIdArray = (arr) =>
    Array.isArray(arr)
      ? Array.from(new Set(arr.filter((x) => typeof x === "string" && qIdSet.has(x)))).slice(0, MAX_SESSION_ARRAY_LEN)
      : [];

  const completedAt = Number(raw.completedAt);
  if (!Number.isFinite(completedAt) || completedAt <= 0) return null;

  const totalCount = questionIds.length;
  const rawCorrect = Number(raw.correctCount);
  const correctCount = Number.isFinite(rawCorrect)
    ? Math.max(0, Math.min(totalCount, Math.floor(rawCorrect)))
    : 0;
  const answeredCount = Object.keys(answers).length;
  const rawWrong = Number(raw.wrongCount);
  const wrongCount = Number.isFinite(rawWrong)
    ? Math.max(0, Math.min(totalCount, Math.floor(rawWrong)))
    : Math.max(0, answeredCount - correctCount);
  const rawSkipped = Number(raw.skippedCount);
  const skippedCount = Number.isFinite(rawSkipped)
    ? Math.max(0, Math.min(totalCount, Math.floor(rawSkipped)))
    : Math.max(0, totalCount - answeredCount);

  const hasTimer = Boolean(raw.hasTimer);
  const initialSeconds = hasTimer && Number.isFinite(Number(raw.initialSeconds))
    ? Math.max(0, Math.floor(Number(raw.initialSeconds)))
    : 0;
  const elapsedSeconds = Number.isFinite(Number(raw.elapsedSeconds))
    ? Math.max(0, Math.floor(Number(raw.elapsedSeconds)))
    : 0;

  return {
    id,
    label: typeof raw.label === "string" ? raw.label.slice(0, 160) : "",
    simType: raw.simType === "custom" ? "custom" : "full",
    examName: typeof raw.examName === "string" ? raw.examName.slice(0, 80) : "",
    completedAt: Math.floor(completedAt),
    hasTimer,
    initialSeconds,
    elapsedSeconds,
    shuffleOpts: Boolean(raw.shuffleOpts),
    questionIds,
    answers,
    flagged: cleanIdArray(raw.flagged),
    unsure: cleanIdArray(raw.unsure),
    correctCount,
    wrongCount,
    skippedCount,
    totalCount,
    scorePct: Math.round((correctCount / totalCount) * 100),
  };
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
    highlights: {},
    highlightUpdatedAt: {},
    drillStreak: {},
    drillStreakUpdatedAt: {},
    dailyStats: {},
    dailyStatsByDevice: {},
    dailyStatsUpdatedAt: 0,
    studySession: null,
    studySessionUpdatedAt: 0,
    activeSim: null,
    activeSimUpdatedAt: 0,
    simHistory: [],
    simHistoryDeleted: {},
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

  // 3b. Question stem highlights per question ([start, end][])
  const highlightQIds = new Set([
    ...Object.keys(b.highlights || {}),
    ...Object.keys(i.highlights || {}),
    ...Object.keys(b.highlightUpdatedAt || {}),
    ...Object.keys(i.highlightUpdatedAt || {}),
  ]);
  for (const qId of highlightQIds) {
    const bArr = Array.isArray(b.highlights?.[qId]) ? b.highlights[qId] : null;
    const bRawTs = Number(b.highlightUpdatedAt?.[qId]) || 0;
    const bTs = bRawTs > 0 ? bRawTs : bArr && bArr.length > 0 ? 1 : 0;

    const iArr = Array.isArray(i.highlights?.[qId]) ? i.highlights[qId] : null;
    const iRawTs = Number(i.highlightUpdatedAt?.[qId]) || 0;
    const iTs = iRawTs > 0 ? iRawTs : iArr && iArr.length > 0 ? 1 : 0;

    const winTs = Math.max(bTs, iTs);
    if (winTs <= resetAt) continue;
    const winArr = iTs >= bTs ? iArr : bArr;
    if (Array.isArray(winArr)) {
      const valid = [];
      for (const r of winArr) {
        if (!Array.isArray(r) || r.length < 2) continue;
        const s = Math.max(0, Math.floor(Number(r[0])));
        const e = Math.max(0, Math.floor(Number(r[1])));
        if (Number.isFinite(s) && Number.isFinite(e) && e > s) valid.push([s, e]);
      }
      if (valid.length > 0) {
        valid.sort((a, b2) => a[0] - b2[0] || a[1] - b2[1]);
        const norm = [valid[0]];
        for (let idx = 1; idx < valid.length; idx++) {
          const last = norm[norm.length - 1];
          if (valid[idx][0] <= last[1]) last[1] = Math.max(last[1], valid[idx][1]);
          else norm.push(valid[idx]);
        }
        merged.highlights[qId] = norm;
      }
    }
    merged.highlightUpdatedAt[qId] = winTs;
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

  // 7. Study session state (LWW by studySessionUpdatedAt)
  const bSess = sanitizeStudySession(b.studySession);
  const bSessRawTs = Number(b.studySessionUpdatedAt) || 0;
  const bSessTs = bSessRawTs > 0 ? bSessRawTs : bSess ? 1 : 0;

  const iSess = sanitizeStudySession(i.studySession);
  const iSessRawTs = Number(i.studySessionUpdatedAt) || 0;
  const iSessTs = iSessRawTs > 0 ? iSessRawTs : iSess ? 1 : 0;

  const winSessTs = Math.max(bSessTs, iSessTs);
  if (winSessTs > resetAt) {
    merged.studySession =
      iSessTs > bSessTs ? iSess : bSessTs > iSessTs ? bSess : iSess ?? bSess;
    merged.studySessionUpdatedAt = winSessTs;
  }

  // 8. Active exam simulation (LWW with tombstone support via activeSim: null)
  const bSim = sanitizeActiveSim(b.activeSim);
  const bSimRawTs = Number(b.activeSimUpdatedAt) || 0;
  const bSimTs = bSimRawTs > 0 ? bSimRawTs : bSim ? 1 : 0;

  const iSim = sanitizeActiveSim(i.activeSim);
  const iSimRawTs = Number(i.activeSimUpdatedAt) || 0;
  const iSimTs = iSimRawTs > 0 ? iSimRawTs : iSim ? 1 : 0;

  const winSimTs = Math.max(bSimTs, iSimTs);
  if (winSimTs > resetAt) {
    let winSim;
    if (iSimTs > bSimTs) winSim = iSim;
    else if (bSimTs > iSimTs) winSim = bSim;
    else winSim = iSim === null || bSim === null ? null : iSim ?? bSim;
    merged.activeSim = winSim;
    merged.activeSimUpdatedAt = winSimTs;
  }

  // 9. Completed exam simulation history + deletion tombstones
  const simDelIds = new Set([
    ...Object.keys(b.simHistoryDeleted || {}),
    ...Object.keys(i.simHistoryDeleted || {}),
  ]);
  for (const simId of simDelIds) {
    if (typeof simId !== "string" || !simId || simId.length > 80) continue;
    const delTs = Math.max(
      Number(b.simHistoryDeleted?.[simId]) || 0,
      Number(i.simHistoryDeleted?.[simId]) || 0
    );
    if (delTs > resetAt) {
      merged.simHistoryDeleted[simId] = delTs;
    }
  }

  const simById = new Map();
  for (const list of [b.simHistory, i.simHistory]) {
    if (!Array.isArray(list)) continue;
    for (const rawItem of list) {
      const clean = sanitizeSimHistoryEntry(rawItem);
      if (!clean) continue;
      if (clean.completedAt <= resetAt) continue;
      const delTs = merged.simHistoryDeleted[clean.id] || 0;
      if (delTs > 0 && clean.completedAt <= delTs) continue;
      const existing = simById.get(clean.id);
      if (!existing || clean.completedAt >= existing.completedAt) {
        simById.set(clean.id, clean);
      }
    }
  }
  merged.simHistory = Array.from(simById.values())
    .sort((a, b2) => b2.completedAt - a.completedAt)
    .slice(0, MAX_SIM_HISTORY_LEN);

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

async function getBlockedStatus(db, userId, existingIdentity = null) {
  if (existingIdentity && Number(existingIdentity.blocked) === 1) {
    return {
      blocked: true,
      blockedAt: Number(existingIdentity.blocked_at) || 0,
      reason: String(existingIdentity.blocked_reason || "").trim(),
    };
  }
  if (!userId) return { blocked: false, blockedAt: 0, reason: "" };
  try {
    const row = await db
      .prepare("SELECT reason, blocked_at FROM blocked_users WHERE user_id = ?")
      .bind(userId)
      .first();
    if (row) {
      return {
        blocked: true,
        blockedAt: Number(row.blocked_at) || 0,
        reason: String(row.reason || "").trim(),
      };
    }
  } catch {
    // Table might not exist yet before migration
  }
  return { blocked: false, blockedAt: 0, reason: "" };
}

function buildBlockedErrorResult(blockInfo) {
  const reason = String(blockInfo?.reason || "").trim();
  return {
    ok: false,
    status: 403,
    blocked: true,
    blockedReason: reason,
    error: reason ? `המשתמש נחסם על ידי המנהל: ${reason}` : "המשתמש נחסם על ידי המנהל",
  };
}

function authFailureResponse(auth) {
  const extra = auth.blocked ? { blocked: true, blockedReason: auth.blockedReason || "" } : {};
  return errorResponse(auth.error, auth.status, extra);
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
      `SELECT user_id, name, emoji, category, client_secret_hash, sync_code_hash, last_seen_at,
              blocked, blocked_at, blocked_reason, admin_renamed_at, COALESCE(role, 'user') AS role
       FROM identities WHERE user_id = ?`
    )
    .bind(userId)
    .first();

  const blockInfo = await getBlockedStatus(db, userId, existing);
  if (blockInfo.blocked) {
    return buildBlockedErrorResult(blockInfo);
  }

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
      `SELECT user_id, name, emoji, category, client_secret_hash, sync_code_hash, last_seen_at,
              blocked, blocked_at, blocked_reason, admin_renamed_at, COALESCE(role, 'user') AS role
       FROM identities WHERE user_id = ?`
    )
    .bind(userId)
    .first();

  const blockInfo = await getBlockedStatus(db, userId, existing);
  if (blockInfo.blocked) {
    return buildBlockedErrorResult(blockInfo);
  }

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
        `SELECT user_id, name, emoji, category, client_secret_hash, sync_code_hash, last_seen_at,
                blocked, blocked_at, blocked_reason, admin_renamed_at, COALESCE(role, 'user') AS role
         FROM identities WHERE user_id = ?`
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
  invalidateCommunityCache();
}

async function syncDeletionToUserProgress(db, userId, qId, kind, now = Date.now()) {
  if (!userId || !qId) return;
  const row = await db
    .prepare("SELECT progress_json, version FROM user_progress WHERE user_id = ?")
    .bind(userId)
    .first();
  if (!row) return;
  const prog = parseJsonSafe(row.progress_json, null);
  if (!prog || typeof prog !== "object") return;

  let changed = false;
  if (kind === "note") {
    const hadNote = Boolean(prog.notes && Object.prototype.hasOwnProperty.call(prog.notes, qId));
    const prevTs = Number(prog.noteUpdatedAt?.[qId]) || 0;
    if (hadNote || prevTs < now) {
      if (prog.notes && typeof prog.notes === "object") {
        delete prog.notes[qId];
      }
      if (!prog.noteUpdatedAt || typeof prog.noteUpdatedAt !== "object") {
        prog.noteUpdatedAt = {};
      }
      prog.noteUpdatedAt[qId] = now;
      changed = true;
    }
  } else if (kind === "problem") {
    const hadFlag = Boolean(prog.flags?.[qId]?.problem);
    const prevTs = Number(prog.flagUpdatedAt?.[qId]?.problem) || 0;
    if (hadFlag || prevTs < now) {
      if (prog.flags?.[qId] && typeof prog.flags[qId] === "object") {
        delete prog.flags[qId].problem;
        if (Object.keys(prog.flags[qId]).length === 0) {
          delete prog.flags[qId];
        }
      }
      if (!prog.flagUpdatedAt || typeof prog.flagUpdatedAt !== "object") {
        prog.flagUpdatedAt = {};
      }
      if (!prog.flagUpdatedAt[qId] || typeof prog.flagUpdatedAt[qId] !== "object") {
        prog.flagUpdatedAt[qId] = {};
      }
      prog.flagUpdatedAt[qId].problem = now;
      changed = true;
    }
  }

  if (!changed) return;
  const serialized = JSON.stringify(prog);
  if (serialized.length > MAX_PROGRESS_JSON_BYTES) return;
  const nextVersion = (Number(row.version) || 1) + 1;
  await db
    .prepare("UPDATE user_progress SET progress_json = ?, updated_at = ?, version = ? WHERE user_id = ?")
    .bind(serialized, now, nextVersion, userId)
    .run();
  invalidateLeaderboardCache();
}

async function fetchCommunityData(db) {
  const [notesRes, noteRepliesRes, probsRes, problemFlagsRes, overridesRes] = await Promise.all([
    db.prepare("SELECT q_id, user_id, author, emoji, category, text, updated_at FROM community_notes").all(),
    db
      .prepare(
        `SELECT reply_id, q_id, note_user_id, parent_reply_id, reply_to_author, user_id, author, emoji, category, text, created_at, updated_at
         FROM note_replies
         ORDER BY created_at ASC`
      )
      .all(),
    db.prepare("SELECT q_id, user_id, type, text, author, emoji, category, updated_at FROM community_problems").all(),
    db
      .prepare("SELECT q_id, problem_user_id, flagger_user_id, author, emoji, category, created_at FROM problem_flags")
      .all(),
    db.prepare(
      "SELECT q_id, hidden, stem, options_json, correct_json, all_accepted, appeal_note, subject, updated_at, updated_by_user_id, updated_by_name, updated_by_emoji, updated_by_role FROM question_overrides"
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

  const noteReplies = {};
  for (const r of noteRepliesRes.results || []) {
    if (!notes[r.q_id]?.[r.note_user_id]) continue;
    if (!noteReplies[r.q_id]) noteReplies[r.q_id] = {};
    if (!noteReplies[r.q_id][r.note_user_id]) noteReplies[r.q_id][r.note_user_id] = [];
    noteReplies[r.q_id][r.note_user_id].push({
      replyId: r.reply_id,
      parentReplyId: r.parent_reply_id || null,
      replyToAuthor: r.reply_to_author || "",
      userId: r.user_id,
      author: r.author,
      emoji: r.emoji,
      category: r.category,
      text: r.text,
      createdAt: Number(r.created_at) || 0,
      updatedAt: Number(r.updated_at) || 0,
    });
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

  const problemFlags = {};
  for (const r of problemFlagsRes.results || []) {
    if (!problems[r.q_id]?.[r.problem_user_id]) continue;
    if (!problemFlags[r.q_id]) problemFlags[r.q_id] = {};
    if (!problemFlags[r.q_id][r.problem_user_id]) problemFlags[r.q_id][r.problem_user_id] = {};
    problemFlags[r.q_id][r.problem_user_id][r.flagger_user_id] = {
      author: r.author,
      emoji: r.emoji,
      category: r.category,
      createdAt: Number(r.created_at) || 0,
    };
  }

  const overrides = {};
  for (const r of overridesRes.results || []) {
    overrides[r.q_id] = formatOverrideRow(r);
  }

  return { notes, noteReplies, problems, problemFlags, overrides };
}

async function getCachedCommunityData(db, version) {
  const safeVersion = Number(version) || 0;
  if (safeVersion > 0 && communityCache.version === safeVersion && communityCache.data) {
    return communityCache.data;
  }
  if (safeVersion > 0 && communityCacheInFlight.version === safeVersion && communityCacheInFlight.promise) {
    return communityCacheInFlight.promise;
  }

  const epochBefore = communityInvalidationEpoch;
  const fetchPromise = fetchCommunityData(db).then((data) => {
    if (safeVersion > 0 && epochBefore === communityInvalidationEpoch && safeVersion >= communityCache.version) {
      communityCache = { version: safeVersion, data };
    }
    return data;
  });

  if (safeVersion > 0) {
    communityCacheInFlight = { version: safeVersion, promise: fetchPromise };
    fetchPromise.finally(() => {
      if (communityCacheInFlight.promise === fetchPromise) {
        communityCacheInFlight = { version: 0, promise: null };
      }
    });
  }
  return fetchPromise;
}

async function handleBootstrap(env) {
  const now = Date.now();
  const [communityVersion, takenNames, onlineUsers, customIdentities] = await Promise.all([
    getCommunityVersion(env.DB),
    getTakenNamesMap(env.DB),
    getOnlineUsersList(env.DB, now),
    getCustomIdentitiesList(env.DB),
  ]);
  const communityData = await getCachedCommunityData(env.DB, communityVersion);

  return jsonResponse({
    ok: true,
    communityVersion,
    ...communityData,
    takenNames,
    customIdentities,
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
  const hasAdminAuthHeader = Boolean((request.headers.get("Authorization") || "").trim());

  const [serverCommunityVersion, auth, adminAuth] = await Promise.all([
    getCommunityVersion(env.DB),
    hasAuthHeaders ? verifyExistingClientSecret(env.DB, userId, clientSecret, { touchPresence }) : Promise.resolve(null),
    hasAdminAuthHeader ? verifyAdminToken(request, env, { touchPresence }) : Promise.resolve(null),
  ]);

  const now = Date.now();
  const communityChanged = serverCommunityVersion !== clientCommunityVersion;

  const [onlineUsers, communityData, progressRow] = await Promise.all([
    getOnlineUsersList(env.DB, now),
    communityChanged ? getCachedCommunityData(env.DB, serverCommunityVersion) : Promise.resolve(null),
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

  if (hasAdminAuthHeader && adminAuth) {
    payload.adminSessionValid = Boolean(adminAuth.valid);
    if (adminAuth.valid) {
      payload.adminSessionId = adminAuth.sessionId || null;
      payload.adminExpiresAt = adminAuth.expiresAt || 0;
    }
  }

  if (communityChanged && communityData) {
    payload.notes = communityData.notes;
    payload.noteReplies = communityData.noteReplies;
    payload.problems = communityData.problems;
    payload.problemFlags = communityData.problemFlags;
    payload.overrides = communityData.overrides;
  }

  if (hasAuthHeaders && auth) {
    if (!auth.ok) {
      if (auth.blocked) {
        payload.progressStatus = 403;
        payload.blocked = true;
        payload.blockedReason = auth.blockedReason || "";
        payload.progressChanged = false;
        payload.progressError = auth.error;
      } else if (auth.status === 404) {
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
    } else {
      if (auth.identity) {
        payload.identity = {
          userId: auth.identity.user_id,
          name: auth.identity.name,
          emoji: auth.identity.emoji,
          category: auth.identity.category,
          adminRenamedAt: Number(auth.identity.admin_renamed_at) || 0,
          role: normalizeUserRole(auth.identity.role),
        };
      }
      if (!progressRow) {
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

async function fetchLeaderboardBaseEntries(db) {
  const { results } = await db
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
       WHERE i.name != ''
         AND COALESCE(i.blocked, 0) = 0
         AND i.user_id NOT IN (SELECT user_id FROM blocked_users)`
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
    entries.push({
      userId: r.userId,
      name: r.name,
      emoji: String(r.emoji || "👤").trim(),
      category: String(r.category || "").trim(),
      solvedCount,
      notesCount,
      lastSeenAt: Number(r.lastSeenAt) || 0,
    });
  }
  return entries;
}

async function getCachedLeaderboardBaseEntries(db, now = Date.now()) {
  if (
    leaderboardCache.entries &&
    now - leaderboardCache.fetchedAt < LEADERBOARD_CACHE_TTL_MS
  ) {
    return leaderboardCache.entries;
  }
  if (leaderboardInFlight) {
    return leaderboardInFlight;
  }

  const epochBefore = leaderboardInvalidationEpoch;
  const fetchPromise = fetchLeaderboardBaseEntries(db).then((entries) => {
    if (epochBefore === leaderboardInvalidationEpoch) {
      leaderboardCache = { entries, fetchedAt: Date.now() };
    }
    return entries;
  });

  leaderboardInFlight = fetchPromise;
  fetchPromise.finally(() => {
    if (leaderboardInFlight === fetchPromise) {
      leaderboardInFlight = null;
    }
  });
  return fetchPromise;
}

async function handleLeaderboard(env, sortBy = "answers") {
  const now = Date.now();
  const baseEntries = await getCachedLeaderboardBaseEntries(env.DB, now);
  const entries = baseEntries.map((entry) => ({
    ...entry,
    isOnline: now - entry.lastSeenAt <= ONLINE_WINDOW_MS,
  }));

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
    .prepare(
      `SELECT user_id, name, emoji, category, client_secret_hash,
              blocked, blocked_at, blocked_reason, admin_renamed_at, COALESCE(role, 'user') AS role
       FROM identities WHERE user_id = ?`
    )
    .bind(userId)
    .first();

  const blockInfo = await getBlockedStatus(env.DB, userId, existing);
  if (blockInfo.blocked) {
    const blockedRes = buildBlockedErrorResult(blockInfo);
    return errorResponse(blockedRes.error, 403, {
      blocked: true,
      blockedReason: blockedRes.blockedReason,
    });
  }

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

  const now = Date.now();
  const isAdminRenamed = Boolean(existing && Number(existing.admin_renamed_at) > 0);
  const effectiveRole = normalizeUserRole(existing?.role);
  let effectiveIdentity = { userId, name, emoji, category, adminRenamedAt: 0, role: effectiveRole };

  if (isAdminRenamed) {
    await env.DB
      .prepare(
        `UPDATE identities
         SET client_secret_hash = COALESCE(client_secret_hash, ?), last_seen_at = ?
         WHERE user_id = ?`
      )
      .bind(secretHash, now, userId)
      .run();
    if (matchedDeviceSecret) {
      await env.DB
        .prepare("UPDATE user_device_secrets SET last_seen_at = ? WHERE secret_hash = ?")
        .bind(now, secretHash)
        .run();
    }
    effectiveIdentity = {
      userId: existing.user_id,
      name: existing.name,
      emoji: existing.emoji,
      category: existing.category || "",
      adminRenamedAt: Number(existing.admin_renamed_at) || 0,
      role: effectiveRole,
    };
  } else {
    const conflictRow = await env.DB
      .prepare("SELECT user_id FROM identities WHERE name = ? AND user_id != ?")
      .bind(name, userId)
      .first();

    if (conflictRow) {
      const takenNames = await getTakenNamesMap(env.DB);
      return jsonResponse({ ok: false, conflict: true, takenNames }, 409);
    }

    if (existing) {
      const profileChanged =
        existing.name !== name ||
        existing.emoji !== emoji ||
        String(existing.category || "") !== category;
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
      if (profileChanged) {
        invalidateLeaderboardCache();
      }
    } else {
      await env.DB
        .prepare(
          `INSERT INTO identities (user_id, name, emoji, category, client_secret_hash, first_seen_at, last_seen_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(userId, name, emoji, category, secretHash, now, now)
        .run();
      invalidateLeaderboardCache();
    }
  }

  const onlineUsers = await getOnlineUsersList(env.DB, now);
  return jsonResponse({
    ok: true,
    conflict: false,
    identity: effectiveIdentity,
    lastSeenAt: now,
    onlineUsers,
    serverTime: now,
  });
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
    return authFailureResponse(auth);
  }

  const trimmed = text.trim();
  if (!trimmed) {
    const now = Date.now();
    const [delRes, delRepliesRes] = await env.DB.batch([
      env.DB.prepare("DELETE FROM community_notes WHERE q_id = ? AND user_id = ?").bind(qId, userId),
      env.DB.prepare("DELETE FROM note_replies WHERE q_id = ? AND note_user_id = ?").bind(qId, userId),
    ]);
    if ((delRes?.meta?.changes ?? 0) > 0 || (delRepliesRes?.meta?.changes ?? 0) > 0) {
      await bumpCommunityVersion(env.DB, now);
      await syncDeletionToUserProgress(env.DB, userId, qId, "note", now);
      invalidateLeaderboardCache();
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
  invalidateLeaderboardCache();

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
  if (!auth.ok) return authFailureResponse(auth);

  // Prevent creating a bogus empty identity from deleting a non-existent note, or deleting someone else's
  const existingNote = await env.DB
    .prepare("SELECT user_id FROM community_notes WHERE q_id = ? AND user_id = ?")
    .bind(qId, userId)
    .first();

  if (existingNote) {
    const now = Date.now();
    await env.DB.batch([
      env.DB.prepare("DELETE FROM community_notes WHERE q_id = ? AND user_id = ?").bind(qId, userId),
      env.DB.prepare("DELETE FROM note_replies WHERE q_id = ? AND note_user_id = ?").bind(qId, userId),
    ]);
    await bumpCommunityVersion(env.DB, now);
    await syncDeletionToUserProgress(env.DB, userId, qId, "note", now);
    invalidateLeaderboardCache();
  }

  return jsonResponse({ ok: true, deleted: Boolean(existingNote) });
}

async function collectDescendantReplyIds(db, qId, noteUserId, rootReplyId) {
  const { results } = await db
    .prepare("SELECT reply_id, parent_reply_id FROM note_replies WHERE q_id = ? AND note_user_id = ?")
    .bind(qId, noteUserId)
    .all();
  const childrenMap = new Map();
  for (const r of results || []) {
    const pid = r.parent_reply_id || "";
    if (!childrenMap.has(pid)) childrenMap.set(pid, []);
    childrenMap.get(pid).push(r.reply_id);
  }
  const toDelete = [];
  const stack = [rootReplyId];
  const seen = new Set();
  while (stack.length > 0) {
    const cur = stack.pop();
    if (!cur || seen.has(cur)) continue;
    seen.add(cur);
    toDelete.push(cur);
    const kids = childrenMap.get(cur) || [];
    for (const k of kids) stack.push(k);
  }
  return toDelete;
}

async function handleCreateNoteReply(request, env, qId, noteUserId) {
  const body = await readJsonBody(request);
  if (!body) return errorResponse("Invalid JSON", 400);

  const userId = String(body.userId || "").trim();
  const author = String(body.author || "").trim();
  const emoji = String(body.emoji || "💬").trim();
  const category = String(body.category || "").trim();
  const text = typeof body.text === "string" ? body.text.trim() : "";
  const parentReplyId = typeof body.parentReplyId === "string" && body.parentReplyId.trim()
    ? body.parentReplyId.trim()
    : null;
  const requestedReplyId = typeof body.replyId === "string" ? body.replyId.trim() : "";
  const clientSecret = typeof body.clientSecret === "string" ? body.clientSecret : "";

  if (!noteUserId) return errorResponse("Missing noteUserId", 400);
  if (!text) return errorResponse("Reply text is required", 400);
  if (text.length > 4000) return errorResponse("Reply is too long (max 4000 chars)", 400);
  if (requestedReplyId && (requestedReplyId.length > 80 || !/^[a-zA-Z0-9_-]+$/.test(requestedReplyId))) {
    return errorResponse("Invalid replyId", 400);
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
    return authFailureResponse(auth);
  }

  const targetNote = await env.DB
    .prepare("SELECT q_id, author, emoji FROM community_notes WHERE q_id = ? AND user_id = ? AND TRIM(text) != ''")
    .bind(qId, noteUserId)
    .first();
  if (!targetNote) {
    return errorResponse("Parent note not found", 404);
  }

  let replyToAuthor = `${targetNote.emoji || "💬"} ${targetNote.author || "אנונימי"}`.trim();
  if (parentReplyId) {
    const parentReply = await env.DB
      .prepare("SELECT reply_id, author, emoji FROM note_replies WHERE reply_id = ? AND q_id = ? AND note_user_id = ?")
      .bind(parentReplyId, qId, noteUserId)
      .first();
    if (!parentReply) {
      return errorResponse("Parent reply not found", 404);
    }
    replyToAuthor = `${parentReply.emoji || "💬"} ${parentReply.author || "אנונימי"}`.trim();
  }

  const now = Date.now();
  const replyId = requestedReplyId || `r_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const finalAuthor = author || "אנונימי";

  await env.DB
    .prepare(
      `INSERT INTO note_replies
         (reply_id, q_id, note_user_id, parent_reply_id, reply_to_author, user_id, author, emoji, category, text, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(replyId, qId, noteUserId, parentReplyId, replyToAuthor, userId, finalAuthor, emoji, category, text, now, now)
    .run();
  await bumpCommunityVersion(env.DB, now);

  return jsonResponse({
    ok: true,
    reply: {
      replyId,
      parentReplyId,
      replyToAuthor,
      userId,
      author: finalAuthor,
      emoji,
      category,
      text,
      createdAt: now,
      updatedAt: now,
    },
  });
}

async function handlePutNoteReply(request, env, replyId) {
  const body = await readJsonBody(request);
  if (!body) return errorResponse("Invalid JSON", 400);

  const userId = String(body.userId || "").trim();
  const author = String(body.author || "").trim();
  const emoji = String(body.emoji || "💬").trim();
  const category = String(body.category || "").trim();
  const text = typeof body.text === "string" ? body.text.trim() : "";
  const clientSecret = typeof body.clientSecret === "string" ? body.clientSecret : "";

  const auth = await verifyExistingClientSecret(env.DB, userId, clientSecret);
  if (!auth.ok) return authFailureResponse(auth);

  const existing = await env.DB
    .prepare("SELECT reply_id, q_id, note_user_id, parent_reply_id, reply_to_author, user_id, created_at FROM note_replies WHERE reply_id = ?")
    .bind(replyId)
    .first();
  if (!existing) return errorResponse("Reply not found", 404);
  if (existing.user_id !== userId) return errorResponse("Forbidden: not your reply", 403);
  if (!text) return errorResponse("Reply text cannot be empty", 400);
  if (text.length > 4000) return errorResponse("Reply is too long (max 4000 chars)", 400);

  const now = Date.now();
  const finalAuthor = author || "אנונימי";
  await env.DB
    .prepare(
      `UPDATE note_replies
       SET author = ?, emoji = ?, category = ?, text = ?, updated_at = ?
       WHERE reply_id = ?`
    )
    .bind(finalAuthor, emoji, category, text, now, replyId)
    .run();
  await bumpCommunityVersion(env.DB, now);

  return jsonResponse({
    ok: true,
    reply: {
      replyId: existing.reply_id,
      parentReplyId: existing.parent_reply_id || null,
      replyToAuthor: existing.reply_to_author || "",
      userId,
      author: finalAuthor,
      emoji,
      category,
      text,
      createdAt: Number(existing.created_at) || now,
      updatedAt: now,
    },
  });
}

async function handleDeleteNoteReply(request, env, replyId) {
  const body = await readJsonBody(request);
  if (body === null) return errorResponse("Invalid JSON", 400);

  const userId = String(body.userId || request.headers.get("X-User-Id") || "").trim();
  const clientSecret = String(body.clientSecret || request.headers.get("X-Client-Secret") || "");

  const auth = await verifyExistingClientSecret(env.DB, userId, clientSecret);
  if (!auth.ok) return authFailureResponse(auth);

  const existing = await env.DB
    .prepare("SELECT reply_id, q_id, note_user_id, user_id FROM note_replies WHERE reply_id = ?")
    .bind(replyId)
    .first();
  if (!existing) return jsonResponse({ ok: true, deletedIds: [] });
  if (existing.user_id !== userId) return errorResponse("Forbidden: not your reply", 403);

  const idsToDelete = await collectDescendantReplyIds(env.DB, existing.q_id, existing.note_user_id, replyId);
  const stmts = idsToDelete.map((id) => env.DB.prepare("DELETE FROM note_replies WHERE reply_id = ?").bind(id));
  for (let idx = 0; idx < stmts.length; idx += 50) {
    await env.DB.batch(stmts.slice(idx, idx + 50));
  }
  await bumpCommunityVersion(env.DB, Date.now());
  return jsonResponse({ ok: true, deletedIds: idsToDelete });
}

async function handlePutProblemFlag(request, env, qId, problemUserId) {
  const body = await readJsonBody(request);
  if (!body) return errorResponse("Invalid JSON", 400);

  const userId = String(body.userId || "").trim();
  const author = String(body.author || "").trim();
  const emoji = String(body.emoji || "⚠️").trim();
  const category = String(body.category || "").trim();
  const clientSecret = typeof body.clientSecret === "string" ? body.clientSecret : "";

  if (!problemUserId) return errorResponse("Missing problemUserId", 400);
  if (userId && userId === problemUserId) {
    return errorResponse("Cannot flag your own problem report", 400);
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
    return authFailureResponse(auth);
  }

  const targetProb = await env.DB
    .prepare("SELECT q_id FROM community_problems WHERE q_id = ? AND user_id = ?")
    .bind(qId, problemUserId)
    .first();
  if (!targetProb) {
    return errorResponse("Problem report not found", 404);
  }

  const createdAt = Date.now();
  await env.DB
    .prepare(
      `INSERT INTO problem_flags (q_id, problem_user_id, flagger_user_id, author, emoji, category, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(q_id, problem_user_id, flagger_user_id) DO UPDATE SET
         author = excluded.author,
         emoji = excluded.emoji,
         category = excluded.category,
         created_at = excluded.created_at`
    )
    .bind(qId, problemUserId, userId, author || "אנונימי", emoji, category, createdAt)
    .run();
  await bumpCommunityVersion(env.DB, createdAt);

  return jsonResponse({
    ok: true,
    flag: { author: author || "אנונימי", emoji, category, createdAt },
  });
}

async function handleDeleteProblemFlag(request, env, qId, problemUserId) {
  const body = await readJsonBody(request);
  if (body === null) return errorResponse("Invalid JSON", 400);

  const userId = String(body.userId || request.headers.get("X-User-Id") || "").trim();
  const clientSecret = String(body.clientSecret || request.headers.get("X-Client-Secret") || "");

  const auth = await verifyOrBindClientSecret(env.DB, userId, clientSecret);
  if (!auth.ok) return authFailureResponse(auth);

  const now = Date.now();
  const delRes = await env.DB
    .prepare("DELETE FROM problem_flags WHERE q_id = ? AND problem_user_id = ? AND flagger_user_id = ?")
    .bind(qId, problemUserId, userId)
    .run();
  const deleted = (delRes?.meta?.changes ?? 0) > 0;
  if (deleted) {
    await bumpCommunityVersion(env.DB, now);
  }

  return jsonResponse({ ok: true, deleted });
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
    return authFailureResponse(auth);
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
  if (!auth.ok) return authFailureResponse(auth);

  const existing = await env.DB
    .prepare("SELECT user_id FROM community_problems WHERE q_id = ? AND user_id = ?")
    .bind(qId, userId)
    .first();

  if (existing) {
    const now = Date.now();
    await env.DB.batch([
      env.DB.prepare("DELETE FROM community_problems WHERE q_id = ? AND user_id = ?").bind(qId, userId),
      env.DB.prepare("DELETE FROM problem_flags WHERE q_id = ? AND problem_user_id = ?").bind(qId, userId),
    ]);
    await bumpCommunityVersion(env.DB, now);
    await syncDeletionToUserProgress(env.DB, userId, qId, "problem", now);
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
    return authFailureResponse(auth);
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
    return authFailureResponse(auth);
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
  invalidateLeaderboardCache();

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
    return authFailureResponse(auth);
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
  if (!auth.ok) return authFailureResponse(auth);

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
  if (!auth.ok) return authFailureResponse(auth);

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
    .prepare("SELECT user_id, name, emoji, category, blocked, blocked_at, blocked_reason, COALESCE(role, 'user') AS role FROM identities WHERE sync_code_hash = ?")
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

  const targetBlock = await getBlockedStatus(env.DB, target.user_id, target);
  if (targetBlock.blocked) {
    return authFailureResponse(buildBlockedErrorResult(targetBlock));
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
    .prepare("SELECT user_id, name, emoji, category, blocked, blocked_at, blocked_reason, COALESCE(role, 'user') AS role FROM identities WHERE sync_code_hash = ?")
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

  const targetBlock = await getBlockedStatus(env.DB, target.user_id, target);
  if (targetBlock.blocked) {
    return authFailureResponse(buildBlockedErrorResult(targetBlock));
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
    invalidateLeaderboardCache();
  }

  // Transfer or release temporary guest identity if provided
  let guestReleased = false;
  const guestUserId = String(body.guestUserId || "").trim();
  const guestClientSecret = typeof body.guestClientSecret === "string" ? body.guestClientSecret : "";
  if (guestUserId && guestUserId !== target.user_id && guestClientSecret) {
    const guestAuth = await verifyExistingClientSecret(env.DB, guestUserId, guestClientSecret);
    if (guestAuth.ok) {
      if (mode === "merge") {
        const [guestNotesRes, targetNotesRes, guestProbsRes, targetProbsRes, guestProbFlagsRes, guestRepliesRes] = await Promise.all([
          env.DB.prepare("SELECT q_id, text, updated_at FROM community_notes WHERE user_id = ?").bind(guestUserId).all(),
          env.DB.prepare("SELECT q_id FROM community_notes WHERE user_id = ?").bind(target.user_id).all(),
          env.DB.prepare("SELECT q_id, type, text, updated_at FROM community_problems WHERE user_id = ?").bind(guestUserId).all(),
          env.DB.prepare("SELECT q_id FROM community_problems WHERE user_id = ?").bind(target.user_id).all(),
          env.DB.prepare("SELECT q_id, problem_user_id, created_at FROM problem_flags WHERE flagger_user_id = ?").bind(guestUserId).all(),
          env.DB.prepare("SELECT reply_id FROM note_replies WHERE user_id = ?").bind(guestUserId).all(),
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
                .bind(gn.q_id, target.user_id, target.name, target.emoji, target.category, gn.text, gn.updated_at),
              env.DB
                .prepare("UPDATE note_replies SET note_user_id = ? WHERE q_id = ? AND note_user_id = ?")
                .bind(target.user_id, gn.q_id, guestUserId)
            );
          } else {
            stmts.push(
              env.DB.prepare("DELETE FROM note_replies WHERE q_id = ? AND note_user_id = ?").bind(gn.q_id, guestUserId)
            );
          }
          stmts.push(
            env.DB.prepare("DELETE FROM community_notes WHERE q_id = ? AND user_id = ?").bind(gn.q_id, guestUserId)
          );
        }

        if ((guestRepliesRes.results || []).length > 0) {
          stmts.push(
            env.DB
              .prepare("UPDATE note_replies SET user_id = ?, author = ?, emoji = ?, category = ? WHERE user_id = ?")
              .bind(target.user_id, target.name, target.emoji, target.category, guestUserId)
          );
        }

        for (const gf of guestProbFlagsRes.results || []) {
          if (gf.problem_user_id !== target.user_id) {
            stmts.push(
              env.DB
                .prepare(
                  `INSERT OR IGNORE INTO problem_flags (q_id, problem_user_id, flagger_user_id, author, emoji, category, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?)`
                )
                .bind(gf.q_id, gf.problem_user_id, target.user_id, target.name, target.emoji, target.category, gf.created_at)
            );
          }
          stmts.push(
            env.DB
              .prepare("DELETE FROM problem_flags WHERE q_id = ? AND problem_user_id = ? AND flagger_user_id = ?")
              .bind(gf.q_id, gf.problem_user_id, guestUserId)
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
                ),
              env.DB
                .prepare("DELETE FROM problem_flags WHERE q_id = ? AND problem_user_id = ? AND flagger_user_id = ?")
                .bind(gp.q_id, guestUserId, target.user_id),
              env.DB
                .prepare("UPDATE OR IGNORE problem_flags SET problem_user_id = ? WHERE q_id = ? AND problem_user_id = ?")
                .bind(target.user_id, gp.q_id, guestUserId)
            );
          }
          stmts.push(
            env.DB.prepare("DELETE FROM problem_flags WHERE q_id = ? AND problem_user_id = ?").bind(gp.q_id, guestUserId),
            env.DB.prepare("DELETE FROM community_problems WHERE q_id = ? AND user_id = ?").bind(gp.q_id, guestUserId)
          );
        }

        if (stmts.length > 0) {
          const CHUNK_SIZE = 50;
          for (let idx = 0; idx < stmts.length; idx += CHUNK_SIZE) {
            await env.DB.batch(stmts.slice(idx, idx + CHUNK_SIZE));
          }
          await bumpCommunityVersion(env.DB, now);
          invalidateLeaderboardCache();
        }
      }

      const [remNotes, remProbs, remProbFlags, remReplies] = await Promise.all([
        env.DB.prepare("SELECT COUNT(*) AS cnt FROM community_notes WHERE user_id = ?").bind(guestUserId).first(),
        env.DB.prepare("SELECT COUNT(*) AS cnt FROM community_problems WHERE user_id = ?").bind(guestUserId).first(),
        env.DB
          .prepare("SELECT COUNT(*) AS cnt FROM problem_flags WHERE flagger_user_id = ? OR problem_user_id = ?")
          .bind(guestUserId, guestUserId)
          .first(),
        env.DB
          .prepare("SELECT COUNT(*) AS cnt FROM note_replies WHERE user_id = ? OR note_user_id = ?")
          .bind(guestUserId, guestUserId)
          .first(),
      ]);
      const remainingCount =
        (Number(remNotes?.cnt) || 0) +
        (Number(remProbs?.cnt) || 0) +
        (Number(remProbFlags?.cnt) || 0) +
        (Number(remReplies?.cnt) || 0);
      if (remainingCount === 0) {
        await env.DB.batch([
          env.DB.prepare("DELETE FROM identities WHERE user_id = ?").bind(guestUserId),
          env.DB.prepare("DELETE FROM user_progress WHERE user_id = ?").bind(guestUserId),
          env.DB.prepare("DELETE FROM user_device_secrets WHERE user_id = ?").bind(guestUserId),
        ]);
        invalidateLeaderboardCache();
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
      role: normalizeUserRole(target.role),
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

  let sessionUserId = "";
  let sessionUserName = "";
  let sessionUserEmoji = "";
  const claimedUserId = String(body.userId || "").trim();
  const claimedSecret = typeof body.clientSecret === "string" ? body.clientSecret : "";
  if (claimedUserId && claimedSecret) {
    const identAuth = await verifyOrBindClientSecret(
      env.DB,
      claimedUserId,
      claimedSecret,
      {
        name: body.name,
        emoji: body.emoji,
        category: body.category,
      },
      { touchPresence: true }
    );
    if (identAuth.ok && identAuth.identity) {
      sessionUserId = identAuth.identity.user_id || claimedUserId;
      sessionUserName = identAuth.identity.name || String(body.name || "").trim();
      sessionUserEmoji = identAuth.identity.emoji || String(body.emoji || "").trim();
    }
  }

  const deviceLabel = String(body.deviceLabel || "").trim().slice(0, 64);
  const rememberDevice = body.rememberDevice ? 1 : 0;
  const sessionId = `adm_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const { token, expiresAt } = await issueAdminToken(env, sessionId);

  await env.DB
    .prepare(
      `INSERT INTO admin_sessions
         (session_id, user_id, user_name, user_emoji, device_label, remember_device, created_at, last_seen_at, expires_at, revoked_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`
    )
    .bind(sessionId, sessionUserId, sessionUserName, sessionUserEmoji, deviceLabel, rememberDevice, now, now, expiresAt)
    .run();

  return jsonResponse({ ok: true, token, expiresAt, sessionId });
}

async function handleAdminVerify(request, env, auth) {
  let sessionId = auth.sessionId || null;
  let upgradedToken = null;
  let expiresAt = auth.expiresAt;

  if (!sessionId) {
    const userId = String(request.headers.get("X-User-Id") || "").trim();
    const clientSecret = String(request.headers.get("X-Client-Secret") || "");
    if (userId && clientSecret) {
      const identAuth = await verifyExistingClientSecret(env.DB, userId, clientSecret, { touchPresence: true });
      if (identAuth.ok && identAuth.identity) {
        const now = Date.now();
        sessionId = `adm_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
        const issued = await issueAdminToken(env, sessionId);
        upgradedToken = issued.token;
        expiresAt = issued.expiresAt;
        await env.DB
          .prepare(
            `INSERT INTO admin_sessions
               (session_id, user_id, user_name, user_emoji, device_label, remember_device, created_at, last_seen_at, expires_at, revoked_at)
             VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, 0)`
          )
          .bind(
            sessionId,
            identAuth.identity.user_id,
            identAuth.identity.name || "",
            identAuth.identity.emoji || "",
            "",
            now,
            now,
            expiresAt
          )
          .run();
      }
    }
  }

  return jsonResponse({
    ok: true,
    admin: true,
    expiresAt,
    sessionId,
    ...(upgradedToken ? { upgradedToken } : {}),
  });
}

async function handleAdminLogout(env, auth) {
  if (auth.sessionId) {
    const now = Date.now();
    await env.DB
      .prepare("UPDATE admin_sessions SET revoked_at = ? WHERE session_id = ? AND revoked_at = 0")
      .bind(now, auth.sessionId)
      .run();
  }
  return jsonResponse({ ok: true, revoked: Boolean(auth.sessionId) });
}

async function handleAdminRevokeSession(env, sessionId) {
  const now = Date.now();
  const res = await env.DB
    .prepare("UPDATE admin_sessions SET revoked_at = ? WHERE session_id = ? AND revoked_at = 0")
    .bind(now, sessionId)
    .run();
  const revoked = (res?.meta?.changes ?? 0) > 0;
  return jsonResponse({ ok: true, sessionId, revoked });
}

async function handleAdminUsers(env, currentAdminSessionId = null) {
  const now = Date.now();
  const [{ results }, customIdentities, blockedOrphansRes, adminSessionsRes] = await Promise.all([
    env.DB
      .prepare(
        `SELECT
           i.user_id AS userId,
           i.name,
           i.emoji,
           i.category,
           i.first_seen_at AS firstSeenAt,
           i.last_seen_at AS lastSeenAt,
           COALESCE(i.blocked, 0) AS blocked,
           COALESCE(i.blocked_at, 0) AS blockedAt,
           COALESCE(i.blocked_reason, '') AS blockedReason,
           COALESCE(i.admin_renamed_at, 0) AS adminRenamedAt,
           COALESCE(i.role, 'user') AS role,
           CASE WHEN i.sync_code_hash IS NOT NULL AND i.sync_code_hash != '' THEN 1 ELSE 0 END AS hasSyncCode,
           up.progress_json AS progressJson,
           COALESCE(n.cnt, 0) AS notesCount,
           COALESCE(p.cnt, 0) AS problemsCount
         FROM identities i
         LEFT JOIN user_progress up
           ON i.user_id = up.user_id
         LEFT JOIN (SELECT user_id, COUNT(*) AS cnt FROM community_notes WHERE TRIM(text) != '' GROUP BY user_id) n
           ON i.user_id = n.user_id
         LEFT JOIN (SELECT user_id, COUNT(*) AS cnt FROM community_problems GROUP BY user_id) p
           ON i.user_id = p.user_id
         ORDER BY i.last_seen_at DESC`
      )
      .all(),
    getCustomIdentitiesList(env.DB),
    env.DB
      .prepare(
        `SELECT b.user_id AS userId, b.name, b.reason, b.blocked_at AS blockedAt
         FROM blocked_users b
         LEFT JOIN identities i ON b.user_id = i.user_id
         WHERE i.user_id IS NULL
         ORDER BY b.blocked_at DESC`
      )
      .all()
      .catch(() => ({ results: [] })),
    env.DB
      .prepare(
        `SELECT
           s.session_id AS sessionId,
           s.user_id AS userId,
           COALESCE(NULLIF(i.name, ''), s.user_name, '') AS name,
           COALESCE(NULLIF(i.emoji, ''), s.user_emoji, '🛡️') AS emoji,
           COALESCE(i.category, '') AS category,
           s.device_label AS deviceLabel,
           COALESCE(s.remember_device, 0) AS rememberDevice,
           s.created_at AS createdAt,
           s.last_seen_at AS lastSeenAt,
           s.expires_at AS expiresAt,
           COALESCE(i.blocked, 0) AS blocked
         FROM admin_sessions s
         LEFT JOIN identities i ON s.user_id = i.user_id
         WHERE s.revoked_at = 0 AND s.expires_at > ?
         ORDER BY s.last_seen_at DESC`
      )
      .bind(now)
      .all()
      .catch(() => ({ results: [] })),
  ]);

  const adminSessions = (adminSessionsRes?.results || []).map((s) => {
    const lastSeenAt = Number(s.lastSeenAt) || 0;
    return {
      sessionId: s.sessionId,
      userId: s.userId || "",
      name: s.name || "",
      emoji: s.emoji || "🛡️",
      category: s.category || "",
      deviceLabel: s.deviceLabel || "",
      rememberDevice: Boolean(s.rememberDevice),
      createdAt: Number(s.createdAt) || 0,
      lastSeenAt,
      expiresAt: Number(s.expiresAt) || 0,
      blocked: Boolean(s.blocked),
      isOnline: now - lastSeenAt <= ONLINE_WINDOW_MS,
      isCurrent: Boolean(currentAdminSessionId && s.sessionId === currentAdminSessionId),
    };
  });

  const adminUserSessionMap = new Map();
  for (const s of adminSessions) {
    if (!s.userId) continue;
    const prev = adminUserSessionMap.get(s.userId) || { connected: false, online: false, sessionCount: 0 };
    adminUserSessionMap.set(s.userId, {
      connected: true,
      online: prev.online || s.isOnline,
      sessionCount: prev.sessionCount + 1,
    });
  }

  const users = (results || []).map((r) => {
    const parsed = r.progressJson ? parseJsonSafe(r.progressJson, null) : null;
    const solvedCount = parsed?.attempts && typeof parsed.attempts === "object"
      ? Object.keys(parsed.attempts).length
      : 0;
    const admInfo = adminUserSessionMap.get(r.userId);
    const blocked = Boolean(r.blocked);
    const lastSeenAt = Number(r.lastSeenAt) || 0;
    return {
      userId: r.userId,
      name: r.name,
      emoji: r.emoji,
      category: r.category,
      firstSeenAt: r.firstSeenAt,
      lastSeenAt,
      isOnline: !blocked && now - lastSeenAt <= ONLINE_WINDOW_MS,
      blocked,
      blockedAt: Number(r.blockedAt) || 0,
      blockedReason: r.blockedReason || "",
      adminRenamedAt: Number(r.adminRenamedAt) || 0,
      role: normalizeUserRole(r.role),
      adminConnected: Boolean(admInfo?.connected),
      adminOnline: Boolean(admInfo?.online),
      notesCount: Number(r.notesCount) || 0,
      problemsCount: Number(r.problemsCount) || 0,
      hasSyncCode: Boolean(r.hasSyncCode),
      solvedCount,
    };
  });

  for (const b of blockedOrphansRes?.results || []) {
    users.push({
      userId: b.userId,
      name: b.name || b.userId,
      emoji: "🚫",
      category: "חסום",
      firstSeenAt: 0,
      lastSeenAt: Number(b.blockedAt) || 0,
      isOnline: false,
      blocked: true,
      blockedAt: Number(b.blockedAt) || 0,
      blockedReason: b.reason || "",
      adminRenamedAt: 0,
      role: "user",
      adminConnected: false,
      adminOnline: false,
      notesCount: 0,
      problemsCount: 0,
      hasSyncCode: false,
      solvedCount: 0,
      orphanBlocked: true,
    });
  }

  return jsonResponse({
    ok: true,
    users,
    customIdentities,
    adminSessions,
    currentAdminSessionId: currentAdminSessionId || null,
    serverTime: now,
  });
}

async function handleAdminSetUserRole(request, env, userId) {
  const body = await readJsonBody(request);
  if (!body) return errorResponse("Invalid JSON", 400);

  const role = String(body.role || "").trim();
  if (!VALID_USER_ROLES.has(role)) {
    return errorResponse("תפקיד לא תקין (user או supervisor)", 400);
  }

  const existing = await env.DB
    .prepare("SELECT user_id, name, blocked FROM identities WHERE user_id = ?")
    .bind(userId)
    .first();
  if (!existing) {
    return errorResponse("המשתמש לא נמצא", 404);
  }

  if (role === "supervisor") {
    const blockInfo = await getBlockedStatus(env.DB, userId, existing);
    if (blockInfo.blocked) {
      return errorResponse("לא ניתן למנות משתמש חסום כמפקח", 400);
    }
  }

  await env.DB
    .prepare("UPDATE identities SET role = ? WHERE user_id = ?")
    .bind(role, userId)
    .run();

  return jsonResponse({ ok: true, userId, role });
}

async function handleAdminRenameUser(request, env, userId) {
  const body = await readJsonBody(request);
  if (!body) return errorResponse("Invalid JSON", 400);

  const newName = String(body.name || "").trim();
  const hasEmoji = body.emoji !== undefined;
  const hasCategory = body.category !== undefined;

  if (!newName || newName.length > 64) {
    return errorResponse("יש להזין שם תקין (עד 64 תווים)", 400);
  }

  const existing = await env.DB
    .prepare("SELECT user_id, name, emoji, category FROM identities WHERE user_id = ?")
    .bind(userId)
    .first();
  if (!existing) {
    return errorResponse("המשתמש לא נמצא", 404);
  }

  const conflict = await env.DB
    .prepare("SELECT user_id FROM identities WHERE name = ? AND user_id != ?")
    .bind(newName, userId)
    .first();
  if (conflict) {
    return errorResponse(`הכינוי "${newName}" כבר תפוס על ידי משתמש אחר`, 409, { conflict: true });
  }

  const newEmoji = hasEmoji ? String(body.emoji || "").trim() || existing.emoji : existing.emoji;
  const newCategory = hasCategory ? String(body.category || "").trim() : existing.category || "";
  if (newEmoji.length > 16 || newCategory.length > 48) {
    return errorResponse("אורך אימוג׳י או קטגוריה חורג מהמותר", 400);
  }

  const now = Date.now();
  const batchRes = await env.DB.batch([
    env.DB
      .prepare(
        `UPDATE identities
         SET name = ?, emoji = ?, category = ?, admin_renamed_at = ?
         WHERE user_id = ?`
      )
      .bind(newName, newEmoji, newCategory, now, userId),
    env.DB
      .prepare("UPDATE community_notes SET author = ?, emoji = ?, category = ? WHERE user_id = ?")
      .bind(newName, newEmoji, newCategory, userId),
    env.DB
      .prepare("UPDATE note_replies SET author = ?, emoji = ?, category = ? WHERE user_id = ?")
      .bind(newName, newEmoji, newCategory, userId),
    env.DB
      .prepare("UPDATE community_problems SET author = ?, emoji = ?, category = ? WHERE user_id = ?")
      .bind(newName, newEmoji, newCategory, userId),
    env.DB
      .prepare("UPDATE problem_flags SET author = ?, emoji = ?, category = ? WHERE flagger_user_id = ?")
      .bind(newName, newEmoji, newCategory, userId),
    env.DB
      .prepare("UPDATE user_feedback SET author = ?, emoji = ?, category = ? WHERE user_id = ?")
      .bind(newName, newEmoji, newCategory, userId),
    env.DB
      .prepare("UPDATE admin_sessions SET user_name = ?, user_emoji = ? WHERE user_id = ?")
      .bind(newName, newEmoji, userId),
  ]);

  const communityChanges =
    (batchRes[1]?.meta?.changes ?? 0) +
    (batchRes[2]?.meta?.changes ?? 0) +
    (batchRes[3]?.meta?.changes ?? 0) +
    (batchRes[4]?.meta?.changes ?? 0);

  if (communityChanges > 0) {
    await bumpCommunityVersion(env.DB, now);
  }

  const progRow = await env.DB
    .prepare("SELECT progress_json, version FROM user_progress WHERE user_id = ?")
    .bind(userId)
    .first();
  if (progRow) {
    const parsed = parseJsonSafe(progRow.progress_json, null);
    if (parsed && typeof parsed === "object") {
      parsed.identity = {
        userId,
        name: newName,
        emoji: newEmoji,
        category: newCategory,
      };
      const serialized = JSON.stringify(parsed);
      if (serialized.length <= MAX_PROGRESS_JSON_BYTES) {
        const nextVersion = (Number(progRow.version) || 1) + 1;
        await env.DB
          .prepare("UPDATE user_progress SET progress_json = ?, updated_at = ?, version = ? WHERE user_id = ?")
          .bind(serialized, now, nextVersion, userId)
          .run();
      }
    }
  }

  invalidateLeaderboardCache();

  return jsonResponse({
    ok: true,
    user: {
      userId,
      name: newName,
      emoji: newEmoji,
      category: newCategory,
      adminRenamedAt: now,
    },
  });
}

async function handleAdminBlockUser(request, env, userId) {
  const body = await readJsonBody(request);
  if (body === null) return errorResponse("Invalid JSON", 400);

  const reason = String(body.reason || "").trim().slice(0, 200);
  const purgeContent = Boolean(body.purgeContent);
  const now = Date.now();

  const existing = await env.DB
    .prepare("SELECT user_id, name FROM identities WHERE user_id = ?")
    .bind(userId)
    .first();

  const stmts = [
    env.DB
      .prepare(
        `INSERT INTO blocked_users (user_id, name, reason, blocked_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET
           name = excluded.name,
           reason = excluded.reason,
           blocked_at = excluded.blocked_at`
      )
      .bind(userId, existing?.name || "", reason, now),
  ];

  if (existing) {
    stmts.push(
      env.DB
        .prepare("UPDATE identities SET blocked = 1, blocked_at = ?, blocked_reason = ?, role = 'user' WHERE user_id = ?")
        .bind(now, reason, userId),
      env.DB
        .prepare("UPDATE admin_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at = 0")
        .bind(now, userId)
    );
  }

  if (purgeContent) {
    stmts.push(
      env.DB.prepare("DELETE FROM note_replies WHERE user_id = ? OR note_user_id = ?").bind(userId, userId),
      env.DB.prepare("DELETE FROM community_notes WHERE user_id = ?").bind(userId),
      env.DB.prepare("DELETE FROM problem_flags WHERE flagger_user_id = ? OR problem_user_id = ?").bind(userId, userId),
      env.DB.prepare("DELETE FROM community_problems WHERE user_id = ?").bind(userId),
      env.DB.prepare("DELETE FROM user_feedback WHERE user_id = ?").bind(userId)
    );
  }

  const res = await env.DB.batch(stmts);
  if (purgeContent) {
    const contentChanged = res.slice(existing ? 3 : 1).some((r) => (r?.meta?.changes ?? 0) > 0);
    if (contentChanged) {
      await bumpCommunityVersion(env.DB, now);
    }
  }
  invalidateLeaderboardCache();

  return jsonResponse({
    ok: true,
    userId,
    blocked: true,
    blockedAt: now,
    blockedReason: reason,
    purgedContent: purgeContent,
  });
}

async function handleAdminUnblockUser(env, userId) {
  await env.DB.batch([
    env.DB
      .prepare("UPDATE identities SET blocked = 0, blocked_at = 0, blocked_reason = '' WHERE user_id = ?")
      .bind(userId),
    env.DB.prepare("DELETE FROM blocked_users WHERE user_id = ?").bind(userId),
  ]);
  invalidateLeaderboardCache();
  return jsonResponse({ ok: true, userId, blocked: false });
}

async function handleAdminAddPoolName(request, env) {
  const body = await readJsonBody(request);
  if (!body) return errorResponse("Invalid JSON", 400);

  const name = String(body.name || "").trim();
  const emoji = String(body.emoji || "✨").trim();
  const category = String(body.category || "מותאם אישית").trim();

  if (!name || name.length > 48) {
    return errorResponse("יש להזין שם תקין למאגר (עד 48 תווים)", 400);
  }
  if (!emoji || emoji.length > 16) {
    return errorResponse("אימוג׳י לא תקין", 400);
  }
  if (!category || category.length > 40) {
    return errorResponse("קטגוריה לא תקינה", 400);
  }

  const existing = await env.DB
    .prepare("SELECT name FROM custom_identities WHERE name = ?")
    .bind(name)
    .first();
  if (existing) {
    return errorResponse(`הכינוי "${name}" כבר קיים במאגר המותאם אישית`, 409);
  }

  const now = Date.now();
  await env.DB
    .prepare("INSERT INTO custom_identities (name, emoji, category, created_at) VALUES (?, ?, ?, ?)")
    .bind(name, emoji, category, now)
    .run();

  return jsonResponse({
    ok: true,
    entry: { name, emoji, category, createdAt: now, custom: true },
  });
}

async function handleAdminDeletePoolName(env, name) {
  const delRes = await env.DB.prepare("DELETE FROM custom_identities WHERE name = ?").bind(name).run();
  return jsonResponse({ ok: true, name, deleted: (delRes?.meta?.changes ?? 0) > 0 });
}

const UNUSED_IDENTITIES_WHERE_SQL = `
  COALESCE(role, 'user') = 'user'
  AND COALESCE(blocked, 0) = 0
  AND COALESCE(admin_renamed_at, 0) = 0
  AND user_id NOT IN (SELECT user_id FROM user_progress)
  AND user_id NOT IN (SELECT user_id FROM community_notes)
  AND user_id NOT IN (SELECT user_id FROM note_replies)
  AND user_id NOT IN (SELECT user_id FROM community_problems)
  AND user_id NOT IN (SELECT flagger_user_id FROM problem_flags)
  AND user_id NOT IN (SELECT user_id FROM user_feedback)
  AND user_id NOT IN (SELECT user_id FROM admin_sessions WHERE user_id != '')
  AND user_id NOT IN (SELECT user_id FROM user_device_secrets)
  AND user_id NOT IN (SELECT user_id FROM blocked_users)
  AND (
    ((last_seen_at - first_seen_at) < ? AND last_seen_at <= ?)
    OR last_seen_at <= ?
  )
`;

async function handleAdminCleanupUnusedUsers(request, env) {
  const body = await readJsonBody(request);
  if (body === null) return errorResponse("Invalid JSON", 400);

  const dryRun = Boolean(body.dryRun);
  const now = Date.now();
  const phantomCutoff = now - UNUSED_PHANTOM_GRACE_MS;
  const staleCutoff = now - UNUSED_STALE_INACTIVE_MS;

  const { results } = await env.DB
    .prepare(
      `SELECT user_id, name, emoji, first_seen_at, last_seen_at
       FROM identities
       WHERE ${UNUSED_IDENTITIES_WHERE_SQL}
       ORDER BY last_seen_at DESC`
    )
    .bind(UNUSED_PHANTOM_MAX_SPAN_MS, phantomCutoff, staleCutoff)
    .all();

  const rows = results || [];
  let phantomCount = 0;
  let staleCount = 0;
  for (const r of rows) {
    const lastSeen = Number(r.last_seen_at) || 0;
    const firstSeen = Number(r.first_seen_at) || 0;
    if (lastSeen <= staleCutoff) {
      staleCount += 1;
    } else if (lastSeen - firstSeen < UNUSED_PHANTOM_MAX_SPAN_MS) {
      phantomCount += 1;
    }
  }

  const sampleNames = rows.slice(0, 12).map((r) => `${r.emoji || "👤"} ${r.name}`);

  if (dryRun) {
    return jsonResponse({
      ok: true,
      dryRun: true,
      count: rows.length,
      phantomCount,
      staleCount,
      sampleNames,
    });
  }

  let releasedCount = 0;
  if (rows.length > 0) {
    const delRes = await env.DB
      .prepare(`DELETE FROM identities WHERE ${UNUSED_IDENTITIES_WHERE_SQL}`)
      .bind(UNUSED_PHANTOM_MAX_SPAN_MS, phantomCutoff, staleCutoff)
      .run();
    releasedCount = delRes?.meta?.changes ?? 0;
    if (releasedCount > 0) {
      invalidateLeaderboardCache();
    }
  }

  return jsonResponse({
    ok: true,
    dryRun: false,
    releasedCount,
    phantomCount,
    staleCount,
  });
}

async function handlePostFeedback(request, env) {
  const body = await readJsonBody(request);
  if (!body) return errorResponse("Invalid JSON", 400);

  const userId = String(body.userId || "").trim();
  const author = String(body.author || "").trim();
  const emoji = String(body.emoji || "💬").trim();
  const category = String(body.category || "").trim();
  const text = typeof body.text === "string" ? body.text.trim() : "";
  const clientSecret = typeof body.clientSecret === "string" ? body.clientSecret : "";

  if (!text) return errorResponse("Feedback text is required", 400);
  if (text.length > MAX_FEEDBACK_CHARS) {
    return errorResponse(`Feedback is too long (max ${MAX_FEEDBACK_CHARS} chars)`, 400);
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
    return authFailureResponse(auth);
  }

  const now = Date.now();
  const feedbackId = `fb_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const finalAuthor = author || "אנונימי";

  await env.DB
    .prepare(
      `INSERT INTO user_feedback (feedback_id, user_id, author, emoji, category, text, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(feedbackId, userId, finalAuthor, emoji, category, text, now)
    .run();

  return jsonResponse({ ok: true, feedbackId, createdAt: now });
}

async function handleAdminFeedback(env) {
  const { results } = await env.DB
    .prepare(
      `SELECT feedback_id, user_id, author, emoji, category, text, created_at
       FROM user_feedback
       ORDER BY created_at DESC
       LIMIT 500`
    )
    .all();

  const feedback = (results || []).map((row) => ({
    feedbackId: row.feedback_id,
    userId: row.user_id,
    author: row.author || "אנונימי",
    emoji: row.emoji || "💬",
    category: row.category || "",
    text: row.text || "",
    createdAt: Number(row.created_at) || 0,
  }));

  return jsonResponse({ ok: true, feedback });
}

async function resolveOverrideActor(request, env, actorAuth) {
  if (actorAuth?.actorType === "supervisor") {
    return {
      userId: String(actorAuth.userId || "").trim(),
      name: String(actorAuth.identity?.name || "מפקח").trim() || "מפקח",
      emoji: String(actorAuth.identity?.emoji || "🎓").trim() || "🎓",
      role: "supervisor",
    };
  }

  const adminAuth = actorAuth?.adminAuth || {};
  if (adminAuth.userName) {
    return {
      userId: String(adminAuth.userId || "").trim(),
      name: String(adminAuth.userName).trim(),
      emoji: String(adminAuth.userEmoji || "🛡️").trim() || "🛡️",
      role: "admin",
    };
  }

  const reqUserId = String(request.headers.get("X-User-Id") || "").trim();
  const reqSecret = String(request.headers.get("X-Client-Secret") || "");
  if (reqUserId && reqSecret) {
    const identAuth = await verifyExistingClientSecret(env.DB, reqUserId, reqSecret, { touchPresence: false }).catch(
      () => null
    );
    if (identAuth?.ok && identAuth.identity?.name) {
      return {
        userId: String(identAuth.identity.user_id || reqUserId).trim(),
        name: String(identAuth.identity.name).trim(),
        emoji: String(identAuth.identity.emoji || "🛡️").trim() || "🛡️",
        role: "admin",
      };
    }
  }

  return {
    userId: String(adminAuth.userId || "").trim(),
    name: "מנהל",
    emoji: "🛡️",
    role: "admin",
  };
}

async function handleAdminPutOverride(request, env, qId, actorAuth = null) {
  const body = await readJsonBody(request);
  if (!body) return errorResponse("Invalid JSON", 400);

  const actor = await resolveOverrideActor(request, env, actorAuth);

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
         (q_id, hidden, stem, options_json, correct_json, all_accepted, appeal_note, subject, updated_at, updated_by_user_id, updated_by_name, updated_by_emoji, updated_by_role)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(q_id) DO UPDATE SET
         hidden = excluded.hidden,
         stem = excluded.stem,
         options_json = excluded.options_json,
         correct_json = excluded.correct_json,
         all_accepted = excluded.all_accepted,
         appeal_note = excluded.appeal_note,
         subject = excluded.subject,
         updated_at = excluded.updated_at,
         updated_by_user_id = excluded.updated_by_user_id,
         updated_by_name = excluded.updated_by_name,
         updated_by_emoji = excluded.updated_by_emoji,
         updated_by_role = excluded.updated_by_role`
    )
    .bind(
      qId,
      hidden,
      stem,
      optionsJson,
      correctJson,
      allAccepted,
      appealNote,
      subject,
      updatedAt,
      actor.userId,
      actor.name,
      actor.emoji,
      actor.role
    )
    .run();
  await bumpCommunityVersion(env.DB, updatedAt);

  const savedRow = await env.DB
    .prepare(
      "SELECT q_id, hidden, stem, options_json, correct_json, all_accepted, appeal_note, subject, updated_at, updated_by_user_id, updated_by_name, updated_by_emoji, updated_by_role FROM question_overrides WHERE q_id = ?"
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
    invalidateLeaderboardCache();
  } else if (seenUsers.size > 0) {
    invalidateLeaderboardCache();
  }

  return jsonResponse({
    ok: true,
    notesImported,
    problemsImported,
    identitiesSeeded: seenUsers.size,
  });
}

function getUtcDayKey(ts = Date.now()) {
  return new Date(ts).toISOString().slice(0, 10);
}

function classifyEndpointBucket(path) {
  if (path === "/api/poll") return "/api/poll";
  if (path === "/api/bootstrap") return "/api/bootstrap";
  if (path === "/api/progress") return "/api/progress";
  if (path === "/api/online") return "/api/online";
  if (path === "/api/leaderboard") return "/api/leaderboard";
  if (path === "/api/identities/ping") return "/api/identities/ping";
  if (path === "/api/feedback") return "/api/feedback";
  if (path === "/api/health") return "/api/health";
  if (path.startsWith("/api/sync/")) return "/api/sync/*";
  if (path.startsWith("/api/notes/")) return "/api/notes/*";
  if (path.startsWith("/api/note-replies/")) return "/api/note-replies/*";
  if (path.startsWith("/api/problems/")) return "/api/problems/*";
  if (path.startsWith("/api/problem-flags/")) return "/api/problem-flags/*";
  if (path.startsWith("/api/admin/")) return "/api/admin/*";
  return "other";
}

function wrapTrackedStatement(rawStmt) {
  const wrapResult = (promise) =>
    promise.then((res) => {
      if (res && typeof res === "object" && res.meta) {
        telemetryState.d1RowsRead += Number(res.meta.rows_read) || 0;
        telemetryState.d1RowsWritten += Number(res.meta.rows_written) || 0;
      }
      return res;
    });
  return {
    _raw: rawStmt,
    bind(...args) {
      return wrapTrackedStatement(rawStmt.bind(...args));
    },
    first(...args) {
      return rawStmt.first(...args);
    },
    all(...args) {
      return wrapResult(rawStmt.all(...args));
    },
    run(...args) {
      return wrapResult(rawStmt.run(...args));
    },
    raw(...args) {
      return rawStmt.raw(...args);
    },
  };
}

function wrapTrackedDb(rawDb) {
  if (!rawDb) return rawDb;
  return {
    prepare(sql) {
      return wrapTrackedStatement(rawDb.prepare(sql));
    },
    async batch(stmts) {
      const rawStmts = stmts.map((s) => (s && s._raw ? s._raw : s));
      const results = await rawDb.batch(rawStmts);
      if (Array.isArray(results)) {
        for (const r of results) {
          if (r && typeof r === "object" && r.meta) {
            telemetryState.d1RowsRead += Number(r.meta.rows_read) || 0;
            telemetryState.d1RowsWritten += Number(r.meta.rows_written) || 0;
          }
        }
      }
      return results;
    },
    exec(sql) {
      return rawDb.exec(sql);
    },
    dump() {
      return rawDb.dump();
    },
  };
}

function recordTelemetry(path, status) {
  const now = Date.now();
  const day = getUtcDayKey(now);
  if (telemetryState.dayUtc && telemetryState.dayUtc !== day) {
    // Keep current counters for next flush under the previous day or roll over cleanly
    telemetryState.dayUtc = day;
  } else if (!telemetryState.dayUtc) {
    telemetryState.dayUtc = day;
  }
  telemetryState.requestsTotal += 1;
  if (status >= 400 && status < 500) telemetryState.errors4xx += 1;
  else if (status >= 500) telemetryState.errors5xx += 1;

  const bucket = classifyEndpointBucket(path);
  telemetryState.endpoints[bucket] = (telemetryState.endpoints[bucket] || 0) + 1;
}

async function flushTelemetry(rawDb, force = false) {
  if (!rawDb) return;
  const now = Date.now();
  const hasPending =
    telemetryState.requestsTotal > 0 ||
    telemetryState.d1RowsRead > 0 ||
    telemetryState.d1RowsWritten > 0;
  if (!hasPending) return;

  if (
    !force &&
    telemetryState.requestsTotal < TELEMETRY_FLUSH_REQUESTS &&
    now - telemetryState.lastFlushAt < TELEMETRY_FLUSH_INTERVAL_MS
  ) {
    return;
  }

  if (telemetryState.flushing) {
    if (force) await telemetryState.flushing.catch(() => {});
    return;
  }

  const dayUtc = telemetryState.dayUtc || getUtcDayKey(now);
  const deltaReq = telemetryState.requestsTotal;
  const delta4xx = telemetryState.errors4xx;
  const delta5xx = telemetryState.errors5xx;
  const deltaRead = telemetryState.d1RowsRead;
  const deltaWrite = telemetryState.d1RowsWritten;
  const deltaEndpoints = { ...telemetryState.endpoints };

  // Reset synchronously before await so concurrent requests aren't lost or double-counted
  telemetryState.requestsTotal = 0;
  telemetryState.errors4xx = 0;
  telemetryState.errors5xx = 0;
  telemetryState.d1RowsRead = 0;
  telemetryState.d1RowsWritten = 0;
  telemetryState.endpoints = {};
  telemetryState.lastFlushAt = now;

  const doFlush = (async () => {
    try {
      const existing = await rawDb
        .prepare("SELECT endpoints_json FROM telemetry_daily WHERE day_utc = ?")
        .bind(dayUtc)
        .first();
      const mergedEndpoints = parseJsonSafe(existing?.endpoints_json, {});
      for (const [k, v] of Object.entries(deltaEndpoints)) {
        mergedEndpoints[k] = (Number(mergedEndpoints[k]) || 0) + (Number(v) || 0);
      }
      await rawDb
        .prepare(
          `INSERT INTO telemetry_daily
             (day_utc, requests_total, errors_4xx, errors_5xx, d1_rows_read, d1_rows_written, endpoints_json, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(day_utc) DO UPDATE SET
             requests_total = requests_total + excluded.requests_total,
             errors_4xx = errors_4xx + excluded.errors_4xx,
             errors_5xx = errors_5xx + excluded.errors_5xx,
             d1_rows_read = d1_rows_read + excluded.d1_rows_read,
             d1_rows_written = d1_rows_written + excluded.d1_rows_written,
             endpoints_json = excluded.endpoints_json,
             updated_at = excluded.updated_at`
        )
        .bind(dayUtc, deltaReq, delta4xx, delta5xx, deltaRead, deltaWrite, JSON.stringify(mergedEndpoints), now)
        .run();
    } catch {
      // Never fail user requests due to telemetry persistence
    }
  })();

  telemetryState.flushing = doFlush.finally(() => {
    telemetryState.flushing = null;
  });
  await telemetryState.flushing;
}

async function fetchJsonWithTimeout(url, options = {}, timeoutMs = 5000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, headers: res.headers, data };
  } catch (err) {
    return { ok: false, status: 0, headers: new Headers(), data: null, error: err?.message || "Fetch failed" };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchGitHubMetrics(env, forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && githubMetricsCache.data && now - githubMetricsCache.fetchedAt < EXTERNAL_METRICS_CACHE_TTL_MS) {
    return githubMetricsCache.data;
  }

  const headers = {
    "User-Agent": "mikbatz1-admin-dashboard",
    Accept: "application/vnd.github+json",
  };
  const hasToken = Boolean(env.GITHUB_TOKEN && String(env.GITHUB_TOKEN).trim());
  if (hasToken) {
    headers.Authorization = `Bearer ${String(env.GITHUB_TOKEN).trim()}`;
  }

  const base = `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}`;
  const reqs = [
    fetchJsonWithTimeout(base, { headers }),
    fetchJsonWithTimeout(`${base}/deployments?per_page=5`, { headers }),
  ];
  if (hasToken) {
    reqs.push(
      fetchJsonWithTimeout(`${base}/traffic/views`, { headers }),
      fetchJsonWithTimeout(`${base}/traffic/clones`, { headers }),
      fetchJsonWithTimeout(`${base}/pages`, { headers })
    );
  }

  const [repoRes, depRes, viewsRes, clonesRes, pagesRes] = await Promise.all(reqs);

  const rlLimit = Number(repoRes.headers.get("x-ratelimit-limit")) || (hasToken ? 5000 : 60);
  const rlRemaining = repoRes.headers.has("x-ratelimit-remaining")
    ? Number(repoRes.headers.get("x-ratelimit-remaining"))
    : null;
  const rlResetSec = Number(repoRes.headers.get("x-ratelimit-reset")) || 0;

  const repo = repoRes.ok && repoRes.data
    ? {
        fullName: repoRes.data.full_name,
        private: Boolean(repoRes.data.private),
        sizeKb: Number(repoRes.data.size) || 0,
        stars: Number(repoRes.data.stargazers_count) || 0,
        forks: Number(repoRes.data.forks_count) || 0,
        openIssues: Number(repoRes.data.open_issues_count) || 0,
        defaultBranch: repoRes.data.default_branch || "main",
        pushedAt: repoRes.data.pushed_at || null,
        updatedAt: repoRes.data.updated_at || null,
        hasPages: Boolean(repoRes.data.has_pages),
        htmlUrl: repoRes.data.html_url || `https://github.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}`,
      }
    : null;

  const deployments = depRes?.ok && Array.isArray(depRes.data)
    ? depRes.data.map((d) => ({
        id: d.id,
        environment: d.environment,
        sha: d.sha,
        shortSha: String(d.sha || "").slice(0, 7),
        createdAt: d.created_at,
        creator: d.creator?.login || "",
      }))
    : [];

  const result = {
    ok: Boolean(repo),
    tokenConfigured: hasToken,
    error: repoRes.ok ? null : repoRes.error || `GitHub HTTP ${repoRes.status}`,
    rateLimit: {
      limit: rlLimit,
      remaining: rlRemaining,
      resetAt: rlResetSec ? rlResetSec * 1000 : 0,
    },
    repo,
    deployments,
    traffic: hasToken
      ? {
          views14d: viewsRes?.ok ? viewsRes.data : null,
          clones14d: clonesRes?.ok ? clonesRes.data : null,
          pages: pagesRes?.ok ? pagesRes.data : null,
        }
      : null,
    quotas: GITHUB_FREE_QUOTAS,
    fetchedAt: now,
  };

  if (repo) {
    githubMetricsCache = { fetchedAt: now, data: result };
  }
  return result;
}

async function fetchCloudflareOfficialAnalytics(env, forceRefresh = false) {
  const token = env.CF_API_TOKEN ? String(env.CF_API_TOKEN).trim() : "";
  if (!token) {
    return { configured: false, available: false, data: null };
  }
  const now = Date.now();
  if (!forceRefresh && cfAnalyticsCache.data && now - cfAnalyticsCache.fetchedAt < EXTERNAL_METRICS_CACHE_TTL_MS) {
    return cfAnalyticsCache.data;
  }

  const accountId = String(env.CF_ACCOUNT_ID || DEFAULT_CF_ACCOUNT_ID).trim();
  const dbId = String(env.CF_D1_DATABASE_ID || DEFAULT_D1_DATABASE_ID).trim();
  const dayStartIso = `${getUtcDayKey(now)}T00:00:00Z`;
  const dayEndIso = new Date(now).toISOString();
  const dayDate = getUtcDayKey(now);

  const query = `
    query AdminMetrics($accountTag: string!, $since: Time!, $until: Time!, $date: Date!, $dbId: string!) {
      viewer {
        accounts(filter: { accountTag: $accountTag }) {
          workersInvocationsAdaptive(limit: 100, filter: { datetime_geq: $since, datetime_leq: $until }) {
            sum { requests errors subrequests }
            quantiles { cpuTimeP50 cpuTimeP99 }
          }
          d1AnalyticsAdaptiveGroups(limit: 100, filter: { date_geq: $date, date_leq: $date, databaseId: $dbId }) {
            sum { readQueries writeQueries rowsRead rowsWritten }
          }
          d1StorageAdaptiveGroups(limit: 10, filter: { date_geq: $date, date_leq: $date, databaseId: $dbId }) {
            max { databaseSizeBytes }
          }
        }
      }
    }
  `;

  const res = await fetchJsonWithTimeout("https://api.cloudflare.com/client/v4/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      variables: { accountTag: accountId, since: dayStartIso, until: dayEndIso, date: dayDate, dbId },
    }),
  });

  const acct = res.data?.data?.viewer?.accounts?.[0];
  if (!res.ok || !acct || (Array.isArray(res.data?.errors) && res.data.errors.length > 0)) {
    return {
      configured: true,
      available: false,
      error: res.data?.errors?.[0]?.message || res.error || `Cloudflare HTTP ${res.status}`,
      data: null,
    };
  }

  const workerGroups = acct.workersInvocationsAdaptive || [];
  const d1Groups = acct.d1AnalyticsAdaptiveGroups || [];
  const d1Storage = acct.d1StorageAdaptiveGroups || [];

  const sumReducer = (arr, keys) =>
    arr.reduce((acc, g) => {
      for (const k of keys) acc[k] = (acc[k] || 0) + (Number(g?.sum?.[k]) || 0);
      return acc;
    }, {});

  const workerSum = sumReducer(workerGroups, ["requests", "errors", "subrequests"]);
  const d1Sum = sumReducer(d1Groups, ["readQueries", "writeQueries", "rowsRead", "rowsWritten"]);
  const dbSizeBytes = d1Storage.reduce((mx, g) => Math.max(mx, Number(g?.max?.databaseSizeBytes) || 0), 0);

  const out = {
    configured: true,
    available: true,
    fetchedAt: now,
    data: {
      workerRequestsToday: workerSum.requests || 0,
      workerErrorsToday: workerSum.errors || 0,
      workerSubrequestsToday: workerSum.subrequests || 0,
      d1ReadQueriesToday: d1Sum.readQueries || 0,
      d1WriteQueriesToday: d1Sum.writeQueries || 0,
      d1RowsReadToday: d1Sum.rowsRead || 0,
      d1RowsWrittenToday: d1Sum.rowsWritten || 0,
      d1StorageBytes: dbSizeBytes,
    },
  };
  cfAnalyticsCache = { fetchedAt: now, data: out };
  return out;
}

async function getD1StorageAndCounts(rawDb) {
  const tableNames = [
    "identities",
    "user_progress",
    "community_notes",
    "note_replies",
    "community_problems",
    "problem_flags",
    "question_overrides",
    "user_feedback",
    "user_device_secrets",
    "custom_identities",
    "blocked_users",
    "admin_sessions",
    "version_releases",
    "telemetry_daily",
  ];

  const counts = {};
  await Promise.all(
    tableNames.map(async (tbl) => {
      try {
        const row = await rawDb.prepare(`SELECT COUNT(*) AS cnt FROM ${tbl}`).first();
        counts[tbl] = Number(row?.cnt) || 0;
      } catch {
        counts[tbl] = 0;
      }
    })
  );

  let dbSizeBytes = 0;
  try {
    const [pageCountRow, pageSizeRow] = await Promise.all([
      rawDb.prepare("PRAGMA page_count").first(),
      rawDb.prepare("PRAGMA page_size").first(),
    ]);
    const pageCount = Number(pageCountRow?.page_count) || 0;
    const pageSize = Number(pageSizeRow?.page_size) || 4096;
    dbSizeBytes = pageCount * pageSize;
  } catch {
    dbSizeBytes = 0;
  }

  let progressBytes = 0;
  try {
    const row = await rawDb.prepare("SELECT COALESCE(SUM(LENGTH(progress_json)), 0) AS totalBytes FROM user_progress").first();
    progressBytes = Number(row?.totalBytes) || 0;
  } catch {
    progressBytes = 0;
  }

  if (!dbSizeBytes && progressBytes > 0) {
    dbSizeBytes = progressBytes;
  }

  return { dbSizeBytes, progressBytes, tableCounts: counts };
}

async function handleAdminMetrics(request, env, rawDb) {
  const url = new URL(request.url);
  const forceRefresh = url.searchParams.get("refresh") === "1";

  await flushTelemetry(rawDb, true);

  const todayUtc = getUtcDayKey();
  const [dailyRes, storageStats, github, cloudflareOfficial] = await Promise.all([
    rawDb
      .prepare(
        `SELECT day_utc, requests_total, errors_4xx, errors_5xx, d1_rows_read, d1_rows_written, endpoints_json, updated_at
         FROM telemetry_daily
         ORDER BY day_utc DESC
         LIMIT 14`
      )
      .all()
      .catch(() => ({ results: [] })),
    getD1StorageAndCounts(rawDb),
    fetchGitHubMetrics(env, forceRefresh),
    fetchCloudflareOfficialAnalytics(env, forceRefresh),
  ]);

  const daily = (dailyRes?.results || []).map((r) => ({
    dayUtc: r.day_utc,
    requestsTotal: Number(r.requests_total) || 0,
    errors4xx: Number(r.errors_4xx) || 0,
    errors5xx: Number(r.errors_5xx) || 0,
    d1RowsRead: Number(r.d1_rows_read) || 0,
    d1RowsWritten: Number(r.d1_rows_written) || 0,
    endpoints: parseJsonSafe(r.endpoints_json, {}),
    updatedAt: Number(r.updated_at) || 0,
  }));

  const todayRow = daily.find((d) => d.dayUtc === todayUtc) || {
    dayUtc: todayUtc,
    requestsTotal: 0,
    errors4xx: 0,
    errors5xx: 0,
    d1RowsRead: 0,
    d1RowsWritten: 0,
    endpoints: {},
    updatedAt: 0,
  };

  return jsonResponse({
    ok: true,
    serverTime: Date.now(),
    todayUtc,
    cloudflare: {
      quotas: CLOUDFLARE_FREE_QUOTAS,
      telemetryToday: todayRow,
      dailyHistory: daily,
      storage: storageStats,
      official: cloudflareOfficial,
    },
    github,
  });
}

async function fetchGitHubVersions(env, forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && githubVersionsCache.data && now - githubVersionsCache.fetchedAt < EXTERNAL_METRICS_CACHE_TTL_MS) {
    return githubVersionsCache.data;
  }

  const headers = {
    "User-Agent": "mikbatz1-admin-dashboard",
    Accept: "application/vnd.github+json",
  };
  if (env.GITHUB_TOKEN && String(env.GITHUB_TOKEN).trim()) {
    headers.Authorization = `Bearer ${String(env.GITHUB_TOKEN).trim()}`;
  }

  const base = `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}`;
  const [commitsRes, depsRes] = await Promise.all([
    fetchJsonWithTimeout(`${base}/commits?per_page=20`, { headers }),
    fetchJsonWithTimeout(`${base}/deployments?per_page=10`, { headers }),
  ]);

  const deployments = depsRes.ok && Array.isArray(depsRes.data)
    ? depsRes.data.map((d) => ({
        id: d.id,
        environment: d.environment,
        sha: d.sha,
        shortSha: String(d.sha || "").slice(0, 7),
        createdAt: d.created_at,
      }))
    : [];

  const deployedShas = new Set(deployments.map((d) => d.sha).filter(Boolean));
  const commits = commitsRes.ok && Array.isArray(commitsRes.data)
    ? commitsRes.data.map((c) => ({
        sha: c.sha,
        shortSha: String(c.sha || "").slice(0, 7),
        message: String(c.commit?.message || "").split("\n")[0],
        author: c.commit?.author?.name || c.author?.login || "",
        date: c.commit?.author?.date || "",
        url: c.html_url || `https://github.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/commit/${c.sha}`,
        deployedToPages: deployedShas.has(c.sha),
      }))
    : [];

  const out = {
    ok: commitsRes.ok,
    error: commitsRes.ok ? null : commitsRes.error || `GitHub HTTP ${commitsRes.status}`,
    repo: `${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}`,
    commits,
    deployments,
    fetchedAt: now,
  };

  if (commitsRes.ok) {
    githubVersionsCache = { fetchedAt: now, data: out };
  }
  return out;
}

async function handleAdminVersions(request, env) {
  const url = new URL(request.url);
  const forceRefresh = url.searchParams.get("refresh") === "1";

  const [syncMetaRow, releasesRes, github] = await Promise.all([
    env.DB.prepare("SELECT community_version, updated_at FROM sync_meta WHERE id = 1").first().catch(() => null),
    env.DB
      .prepare(
        `SELECT release_id, version, component, title, notes, commit_sha, created_at
         FROM version_releases
         ORDER BY created_at DESC
         LIMIT 100`
      )
      .all()
      .catch(() => ({ results: [] })),
    fetchGitHubVersions(env, forceRefresh),
  ]);

  const releases = (releasesRes?.results || []).map((r) => ({
    releaseId: r.release_id,
    version: r.version,
    component: r.component,
    title: r.title,
    notes: r.notes || "",
    commitSha: r.commit_sha || "",
    createdAt: Number(r.created_at) || 0,
  }));

  return jsonResponse({
    ok: true,
    serverTime: Date.now(),
    worker: {
      version: WORKER_VERSION,
      schemaVersion: WORKER_SCHEMA_VERSION,
      communityVersion: Number(syncMetaRow?.community_version) || 1,
      communityUpdatedAt: Number(syncMetaRow?.updated_at) || 0,
    },
    github,
    releases,
  });
}

async function handleAdminCreateVersionRelease(request, env) {
  const body = await readJsonBody(request);
  if (!body) return errorResponse("Invalid JSON", 400);

  const version = String(body.version || "").trim().slice(0, 48);
  const component = String(body.component || "all").trim().slice(0, 32);
  const title = String(body.title || "").trim().slice(0, 140);
  const notes = String(body.notes || "").trim().slice(0, 2000);
  const commitSha = String(body.commitSha || "").trim().slice(0, 64);

  if (!version || !title) {
    return errorResponse("יש להזין מספר גרסה וכותרת", 400);
  }

  const now = Date.now();
  const releaseId = `rel_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  await env.DB
    .prepare(
      `INSERT INTO version_releases (release_id, version, component, title, notes, commit_sha, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(releaseId, version, component || "all", title, notes, commitSha, now)
    .run();

  return jsonResponse({
    ok: true,
    release: {
      releaseId,
      version,
      component: component || "all",
      title,
      notes,
      commitSha,
      createdAt: now,
    },
  });
}

async function handleAdminDeleteVersionRelease(env, releaseId) {
  const delRes = await env.DB
    .prepare("DELETE FROM version_releases WHERE release_id = ?")
    .bind(releaseId)
    .run();
  return jsonResponse({ ok: true, deletedId: releaseId, deleted: (delRes?.meta?.changes ?? 0) > 0 });
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    const method = request.method.toUpperCase();
    const rawDb = env.DB;
    const trackedEnv = rawDb ? { ...env, DB: wrapTrackedDb(rawDb) } : env;

    const finalize = (response) => {
      recordTelemetry(path, response?.status || 200);
      const flushPromise = flushTelemetry(rawDb, false);
      if (ctx && typeof ctx.waitUntil === "function") {
        ctx.waitUntil(flushPromise);
      }
      return response;
    };

    try {
      if (method === "GET" && path === "/api/health") {
        return finalize(
          jsonResponse({
            ok: true,
            workerVersion: WORKER_VERSION,
            schemaVersion: WORKER_SCHEMA_VERSION,
            serverTime: Date.now(),
          })
        );
      }

      if (method === "GET" && path === "/api/bootstrap") {
        return finalize(await handleBootstrap(trackedEnv));
      }

      if (method === "GET" && path === "/api/poll") {
        return finalize(await handlePoll(request, trackedEnv));
      }

      if (method === "GET" && path === "/api/online") {
        return finalize(await handleOnlineUsers(trackedEnv));
      }

      if (method === "GET" && path === "/api/leaderboard") {
        const sortParam = url.searchParams.get("sort") === "notes" ? "notes" : "answers";
        return finalize(await handleLeaderboard(trackedEnv, sortParam));
      }

      if (method === "POST" && path === "/api/identities/ping") {
        return finalize(await handleIdentityPing(request, trackedEnv));
      }

      if (method === "POST" && path === "/api/feedback") {
        return finalize(await handlePostFeedback(request, trackedEnv));
      }

      if (path === "/api/progress") {
        if (method === "GET") return finalize(await handleGetProgress(request, trackedEnv));
        if (method === "PUT") return finalize(await handlePutProgress(request, trackedEnv));
      }

      if (method === "POST" && path === "/api/sync/register-code") {
        return finalize(await handleSyncRegisterCode(request, trackedEnv));
      }
      if (method === "POST" && path === "/api/sync/rotate-code") {
        return finalize(await handleSyncRotateCode(request, trackedEnv));
      }
      if (method === "POST" && path === "/api/sync/revoke-other-devices") {
        return finalize(await handleSyncRevokeOtherDevices(request, trackedEnv));
      }
      if (method === "POST" && path === "/api/sync/preview") {
        return finalize(await handleSyncPreview(request, trackedEnv));
      }
      if (method === "POST" && path === "/api/sync/link") {
        return finalize(await handleSyncLink(request, trackedEnv));
      }

      const noteMatch = path.match(/^\/api\/notes\/([^/]+)$/);
      if (noteMatch) {
        const qId = decodeURIComponent(noteMatch[1]);
        if (method === "PUT") return finalize(await handlePutNote(request, trackedEnv, qId));
        if (method === "DELETE") return finalize(await handleDeleteNote(request, trackedEnv, qId));
      }

      const noteReplyCreateMatch = path.match(/^\/api\/note-replies\/([^/]+)\/([^/]+)$/);
      if (noteReplyCreateMatch && method === "POST") {
        const qId = decodeURIComponent(noteReplyCreateMatch[1]);
        const noteUserId = decodeURIComponent(noteReplyCreateMatch[2]);
        return finalize(await handleCreateNoteReply(request, trackedEnv, qId, noteUserId));
      }

      const noteReplyItemMatch = path.match(/^\/api\/note-replies\/([^/]+)$/);
      if (noteReplyItemMatch) {
        const replyId = decodeURIComponent(noteReplyItemMatch[1]);
        if (method === "PUT") return finalize(await handlePutNoteReply(request, trackedEnv, replyId));
        if (method === "DELETE") return finalize(await handleDeleteNoteReply(request, trackedEnv, replyId));
      }

      const problemMatch = path.match(/^\/api\/problems\/([^/]+)$/);
      if (problemMatch) {
        const qId = decodeURIComponent(problemMatch[1]);
        if (method === "PUT") return finalize(await handlePutProblem(request, trackedEnv, qId));
        if (method === "DELETE") return finalize(await handleDeleteProblem(request, trackedEnv, qId));
      }

      const problemFlagMatch = path.match(/^\/api\/problem-flags\/([^/]+)\/([^/]+)$/);
      if (problemFlagMatch) {
        const qId = decodeURIComponent(problemFlagMatch[1]);
        const problemUserId = decodeURIComponent(problemFlagMatch[2]);
        if (method === "PUT") return finalize(await handlePutProblemFlag(request, trackedEnv, qId, problemUserId));
        if (method === "DELETE") return finalize(await handleDeleteProblemFlag(request, trackedEnv, qId, problemUserId));
      }

      if (method === "POST" && path === "/api/admin/login") {
        return finalize(await handleAdminLogin(request, trackedEnv));
      }

      // Question overrides & community moderation can be performed by either full Admin OR designated Supervisor ('מפקח')
      const adminOverrideMatch = path.match(/^\/api\/admin\/overrides\/([^/]+)$/);
      if (adminOverrideMatch && (method === "PUT" || method === "DELETE")) {
        const qId = decodeURIComponent(adminOverrideMatch[1]);
        const actorAuth = await verifyAdminOrSupervisor(request, trackedEnv);
        if (!actorAuth.ok) {
          return finalize(authFailureResponse(actorAuth));
        }
        if (method === "PUT") {
          return finalize(await handleAdminPutOverride(request, trackedEnv, qId, actorAuth));
        }
        const delRes = await trackedEnv.DB.prepare("DELETE FROM question_overrides WHERE q_id = ?").bind(qId).run();
        if ((delRes?.meta?.changes ?? 1) > 0) {
          await bumpCommunityVersion(trackedEnv.DB);
        }
        return finalize(jsonResponse({ ok: true, reset: qId }));
      }

      const adminNoteMatch = path.match(/^\/api\/admin\/notes\/([^/]+)\/([^/]+)$/);
      if (adminNoteMatch && method === "DELETE") {
        const actorAuth = await verifyAdminOrSupervisor(request, trackedEnv);
        if (!actorAuth.ok) {
          return finalize(authFailureResponse(actorAuth));
        }
        const qId = decodeURIComponent(adminNoteMatch[1]);
        const userId = decodeURIComponent(adminNoteMatch[2]);
        const now = Date.now();
        const [delRes, delRepliesRes] = await trackedEnv.DB.batch([
          trackedEnv.DB.prepare("DELETE FROM community_notes WHERE q_id = ? AND user_id = ?").bind(qId, userId),
          trackedEnv.DB.prepare("DELETE FROM note_replies WHERE q_id = ? AND note_user_id = ?").bind(qId, userId),
        ]);
        if ((delRes?.meta?.changes ?? 0) > 0 || (delRepliesRes?.meta?.changes ?? 0) > 0) {
          await bumpCommunityVersion(trackedEnv.DB, now);
          await syncDeletionToUserProgress(trackedEnv.DB, userId, qId, "note", now);
          invalidateLeaderboardCache();
        }
        return finalize(jsonResponse({ ok: true, qId, userId }));
      }

      const adminNoteReplyMatch = path.match(/^\/api\/admin\/note-replies\/([^/]+)$/);
      if (adminNoteReplyMatch && method === "DELETE") {
        const actorAuth = await verifyAdminOrSupervisor(request, trackedEnv);
        if (!actorAuth.ok) {
          return finalize(authFailureResponse(actorAuth));
        }
        const replyId = decodeURIComponent(adminNoteReplyMatch[1]);
        const existing = await trackedEnv.DB
          .prepare("SELECT reply_id, q_id, note_user_id FROM note_replies WHERE reply_id = ?")
          .bind(replyId)
          .first();
        let deletedIds = [];
        if (existing) {
          deletedIds = await collectDescendantReplyIds(trackedEnv.DB, existing.q_id, existing.note_user_id, replyId);
          const stmts = deletedIds.map((id) =>
            trackedEnv.DB.prepare("DELETE FROM note_replies WHERE reply_id = ?").bind(id)
          );
          for (let idx = 0; idx < stmts.length; idx += 50) {
            await trackedEnv.DB.batch(stmts.slice(idx, idx + 50));
          }
          await bumpCommunityVersion(trackedEnv.DB, Date.now());
        }
        return finalize(jsonResponse({ ok: true, replyId, deletedIds }));
      }

      const adminProblemMatch = path.match(/^\/api\/admin\/problems\/([^/]+)\/([^/]+)$/);
      if (adminProblemMatch && method === "DELETE") {
        const actorAuth = await verifyAdminOrSupervisor(request, trackedEnv);
        if (!actorAuth.ok) {
          return finalize(authFailureResponse(actorAuth));
        }
        const qId = decodeURIComponent(adminProblemMatch[1]);
        const userId = decodeURIComponent(adminProblemMatch[2]);
        const now = Date.now();
        const [delRes, delFlagsRes] = await trackedEnv.DB.batch([
          trackedEnv.DB.prepare("DELETE FROM community_problems WHERE q_id = ? AND user_id = ?").bind(qId, userId),
          trackedEnv.DB.prepare("DELETE FROM problem_flags WHERE q_id = ? AND problem_user_id = ?").bind(qId, userId),
        ]);
        if ((delRes?.meta?.changes ?? 0) > 0 || (delFlagsRes?.meta?.changes ?? 0) > 0) {
          await bumpCommunityVersion(trackedEnv.DB, now);
          await syncDeletionToUserProgress(trackedEnv.DB, userId, qId, "problem", now);
        }
        return finalize(jsonResponse({ ok: true, qId, userId }));
      }

      const adminProblemFlagsMatch = path.match(/^\/api\/admin\/problem-flags\/([^/]+)\/([^/]+)$/);
      if (adminProblemFlagsMatch && method === "DELETE") {
        const actorAuth = await verifyAdminOrSupervisor(request, trackedEnv);
        if (!actorAuth.ok) {
          return finalize(authFailureResponse(actorAuth));
        }
        const qId = decodeURIComponent(adminProblemFlagsMatch[1]);
        const problemUserId = decodeURIComponent(adminProblemFlagsMatch[2]);
        const now = Date.now();
        const delRes = await trackedEnv.DB
          .prepare("DELETE FROM problem_flags WHERE q_id = ? AND problem_user_id = ?")
          .bind(qId, problemUserId)
          .run();
        if ((delRes?.meta?.changes ?? 0) > 0) {
          await bumpCommunityVersion(trackedEnv.DB, now);
        }
        return finalize(jsonResponse({ ok: true, qId, problemUserId }));
      }

      // All other /api/admin/* endpoints require valid Bearer HMAC token
      if (path.startsWith("/api/admin/")) {
        const auth = await verifyAdminToken(request, trackedEnv);
        if (!auth.valid) {
          return finalize(errorResponse(auth.error, auth.status));
        }

        if (method === "GET" && path === "/api/admin/verify") {
          return finalize(await handleAdminVerify(request, trackedEnv, auth));
        }

        if (method === "POST" && path === "/api/admin/logout") {
          return finalize(await handleAdminLogout(trackedEnv, auth));
        }

        const adminSessionRevokeMatch = path.match(/^\/api\/admin\/sessions\/([^/]+)\/revoke$/);
        if (adminSessionRevokeMatch && method === "POST") {
          const sessionId = decodeURIComponent(adminSessionRevokeMatch[1]);
          return finalize(await handleAdminRevokeSession(trackedEnv, sessionId));
        }

        if (method === "GET" && path === "/api/admin/users") {
          return finalize(await handleAdminUsers(trackedEnv, auth.sessionId));
        }

        if (method === "POST" && path === "/api/admin/users/cleanup-unused") {
          return finalize(await handleAdminCleanupUnusedUsers(request, trackedEnv));
        }

        const adminUserRoleMatch = path.match(/^\/api\/admin\/users\/([^/]+)\/role$/);
        if (adminUserRoleMatch && method === "POST") {
          const userId = decodeURIComponent(adminUserRoleMatch[1]);
          return finalize(await handleAdminSetUserRole(request, trackedEnv, userId));
        }

        if (method === "POST" && path === "/api/admin/identities/pool") {
          return finalize(await handleAdminAddPoolName(request, trackedEnv));
        }

        const adminPoolDeleteMatch = path.match(/^\/api\/admin\/identities\/pool\/([^/]+)$/);
        if (adminPoolDeleteMatch && method === "DELETE") {
          const poolName = decodeURIComponent(adminPoolDeleteMatch[1]);
          return finalize(await handleAdminDeletePoolName(trackedEnv, poolName));
        }

        if (method === "GET" && path === "/api/admin/metrics") {
          return finalize(await handleAdminMetrics(request, trackedEnv, rawDb));
        }

        if (method === "GET" && path === "/api/admin/versions") {
          return finalize(await handleAdminVersions(request, trackedEnv));
        }

        if (method === "POST" && path === "/api/admin/versions") {
          return finalize(await handleAdminCreateVersionRelease(request, trackedEnv));
        }

        const adminVersionMatch = path.match(/^\/api\/admin\/versions\/([^/]+)$/);
        if (adminVersionMatch && method === "DELETE") {
          const releaseId = decodeURIComponent(adminVersionMatch[1]);
          return finalize(await handleAdminDeleteVersionRelease(trackedEnv, releaseId));
        }

        if (method === "GET" && path === "/api/admin/feedback") {
          return finalize(await handleAdminFeedback(trackedEnv));
        }

        const adminFeedbackMatch = path.match(/^\/api\/admin\/feedback\/([^/]+)$/);
        if (adminFeedbackMatch && method === "DELETE") {
          const feedbackId = decodeURIComponent(adminFeedbackMatch[1]);
          await trackedEnv.DB.prepare("DELETE FROM user_feedback WHERE feedback_id = ?").bind(feedbackId).run();
          return finalize(jsonResponse({ ok: true, deletedId: feedbackId }));
        }

        const adminUserBlockMatch = path.match(/^\/api\/admin\/users\/([^/]+)\/block$/);
        if (adminUserBlockMatch && method === "POST") {
          const userId = decodeURIComponent(adminUserBlockMatch[1]);
          return finalize(await handleAdminBlockUser(request, trackedEnv, userId));
        }

        const adminUserUnblockMatch = path.match(/^\/api\/admin\/users\/([^/]+)\/unblock$/);
        if (adminUserUnblockMatch && method === "POST") {
          const userId = decodeURIComponent(adminUserUnblockMatch[1]);
          return finalize(await handleAdminUnblockUser(trackedEnv, userId));
        }

        const adminUserMatch = path.match(/^\/api\/admin\/users\/([^/]+)$/);
        if (adminUserMatch) {
          const userId = decodeURIComponent(adminUserMatch[1]);
          if (method === "PUT") {
            return finalize(await handleAdminRenameUser(request, trackedEnv, userId));
          }
          if (method === "DELETE") {
            const now = Date.now();
            await trackedEnv.DB.batch([
              trackedEnv.DB.prepare("DELETE FROM identities WHERE user_id = ?").bind(userId),
              trackedEnv.DB.prepare("DELETE FROM user_device_secrets WHERE user_id = ?").bind(userId),
              trackedEnv.DB.prepare("DELETE FROM user_progress WHERE user_id = ?").bind(userId),
              trackedEnv.DB.prepare("DELETE FROM blocked_users WHERE user_id = ?").bind(userId),
              trackedEnv.DB.prepare("UPDATE admin_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at = 0").bind(now, userId),
            ]);
            invalidateLeaderboardCache();
            return finalize(jsonResponse({ ok: true, releasedUserId: userId }));
          }
        }

        if (method === "POST" && path === "/api/admin/import-legacy") {
          return finalize(await handleAdminImportLegacy(request, trackedEnv));
        }
      }

      return finalize(errorResponse("Not found", 404));
    } catch (err) {
      return finalize(errorResponse(err?.message || "Internal server error", 500));
    }
  },
};

export { mergeProgressPayloads, normalizeSyncCode };
