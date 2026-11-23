(() => {
  "use strict";

  const STORAGE_KEY = "med_exam_cluster1_progress_v1";
  const THEME_KEY = "med_exam_theme_v1";
  const IDENTITY_KEY = "med_exam_user_identity_v1";
  const COMMUNITY_NOTES_CACHE_KEY = "med_exam_community_notes_cache_v1";
  const CLOUD_NOTES_URL = "https://textdb.dev/api/data/mikbatz1_blat_notes_1b014a75-b087-45fc-9cea-c4749561ae4e";
  const HEBREW_LETTERS = ["א", "ב", "ג", "ד", "ה", "ו"];

  // 100 unique identities across 4 categories (25 each)
  const IDENTITY_CATALOG = [
    // פירות (1-25)
    { name: "תפוח", emoji: "🍎", category: "פירות" },
    { name: "מנגו", emoji: "🥭", category: "פירות" },
    { name: "תות", emoji: "🍓", category: "פירות" },
    { name: "אננס", emoji: "🍍", category: "פירות" },
    { name: "אבטיח", emoji: "🍉", category: "פירות" },
    { name: "אפרסק", emoji: "🍑", category: "פירות" },
    { name: "דובדבן", emoji: "🍒", category: "פירות" },
    { name: "קיווי", emoji: "🥝", category: "פירות" },
    { name: "בננה", emoji: "🍌", category: "פירות" },
    { name: "ענבים", emoji: "🍇", category: "פירות" },
    { name: "אגס", emoji: "🍐", category: "פירות" },
    { name: "תפוז", emoji: "🍊", category: "פירות" },
    { name: "לימון", emoji: "🍋", category: "פירות" },
    { name: "אוכמניות", emoji: "🫐", category: "פירות" },
    { name: "קוקוס", emoji: "🥥", category: "פירות" },
    { name: "מלון", emoji: "🍈", category: "פירות" },
    { name: "רימון", emoji: "🍎", category: "פירות" },
    { name: "ליצ'י", emoji: "🍒", category: "פירות" },
    { name: "פסיפלורה", emoji: "🥭", category: "פירות" },
    { name: "שזיף", emoji: "🍑", category: "פירות" },
    { name: "קלמנטינה", emoji: "🍊", category: "פירות" },
    { name: "גויאבה", emoji: "🍈", category: "פירות" },
    { name: "סברס", emoji: "🌵", category: "פירות" },
    { name: "תמר", emoji: "🌴", category: "פירות" },
    { name: "משמש", emoji: "🍑", category: "פירות" },
    // ירקות (26-50)
    { name: "עגבנייה", emoji: "🍅", category: "ירקות" },
    { name: "מלפפון", emoji: "🥒", category: "ירקות" },
    { name: "גזר", emoji: "🥕", category: "ירקות" },
    { name: "אבוקדו", emoji: "🥑", category: "ירקות" },
    { name: "ברוקולי", emoji: "🥦", category: "ירקות" },
    { name: "חציל", emoji: "🍆", category: "ירקות" },
    { name: "תירס", emoji: "🌽", category: "ירקות" },
    { name: "פלפל חריף", emoji: "🌶️", category: "ירקות" },
    { name: "גמבה", emoji: "🫑", category: "ירקות" },
    { name: "שום", emoji: "🧄", category: "ירקות" },
    { name: "בצל", emoji: "🧅", category: "ירקות" },
    { name: "תפוח אדמה", emoji: "🥔", category: "ירקות" },
    { name: "בטטה", emoji: "🍠", category: "ירקות" },
    { name: "חסה", emoji: "🥬", category: "ירקות" },
    { name: "פטרייה", emoji: "🍄", category: "ירקות" },
    { name: "דלעת", emoji: "🎃", category: "ירקות" },
    { name: "קישוא", emoji: "🥒", category: "ירקות" },
    { name: "כרובית", emoji: "🥦", category: "ירקות" },
    { name: "תרד", emoji: "🥬", category: "ירקות" },
    { name: "ג'ינג'ר", emoji: "🫚", category: "ירקות" },
    { name: "אפונה", emoji: "🫛", category: "ירקות" },
    { name: "קולורבי", emoji: "🥗", category: "ירקות" },
    { name: "סלרי", emoji: "🌿", category: "ירקות" },
    { name: "זית", emoji: "🫒", category: "ירקות" },
    { name: "צנונית", emoji: "🥕", category: "ירקות" },
    // כלי מטבח (51-75)
    { name: "מצקת", emoji: "🥄", category: "כלי מטבח" },
    { name: "מחבת", emoji: "🍳", category: "כלי מטבח" },
    { name: "סיר", emoji: "🍲", category: "כלי מטבח" },
    { name: "קערה", emoji: "🥣", category: "כלי מטבח" },
    { name: "מזלג", emoji: "🍴", category: "כלי מטבח" },
    { name: "כף", emoji: "🥄", category: "כלי מטבח" },
    { name: "סכין שף", emoji: "🔪", category: "כלי מטבח" },
    { name: "צ'ופסטיקס", emoji: "🥢", category: "כלי מטבח" },
    { name: "פינג'אן", emoji: "☕", category: "כלי מטבח" },
    { name: "קומקום", emoji: "🫖", category: "כלי מטבח" },
    { name: "תבנית אפייה", emoji: "🧁", category: "כלי מטבח" },
    { name: "מערוך", emoji: "🥖", category: "כלי מטבח" },
    { name: "פומפייה", emoji: "🧀", category: "כלי מטבח" },
    { name: "מסננת", emoji: "🥗", category: "כלי מטבח" },
    { name: "מרית", emoji: "🥞", category: "כלי מטבח" },
    { name: "מטרפה", emoji: "🥚", category: "כלי מטבח" },
    { name: "כותש שום", emoji: "🧄", category: "כלי מטבח" },
    { name: "קולפן", emoji: "🥔", category: "כלי מטבח" },
    { name: "קרש חיתוך", emoji: "🪵", category: "כלי מטבח" },
    { name: "פותחן", emoji: "🥫", category: "כלי מטבח" },
    { name: "משקל מטבח", emoji: "⚖️", category: "כלי מטבח" },
    { name: "צנצנת", emoji: "🫙", category: "כלי מטבח" },
    { name: "צלחת", emoji: "🍽️", category: "כלי מטבח" },
    { name: "כוס מדידה", emoji: "🥛", category: "כלי מטבח" },
    { name: "מבער", emoji: "🔥", category: "כלי מטבח" },
    // תנ"ך (76-100)
    { name: "משה", emoji: "📜", category: "תנ\"ך" },
    { name: "דוד", emoji: "👑", category: "תנ\"ך" },
    { name: "שלמה", emoji: "🦁", category: "תנ\"ך" },
    { name: "דבורה", emoji: "⚖️", category: "תנ\"ך" },
    { name: "אסתר", emoji: "👑", category: "תנ\"ך" },
    { name: "רות", emoji: "🌾", category: "תנ\"ך" },
    { name: "יהושע", emoji: "🎺", category: "תנ\"ך" },
    { name: "אליהו", emoji: "🔥", category: "תנ\"ך" },
    { name: "יונה", emoji: "🕊️", category: "תנ\"ך" },
    { name: "שמשון", emoji: "💪", category: "תנ\"ך" },
    { name: "שמואל", emoji: "🏺", category: "תנ\"ך" },
    { name: "מרים", emoji: "🌿", category: "תנ\"ך" },
    { name: "אברהם", emoji: "⛺", category: "תנ\"ך" },
    { name: "שרה", emoji: "🌟", category: "תנ\"ך" },
    { name: "יעקב", emoji: "🐑", category: "תנ\"ך" },
    { name: "רחל", emoji: "🌸", category: "תנ\"ך" },
    { name: "רבקה", emoji: "💧", category: "תנ\"ך" },
    { name: "לאה", emoji: "🌾", category: "תנ\"ך" },
    { name: "יוסף", emoji: "🧥", category: "תנ\"ך" },
    { name: "יהונתן", emoji: "🏹", category: "תנ\"ך" },
    { name: "דניאל", emoji: "🦁", category: "תנ\"ך" },
    { name: "גדעון", emoji: "📯", category: "תנ\"ך" },
    { name: "חזקיהו", emoji: "👑", category: "תנ\"ך" },
    { name: "אביגיל", emoji: "🎶", category: "תנ\"ך" },
    { name: "יעל", emoji: "🛡️", category: "תנ\"ך" },
  ];

  const DATA = window.EXAM_DATA;
  if (!DATA || !Array.isArray(DATA.questions)) {
    document.body.innerHTML = "<h2 style='padding:40px;text-align:center'>שגיאה בטעינת questions_data.js</h2>";
    return;
  }

  const QUESTIONS = DATA.questions;
  const EXAMS = DATA.exams;
  const Q_MAP = new Map(QUESTIONS.map((q) => [q.id, q]));

  // State
  let serverOnline = false;
  let currentMode = "practice"; // practice | exam | drill | flashcard | analytics
  let communityNotes = loadCommunityNotesCache(); // { qId: { userId: { author, emoji, category, text, updatedAt } } }
  let identityNeedsCloudCheck = false;
  let userIdentity = loadOrInitIdentity();
  let progress = loadProgress();
  let filteredList = [...QUESTIONS];
  let currentIndex = 0;
  let optionPermutations = new Map(); // qId -> array of original indices
  let shuffleOptionsEnabled = false;
  let flashcardRevealed = false;
  let sessionAnswered = 0;
  let sessionCorrect = 0;
  let notesExpanded = false; // Always closed by default (strict manual spoiler toggle)
  let lastRenderedQId = null;
  let noteSyncState = "synced";
  let noteInputDebounce = null;
  const pendingDirtyQIds = new Set();
  let cloudWriteQueue = Promise.resolve();

  // Filter state
  const filters = {
    exams: new Set(), // empty = all
    subjects: new Set(), // empty = all
    status: "all",
    search: "",
    mergePathology: true,
  };

  // Exam simulation state
  let simState = {
    active: false,
    questions: [],
    answers: new Map(), // qId -> selected original option idx
    flagged: new Set(),
    struck: new Map(), // qId -> Set of original option idx
    currentIndex: 0,
    secondsLeft: 0,
    timerId: null,
    shuffleOpts: false,
  };

  // Lightbox state
  let lbScale = 1;
  let lbX = 0;
  let lbY = 0;
  let lbDragging = false;
  let lbStartX = 0;
  let lbStartY = 0;

  // DOM refs
  const el = (id) => document.getElementById(id);

  function defaultProgress() {
    return {
      identity: userIdentity
        ? { userId: userIdentity.userId, name: userIdentity.name, emoji: userIdentity.emoji, category: userIdentity.category }
        : null,
      attempts: {}, // qId -> { selected: number, isCorrect: boolean, ts: number }
      flags: {},    // qId -> { star?: bool, unsure?: bool, problem?: bool }
      notes: {},    // qId -> string
      struck: {},   // qId -> number[]
      drillStreak: {}, // qId -> number (0..2)
      dailyStats: {},  // YYYY-MM-DD -> { answered: number, correct: number }
    };
  }

  function loadProgress() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultProgress();
      return { ...defaultProgress(), ...JSON.parse(raw) };
    } catch {
      return defaultProgress();
    }
  }

  let saveTimeout = null;
  function saveProgress() {
    progress.identity = {
      userId: userIdentity.userId,
      name: userIdentity.name,
      emoji: userIdentity.emoji,
      category: userIdentity.category,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    updateDrillBadge();
    if (serverOnline) {
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => {
        fetch("/api/progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(progress),
        }).catch(() => {});
      }, 400);
    }
  }

  function todayKey() {
    return new Date().toISOString().slice(0, 10);
  }

  function recordDaily(isCorrect) {
    const k = todayKey();
    if (!progress.dailyStats[k]) progress.dailyStats[k] = { answered: 0, correct: 0 };
    progress.dailyStats[k].answered += 1;
    if (isCorrect) progress.dailyStats[k].correct += 1;
  }

  function showToast(msg) {
    const container = el("toastContainer");
    const t = document.createElement("div");
    t.className = "toast";
    t.textContent = msg;
    container.appendChild(t);
    setTimeout(() => t.remove(), 3200);
  }

  // Identity & Community Notes helpers
  function loadCommunityNotesCache() {
    try {
      const raw = localStorage.getItem(COMMUNITY_NOTES_CACHE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function saveCommunityNotesCache() {
    try {
      localStorage.setItem(COMMUNITY_NOTES_CACHE_KEY, JSON.stringify(communityNotes));
    } catch {}
  }

  function getTakenAuthorNames() {
    const taken = new Set();
    Object.values(communityNotes).forEach((byUser) => {
      if (!byUser || typeof byUser !== "object") return;
      Object.entries(byUser).forEach(([uid, noteObj]) => {
        if (userIdentity && uid === userIdentity.userId) return;
        if (noteObj && typeof noteObj.text === "string" && noteObj.text.trim() && noteObj.author) {
          taken.add(noteObj.author);
        }
      });
    });
    return taken;
  }

  function pickRandomIdentity(excludeCurrent = true) {
    const taken = getTakenAuthorNames();
    let pool = IDENTITY_CATALOG.filter((item) => {
      if (excludeCurrent && userIdentity && item.name === userIdentity.name) return false;
      return !taken.has(item.name);
    });
    if (pool.length === 0) {
      pool = IDENTITY_CATALOG.filter((item) => !(excludeCurrent && userIdentity && item.name === userIdentity.name));
    }
    if (pool.length === 0) pool = IDENTITY_CATALOG;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function loadOrInitIdentity() {
    try {
      const raw = localStorage.getItem(IDENTITY_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const match = IDENTITY_CATALOG.find((item) => item.name === parsed?.name);
        if (parsed?.userId && match) {
          identityNeedsCloudCheck = false;
          return {
            userId: String(parsed.userId),
            name: match.name,
            emoji: match.emoji,
            category: match.category,
            locked: true,
          };
        }
      }
    } catch {}
    const picked = pickRandomIdentity(false);
    const created = {
      userId: "u_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36),
      name: picked.name,
      emoji: picked.emoji,
      category: picked.category,
      locked: true,
    };
    identityNeedsCloudCheck = true;
    try {
      localStorage.setItem(IDENTITY_KEY, JSON.stringify(created));
    } catch {}
    return created;
  }

  function updateIdentityUI() {
    const label = `${userIdentity.emoji} ${userIdentity.name}`;
    const badge = el("userIdentityBadge");
    if (badge) badge.textContent = label;
    const myLabel = el("myNoteLabel");
    if (myLabel) myLabel.textContent = `📝 ההערה שלי בתור ${label}:`;
  }

  function saveUserIdentity() {
    try {
      localStorage.setItem(IDENTITY_KEY, JSON.stringify(userIdentity));
    } catch {}
    if (progress) {
      progress.identity = {
        userId: userIdentity.userId,
        name: userIdentity.name,
        emoji: userIdentity.emoji,
        category: userIdentity.category,
      };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
      } catch {}
    }
    updateIdentityUI();
  }

  function getMyNoteText(qId) {
    const cloudMine = communityNotes[qId]?.[userIdentity.userId]?.text;
    if (typeof cloudMine === "string") return cloudMine;
    return progress.notes[qId] || "";
  }

  function getQuestionCommunityNotesList(qId) {
    const byUser = communityNotes[qId];
    const list = [];
    if (byUser && typeof byUser === "object") {
      Object.entries(byUser).forEach(([uid, noteObj]) => {
        if (!noteObj || typeof noteObj.text !== "string") return;
        const text = noteObj.text.trim();
        if (!text) return;
        list.push({
          userId: uid,
          author: noteObj.author || "אנונימי",
          emoji: noteObj.emoji || "💬",
          category: noteObj.category || "",
          text: noteObj.text,
          updatedAt: Number(noteObj.updatedAt) || 0,
          isMine: uid === userIdentity.userId,
        });
      });
    }
    // Put current user's note first, then newest first
    list.sort((a, b) => {
      if (a.isMine !== b.isMine) return a.isMine ? -1 : 1;
      return b.updatedAt - a.updatedAt;
    });
    return list;
  }

  function formatNoteTime(ts) {
    if (!ts) return "";
    try {
      return new Date(ts).toLocaleString("he-IL", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  }

  function updateNoteSyncBadge() {
    const statusEl = el("noteSyncStatus");
    if (!statusEl) return;
    if (noteSyncState === "saving") statusEl.textContent = "שומר לענן... ⏳";
    else if (noteSyncState === "offline") statusEl.textContent = "שמור מקומית (אופליין) 💾";
    else if (noteSyncState === "error") statusEl.textContent = "ממתין לסנכרון ⚠️";
    else statusEl.textContent = "מסונכרן ☁️";
  }

  function renderNotesSection(q, preserveFocus = false) {
    updateIdentityUI();
    const notesList = getQuestionCommunityNotesList(q.id);

    const toggleBtn = el("btnToggleNotes");
    toggleBtn.setAttribute("aria-expanded", notesExpanded ? "true" : "false");
    toggleBtn.classList.toggle("open", notesExpanded);
    toggleBtn.classList.toggle("has-notes", notesList.length > 0);

    el("notesToggleTitle").textContent = notesList.length > 0
      ? `הערות לשאלה זו (${notesList.length})`
      : "אין הערות עדיין לשאלה זו";

    const previewEl = el("notesAuthorsPreview");
    previewEl.innerHTML = "";
    const maxPreview = 5;
    notesList.slice(0, maxPreview).forEach((n) => {
      const chip = document.createElement("span");
      chip.className = "author-chip-mini" + (n.isMine ? " is-mine" : "");
      chip.textContent = `${n.emoji} ${n.author}`;
      previewEl.appendChild(chip);
    });
    if (notesList.length > maxPreview) {
      const more = document.createElement("span");
      more.className = "author-chip-mini";
      more.textContent = `+${notesList.length - maxPreview}`;
      previewEl.appendChild(more);
    }

    el("notesToggleArrow").textContent = notesExpanded
      ? "הסתר הערות 🔼"
      : notesList.length > 0
      ? "לחץ להצגה 🔽"
      : "הוסף הערה 🔽";

    el("qNotesDrawer").classList.toggle("hidden", !notesExpanded);

    const listEl = el("communityNotesList");
    listEl.innerHTML = "";
    if (notesList.length === 0) {
      const emptyMsg = document.createElement("div");
      emptyMsg.className = "community-notes-empty";
      emptyMsg.textContent = "אין עדיין הערות משותפות לשאלה זו. כתוב הערה למטה והיא תשותף עם כולם!";
      listEl.appendChild(emptyMsg);
    } else {
      notesList.forEach((n) => {
        const card = document.createElement("div");
        card.className = "community-note-card" + (n.isMine ? " is-mine" : "");

        const head = document.createElement("div");
        head.className = "community-note-head";

        const authorSpan = document.createElement("span");
        authorSpan.className = "community-note-author";
        authorSpan.textContent = `${n.emoji} ${n.author}`;
        if (n.isMine) {
          const mineBadge = document.createElement("span");
          mineBadge.className = "community-note-mine-badge";
          mineBadge.textContent = "שלי";
          authorSpan.appendChild(mineBadge);
        }

        const timeSpan = document.createElement("span");
        timeSpan.className = "community-note-time";
        timeSpan.textContent = formatNoteTime(n.updatedAt);

        head.append(authorSpan, timeSpan);

        const textDiv = document.createElement("div");
        textDiv.className = "community-note-text";
        textDiv.textContent = n.text;

        card.append(head, textDiv);
        listEl.appendChild(card);
      });
    }

    const inputEl = el("qNoteInput");
    if (!(preserveFocus && document.activeElement === inputEl)) {
      inputEl.value = getMyNoteText(q.id);
    }
    updateNoteSyncBadge();
  }

  function toggleNotesDrawer(forceState = null) {
    if (filteredList.length === 0) return;
    notesExpanded = forceState !== null ? Boolean(forceState) : !notesExpanded;
    renderNotesSection(filteredList[currentIndex], true);
  }

  function normalizeCloudPayload(raw) {
    if (raw && typeof raw === "object" && raw.notes && typeof raw.notes === "object") {
      return { version: 1, notes: raw.notes };
    }
    return { version: 1, notes: {} };
  }

  function mergeCloudIntoLocal(cloudPayload) {
    const normalized = normalizeCloudPayload(cloudPayload);
    const merged = {};

    // Start from cloud notes
    Object.entries(normalized.notes).forEach(([qId, byUser]) => {
      if (!byUser || typeof byUser !== "object") return;
      merged[qId] = {};
      Object.entries(byUser).forEach(([uid, noteObj]) => {
        if (noteObj && typeof noteObj.text === "string" && noteObj.text.trim()) {
          merged[qId][uid] = { ...noteObj };
        }
      });
      if (Object.keys(merged[qId]).length === 0) delete merged[qId];
    });

    // Preserve any local unsynced edits for current user
    pendingDirtyQIds.forEach((qId) => {
      const localMine = communityNotes[qId]?.[userIdentity.userId];
      if (!merged[qId]) merged[qId] = {};
      if (localMine && localMine.text && localMine.text.trim()) {
        merged[qId][userIdentity.userId] = { ...localMine };
      } else {
        delete merged[qId][userIdentity.userId];
        if (Object.keys(merged[qId]).length === 0) delete merged[qId];
      }
    });

    communityNotes = merged;
    saveCommunityNotesCache();
  }

  async function fetchCloudNotesPayload() {
    try {
      const res = await fetch(CLOUD_NOTES_URL, { cache: "no-store" });
      if (res.ok) {
        const text = await res.text();
        if (!text || !text.trim()) return { version: 1, notes: {} };
        return normalizeCloudPayload(JSON.parse(text));
      }
    } catch {}
    if (serverOnline) {
      const res = await fetch("/api/community-notes", { cache: "no-store" });
      if (res.ok) return normalizeCloudPayload(await res.json());
    }
    throw new Error("Cloud notes unreachable");
  }

  async function pullCloudNotes(showFeedback = false) {
    try {
      const cloudData = await fetchCloudNotesPayload();
      mergeCloudIntoLocal(cloudData);
      if (identityNeedsCloudCheck) {
        identityNeedsCloudCheck = false;
        const hasMyNotes = pendingDirtyQIds.size > 0 || Object.values(communityNotes).some(
          (byUser) => byUser && byUser[userIdentity.userId]
        );
        if (!hasMyNotes && getTakenAuthorNames().has(userIdentity.name)) {
          const fresh = pickRandomIdentity(true);
          userIdentity = {
            userId: userIdentity.userId,
            name: fresh.name,
            emoji: fresh.emoji,
            category: fresh.category,
            locked: true,
          };
          saveUserIdentity();
        }
      }
      if (pendingDirtyQIds.size === 0) {
        noteSyncState = "synced";
      }
      if (serverOnline) {
        fetch("/api/community-notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ version: 1, notes: communityNotes }),
        }).catch(() => {});
      }
      if (filteredList.length > 0 && currentMode !== "exam" && currentMode !== "analytics") {
        renderNotesSection(filteredList[currentIndex], true);
      }
      if (showFeedback) showToast("🔄 ההערות המשותפות רועננו מהענן!");
    } catch {
      if (pendingDirtyQIds.size > 0) noteSyncState = "offline";
      updateNoteSyncBadge();
      if (showFeedback) showToast("⚠️ לא ניתן להתחבר לענן כרגע — מציג מטמון מקומי.");
    }
  }

  function enqueueCloudSync() {
    cloudWriteQueue = cloudWriteQueue
      .then(async () => {
        if (pendingDirtyQIds.size === 0) return;
        noteSyncState = "saving";
        updateNoteSyncBadge();

        const syncSnapshot = new Map();
        pendingDirtyQIds.forEach((qId) => {
          const entry = communityNotes[qId]?.[userIdentity.userId];
          syncSnapshot.set(qId, entry ? { ...entry } : null);
        });

        let cloudData = { version: 1, notes: {} };
        let cloudReachable = false;
        try {
          const res = await fetch(CLOUD_NOTES_URL, { cache: "no-store" });
          if (res.ok) {
            cloudReachable = true;
            const text = await res.text();
            if (text && text.trim()) {
              cloudData = normalizeCloudPayload(JSON.parse(text));
            }
          }
        } catch {}

        // Apply our snapshot onto latest cloud data (merge-safe per questionId + userId)
        syncSnapshot.forEach((entry, qId) => {
          if (!cloudData.notes[qId] || typeof cloudData.notes[qId] !== "object") {
            cloudData.notes[qId] = {};
          }
          if (entry && entry.text && entry.text.trim()) {
            cloudData.notes[qId][userIdentity.userId] = entry;
          } else {
            delete cloudData.notes[qId][userIdentity.userId];
            if (Object.keys(cloudData.notes[qId]).length === 0) {
              delete cloudData.notes[qId];
            }
          }
        });

        let cloudSaved = false;
        if (cloudReachable) {
          try {
            const postRes = await fetch(CLOUD_NOTES_URL, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(cloudData),
            });
            cloudSaved = postRes.ok;
          } catch {}
        }

        if (serverOnline) {
          fetch("/api/community-notes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(cloudData),
          }).catch(() => {});
        }

        if (cloudSaved) {
          // Clear only qIds that haven't been modified again while request was in flight
          syncSnapshot.forEach((sentEntry, qId) => {
            const currentEntry = communityNotes[qId]?.[userIdentity.userId] || null;
            const sameText = (sentEntry?.text || "") === (currentEntry?.text || "");
            const sameAuthor = (sentEntry?.author || "") === (currentEntry?.author || "");
            if (sameText && sameAuthor) {
              pendingDirtyQIds.delete(qId);
            }
          });
          mergeCloudIntoLocal(cloudData);
          noteSyncState = pendingDirtyQIds.size > 0 ? "saving" : "synced";
        } else {
          noteSyncState = "offline";
        }

        if (filteredList.length > 0 && currentMode !== "exam" && currentMode !== "analytics") {
          renderNotesSection(filteredList[currentIndex], true);
        } else {
          updateNoteSyncBadge();
        }
      })
      .catch(() => {
        noteSyncState = "error";
        updateNoteSyncBadge();
      });
    return cloudWriteQueue;
  }

  // Theme
  function initTheme() {
    const saved = localStorage.getItem(THEME_KEY) || "light";
    document.documentElement.setAttribute("data-theme", saved);
    el("btnTheme").textContent = saved === "dark" ? "☀️" : "🌙";
  }

  function toggleTheme() {
    const cur = document.documentElement.getAttribute("data-theme");
    const next = cur === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem(THEME_KEY, next);
    el("btnTheme").textContent = next === "dark" ? "☀️" : "🌙";
  }

  // Server check (only probe local Python server when running on localhost / 127.0.0.1)
  async function checkServer() {
    const isLocalHost = location.hostname === "127.0.0.1" || location.hostname === "localhost";
    if (location.protocol === "file:" || !isLocalHost) return;
    try {
      const res = await fetch("/api/health");
      if (res.ok) {
        serverOnline = true;
        el("syncPill").classList.remove("offline");
        el("syncPill").classList.add("online");
        el("syncText").textContent = "מחובר לשרת (סנכרון חי)";
        // Load server progress if newer/non-empty
        const pRes = await fetch("/api/progress");
        if (pRes.ok) {
          const srvProg = await pRes.json();
          if (srvProg && Object.keys(srvProg.attempts || {}).length > Object.keys(progress.attempts || {}).length) {
            progress = { ...defaultProgress(), ...srvProg };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
            renderCurrentView();
          }
        }
      }
    } catch {
      serverOnline = false;
    }
  }

  function getSubject(q) {
    return filters.mergePathology ? q.baseSubject : q.subject;
  }

  function getUniqueSubjects() {
    const set = new Set(QUESTIONS.map((q) => getSubject(q)));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "he"));
  }

  // Build filter chips
  function renderFilterChips() {
    const examWrap = el("examChips");
    examWrap.innerHTML = "";
    EXAMS.forEach((ex) => {
      const btn = document.createElement("button");
      btn.className = "chip" + (filters.exams.has(ex.name) ? " active" : "");
      btn.textContent = `${ex.name} (${ex.expectedCount})`;
      btn.onclick = () => {
        if (filters.exams.has(ex.name)) filters.exams.delete(ex.name);
        else filters.exams.add(ex.name);
        renderFilterChips();
        applyFilters();
      };
      examWrap.appendChild(btn);
    });

    const subjWrap = el("subjectChips");
    subjWrap.innerHTML = "";
    getUniqueSubjects().forEach((subj) => {
      const btn = document.createElement("button");
      btn.className = "chip" + (filters.subjects.has(subj) ? " active" : "");
      btn.textContent = subj;
      btn.onclick = () => {
        if (filters.subjects.has(subj)) filters.subjects.delete(subj);
        else filters.subjects.add(subj);
        renderFilterChips();
        applyFilters();
      };
      subjWrap.appendChild(btn);
    });
  }

  function getDrillQuestions() {
    return QUESTIONS.filter((q) => {
      const att = progress.attempts[q.id];
      const fl = progress.flags[q.id] || {};
      const streak = progress.drillStreak[q.id] || 0;
      const needsDrill = (att && !att.isCorrect) || fl.unsure;
      return needsDrill && streak < 2;
    });
  }

  function updateDrillBadge() {
    const count = getDrillQuestions().length;
    el("drillCountBadge").textContent = count;
  }

  function applyFilters(keepCurrentId = null) {
    if (currentMode === "drill") {
      filteredList = getDrillQuestions();
    } else {
      const term = filters.search.trim().toLowerCase();
      filteredList = QUESTIONS.filter((q) => {
        if (filters.exams.size > 0 && !filters.exams.has(q.exam)) return false;
        const s = getSubject(q);
        if (filters.subjects.size > 0 && !filters.subjects.has(s)) return false;

        const att = progress.attempts[q.id];
        const fl = progress.flags[q.id] || {};
        const myNote = getMyNoteText(q.id).trim();
        const qCommNotes = getQuestionCommunityNotesList(q.id);

        switch (filters.status) {
          case "unsolved": if (att) return false; break;
          case "wrong": if (!att || att.isCorrect) return false; break;
          case "starred": if (!fl.star) return false; break;
          case "unsure": if (!fl.unsure) return false; break;
          case "problematic": if (!fl.problem) return false; break;
          case "with_image": if (q.images.length === 0) return false; break;
          case "with_note": if (!myNote) return false; break;
          case "with_any_note": if (qCommNotes.length === 0 && !myNote) return false; break;
        }

        if (term) {
          const commText = qCommNotes.map((n) => `${n.emoji} ${n.author} ${n.text}`).join(" ");
          const hay = (
            q.stem + " " +
            q.options.map((o) => o.text).join(" ") + " " +
            myNote + " " +
            commText + " " +
            q.exam + " " +
            q.subject
          ).toLowerCase();
          if (!hay.includes(term)) return false;
        }
        return true;
      });
    }

    if (keepCurrentId) {
      const idx = filteredList.findIndex((q) => q.id === keepCurrentId);
      currentIndex = idx >= 0 ? idx : 0;
    } else {
      currentIndex = 0;
    }

    el("filteredCountText").textContent = `מציג ${filteredList.length} מתוך ${QUESTIONS.length} שאלות`;
    el("jumpInput").max = Math.max(1, filteredList.length);
    renderQuestion();
  }

  function getOptionOrder(q, forceShuffle = false) {
    if (!forceShuffle && !shuffleOptionsEnabled) {
      return q.options.map((_, i) => i);
    }
    if (!optionPermutations.has(q.id)) {
      const arr = q.options.map((_, i) => i);
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      optionPermutations.set(q.id, arr);
    }
    return optionPermutations.get(q.id);
  }

  function renderQuestion() {
    if (currentMode === "exam" || currentMode === "analytics") return;

    const card = el("questionCard");
    const empty = el("emptyState");
    if (filteredList.length === 0) {
      card.classList.add("hidden");
      empty.classList.remove("hidden");
      return;
    }
    card.classList.remove("hidden");
    empty.classList.add("hidden");

    if (currentIndex >= filteredList.length) currentIndex = filteredList.length - 1;
    if (currentIndex < 0) currentIndex = 0;

    const q = filteredList[currentIndex];
    if (q.id !== lastRenderedQId) {
      notesExpanded = false;
      lastRenderedQId = q.id;
    }
    const att = progress.attempts[q.id];
    const fl = progress.flags[q.id] || {};
    const struckSet = new Set(progress.struck[q.id] || []);
    flashcardRevealed = false;

    el("qExamBadge").textContent = `${q.exam} · שאלה ${q.num}`;
    el("qSubjectBadge").textContent = getSubject(q);
    el("qAppealBadge").classList.toggle("hidden", !(q.correct.length > 1 || q.allAccepted));

    const pdfLink = el("qPdfLink");
    if (q.pdf) {
      pdfLink.classList.remove("hidden");
      const encodedPdf = encodeURI(q.pdf);
      pdfLink.href = q.pdfPage ? `${encodedPdf}#page=${q.pdfPage}` : encodedPdf;
      pdfLink.textContent = q.pdfPage ? `📖 עמ׳ ${q.pdfPage} במבחן` : "📖 קובץ המבחן";
    } else {
      pdfLink.classList.add("hidden");
    }

    el("btnFlagStar").classList.toggle("active", !!fl.star);
    el("btnFlagUnsure").classList.toggle("active", !!fl.unsure);
    el("btnFlagProblem").classList.toggle("active", !!fl.problem);

    el("qPositionText").textContent = `שאלה ${currentIndex + 1} מתוך ${filteredList.length}`;
    el("jumpInput").value = currentIndex + 1;

    const drillStreakEl = el("qDrillStreakText");
    if (currentMode === "drill") {
      const st = progress.drillStreak[q.id] || 0;
      drillStreakEl.classList.remove("hidden");
      drillStreakEl.textContent = `🔥 רצף תיקון: ${st}/2`;
    } else {
      drillStreakEl.classList.add("hidden");
    }

    el("qSessionStatsText").textContent = sessionAnswered > 0
      ? `בסשן: ${sessionCorrect}/${sessionAnswered} (${Math.round((sessionCorrect / sessionAnswered) * 100)}%)`
      : "";

    el("qStem").textContent = q.stem;

    // Images
    const imgWrap = el("qImages");
    imgWrap.innerHTML = "";
    q.images.forEach((src, idx) => {
      const box = document.createElement("div");
      box.className = "q-image-wrap";
      const img = document.createElement("img");
      img.src = src;
      img.alt = `תמונה ${idx + 1} לשאלה ${q.num}`;
      const hint = document.createElement("span");
      hint.className = "q-image-hint";
      hint.textContent = "🔍 לחץ לזום";
      box.append(img, hint);
      box.onclick = () => openLightbox(src, `${q.exam} · שאלה ${q.num}`);
      imgWrap.appendChild(box);
    });

    // Options
    const optWrap = el("qOptions");
    optWrap.innerHTML = "";
    const order = getOptionOrder(q);
    const isFlashcard = currentMode === "flashcard";

    order.forEach((origIdx, displayIdx) => {
      const opt = q.options[origIdx];
      const row = document.createElement("div");
      row.className = "option-row" + (struckSet.has(origIdx) ? " struck" : "");

      const btn = document.createElement("button");
      btn.className = "option-btn";

      if (!isFlashcard && att) {
        if (q.correct.includes(origIdx)) btn.classList.add("correct");
        else if (att.selected === origIdx) btn.classList.add("wrong");
      }

      const letterSpan = document.createElement("span");
      letterSpan.className = "option-letter";
      letterSpan.textContent = `${HEBREW_LETTERS[displayIdx]}.`;

      const textSpan = document.createElement("span");
      textSpan.textContent = opt.text;

      btn.append(letterSpan, textSpan);
      btn.onclick = () => {
        if (isFlashcard) return;
        handleAnswer(q, origIdx);
      };
      btn.oncontextmenu = (e) => {
        e.preventDefault();
        toggleStrike(q.id, origIdx);
      };

      const strikeBtn = document.createElement("button");
      strikeBtn.className = "strike-btn";
      strikeBtn.title = "פסול מסיח (לחיצה ימנית)";
      strikeBtn.textContent = "✂️";
      strikeBtn.onclick = () => toggleStrike(q.id, origIdx);

      row.append(btn, strikeBtn);
      optWrap.appendChild(row);
    });

    // Feedback
    const fb = el("qFeedback");
    if (!isFlashcard && att) {
      showFeedbackBox(q, att.isCorrect);
    } else {
      fb.classList.add("hidden");
    }

    // Flashcard controls
    const fcCtrl = el("flashcardControls");
    if (isFlashcard) {
      fcCtrl.classList.remove("hidden");
      el("btnRevealCard").classList.remove("hidden");
      el("flashcardRate").classList.add("hidden");
    } else {
      fcCtrl.classList.add("hidden");
    }

    // Notes (always closed by default on new question; preserves state when answering same question)
    renderNotesSection(q, true);
  }

  function showFeedbackBox(q, isCorrect) {
    const fb = el("qFeedback");
    fb.classList.remove("hidden", "correct", "wrong", "info");
    if (isCorrect === true) fb.classList.add("correct");
    else if (isCorrect === false) fb.classList.add("wrong");
    else fb.classList.add("info");

    const order = getOptionOrder(q);
    const correctLabels = q.correct
      .map((origIdx) => {
        const dispIdx = order.indexOf(origIdx);
        return `<strong>${HEBREW_LETTERS[dispIdx >= 0 ? dispIdx : origIdx]}.</strong> ${escapeHtml(q.options[origIdx].text)}`;
      })
      .join("<br/>");

    let html = isCorrect === true
      ? "✅ <strong>תשובה נכונה!</strong>"
      : isCorrect === false
      ? `❌ <strong>טעות.</strong> התשובה הנכונה:<br/>${correctLabels}`
      : `💡 <strong>התשובה הנכונה:</strong><br/>${correctLabels}`;

    if (q.allAccepted) {
      html += `<div class="appeal-note">⚖️ כל התשובות התקבלו בשאלה זו.</div>`;
    } else if (q.appealNote) {
      html += `<div class="appeal-note">⚖️ ${escapeHtml(q.appealNote)}</div>`;
    }

    fb.innerHTML = html;
  }

  function handleAnswer(q, origIdx) {
    const isCorrect = q.correct.includes(origIdx);
    const firstTime = !progress.attempts[q.id];

    progress.attempts[q.id] = {
      selected: origIdx,
      isCorrect,
      ts: Date.now(),
    };

    if (currentMode === "drill") {
      if (isCorrect) {
        progress.drillStreak[q.id] = (progress.drillStreak[q.id] || 0) + 1;
        if (progress.drillStreak[q.id] >= 2) {
          showToast("🎉 ענית נכון פעמיים! השאלה הושלמה בתיקון טעויות.");
        }
      } else {
        progress.drillStreak[q.id] = 0;
      }
    }

    if (firstTime || currentMode === "drill") {
      sessionAnswered += 1;
      if (isCorrect) sessionCorrect += 1;
      recordDaily(isCorrect);
    }

    saveProgress();
    renderQuestion();
  }

  function toggleStrike(qId, origIdx) {
    const arr = new Set(progress.struck[qId] || []);
    if (arr.has(origIdx)) arr.delete(origIdx);
    else arr.add(origIdx);
    progress.struck[qId] = Array.from(arr);
    saveProgress();
    renderQuestion();
  }

  function toggleFlag(flagName) {
    if (filteredList.length === 0) return;
    const q = filteredList[currentIndex];
    if (!progress.flags[q.id]) progress.flags[q.id] = {};
    progress.flags[q.id][flagName] = !progress.flags[q.id][flagName];
    saveProgress();
    renderQuestion();
  }

  // Flashcard actions
  function revealFlashcard() {
    if (currentMode !== "flashcard" || filteredList.length === 0) return;
    flashcardRevealed = true;
    const q = filteredList[currentIndex];
    const order = getOptionOrder(q);
    const btns = el("qOptions").querySelectorAll(".option-btn");
    order.forEach((origIdx, dispIdx) => {
      if (q.correct.includes(origIdx) && btns[dispIdx]) {
        btns[dispIdx].classList.add("correct");
      }
    });
    showFeedbackBox(q, null);
    el("btnRevealCard").classList.add("hidden");
    el("flashcardRate").classList.remove("hidden");
  }

  function rateFlashcard(knew) {
    if (filteredList.length === 0) return;
    const q = filteredList[currentIndex];
    progress.attempts[q.id] = {
      selected: knew ? q.correct[0] : -1,
      isCorrect: knew,
      ts: Date.now(),
    };
    sessionAnswered += 1;
    if (knew) sessionCorrect += 1;
    recordDaily(knew);
    saveProgress();
    nextQuestion();
  }

  function prevQuestion() {
    if (currentIndex > 0) {
      currentIndex--;
      renderQuestion();
    }
  }

  function nextQuestion() {
    if (currentMode === "drill") {
      const prevId = filteredList[currentIndex]?.id;
      filteredList = getDrillQuestions();
      if (filteredList.length === 0) {
        renderQuestion();
        return;
      }
      const nextIdx = filteredList.findIndex((q) => q.id !== prevId);
      currentIndex = (currentIndex + 1) % filteredList.length;
      if (filteredList[currentIndex]?.id === prevId && nextIdx >= 0) currentIndex = nextIdx;
      renderQuestion();
      return;
    }
    if (currentIndex < filteredList.length - 1) {
      currentIndex++;
      renderQuestion();
    } else {
      showToast("הגעת לסוף הרשימה!");
    }
  }

  // Shuffle
  function shuffleFilteredQuestions() {
    for (let i = filteredList.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [filteredList[i], filteredList[j]] = [filteredList[j], filteredList[i]];
    }
    currentIndex = 0;
    renderQuestion();
    showToast("🔀 סדר השאלות עורבב!");
  }

  function toggleShuffleOptions() {
    shuffleOptionsEnabled = !shuffleOptionsEnabled;
    optionPermutations.clear();
    el("btnShuffleOptions").classList.toggle("btn-primary", shuffleOptionsEnabled);
    el("btnShuffleOptions").classList.toggle("btn-secondary", !shuffleOptionsEnabled);
    renderQuestion();
    showToast(shuffleOptionsEnabled ? "🎲 ערבוב מסיחים הופעל" : "סדר מסיחים מקורי");
  }

  // Lightbox Pan & Zoom
  function openLightbox(src, caption) {
    lbScale = 1;
    lbX = 0;
    lbY = 0;
    el("lightboxImg").src = src;
    el("lightboxCaption").textContent = caption;
    updateLightboxTransform();
    el("lightboxModal").classList.remove("hidden");
  }

  function updateLightboxTransform() {
    el("lightboxImg").style.transform = `translate(${lbX}px, ${lbY}px) scale(${lbScale})`;
  }

  function initLightbox() {
    const stage = el("lightboxStage");
    stage.addEventListener("wheel", (e) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.2 : -0.2;
      lbScale = Math.min(5, Math.max(0.5, lbScale + delta));
      updateLightboxTransform();
    });
    stage.addEventListener("mousedown", (e) => {
      lbDragging = true;
      lbStartX = e.clientX - lbX;
      lbStartY = e.clientY - lbY;
    });
    window.addEventListener("mousemove", (e) => {
      if (!lbDragging) return;
      lbX = e.clientX - lbStartX;
      lbY = e.clientY - lbStartY;
      updateLightboxTransform();
    });
    window.addEventListener("mouseup", () => { lbDragging = false; });

    el("btnZoomIn").onclick = () => { lbScale = Math.min(5, lbScale + 0.35); updateLightboxTransform(); };
    el("btnZoomOut").onclick = () => { lbScale = Math.max(0.5, lbScale - 0.35); updateLightboxTransform(); };
    el("btnZoomReset").onclick = () => { lbScale = 1; lbX = 0; lbY = 0; updateLightboxTransform(); };
    el("btnCloseLightbox").onclick = () => el("lightboxModal").classList.add("hidden");
  }

  // Exam Simulation
  function initExamSetup() {
    const sel = el("simExamSelect");
    sel.innerHTML = "";
    EXAMS.forEach((ex) => {
      const opt = document.createElement("option");
      opt.value = ex.name;
      opt.textContent = `${ex.name} (${ex.expectedCount} שאלות)`;
      sel.appendChild(opt);
    });

    const simSubjWrap = el("simSubjectChips");
    simSubjWrap.innerHTML = "";
    getUniqueSubjects().forEach((s) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chip active";
      btn.dataset.subj = s;
      btn.textContent = s;
      btn.onclick = () => btn.classList.toggle("active");
      simSubjWrap.appendChild(btn);
    });
  }

  function startSimulation() {
    const simType = document.querySelector('input[name="simType"]:checked').value;
    let pool = [];
    if (simType === "full") {
      const examName = el("simExamSelect").value;
      pool = QUESTIONS.filter((q) => q.exam === examName);
    } else {
      const chosenSubjs = new Set(
        Array.from(el("simSubjectChips").querySelectorAll(".chip.active")).map((b) => b.dataset.subj)
      );
      const count = Math.max(5, Math.min(200, parseInt(el("simCustomCount").value, 10) || 30));
      let candidates = QUESTIONS.filter((q) => chosenSubjs.size === 0 || chosenSubjs.has(getSubject(q)));
      candidates = [...candidates].sort(() => Math.random() - 0.5);
      pool = candidates.slice(0, count);
    }

    if (pool.length === 0) {
      showToast("אין שאלות זמינות לבחירה זו");
      return;
    }

    const mins = parseInt(el("simMinutes").value, 10) || 0;
    simState = {
      active: true,
      questions: pool,
      answers: new Map(),
      flagged: new Set(),
      struck: new Map(),
      currentIndex: 0,
      secondsLeft: mins * 60,
      timerId: null,
      shuffleOpts: el("simShuffleOpts").checked,
    };

    optionPermutations.clear();
    el("examSetup").classList.add("hidden");
    el("examResults").classList.add("hidden");
    el("examActive").classList.remove("hidden");

    if (simState.secondsLeft > 0) {
      updateSimTimerDisplay();
      simState.timerId = setInterval(() => {
        simState.secondsLeft--;
        updateSimTimerDisplay();
        if (simState.secondsLeft <= 0) {
          clearInterval(simState.timerId);
          submitSimulation();
        }
      }, 1000);
    } else {
      el("simTimerDisplay").textContent = "ללא הגבלה";
    }

    renderSimQuestion();
  }

  function updateSimTimerDisplay() {
    const m = Math.floor(simState.secondsLeft / 60);
    const s = simState.secondsLeft % 60;
    el("simTimerDisplay").textContent = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  function renderSimGrid() {
    const grid = el("simGrid");
    grid.innerHTML = "";
    simState.questions.forEach((q, idx) => {
      const cell = document.createElement("button");
      cell.className = "sim-cell";
      if (simState.answers.has(q.id)) cell.classList.add("answered");
      if (simState.flagged.has(q.id)) cell.classList.add("flagged");
      if (idx === simState.currentIndex) cell.classList.add("current");
      cell.textContent = idx + 1;
      cell.onclick = () => {
        simState.currentIndex = idx;
        renderSimQuestion();
      };
      grid.appendChild(cell);
    });
    el("simAnsweredDisplay").textContent = `${simState.answers.size} / ${simState.questions.length}`;
  }

  function renderSimQuestion() {
    renderSimGrid();
    const q = simState.questions[simState.currentIndex];
    const mount = el("simQuestionMount");
    const order = getOptionOrder(q, simState.shuffleOpts);
    const selectedOrig = simState.answers.get(q.id);
    const struckSet = simState.struck.get(q.id) || new Set();

    mount.innerHTML = `
      <article class="question-card card">
        <div class="q-header">
          <div class="q-meta">
            <span class="q-badge exam-badge">שאלה ${simState.currentIndex + 1} מתוך ${simState.questions.length}</span>
            <span class="q-badge subject-badge">${escapeHtml(getSubject(q))} · ${escapeHtml(q.exam)}</span>
          </div>
          <button class="flag-btn ${simState.flagged.has(q.id) ? "active" : ""}" id="simFlagBtn" title="סמן לבדיקה">🚩 סמן לבדיקה</button>
        </div>
        <div class="q-stem">${escapeHtml(q.stem)}</div>
        <div class="q-images" id="simImages"></div>
        <div class="q-options" id="simOptions"></div>
        <div class="q-nav-footer">
          <button class="btn-secondary" id="simPrevBtn">→ הקודמת</button>
          <button class="btn-primary" id="simNextBtn">הבאה ←</button>
        </div>
      </article>
    `;

    el("simFlagBtn").onclick = () => {
      if (simState.flagged.has(q.id)) simState.flagged.delete(q.id);
      else simState.flagged.add(q.id);
      renderSimQuestion();
    };

    const imgWrap = el("simImages");
    q.images.forEach((src) => {
      const box = document.createElement("div");
      box.className = "q-image-wrap";
      box.innerHTML = `<img src="${src}" alt="תמונה" /><span class="q-image-hint">🔍 לחץ לזום</span>`;
      box.onclick = () => openLightbox(src, `סימולציה · שאלה ${simState.currentIndex + 1}`);
      imgWrap.appendChild(box);
    });

    const optWrap = el("simOptions");
    order.forEach((origIdx, dispIdx) => {
      const opt = q.options[origIdx];
      const row = document.createElement("div");
      row.className = "option-row" + (struckSet.has(origIdx) ? " struck" : "");

      const btn = document.createElement("button");
      btn.className = "option-btn" + (selectedOrig === origIdx ? " selected" : "");
      btn.innerHTML = `<span class="option-letter">${HEBREW_LETTERS[dispIdx]}.</span><span>${escapeHtml(opt.text)}</span>`;
      btn.onclick = () => {
        simState.answers.set(q.id, origIdx);
        renderSimQuestion();
      };
      btn.oncontextmenu = (e) => {
        e.preventDefault();
        if (!simState.struck.has(q.id)) simState.struck.set(q.id, new Set());
        const st = simState.struck.get(q.id);
        if (st.has(origIdx)) st.delete(origIdx); else st.add(origIdx);
        renderSimQuestion();
      };

      const strikeBtn = document.createElement("button");
      strikeBtn.className = "strike-btn";
      strikeBtn.textContent = "✂️";
      strikeBtn.onclick = () => {
        if (!simState.struck.has(q.id)) simState.struck.set(q.id, new Set());
        const st = simState.struck.get(q.id);
        if (st.has(origIdx)) st.delete(origIdx); else st.add(origIdx);
        renderSimQuestion();
      };

      row.append(btn, strikeBtn);
      optWrap.appendChild(row);
    });

    el("simPrevBtn").onclick = () => {
      if (simState.currentIndex > 0) { simState.currentIndex--; renderSimQuestion(); }
    };
    el("simNextBtn").onclick = () => {
      if (simState.currentIndex < simState.questions.length - 1) { simState.currentIndex++; renderSimQuestion(); }
    };
  }

  function submitSimulation() {
    clearInterval(simState.timerId);
    simState.active = false;

    let correctCount = 0;
    const bySubj = {};
    const wrongIds = [];

    simState.questions.forEach((q) => {
      const s = getSubject(q);
      if (!bySubj[s]) bySubj[s] = { total: 0, correct: 0 };
      bySubj[s].total++;

      const chosen = simState.answers.get(q.id);
      const isOk = chosen !== undefined && q.correct.includes(chosen);
      if (isOk) {
        correctCount++;
        bySubj[s].correct++;
      } else {
        wrongIds.push(q.id);
      }

      if (chosen !== undefined) {
        progress.attempts[q.id] = { selected: chosen, isCorrect: isOk, ts: Date.now() };
        recordDaily(isOk);
      }
    });
    saveProgress();

    const pct = Math.round((correctCount / simState.questions.length) * 100);
    const resEl = el("examResults");
    el("examActive").classList.add("hidden");
    resEl.classList.remove("hidden");

    const subjRows = Object.entries(bySubj)
      .map(([subj, st]) => {
        const sp = Math.round((st.correct / st.total) * 100);
        return `
          <div class="prog-item">
            <div class="prog-item-head"><span>${escapeHtml(subj)}</span><strong>${st.correct}/${st.total} (${sp}%)</strong></div>
            <div class="prog-bar-bg"><div class="prog-bar-fill" style="width:${sp}%"></div></div>
          </div>`;
      })
      .join("");

    resEl.innerHTML = `
      <h2>🏁 תוצאות הסימולציה</h2>
      <div class="kpi-grid" style="margin-top:14px;">
        <div class="kpi-card"><div class="kpi-label">ציון סופי</div><div class="kpi-value">${pct}%</div></div>
        <div class="kpi-card"><div class="kpi-label">תשובות נכונות</div><div class="kpi-value">${correctCount} / ${simState.questions.length}</div></div>
        <div class="kpi-card"><div class="kpi-label">טעויות / דילוגים</div><div class="kpi-value">${wrongIds.length}</div></div>
      </div>
      <h3>פילוח לפי מקצוע</h3>
      <div class="subject-progress-list">${subjRows}</div>
      <div style="display:flex;gap:10px;margin-top:20px;flex-wrap:wrap;">
        <button class="btn-primary" id="btnReviewSimWrong">🔥 תחקר טעויות מהסימולציה (${wrongIds.length})</button>
        <button class="btn-secondary" id="btnNewSim">🔄 סימולציה חדשה</button>
      </div>
    `;

    el("btnReviewSimWrong").onclick = () => {
      switchMode("practice");
      filteredList = wrongIds.map((id) => Q_MAP.get(id)).filter(Boolean);
      currentIndex = 0;
      el("filteredCountText").textContent = `מתחקר ${filteredList.length} טעויות מהסימולציה`;
      renderQuestion();
    };
    el("btnNewSim").onclick = () => {
      resEl.classList.add("hidden");
      el("examSetup").classList.remove("hidden");
    };
  }

  // Analytics Dashboard
  function renderAnalytics() {
    const solvedIds = Object.keys(progress.attempts);
    const totalSolved = solvedIds.length;
    const totalCorrect = solvedIds.filter((id) => progress.attempts[id].isCorrect).length;
    const acc = totalSolved > 0 ? Math.round((totalCorrect / totalSolved) * 100) : 0;
    const today = progress.dailyStats[todayKey()] || { answered: 0, correct: 0 };
    const starredCount = Object.values(progress.flags).filter((f) => f.star).length;

    el("analyticsKpis").innerHTML = `
      <div class="kpi-card"><div class="kpi-label">התקדמות כוללת</div><div class="kpi-value">${totalSolved} / ${QUESTIONS.length}</div></div>
      <div class="kpi-card"><div class="kpi-label">דיוק מצטבר</div><div class="kpi-value">${acc}%</div></div>
      <div class="kpi-card"><div class="kpi-label">נפתרו היום</div><div class="kpi-value">${today.answered}</div></div>
      <div class="kpi-card"><div class="kpi-label">מועדפים לחזרה ⭐</div><div class="kpi-value">${starredCount}</div></div>
    `;

    // By subject
    const subjs = getUniqueSubjects();
    const subjHtml = subjs.map((s) => {
      const qs = QUESTIONS.filter((q) => getSubject(q) === s);
      const solved = qs.filter((q) => progress.attempts[q.id]);
      const ok = solved.filter((q) => progress.attempts[q.id].isCorrect);
      const compPct = Math.round((solved.length / qs.length) * 100);
      const accPct = solved.length > 0 ? Math.round((ok.length / solved.length) * 100) : 0;
      return `
        <div class="prog-item">
          <div class="prog-item-head">
            <strong>${escapeHtml(s)} (${qs.length})</strong>
            <span>השלמה: ${compPct}% · דיוק: ${solved.length ? accPct + "%" : "—"}</span>
          </div>
          <div class="prog-bar-bg"><div class="prog-bar-fill" style="width:${compPct}%"></div></div>
        </div>`;
    }).join("");
    el("subjectProgressList").innerHTML = subjHtml;

    // Summary recommendations
    const weakSubjs = subjs
      .map((s) => {
        const qs = QUESTIONS.filter((q) => getSubject(q) === s);
        const solved = qs.filter((q) => progress.attempts[q.id]);
        const ok = solved.filter((q) => progress.attempts[q.id].isCorrect);
        return { s, solved: solved.length, acc: solved.length ? ok.length / solved.length : null };
      })
      .filter((x) => x.acc !== null)
      .sort((a, b) => a.acc - b.acc);

    el("analyticsSummaryBox").innerHTML = `
      <p class="muted" style="margin-top:8px;">
        ${weakSubjs.length > 0
          ? `המקצוע שדורש הכי הרבה חיזוק כרגע: <strong>${escapeHtml(weakSubjs[0].s)}</strong> (${Math.round(weakSubjs[0].acc * 100)}% דיוק).`
          : "פתור כמה שאלות כדי לראות המלצות מותאמות אישית!"}
      </p>
      <p style="margin-top:10px;">יש לך <strong>${getDrillQuestions().length}</strong> שאלות שממתינות בתיקון טעויות 🔥.</p>
    `;

    // Readiness Matrix (Exam x Subject)
    const table = el("readinessMatrix");
    let head = `<tr><th>שנה / מקצוע</th>${subjs.map((s) => `<th>${escapeHtml(s)}</th>`).join("")}</tr>`;
    let rows = EXAMS.map((ex) => {
      const cells = subjs.map((s) => {
        const qs = QUESTIONS.filter((q) => q.exam === ex.name && getSubject(q) === s);
        if (qs.length === 0) return `<td style="color:var(--text-muted)">—</td>`;
        const solved = qs.filter((q) => progress.attempts[q.id]);
        const ok = solved.filter((q) => progress.attempts[q.id].isCorrect);
        let bg = "transparent";
        if (solved.length > 0) {
          const ratio = ok.length / solved.length;
          bg = ratio >= 0.75 ? "var(--success-soft)" : ratio >= 0.5 ? "var(--warning-soft)" : "var(--danger-soft)";
        }
        return `<td style="background:${bg}"><button class="matrix-cell-btn" data-exam="${escapeHtml(ex.name)}" data-subj="${escapeHtml(s)}">${solved.length}/${qs.length}</button></td>`;
      }).join("");
      return `<tr><th>${escapeHtml(ex.name)}</th>${cells}</tr>`;
    }).join("");

    table.innerHTML = `<thead>${head}</thead><tbody>${rows}</tbody>`;
    table.querySelectorAll(".matrix-cell-btn").forEach((btn) => {
      btn.onclick = () => {
        filters.exams = new Set([btn.dataset.exam]);
        filters.subjects = new Set([btn.dataset.subj]);
        filters.status = "all";
        renderFilterChips();
        switchMode("practice");
      };
    });
  }

  // Export to Obsidian Mistakes Notebook
  async function exportToObsidian() {
    const wrongOrNoted = QUESTIONS.filter((q) => {
      const att = progress.attempts[q.id];
      const note = getMyNoteText(q.id).trim();
      const qComm = getQuestionCommunityNotesList(q.id);
      const fl = progress.flags[q.id] || {};
      return (att && !att.isCorrect) || note || qComm.length > 0 || fl.star || fl.problem;
    });

    if (wrongOrNoted.length === 0) {
      showToast("אין עדיין שאלות שטעית בהן, סימנת או הוספת להן הערה.");
      return;
    }

    if (serverOnline) {
      try {
        const res = await fetch("/api/export-obsidian", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ progress, communityNotes }),
        });
        const data = await res.json();
        if (res.ok) {
          showToast(`📓 יוצאו ${data.count} שאלות למחברת הטעויות ב-Obsidian!`);
          return;
        }
      } catch {}
    }

    // Offline fallback: download Markdown
    const lines = ["# מחברת טעויות והערות – מקבץ 1\n"];
    wrongOrNoted.forEach((q) => {
      const note = getMyNoteText(q.id).trim();
      const qComm = getQuestionCommunityNotesList(q.id);
      const corrText = q.correct.map((i) => `${q.options[i].letter}. ${q.options[i].text}`).join(" / ");
      lines.push(`## ${q.exam} · שאלה ${q.num} (${q.subject})`);
      lines.push(q.stem);
      lines.push(`**תשובה נכונה:** ${corrText}`);
      if (note) lines.push(`> 📝 **הפנינה שלי (${userIdentity.emoji} ${userIdentity.name}):** ${note}`);
      qComm.filter((n) => !n.isMine).forEach((n) => {
        lines.push(`> 💬 **${n.emoji} ${n.author}:** ${n.text}`);
      });
      lines.push("");
    });

    const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "מחברת טעויות - מקבץ 1.md";
    a.click();
    showToast(`📥 הורד קובץ Markdown עם ${wrongOrNoted.length} שאלות!`);
  }

  // Mode switching
  function switchMode(mode) {
    currentMode = mode;
    notesExpanded = false;
    lastRenderedQId = null;
    document.querySelectorAll("#modeTabs .tab-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.mode === mode);
    });

    const isStudy = mode === "practice" || mode === "drill" || mode === "flashcard";
    el("filterPanel").classList.toggle("hidden", !(mode === "practice" || mode === "flashcard"));
    el("studyView").classList.toggle("hidden", !isStudy);
    el("examView").classList.toggle("hidden", mode !== "exam");
    el("analyticsView").classList.toggle("hidden", mode !== "analytics");

    if (isStudy) applyFilters();
    else if (mode === "analytics") renderAnalytics();
  }

  function renderCurrentView() {
    if (currentMode === "analytics") renderAnalytics();
    else if (currentMode !== "exam") applyFilters(filteredList[currentIndex]?.id);
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // Event bindings
  function bindEvents() {
    document.querySelectorAll("#modeTabs .tab-btn").forEach((btn) => {
      btn.onclick = () => switchMode(btn.dataset.mode);
    });

    el("btnTheme").onclick = toggleTheme;
    el("btnExportObsidian").onclick = exportToObsidian;

    // Search
    el("searchInput").addEventListener("input", (e) => {
      filters.search = e.target.value;
      el("clearSearchBtn").classList.toggle("hidden", !filters.search);
      applyFilters();
    });
    el("clearSearchBtn").onclick = () => {
      filters.search = "";
      el("searchInput").value = "";
      el("clearSearchBtn").classList.add("hidden");
      applyFilters();
    };

    // Merge pathology toggle
    el("mergePathologyToggle").onchange = (e) => {
      filters.mergePathology = e.target.checked;
      filters.subjects.clear();
      renderFilterChips();
      initExamSetup();
      applyFilters();
    };

    el("btnToggleFilters").onclick = () => {
      const body = el("filterBody");
      const hidden = body.classList.toggle("hidden");
      el("btnToggleFilters").textContent = hidden ? "🔼 הרחב סינון" : "🔽 צמצם סינון";
    };

    // Year quick buttons
    el("btnRecentYears").onclick = () => {
      filters.exams = new Set(["2026", "2025", "2024", "2022", "2021"]);
      renderFilterChips();
      applyFilters();
    };
    el("btnAllYears").onclick = () => { filters.exams.clear(); renderFilterChips(); applyFilters(); };
    el("btnClearYears").onclick = () => { filters.exams.clear(); renderFilterChips(); applyFilters(); };
    el("btnAllSubjects").onclick = () => { filters.subjects.clear(); renderFilterChips(); applyFilters(); };
    el("btnClearSubjects").onclick = () => { filters.subjects.clear(); renderFilterChips(); applyFilters(); };

    // Status chips
    el("statusChips").querySelectorAll(".chip").forEach((c) => {
      c.onclick = () => {
        el("statusChips").querySelectorAll(".chip").forEach((x) => x.classList.remove("active"));
        c.classList.add("active");
        filters.status = c.dataset.status;
        applyFilters();
      };
    });

    el("btnResetFiltersEmpty").onclick = () => {
      filters.exams.clear();
      filters.subjects.clear();
      filters.status = "all";
      filters.search = "";
      el("searchInput").value = "";
      el("statusChips").querySelectorAll(".chip").forEach((x) => x.classList.toggle("active", x.dataset.status === "all"));
      renderFilterChips();
      applyFilters();
    };

    el("btnShuffleQuestions").onclick = shuffleFilteredQuestions;
    el("btnShuffleOptions").onclick = toggleShuffleOptions;

    el("btnJump").onclick = () => {
      const v = parseInt(el("jumpInput").value, 10);
      if (v >= 1 && v <= filteredList.length) {
        currentIndex = v - 1;
        renderQuestion();
      }
    };

    // Question controls
    el("btnPrevQ").onclick = prevQuestion;
    el("btnNextQ").onclick = nextQuestion;
    el("btnFlagStar").onclick = () => toggleFlag("star");
    el("btnFlagUnsure").onclick = () => toggleFlag("unsure");
    el("btnFlagProblem").onclick = () => toggleFlag("problem");

    el("btnClearAttempt").onclick = () => {
      if (filteredList.length === 0) return;
      const q = filteredList[currentIndex];
      delete progress.attempts[q.id];
      saveProgress();
      renderQuestion();
    };

    el("btnToggleNotes").onclick = () => toggleNotesDrawer();
    el("btnRefreshNotes").onclick = () => pullCloudNotes(true);
    el("userIdentityPill").onclick = () => {
      showToast(`🔒 הכינוי הקבוע שלך במכשיר זה: ${userIdentity.emoji} ${userIdentity.name}`);
    };

    el("qNoteInput").addEventListener("input", (e) => {
      if (filteredList.length === 0) return;
      identityNeedsCloudCheck = false;
      const q = filteredList[currentIndex];
      const text = e.target.value;
      progress.notes[q.id] = text;
      saveProgress();

      if (!communityNotes[q.id] || typeof communityNotes[q.id] !== "object") {
        communityNotes[q.id] = {};
      }
      if (text.trim()) {
        communityNotes[q.id][userIdentity.userId] = {
          author: userIdentity.name,
          emoji: userIdentity.emoji,
          category: userIdentity.category,
          text,
          updatedAt: Date.now(),
        };
      } else {
        delete communityNotes[q.id][userIdentity.userId];
        if (Object.keys(communityNotes[q.id]).length === 0) {
          delete communityNotes[q.id];
        }
      }

      pendingDirtyQIds.add(q.id);
      saveCommunityNotesCache();
      noteSyncState = "saving";
      renderNotesSection(q, true);

      clearTimeout(noteInputDebounce);
      noteInputDebounce = setTimeout(() => {
        enqueueCloudSync();
      }, 700);
    });

    // Flashcard
    el("btnRevealCard").onclick = revealFlashcard;
    el("btnCardKnew").onclick = () => rateFlashcard(true);
    el("btnCardForgot").onclick = () => rateFlashcard(false);

    // Exam Simulation
    el("btnStartSim").onclick = startSimulation;
    el("btnToggleSimGrid").onclick = () => el("simGridPanel").classList.toggle("hidden");
    el("btnSubmitSim").onclick = () => {
      if (confirm("להגיש את המבחן ולראות תוצאות?")) submitSimulation();
    };

    // Modals
    el("btnBackupMenu").onclick = () => el("backupModal").classList.remove("hidden");
    el("btnCloseBackup").onclick = () => el("backupModal").classList.add("hidden");
    el("btnShortcuts").onclick = () => el("shortcutsModal").classList.remove("hidden");
    el("btnCloseShortcuts").onclick = () => el("shortcutsModal").classList.add("hidden");

    el("btnDownloadBackup").onclick = () => {
      const blob = new Blob([JSON.stringify(progress, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `med_exam_progress_${todayKey()}.json`;
      a.click();
    };

    el("importBackupInput").onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(reader.result);
          progress = { ...defaultProgress(), ...parsed };
          saveProgress();
          renderCurrentView();
          el("backupModal").classList.add("hidden");
          showToast("✅ הגיבוי שוחזר בהצלחה!");
        } catch {
          showToast("❌ קובץ גיבוי לא תקין");
        }
      };
      reader.readAsText(file);
    };

    el("btnResetProgress").onclick = () => {
      if (confirm("בטוח שברצונך למחוק את כל ההתקדמות, הסימונים וההערות?")) {
        progress = defaultProgress();
        saveProgress();
        renderCurrentView();
        el("backupModal").classList.add("hidden");
        showToast("ההתקדמות אופסה.");
      }
    };

    // Keyboard shortcuts
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        el("lightboxModal").classList.add("hidden");
        el("backupModal").classList.add("hidden");
        el("shortcutsModal").classList.add("hidden");
        return;
      }
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (currentMode === "analytics" || currentMode === "exam") return;
      if (filteredList.length === 0) return;

      const q = filteredList[currentIndex];
      const order = getOptionOrder(q);

      if (e.key >= "1" && e.key <= "5") {
        const idx = parseInt(e.key, 10) - 1;
        if (idx < order.length) {
          if (e.shiftKey) toggleStrike(q.id, order[idx]);
          else if (currentMode !== "flashcard") handleAnswer(q, order[idx]);
        }
      } else if (HEBREW_LETTERS.includes(e.key)) {
        const idx = HEBREW_LETTERS.indexOf(e.key);
        if (idx < order.length && currentMode !== "flashcard") {
          handleAnswer(q, order[idx]);
        }
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        nextQuestion();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        prevQuestion();
      } else if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (currentMode === "flashcard" && !flashcardRevealed) revealFlashcard();
        else nextQuestion();
      } else if (e.key.toLowerCase() === "s" || e.key.toLowerCase() === "f") {
        toggleFlag("star");
      } else if (e.key.toLowerCase() === "n") {
        e.preventDefault();
        toggleNotesDrawer();
      } else if (e.key.toLowerCase() === "r") {
        shuffleFilteredQuestions();
      }
    });
  }

  // Init
  initTheme();
  initLightbox();
  updateIdentityUI();
  renderFilterChips();
  initExamSetup();
  updateDrillBadge();
  bindEvents();
  applyFilters();
  checkServer();
  pullCloudNotes(false);
  setInterval(() => pullCloudNotes(false), 45000);
})();
