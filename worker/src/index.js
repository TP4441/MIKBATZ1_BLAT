const TOKEN_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days
const RATE_LIMIT_MAX_ATTEMPTS = 5;
const RATE_LIMIT_LOCK_MS = 10 * 60 * 1000; // 10 minutes
const VALID_PROBLEM_TYPES = new Set(["question_issue", "distractor_issue", "out_of_material"]);

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

async function verifyOrBindClientSecret(db, userId, clientSecret, identityInfo = null) {
  if (!userId || typeof userId !== "string" || userId.length > 80) {
    return { ok: false, status: 400, error: "Invalid userId" };
  }
  if (!clientSecret || typeof clientSecret !== "string" || clientSecret.length < 8 || clientSecret.length > 256) {
    return { ok: false, status: 403, error: "Missing or invalid clientSecret" };
  }

  const secretHash = await sha256Hex(clientSecret);
  const existing = await db
    .prepare("SELECT user_id, name, client_secret_hash FROM identities WHERE user_id = ?")
    .bind(userId)
    .first();

  const now = Date.now();
  if (existing) {
    if (existing.client_secret_hash && existing.client_secret_hash !== secretHash) {
      return { ok: false, status: 403, error: "Forbidden: clientSecret mismatch" };
    }
    if (!existing.client_secret_hash) {
      await db
        .prepare("UPDATE identities SET client_secret_hash = ?, last_seen_at = ? WHERE user_id = ?")
        .bind(secretHash, now, userId)
        .run();
    } else {
      await db
        .prepare("UPDATE identities SET last_seen_at = ? WHERE user_id = ?")
        .bind(now, userId)
        .run();
    }
    return { ok: true, secretHash };
  }

  // First time seeing this userId — create identity row if info is provided
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
  }
  return { ok: true, secretHash };
}

async function handleBootstrap(env) {
  const [notesRes, probsRes, overridesRes, takenNames] = await Promise.all([
    env.DB.prepare("SELECT q_id, user_id, author, emoji, category, text, updated_at FROM community_notes").all(),
    env.DB.prepare("SELECT q_id, user_id, type, text, author, emoji, category, updated_at FROM community_problems").all(),
    env.DB.prepare(
      "SELECT q_id, hidden, stem, options_json, correct_json, all_accepted, appeal_note, subject, updated_at FROM question_overrides"
    ).all(),
    getTakenNamesMap(env.DB),
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

  return jsonResponse({ ok: true, notes, problems, overrides, takenNames });
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

  if (existing && existing.client_secret_hash && existing.client_secret_hash !== secretHash) {
    return errorResponse("Forbidden: clientSecret mismatch", 403);
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
  } else {
    await env.DB
      .prepare(
        `INSERT INTO identities (user_id, name, emoji, category, client_secret_hash, first_seen_at, last_seen_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(userId, name, emoji, category, secretHash, now, now)
      .run();
  }

  return jsonResponse({ ok: true, conflict: false, lastSeenAt: now });
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
    await env.DB
      .prepare("DELETE FROM community_notes WHERE q_id = ? AND user_id = ?")
      .bind(qId, userId)
      .run();
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
  }

  return jsonResponse({ ok: true, deleted: Boolean(existing) });
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
         COALESCE(n.cnt, 0) AS notesCount,
         COALESCE(p.cnt, 0) AS problemsCount
       FROM identities i
       LEFT JOIN (SELECT user_id, COUNT(*) AS cnt FROM community_notes GROUP BY user_id) n
         ON i.user_id = n.user_id
       LEFT JOIN (SELECT user_id, COUNT(*) AS cnt FROM community_problems GROUP BY user_id) p
         ON i.user_id = p.user_id
       ORDER BY i.last_seen_at DESC`
    )
    .all();

  return jsonResponse({ ok: true, users: results || [] });
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

      if (method === "POST" && path === "/api/identities/ping") {
        return await handleIdentityPing(request, env);
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
          await env.DB.prepare("DELETE FROM identities WHERE user_id = ?").bind(userId).run();
          return jsonResponse({ ok: true, releasedUserId: userId });
        }

        const adminNoteMatch = path.match(/^\/api\/admin\/notes\/([^/]+)\/([^/]+)$/);
        if (adminNoteMatch && method === "DELETE") {
          const qId = decodeURIComponent(adminNoteMatch[1]);
          const userId = decodeURIComponent(adminNoteMatch[2]);
          await env.DB
            .prepare("DELETE FROM community_notes WHERE q_id = ? AND user_id = ?")
            .bind(qId, userId)
            .run();
          return jsonResponse({ ok: true, qId, userId });
        }

        const adminProblemMatch = path.match(/^\/api\/admin\/problems\/([^/]+)\/([^/]+)$/);
        if (adminProblemMatch && method === "DELETE") {
          const qId = decodeURIComponent(adminProblemMatch[1]);
          const userId = decodeURIComponent(adminProblemMatch[2]);
          await env.DB
            .prepare("DELETE FROM community_problems WHERE q_id = ? AND user_id = ?")
            .bind(qId, userId)
            .run();
          return jsonResponse({ ok: true, qId, userId });
        }

        const adminOverrideMatch = path.match(/^\/api\/admin\/overrides\/([^/]+)$/);
        if (adminOverrideMatch) {
          const qId = decodeURIComponent(adminOverrideMatch[1]);
          if (method === "PUT") return await handleAdminPutOverride(request, env, qId);
          if (method === "DELETE") {
            await env.DB.prepare("DELETE FROM question_overrides WHERE q_id = ?").bind(qId).run();
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
