(() => {
  "use strict";

  const STORAGE_KEY = "med_exam_cluster1_progress_v1";
  const THEME_KEY = "med_exam_theme_v1";
  const IDENTITY_KEY = "med_exam_user_identity_v1";
  const DEVICE_ID_KEY = "med_exam_device_id_v1";
  const SYNC_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const SYNC_CODE_REGEX = /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{12}$/;
  const COMMUNITY_NOTES_CACHE_KEY = "med_exam_community_notes_cache_v1";
  const COMMUNITY_PROBLEMS_CACHE_KEY = "med_exam_community_problems_cache_v1";
  const QUESTION_OVERRIDES_CACHE_KEY = "med_exam_question_overrides_cache_v1";
  const TAKEN_NAMES_CACHE_KEY = "med_exam_taken_names_cache_v1";
  const ADMIN_TOKEN_LOCAL_KEY = "med_exam_admin_token_v1";
  const ADMIN_TOKEN_SESSION_KEY = "med_exam_admin_token_session_v1";
  const CLOUD_API_OVERRIDE_KEY = "med_exam_cloud_api_override_v1";
  const DEFAULT_CLOUD_API_BASE = "https://mikbatz1-api.mikbatz1-tal.workers.dev";
  const CLOUD_API_BASE = resolveCloudApiBase();
  const HEBREW_LETTERS = ["א", "ב", "ג", "ד", "ה", "ו"];

  function resolveCloudApiBase() {
    try {
      const params = new URLSearchParams(window.location.search);
      const apiParam = params.get("api");
      if (apiParam) {
        const clean = apiParam.replace(/\/+$/, "");
        sessionStorage.setItem(CLOUD_API_OVERRIDE_KEY, clean);
        params.delete("api");
        const qs = params.toString();
        const nextUrl = window.location.pathname + (qs ? `?${qs}` : "") + window.location.hash;
        history.replaceState(null, "", nextUrl);
        return clean;
      }
      const savedOverride = sessionStorage.getItem(CLOUD_API_OVERRIDE_KEY);
      if (savedOverride) return savedOverride.replace(/\/+$/, "");
    } catch {}
    if (typeof window.CLOUD_API_BASE === "string" && window.CLOUD_API_BASE.trim()) {
      return window.CLOUD_API_BASE.trim().replace(/\/+$/, "");
    }
    return DEFAULT_CLOUD_API_BASE.replace(/\/+$/, "");
  }

  function isCloudApiConfigured() {
    return Boolean(CLOUD_API_BASE && !CLOUD_API_BASE.includes("REPLACE_WITH_SUBDOMAIN"));
  }

  const PROBLEM_TYPES = {
    question_issue: {
      id: "question_issue",
      label: "בעיה בשאלה",
      emoji: "❓",
      detailLabel: "מה בדיוק הבעיה בשאלה?",
      placeholder: "פרט מה לא תקין בניסוח השאלה, בנתונים או בתמונה...",
      requireDetail: true,
    },
    distractor_issue: {
      id: "distractor_issue",
      label: "בעיה במסיחים",
      emoji: "🔀",
      detailLabel: "איזה מסיח ולמה?",
      placeholder: "ציין איזה מסיח בעייתי (למשל מסיח ב׳ / ג׳) ומדוע...",
      requireDetail: true,
    },
    out_of_material: {
      id: "out_of_material",
      label: "שאלה שלא בחומר",
      emoji: "📚",
      detailLabel: "פירוט נוסף (רשות):",
      placeholder: "למשל: ירד מהמיקוד / לא נלמד השנה (לא חובה למלא)...",
      requireDetail: false,
    },
  };

  // 200 unique identities across 8 categories (4 x 30 + 4 x 20)
  const IDENTITY_CATALOG = [
    // פירות (1-30)
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
    { name: "אשכולית", emoji: "🍊", category: "פירות" },
    { name: "נקטרינה", emoji: "🍑", category: "פירות" },
    { name: "פומלה", emoji: "🍈", category: "פירות" },
    { name: "פטל", emoji: "🍓", category: "פירות" },
    { name: "פפאיה", emoji: "🥭", category: "פירות" },
    // ירקות (31-60)
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
    { name: "כרוב", emoji: "🥬", category: "ירקות" },
    { name: "סלק", emoji: "🍠", category: "ירקות" },
    { name: "אספרגוס", emoji: "🌿", category: "ירקות" },
    { name: "ארטישוק", emoji: "🥗", category: "ירקות" },
    { name: "שומר", emoji: "🌿", category: "ירקות" },
    // כלי מטבח (61-90)
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
    { name: "טוסטר", emoji: "🍞", category: "כלי מטבח" },
    { name: "בלנדר", emoji: "🥤", category: "כלי מטבח" },
    { name: "מלקחיים", emoji: "🥢", category: "כלי מטבח" },
    { name: "כף עץ", emoji: "🥄", category: "כלי מטבח" },
    { name: "מיקסר", emoji: "🧁", category: "כלי מטבח" },
    // תנ"ך (91-120)
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
    { name: "יצחק", emoji: "⛰️", category: "תנ\"ך" },
    { name: "אהרן", emoji: "🕯️", category: "תנ\"ך" },
    { name: "נח", emoji: "🌈", category: "תנ\"ך" },
    { name: "שאול", emoji: "👑", category: "תנ\"ך" },
    { name: "ישעיהו", emoji: "📜", category: "תנ\"ך" },
    // קטניות (121-140)
    { name: "חומוס", emoji: "🧆", category: "קטניות" },
    { name: "עדשים אדומות", emoji: "🫘", category: "קטניות" },
    { name: "עדשים ירוקות", emoji: "🫘", category: "קטניות" },
    { name: "עדשים שחורות", emoji: "🫘", category: "קטניות" },
    { name: "עדשים חומות", emoji: "🫘", category: "קטניות" },
    { name: "שעועית לבנה", emoji: "🫘", category: "קטניות" },
    { name: "שעועית אדומה", emoji: "🫘", category: "קטניות" },
    { name: "שעועית שחורה", emoji: "🫘", category: "קטניות" },
    { name: "שעועית ירוקה", emoji: "🫛", category: "קטניות" },
    { name: "שעועית צהובה", emoji: "🫛", category: "קטניות" },
    { name: "שעועית מנומרת", emoji: "🫘", category: "קטניות" },
    { name: "שעועית לימה", emoji: "🫘", category: "קטניות" },
    { name: "פול", emoji: "🫘", category: "קטניות" },
    { name: "פולי סויה", emoji: "🫛", category: "קטניות" },
    { name: "אדממה", emoji: "🫛", category: "קטניות" },
    { name: "תורמוס", emoji: "🫘", category: "קטניות" },
    { name: "מש", emoji: "🫛", category: "קטניות" },
    { name: "לוביה", emoji: "🫘", category: "קטניות" },
    { name: "אזוקי", emoji: "🫘", category: "קטניות" },
    { name: "בוטן", emoji: "🥜", category: "קטניות" },
    // דגנים (141-160)
    { name: "חיטה", emoji: "🌾", category: "דגנים" },
    { name: "שעורה", emoji: "🌾", category: "דגנים" },
    { name: "שיבולת שועל", emoji: "🥣", category: "דגנים" },
    { name: "שיפון", emoji: "🍞", category: "דגנים" },
    { name: "כוסמין", emoji: "🌾", category: "דגנים" },
    { name: "אורז", emoji: "🍚", category: "דגנים" },
    { name: "אורז מלא", emoji: "🍚", category: "דגנים" },
    { name: "אורז בר", emoji: "🌾", category: "דגנים" },
    { name: "קינואה", emoji: "🥣", category: "דגנים" },
    { name: "כוסמת", emoji: "🌾", category: "דגנים" },
    { name: "דוחן", emoji: "🌾", category: "דגנים" },
    { name: "סורגום", emoji: "🌾", category: "דגנים" },
    { name: "אמרנט", emoji: "🌾", category: "דגנים" },
    { name: "טף", emoji: "🌾", category: "דגנים" },
    { name: "קמוט", emoji: "🌾", category: "דגנים" },
    { name: "בורגול", emoji: "🥣", category: "דגנים" },
    { name: "פריקה", emoji: "🌾", category: "דגנים" },
    { name: "גריסים", emoji: "🥣", category: "דגנים" },
    { name: "סולת", emoji: "🥣", category: "דגנים" },
    { name: "קוסקוס", emoji: "🍲", category: "דגנים" },
    // כלי אחסון (161-180)
    { name: "קופסה", emoji: "📦", category: "כלי אחסון" },
    { name: "קופסת אוכל", emoji: "🍱", category: "כלי אחסון" },
    { name: "קופסת פח", emoji: "🥫", category: "כלי אחסון" },
    { name: "טאפרוור", emoji: "🥡", category: "כלי אחסון" },
    { name: "ארגז", emoji: "📦", category: "כלי אחסון" },
    { name: "ארגונית", emoji: "🗂️", category: "כלי אחסון" },
    { name: "סלסילה", emoji: "🧺", category: "כלי אחסון" },
    { name: "מגירה", emoji: "🗄️", category: "כלי אחסון" },
    { name: "ארון", emoji: "🗄️", category: "כלי אחסון" },
    { name: "תיבה", emoji: "🧰", category: "כלי אחסון" },
    { name: "צידנית", emoji: "🧊", category: "כלי אחסון" },
    { name: "תרמוס", emoji: "🫖", category: "כלי אחסון" },
    { name: "בקבוק", emoji: "🍾", category: "כלי אחסון" },
    { name: "מימייה", emoji: "🍶", category: "כלי אחסון" },
    { name: "כד", emoji: "🏺", category: "כלי אחסון" },
    { name: "דלי", emoji: "🪣", category: "כלי אחסון" },
    { name: "חבית", emoji: "🛢️", category: "כלי אחסון" },
    { name: "שק", emoji: "🛍️", category: "כלי אחסון" },
    { name: "שקית ואקום", emoji: "🛍️", category: "כלי אחסון" },
    { name: "מזוודה", emoji: "🧳", category: "כלי אחסון" },
    // בדים (181-200)
    { name: "כותנה", emoji: "☁️", category: "בדים" },
    { name: "פשתן", emoji: "🧵", category: "בדים" },
    { name: "משי", emoji: "🎀", category: "בדים" },
    { name: "צמר", emoji: "🐑", category: "בדים" },
    { name: "קשמיר", emoji: "🧶", category: "בדים" },
    { name: "קטיפה", emoji: "🧣", category: "בדים" },
    { name: "סאטן", emoji: "✨", category: "בדים" },
    { name: "תחרה", emoji: "🕸️", category: "בדים" },
    { name: "ג'ינס", emoji: "👖", category: "בדים" },
    { name: "קורדרוי", emoji: "👖", category: "בדים" },
    { name: "פליז", emoji: "🧥", category: "בדים" },
    { name: "פלנל", emoji: "🧣", category: "בדים" },
    { name: "טוויד", emoji: "🧥", category: "בדים" },
    { name: "טריקו", emoji: "👕", category: "בדים" },
    { name: "ליקרה", emoji: "🩳", category: "בדים" },
    { name: "זמש", emoji: "🥾", category: "בדים" },
    { name: "לבד", emoji: "🧶", category: "בדים" },
    { name: "טול", emoji: "🩰", category: "בדים" },
    { name: "אורגנזה", emoji: "🎀", category: "בדים" },
    { name: "קנבס", emoji: "🖼️", category: "בדים" },
  ];

  const DATA = window.EXAM_DATA;
  if (!DATA || !Array.isArray(DATA.questions)) {
    document.body.innerHTML = "<h2 style='padding:40px;text-align:center'>שגיאה בטעינת questions_data.js</h2>";
    return;
  }

  const RAW_QUESTIONS = DATA.questions;
  const RAW_Q_MAP = new Map(RAW_QUESTIONS.map((q) => [q.id, q]));
  const EXAMS = (DATA.exams || []).map((ex) => ({ ...ex }));
  let QUESTIONS = [];
  let Q_MAP = new Map();

  // State
  let serverOnline = false;
  let currentMode = "practice"; // practice | exam | drill | flashcard | analytics
  let communityNotes = loadCommunityNotesCache(); // { qId: { userId: { author, emoji, category, text, updatedAt } } }
  let communityProblems = loadCommunityProblemsCache(); // { qId: { userId: { type, text, author, emoji, category, updatedAt } } }
  let questionOverrides = loadQuestionOverridesCache(); // { qId: { hidden, stem, options, correct, allAccepted, appealNote, subject, updatedAt } }
  let takenNamesMap = loadTakenNamesCache(); // { name: userId }
  let identityNeedsCloudCheck = false;
  let deviceId = loadOrInitDeviceId();
  let userIdentity = loadOrInitIdentity();
  let progress = loadProgress();
  let cloudProgressSyncState = isCloudApiConfigured() ? "idle" : "offline";
  let cloudProgressDirty = false;
  let cloudProgressPushTimer = null;
  let cloudProgressSyncPromise = null;
  let lastVisibilityPullAt = Date.now();
  let pendingSyncPreview = null;
  let filteredList = [];
  let currentIndex = 0;
  let optionPermutations = new Map(); // qId -> array of original indices
  let shuffleOptionsEnabled = false;
  let flashcardRevealed = false;
  let sessionAnswered = 0;
  let sessionCorrect = 0;
  let notesExpanded = false; // Always closed by default (strict manual spoiler toggle)
  let lastRenderedQId = null;
  let noteSyncState = "synced";
  let problemSyncState = "synced";
  let activeProblemModalQId = null;
  const noteDrafts = {}; // qId -> unsent draft text
  const editingNoteQIds = new Set();
  const pendingDirtyQIds = new Set();
  const pendingProblemDirtyQIds = new Set();
  let cloudWriteQueue = Promise.resolve();
  let problemWriteQueue = Promise.resolve();
  let adminState = {
    authenticated: false,
    token: null,
    rememberDevice: false,
    expiresAt: 0,
  };
  let adminUsersCache = [];
  let adminActiveTab = "users";
  let adminOverridesFilter = "all";
  let adminModerationFilter = "all";
  let activeAdminEditQId = null;
  let adminDraftOptions = [];

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
      clearedAttempts: {}, // qId -> ts
      flags: {},    // qId -> { star?: bool, unsure?: bool, problem?: bool }
      flagUpdatedAt: {}, // qId -> { star?: ts, unsure?: ts, problem?: ts }
      notes: {},    // qId -> string
      noteUpdatedAt: {}, // qId -> ts
      struck: {},   // qId -> number[]
      struckUpdatedAt: {}, // qId -> ts
      drillStreak: {}, // qId -> number (0..2)
      drillStreakUpdatedAt: {}, // qId -> ts
      dailyStats: {},  // YYYY-MM-DD -> { answered: number, correct: number }
      dailyStatsByDevice: {}, // deviceId -> { YYYY-MM-DD -> { answered, correct } }
      dailyStatsUpdatedAt: 0,
      resetAt: 0,
    };
  }

  function loadOrInitDeviceId() {
    try {
      const existing = localStorage.getItem(DEVICE_ID_KEY);
      if (existing && typeof existing === "string" && existing.length >= 6) return existing;
      const created = "d_" + generateRandomHex(8);
      localStorage.setItem(DEVICE_ID_KEY, created);
      return created;
    } catch {
      return "d_" + Math.random().toString(36).slice(2, 10);
    }
  }

  function generateRandomHex(byteLen = 16) {
    try {
      if (window.crypto && window.crypto.getRandomValues) {
        const bytes = new Uint8Array(byteLen);
        window.crypto.getRandomValues(bytes);
        return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
      }
    } catch {}
    let out = "";
    while (out.length < byteLen * 2) {
      out += Math.random().toString(16).slice(2);
    }
    return out.slice(0, byteLen * 2);
  }

  function normalizeSyncCode(raw) {
    if (typeof raw !== "string") return null;
    let str = raw.trim();
    const hashMatch = str.match(/#sync=([^&\s]+)/i);
    if (hashMatch) str = hashMatch[1];
    const clean = str.toUpperCase().replace(/[^A-Z0-9]/g, "");
    return SYNC_CODE_REGEX.test(clean) ? clean : null;
  }

  function formatSyncCode(raw) {
    const clean = normalizeSyncCode(raw);
    if (!clean) return "";
    return `${clean.slice(0, 4)}-${clean.slice(4, 8)}-${clean.slice(8, 12)}`;
  }

  function generateSyncCode() {
    let chars = "";
    try {
      if (window.crypto && window.crypto.getRandomValues) {
        const bytes = new Uint8Array(12);
        window.crypto.getRandomValues(bytes);
        for (let i = 0; i < 12; i++) {
          chars += SYNC_ALPHABET[bytes[i] % SYNC_ALPHABET.length];
        }
        return formatSyncCode(chars);
      }
    } catch {}
    for (let i = 0; i < 12; i++) {
      chars += SYNC_ALPHABET[Math.floor(Math.random() * SYNC_ALPHABET.length)];
    }
    return formatSyncCode(chars);
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

  function loadProgress() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultProgress();
      const parsed = JSON.parse(raw);
      const loaded = mergeProgressPayloads({}, parsed);
      if (
        Object.keys(loaded.dailyStatsByDevice).length === 0 &&
        Object.keys(loaded.dailyStats).length > 0
      ) {
        loaded.dailyStatsByDevice[deviceId] = { ...loaded.dailyStats };
        loaded.dailyStatsUpdatedAt = loaded.dailyStatsUpdatedAt || Date.now();
      } else if (loaded.dailyStatsByDevice._legacy) {
        // Attribute migrated pre-sync daily stats on this device to this deviceId
        loaded.dailyStatsByDevice[deviceId] = { ...loaded.dailyStatsByDevice._legacy };
        delete loaded.dailyStatsByDevice._legacy;
      }
      return { ...defaultProgress(), ...loaded };
    } catch {
      return defaultProgress();
    }
  }

  let saveTimeout = null;
  function saveProgress({ syncCloud = true, immediateCloud = false } = {}) {
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
    if (syncCloud && isCloudApiConfigured()) {
      scheduleCloudProgressPush({ immediate: immediateCloud });
    }
  }

  function todayKey() {
    return new Date().toISOString().slice(0, 10);
  }

  function recordDaily(isCorrect) {
    const k = todayKey();
    if (!progress.dailyStatsByDevice || typeof progress.dailyStatsByDevice !== "object") {
      progress.dailyStatsByDevice = {};
    }
    if (!progress.dailyStatsByDevice[deviceId]) {
      progress.dailyStatsByDevice[deviceId] = {};
    }
    if (!progress.dailyStatsByDevice[deviceId][k]) {
      progress.dailyStatsByDevice[deviceId][k] = { answered: 0, correct: 0 };
    }
    progress.dailyStatsByDevice[deviceId][k].answered += 1;
    if (isCorrect) progress.dailyStatsByDevice[deviceId][k].correct += 1;

    let totalAnswered = 0;
    let totalCorrect = 0;
    for (const byDate of Object.values(progress.dailyStatsByDevice)) {
      const entry = byDate?.[k];
      if (entry) {
        totalAnswered += Number(entry.answered) || 0;
        totalCorrect += Number(entry.correct) || 0;
      }
    }
    if (!progress.dailyStats) progress.dailyStats = {};
    progress.dailyStats[k] = { answered: totalAnswered, correct: totalCorrect };
    progress.dailyStatsUpdatedAt = Date.now();
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

  function loadCommunityProblemsCache() {
    try {
      const raw = localStorage.getItem(COMMUNITY_PROBLEMS_CACHE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function saveCommunityProblemsCache() {
    try {
      localStorage.setItem(COMMUNITY_PROBLEMS_CACHE_KEY, JSON.stringify(communityProblems));
    } catch {}
  }

  function loadQuestionOverridesCache() {
    try {
      const raw = localStorage.getItem(QUESTION_OVERRIDES_CACHE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function saveQuestionOverridesCache() {
    try {
      localStorage.setItem(QUESTION_OVERRIDES_CACHE_KEY, JSON.stringify(questionOverrides));
    } catch {}
  }

  function loadTakenNamesCache() {
    try {
      const raw = localStorage.getItem(TAKEN_NAMES_CACHE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function saveTakenNamesCache() {
    try {
      localStorage.setItem(TAKEN_NAMES_CACHE_KEY, JSON.stringify(takenNamesMap));
    } catch {}
  }

  function normalizeBaseSubjectName(subject) {
    if (subject === "פתולוגיית ריאות") return "ריאות";
    if (subject === "פתולוגיית קרדיולוגיה") return "קרדיולוגיה";
    return subject;
  }

  function applyOverrideToQuestion(rawQ, ov) {
    if (!ov || typeof ov !== "object") return rawQ;
    const subject = typeof ov.subject === "string" && ov.subject.trim() ? ov.subject.trim() : rawQ.subject;
    const baseSubject = normalizeBaseSubjectName(subject);
    const options = Array.isArray(ov.options) && ov.options.length >= 2
      ? ov.options.map((opt, idx) => ({
          letter: HEBREW_LETTERS[idx] || String(opt?.letter || ""),
          text: String(opt?.text ?? opt ?? ""),
        }))
      : rawQ.options;
    const rawCorrect = Array.isArray(ov.correct) && ov.correct.length > 0 ? ov.correct : rawQ.correct;
    const correct = rawCorrect.filter((idx) => Number.isInteger(idx) && idx >= 0 && idx < options.length);
    return {
      ...rawQ,
      stem: typeof ov.stem === "string" ? ov.stem : rawQ.stem,
      options,
      correct: correct.length > 0 ? correct : [0],
      allAccepted: ov.allAccepted !== undefined ? Boolean(ov.allAccepted) : rawQ.allAccepted,
      appealNote: typeof ov.appealNote === "string" ? ov.appealNote : rawQ.appealNote,
      subject,
      baseSubject,
      isOverridden: true,
    };
  }

  function rebuildEffectiveQuestions({ render = true } = {}) {
    const nextQuestions = [];
    for (const rawQ of RAW_QUESTIONS) {
      const ov = questionOverrides[rawQ.id];
      if (ov && ov.hidden) continue;
      nextQuestions.push(applyOverrideToQuestion(rawQ, ov));
    }
    QUESTIONS = nextQuestions;
    Q_MAP = new Map(QUESTIONS.map((q) => [q.id, q]));

    const countsByExam = new Map();
    for (const q of QUESTIONS) {
      countsByExam.set(q.exam, (countsByExam.get(q.exam) || 0) + 1);
    }
    EXAMS.forEach((ex) => {
      ex.expectedCount = countsByExam.get(ex.name) || 0;
    });

    optionPermutations.clear();

    const statsBadge = el("totalStatsBadge");
    if (statsBadge) {
      statsBadge.textContent = `${QUESTIONS.length} שאלות · ${EXAMS.length} מבחנים`;
    }

    if (render) {
      renderFilterChips();
      if (!simState.active) initExamSetup();
      updateDrillBadge();
      renderCurrentView();
    }
  }

  rebuildEffectiveQuestions({ render: false });
  filteredList = [...QUESTIONS];

  function getTakenAuthorNames() {
    const taken = new Set();
    if (takenNamesMap && typeof takenNamesMap === "object") {
      Object.entries(takenNamesMap).forEach(([name, uid]) => {
        if (userIdentity && uid === userIdentity.userId) return;
        if (name) taken.add(name);
      });
    }
    [communityNotes, communityProblems].forEach((store) => {
      Object.values(store).forEach((byUser) => {
        if (!byUser || typeof byUser !== "object") return;
        Object.entries(byUser).forEach(([uid, entry]) => {
          if (userIdentity && uid === userIdentity.userId) return;
          if (!entry || typeof entry !== "object") return;
          const hasText = typeof entry.text === "string" && entry.text.trim();
          const hasType = typeof entry.type === "string" && Boolean(PROBLEM_TYPES[entry.type]);
          if ((hasText || hasType) && entry.author) {
            taken.add(entry.author);
          }
        });
      });
    });
    return taken;
  }

  function generateClientSecret() {
    try {
      if (window.crypto && window.crypto.getRandomValues) {
        const bytes = new Uint8Array(16);
        window.crypto.getRandomValues(bytes);
        return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
      }
    } catch {}
    return "cs_" + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2) + Date.now().toString(36);
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
          const clientSecret =
            typeof parsed.clientSecret === "string" && parsed.clientSecret.length >= 8
              ? parsed.clientSecret
              : generateClientSecret();
          const validSyncCode = formatSyncCode(parsed.syncCode);
          const syncCode = validSyncCode || generateSyncCode();
          const syncCodeRegistered = Boolean(validSyncCode && parsed.syncCodeRegistered);
          const loaded = {
            userId: String(parsed.userId),
            name: match.name,
            emoji: match.emoji,
            category: match.category,
            clientSecret,
            syncCode,
            syncCodeRegistered,
            locked: true,
          };
          if (!parsed.clientSecret || !validSyncCode) {
            try {
              localStorage.setItem(IDENTITY_KEY, JSON.stringify(loaded));
            } catch {}
          }
          return loaded;
        }
      }
    } catch {}
    const picked = pickRandomIdentity(false);
    const created = {
      userId: "u_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36),
      name: picked.name,
      emoji: picked.emoji,
      category: picked.category,
      clientSecret: generateClientSecret(),
      syncCode: generateSyncCode(),
      syncCodeRegistered: false,
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
    if (myLabel) {
      const curQId = filteredList?.[currentIndex]?.id;
      const isEditing = curQId && editingNoteQIds.has(curQId);
      myLabel.textContent = isEditing
        ? `✏️ עריכת ההערה שלי בתור ${label}:`
        : `📝 ההערה שלי בתור ${label}:`;
    }
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
    const curQId = filteredList?.[currentIndex]?.id;
    const hasDraft = Boolean(curQId && ((noteDrafts[curQId] || "").trim().length > 0 || editingNoteQIds.has(curQId)));
    if (noteSyncState === "saving") statusEl.textContent = "שומר לענן... ⏳";
    else if (hasDraft) statusEl.textContent = "טיוטה · לחץ Enter לשליחה";
    else if (noteSyncState === "offline") statusEl.textContent = "שמור מקומית (אופליין) 💾";
    else if (noteSyncState === "error") statusEl.textContent = "ממתין לסנכרון ⚠️";
    else statusEl.textContent = "מסונכרן ☁️";
  }

  function startEditMyNote(qId) {
    const existing = communityNotes[qId]?.[userIdentity.userId]?.text || "";
    noteDrafts[qId] = existing;
    editingNoteQIds.add(qId);
    notesExpanded = true;
    const q = Q_MAP.get(qId);
    if (q) renderNotesSection(q, false);
    const inputEl = el("qNoteInput");
    if (inputEl) {
      inputEl.focus();
      inputEl.setSelectionRange(inputEl.value.length, inputEl.value.length);
    }
  }

  function cancelEditMyNote(qId) {
    editingNoteQIds.delete(qId);
    delete noteDrafts[qId];
    const q = Q_MAP.get(qId);
    if (q) renderNotesSection(q, false);
  }

  async function deleteMyNote(qId) {
    editingNoteQIds.delete(qId);
    delete noteDrafts[qId];
    delete progress.notes[qId];
    if (!progress.noteUpdatedAt) progress.noteUpdatedAt = {};
    progress.noteUpdatedAt[qId] = Date.now();
    saveProgress();

    if (communityNotes[qId]) {
      delete communityNotes[qId][userIdentity.userId];
      if (Object.keys(communityNotes[qId]).length === 0) {
        delete communityNotes[qId];
      }
    }

    pendingDirtyQIds.add(qId);
    saveCommunityNotesCache();
    noteSyncState = "saving";
    const q = Q_MAP.get(qId);
    if (q && filteredList[currentIndex]?.id === qId) {
      renderNotesSection(q, false);
    }
    await enqueueCloudSync();
    if (noteSyncState === "synced") {
      showToast("🗑️ ההערה שלך נמחקה.");
    }
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
      ? "הצג הערות 🔽"
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

        const headActions = document.createElement("div");
        headActions.className = "community-note-head-actions";

        const timeSpan = document.createElement("span");
        timeSpan.className = "community-note-time";
        timeSpan.textContent = formatNoteTime(n.updatedAt);
        headActions.appendChild(timeSpan);

        if (n.isMine) {
          const editBtn = document.createElement("button");
          editBtn.type = "button";
          editBtn.className = "note-card-action-btn";
          editBtn.title = "ערוך את ההערה שלי";
          editBtn.textContent = "✏️ ערוך";
          editBtn.onclick = () => startEditMyNote(q.id);

          const delBtn = document.createElement("button");
          delBtn.type = "button";
          delBtn.className = "note-card-action-btn danger";
          delBtn.title = "מחק את ההערה שלי";
          delBtn.textContent = "🗑️ מחק";
          delBtn.onclick = () => deleteMyNote(q.id);

          headActions.append(editBtn, delBtn);
        } else if (adminState.authenticated) {
          const adminDelBtn = document.createElement("button");
          adminDelBtn.type = "button";
          adminDelBtn.className = "note-card-action-btn danger admin-del";
          adminDelBtn.title = "מחק הערה כמנהל";
          adminDelBtn.textContent = "🗑️ הסר";
          adminDelBtn.onclick = () => adminDeleteNote(q.id, n.userId);
          headActions.appendChild(adminDelBtn);
        }

        head.append(authorSpan, headActions);

        const textDiv = document.createElement("div");
        textDiv.className = "community-note-text";
        textDiv.textContent = n.text;

        card.append(head, textDiv);
        listEl.appendChild(card);
      });
    }

    const cancelBtn = el("btnCancelEditNote");
    if (cancelBtn) cancelBtn.classList.toggle("hidden", !editingNoteQIds.has(q.id));

    const inputEl = el("qNoteInput");
    if (!(preserveFocus && document.activeElement === inputEl)) {
      inputEl.value = noteDrafts[q.id] ?? "";
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

  async function registerIdentityPing(retried = false) {
    if (!isCloudApiConfigured()) return false;
    try {
      const res = await fetch(`${CLOUD_API_BASE}/api/identities/ping`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: userIdentity.userId,
          name: userIdentity.name,
          emoji: userIdentity.emoji,
          category: userIdentity.category,
          clientSecret: userIdentity.clientSecret,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if ((res.status === 409 || data.conflict) && !retried) {
        if (data.takenNames && typeof data.takenNames === "object") {
          takenNamesMap = data.takenNames;
          saveTakenNamesCache();
        }
        const fresh = pickRandomIdentity(true);
        userIdentity = {
          ...userIdentity,
          name: fresh.name,
          emoji: fresh.emoji,
          category: fresh.category,
          locked: true,
        };
        saveUserIdentity();
        return registerIdentityPing(true);
      }
      if (res.ok) {
        takenNamesMap[userIdentity.name] = userIdentity.userId;
        saveTakenNamesCache();
        return true;
      }
    } catch {}
    return false;
  }

  async function fetchBootstrapPayload() {
    if (isCloudApiConfigured()) {
      try {
        const res = await fetch(`${CLOUD_API_BASE}/api/bootstrap`, { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          return {
            source: "cloud",
            notes: data?.notes && typeof data.notes === "object" ? data.notes : {},
            problems: data?.problems && typeof data.problems === "object" ? data.problems : {},
            overrides: data?.overrides && typeof data.overrides === "object" ? data.overrides : {},
            takenNames: data?.takenNames && typeof data.takenNames === "object" ? data.takenNames : {},
          };
        }
      } catch {}
    }
    if (serverOnline) {
      const [nRes, pRes, oRes] = await Promise.all([
        fetch("/api/community-notes", { cache: "no-store" }).catch(() => null),
        fetch("/api/community-problems", { cache: "no-store" }).catch(() => null),
        fetch("/api/question-overrides", { cache: "no-store" }).catch(() => null),
      ]);
      const notes = nRes && nRes.ok ? normalizeCloudPayload(await nRes.json()).notes : communityNotes;
      const problems = pRes && pRes.ok ? normalizeCloudProblemsPayload(await pRes.json()).problems : communityProblems;
      const overridesRaw = oRes && oRes.ok ? await oRes.json() : null;
      const overrides = overridesRaw?.overrides && typeof overridesRaw.overrides === "object"
        ? overridesRaw.overrides
        : questionOverrides;
      return { source: "local", notes, problems, overrides, takenNames: takenNamesMap };
    }
    throw new Error("Cloud API unreachable");
  }

  async function bootstrapCloudState(showFeedback = false) {
    try {
      const data = await fetchBootstrapPayload();
      const prevOverridesJson = JSON.stringify(questionOverrides);

      mergeCloudIntoLocal({ version: 1, notes: data.notes });
      mergeCloudProblemsIntoLocal({ version: 1, problems: data.problems });

      if (data.takenNames && typeof data.takenNames === "object") {
        takenNamesMap = data.takenNames;
        saveTakenNamesCache();
      }

      if (data.overrides && typeof data.overrides === "object") {
        questionOverrides = data.overrides;
        saveQuestionOverridesCache();
      }

      if (identityNeedsCloudCheck) {
        identityNeedsCloudCheck = false;
        const hasMyContent =
          pendingDirtyQIds.size > 0 ||
          pendingProblemDirtyQIds.size > 0 ||
          Object.values(communityNotes).some((byUser) => byUser && byUser[userIdentity.userId]) ||
          Object.values(communityProblems).some((byUser) => byUser && byUser[userIdentity.userId]);
        if (!hasMyContent && getTakenAuthorNames().has(userIdentity.name)) {
          const fresh = pickRandomIdentity(true);
          userIdentity = {
            ...userIdentity,
            name: fresh.name,
            emoji: fresh.emoji,
            category: fresh.category,
            locked: true,
          };
          saveUserIdentity();
        }
      }

      if (pendingDirtyQIds.size === 0) noteSyncState = "synced";
      if (pendingProblemDirtyQIds.size === 0) problemSyncState = "synced";

      if (serverOnline && data.source === "cloud") {
        fetch("/api/community-notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ version: 1, notes: communityNotes }),
        }).catch(() => {});
        fetch("/api/community-problems", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ version: 1, problems: communityProblems }),
        }).catch(() => {});
        fetch("/api/question-overrides", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ version: 1, overrides: questionOverrides }),
        }).catch(() => {});
      }

      const nextOverridesJson = JSON.stringify(questionOverrides);
      if (prevOverridesJson !== nextOverridesJson) {
        rebuildEffectiveQuestions({ render: true });
      } else {
        if (filteredList.length > 0 && currentMode !== "exam" && currentMode !== "analytics") {
          renderNotesSection(filteredList[currentIndex], true);
        }
        refreshActiveQuestionProblemViews();
        updateProblemSyncBadge();
      }

      if (showFeedback) showToast("🔄 הנתונים המשותפים רועננו מהענן!");
      return true;
    } catch {
      if (pendingDirtyQIds.size > 0) noteSyncState = "offline";
      if (pendingProblemDirtyQIds.size > 0) problemSyncState = "offline";
      updateNoteSyncBadge();
      updateProblemSyncBadge();
      if (showFeedback) showToast("⚠️ לא ניתן להתחבר לענן כרגע — מציג מטמון מקומי.");
      return false;
    }
  }

  async function pullCloudNotes(showFeedback = false) {
    return bootstrapCloudState(showFeedback);
  }

  // Community Problem Reports ("בעיות בשאלה")
  function isValidProblemEntry(entry) {
    if (!entry || typeof entry !== "object") return false;
    const typeInfo = PROBLEM_TYPES[entry.type];
    if (!typeInfo) return false;
    const text = typeof entry.text === "string" ? entry.text.trim() : "";
    if (typeInfo.requireDetail && !text) return false;
    return true;
  }

  function getQuestionProblemsList(qId) {
    const byUser = communityProblems[qId];
    const list = [];
    if (byUser && typeof byUser === "object") {
      Object.entries(byUser).forEach(([uid, entry]) => {
        if (!isValidProblemEntry(entry)) return;
        list.push({
          userId: uid,
          type: entry.type,
          text: (entry.text || "").trim(),
          author: entry.author || "אנונימי",
          emoji: entry.emoji || "⚠️",
          category: entry.category || "",
          updatedAt: Number(entry.updatedAt) || 0,
          isMine: uid === userIdentity.userId,
        });
      });
    }
    list.sort((a, b) => {
      if (a.isMine !== b.isMine) return a.isMine ? -1 : 1;
      return b.updatedAt - a.updatedAt;
    });
    return list;
  }

  function updateProblemSyncBadge() {
    const statusEl = el("problemSyncStatus");
    if (!statusEl) return;
    if (problemSyncState === "saving") statusEl.textContent = "שומר לענן... ⏳";
    else if (problemSyncState === "offline") statusEl.textContent = "שמור מקומית (אופליין) 💾";
    else if (problemSyncState === "error") statusEl.textContent = "ממתין לסנכרון ⚠️";
    else statusEl.textContent = "מסונכרן ☁️";
  }

  function updateProblemFlagButton(btnEl, countEl, q) {
    if (!btnEl || !q) return;
    const problems = getQuestionProblemsList(q.id);
    const fl = progress.flags[q.id] || {};
    const hasMine = problems.some((p) => p.isMine);
    btnEl.classList.toggle("active", hasMine || !!fl.problem);
    btnEl.classList.toggle("has-problems", problems.length > 0);
    if (countEl) {
      if (problems.length > 0) {
        countEl.textContent = String(problems.length);
        countEl.classList.remove("hidden");
      } else {
        countEl.textContent = "";
        countEl.classList.add("hidden");
      }
    }
  }

  function renderProblemBanner(bannerEl, q) {
    if (!bannerEl || !q) return;
    const problems = getQuestionProblemsList(q.id);
    if (problems.length === 0) {
      bannerEl.classList.add("hidden");
      bannerEl.innerHTML = "";
      return;
    }

    bannerEl.classList.remove("hidden");
    bannerEl.innerHTML = "";

    const head = document.createElement("div");
    head.className = "problem-banner-head";

    const title = document.createElement("div");
    title.className = "problem-banner-title";
    title.textContent = problems.length === 1
      ? "⚠️ שים לב – דווחה בעיה בשאלה זו"
      : `⚠️ שים לב – דווחו ${problems.length} בעיות בשאלה זו`;

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "problem-banner-add-btn";
    const mine = problems.find((p) => p.isMine);
    addBtn.textContent = mine ? "✏️ ערוך דיווח שלי" : "+ הוסף דיווח";
    addBtn.onclick = () => openProblemModal(q.id);

    head.append(title, addBtn);

    const listWrap = document.createElement("div");
    listWrap.className = "problem-banner-list";

    problems.forEach((p) => {
      const info = PROBLEM_TYPES[p.type] || PROBLEM_TYPES.question_issue;
      const item = document.createElement("div");
      item.className = "problem-banner-item" + (p.isMine ? " is-mine" : "");

      const top = document.createElement("div");
      top.className = "problem-item-top";

      const pill = document.createElement("span");
      pill.className = `problem-type-pill ${info.id}`;
      pill.textContent = `${info.emoji} ${info.label}`;

      const meta = document.createElement("div");
      meta.className = "problem-item-meta";

      const authorSpan = document.createElement("span");
      authorSpan.className = "problem-item-author";
      authorSpan.textContent = `${p.emoji} ${p.author}`;
      meta.appendChild(authorSpan);

      const timeStr = formatNoteTime(p.updatedAt);
      if (timeStr) {
        const timeSpan = document.createElement("span");
        timeSpan.className = "tabular-text";
        timeSpan.textContent = `· ${timeStr}`;
        meta.appendChild(timeSpan);
      }

      if (p.isMine) {
        const editBtn = document.createElement("button");
        editBtn.type = "button";
        editBtn.className = "note-card-action-btn";
        editBtn.title = "ערוך דיווח";
        editBtn.textContent = "✏️";
        editBtn.onclick = () => openProblemModal(q.id);

        const delBtn = document.createElement("button");
        delBtn.type = "button";
        delBtn.className = "note-card-action-btn danger";
        delBtn.title = "מחק דיווח";
        delBtn.textContent = "🗑️";
        delBtn.onclick = () => deleteMyProblemReport(q.id);

        meta.append(editBtn, delBtn);
      } else if (adminState.authenticated) {
        const adminDelBtn = document.createElement("button");
        adminDelBtn.type = "button";
        adminDelBtn.className = "note-card-action-btn danger admin-del";
        adminDelBtn.title = "הסר דיווח כמנהל";
        adminDelBtn.textContent = "🗑️ הסר";
        adminDelBtn.onclick = () => adminDeleteProblem(q.id, p.userId);
        meta.appendChild(adminDelBtn);
      }

      top.append(pill, meta);
      item.appendChild(top);

      if (p.text) {
        const textDiv = document.createElement("div");
        textDiv.className = "problem-item-text";
        textDiv.textContent = p.text;
        item.appendChild(textDiv);
      }

      listWrap.appendChild(item);
    });

    bannerEl.append(head, listWrap);
  }

  function updateProblemModalFields() {
    const selectedRadio = document.querySelector('input[name="problemType"]:checked');
    const typeKey = selectedRadio ? selectedRadio.value : "question_issue";
    const info = PROBLEM_TYPES[typeKey] || PROBLEM_TYPES.question_issue;
    const labelEl = el("problemDetailLabel");
    const inputEl = el("problemDetailInput");
    if (labelEl) labelEl.textContent = info.detailLabel;
    if (inputEl) inputEl.placeholder = info.placeholder;
  }

  function openProblemModal(qId) {
    const q = Q_MAP.get(qId);
    if (!q) return;
    activeProblemModalQId = qId;

    const modal = el("problemReportModal");
    el("problemModalQLabel").textContent = `${q.exam} · שאלה ${q.num} · ${formatSubject(getSubject(q))}`;
    el("problemAuthorLabel").textContent = `מדווח בתור ${userIdentity.emoji} ${userIdentity.name}`;

    const mine = communityProblems[qId]?.[userIdentity.userId];
    const hasValidMine = isValidProblemEntry(mine);
    const chosenType = hasValidMine && PROBLEM_TYPES[mine.type] ? mine.type : "question_issue";

    document.querySelectorAll('input[name="problemType"]').forEach((r) => {
      r.checked = r.value === chosenType;
    });
    el("problemDetailInput").value = hasValidMine ? (mine.text || "") : "";
    el("btnSubmitProblem").textContent = hasValidMine ? "💾 עדכן אזהרה" : "⚠️ פרסם אזהרה לכולם";
    el("btnDeleteMyProblem").classList.toggle("hidden", !hasValidMine);

    updateProblemModalFields();
    updateProblemSyncBadge();
    modal.classList.remove("hidden");
    setTimeout(() => el("problemDetailInput")?.focus(), 20);
  }

  function closeProblemModal() {
    activeProblemModalQId = null;
    el("problemReportModal").classList.add("hidden");
  }

  function refreshActiveQuestionProblemViews() {
    if (currentMode === "exam" && simState.active) {
      const simQ = simState.questions[simState.currentIndex];
      if (simQ) {
        renderProblemBanner(el("simProblemBanner"), simQ);
        updateProblemFlagButton(el("simProblemBtn"), el("simProblemCount"), simQ);
      }
      return;
    }
    if (currentMode !== "analytics" && filteredList.length > 0) {
      const q = filteredList[currentIndex];
      if (q) {
        renderProblemBanner(el("qProblemBanner"), q);
        updateProblemFlagButton(el("btnFlagProblem"), el("btnFlagProblemCount"), q);
      }
    }
  }

  async function submitProblemReport() {
    const qId = activeProblemModalQId;
    if (!qId) return;
    const selectedRadio = document.querySelector('input[name="problemType"]:checked');
    const typeKey = selectedRadio ? selectedRadio.value : "question_issue";
    const info = PROBLEM_TYPES[typeKey] || PROBLEM_TYPES.question_issue;
    const rawText = el("problemDetailInput").value;
    const trimmed = rawText.trim();

    if (info.requireDetail && !trimmed) {
      showToast(`✏️ נא לפרט: ${info.detailLabel}`);
      el("problemDetailInput").focus();
      return;
    }

    identityNeedsCloudCheck = false;
    if (!progress.flags[qId]) progress.flags[qId] = {};
    if (!progress.flagUpdatedAt) progress.flagUpdatedAt = {};
    if (!progress.flagUpdatedAt[qId]) progress.flagUpdatedAt[qId] = {};
    progress.flags[qId].problem = true;
    progress.flagUpdatedAt[qId].problem = Date.now();
    saveProgress();

    if (!communityProblems[qId] || typeof communityProblems[qId] !== "object") {
      communityProblems[qId] = {};
    }
    communityProblems[qId][userIdentity.userId] = {
      type: info.id,
      text: trimmed,
      author: userIdentity.name,
      emoji: userIdentity.emoji,
      category: userIdentity.category,
      updatedAt: Date.now(),
    };

    pendingProblemDirtyQIds.add(qId);
    saveCommunityProblemsCache();
    problemSyncState = "saving";
    closeProblemModal();
    refreshActiveQuestionProblemViews();

    await enqueueProblemCloudSync();
    if (problemSyncState === "synced") {
      showToast("⚠️ הדיווח פורסם ומוצג מעל השאלה לכולם!");
    } else {
      showToast("⚠️ הדיווח נשמר מקומית ויוצג מעל השאלה.");
    }
  }

  async function deleteMyProblemReport(qId) {
    if (!qId) return;
    if (progress.flags[qId]) {
      progress.flags[qId].problem = false;
      if (!progress.flagUpdatedAt) progress.flagUpdatedAt = {};
      if (!progress.flagUpdatedAt[qId]) progress.flagUpdatedAt[qId] = {};
      progress.flagUpdatedAt[qId].problem = Date.now();
      saveProgress();
    }
    if (communityProblems[qId]) {
      delete communityProblems[qId][userIdentity.userId];
      if (Object.keys(communityProblems[qId]).length === 0) {
        delete communityProblems[qId];
      }
    }
    pendingProblemDirtyQIds.add(qId);
    saveCommunityProblemsCache();
    problemSyncState = "saving";
    if (activeProblemModalQId === qId) closeProblemModal();
    refreshActiveQuestionProblemViews();

    await enqueueProblemCloudSync();
    if (problemSyncState === "synced") {
      showToast("🗑️ הדיווח שלך הוסר.");
    }
  }

  function normalizeCloudProblemsPayload(raw) {
    if (raw && typeof raw === "object" && raw.problems && typeof raw.problems === "object") {
      return { version: 1, problems: raw.problems };
    }
    return { version: 1, problems: {} };
  }

  function mergeCloudProblemsIntoLocal(cloudPayload) {
    const normalized = normalizeCloudProblemsPayload(cloudPayload);
    const merged = {};

    Object.entries(normalized.problems).forEach(([qId, byUser]) => {
      if (!byUser || typeof byUser !== "object") return;
      merged[qId] = {};
      Object.entries(byUser).forEach(([uid, entry]) => {
        if (isValidProblemEntry(entry)) {
          merged[qId][uid] = { ...entry };
        }
      });
      if (Object.keys(merged[qId]).length === 0) delete merged[qId];
    });

    pendingProblemDirtyQIds.forEach((qId) => {
      const localMine = communityProblems[qId]?.[userIdentity.userId];
      if (!merged[qId]) merged[qId] = {};
      if (isValidProblemEntry(localMine)) {
        merged[qId][userIdentity.userId] = { ...localMine };
      } else {
        delete merged[qId][userIdentity.userId];
        if (Object.keys(merged[qId]).length === 0) delete merged[qId];
      }
    });

    communityProblems = merged;
    saveCommunityProblemsCache();
  }

  async function pullCloudProblems(showFeedback = false) {
    return bootstrapCloudState(showFeedback);
  }

  function enqueueProblemCloudSync() {
    problemWriteQueue = problemWriteQueue
      .then(async () => {
        if (pendingProblemDirtyQIds.size === 0) return;
        problemSyncState = "saving";
        updateProblemSyncBadge();

        const syncSnapshot = new Map();
        pendingProblemDirtyQIds.forEach((qId) => {
          const entry = communityProblems[qId]?.[userIdentity.userId];
          syncSnapshot.set(qId, isValidProblemEntry(entry) ? { ...entry } : null);
        });

        let anySaved = false;
        let allSaved = true;

        if (isCloudApiConfigured()) {
          for (const [qId, entry] of syncSnapshot.entries()) {
            try {
              const url = `${CLOUD_API_BASE}/api/problems/${encodeURIComponent(qId)}`;
              let res;
              if (isValidProblemEntry(entry)) {
                res = await fetch(url, {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    userId: userIdentity.userId,
                    clientSecret: userIdentity.clientSecret,
                    type: entry.type,
                    text: entry.text,
                    author: userIdentity.name,
                    emoji: userIdentity.emoji,
                    category: userIdentity.category,
                  }),
                });
                if (res.status === 409) {
                  await registerIdentityPing(false);
                  if (communityProblems[qId]?.[userIdentity.userId]) {
                    communityProblems[qId][userIdentity.userId].author = userIdentity.name;
                    communityProblems[qId][userIdentity.userId].emoji = userIdentity.emoji;
                    communityProblems[qId][userIdentity.userId].category = userIdentity.category;
                  }
                  res = await fetch(url, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      userId: userIdentity.userId,
                      clientSecret: userIdentity.clientSecret,
                      type: entry.type,
                      text: entry.text,
                      author: userIdentity.name,
                      emoji: userIdentity.emoji,
                      category: userIdentity.category,
                    }),
                  });
                }
              } else {
                res = await fetch(url, {
                  method: "DELETE",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    userId: userIdentity.userId,
                    clientSecret: userIdentity.clientSecret,
                  }),
                });
              }

              if (res.ok) {
                anySaved = true;
                const resData = await res.json().catch(() => ({}));
                if (resData?.problem && communityProblems[qId]?.[userIdentity.userId]) {
                  communityProblems[qId][userIdentity.userId] = resData.problem;
                }
                const currentEntry = communityProblems[qId]?.[userIdentity.userId] || null;
                const sameType = (entry?.type || "") === (currentEntry?.type || "");
                const sameText = (entry?.text || "") === (currentEntry?.text || "");
                if (sameType && sameText) {
                  pendingProblemDirtyQIds.delete(qId);
                }
              } else {
                allSaved = false;
              }
            } catch {
              allSaved = false;
            }
          }
          saveCommunityProblemsCache();
        } else {
          allSaved = false;
        }

        if (serverOnline) {
          fetch("/api/community-problems", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ version: 1, problems: communityProblems }),
          }).catch(() => {});
        }

        if (allSaved && anySaved) {
          problemSyncState = pendingProblemDirtyQIds.size > 0 ? "saving" : "synced";
        } else if (!isCloudApiConfigured() && serverOnline) {
          pendingProblemDirtyQIds.clear();
          problemSyncState = "synced";
        } else {
          problemSyncState = "offline";
        }

        refreshActiveQuestionProblemViews();
        updateProblemSyncBadge();
      })
      .catch(() => {
        problemSyncState = "error";
        updateProblemSyncBadge();
      });
    return problemWriteQueue;
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

        let anySaved = false;
        let allSaved = true;

        if (isCloudApiConfigured()) {
          for (const [qId, entry] of syncSnapshot.entries()) {
            try {
              const url = `${CLOUD_API_BASE}/api/notes/${encodeURIComponent(qId)}`;
              let res;
              if (entry && entry.text && entry.text.trim()) {
                res = await fetch(url, {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    userId: userIdentity.userId,
                    clientSecret: userIdentity.clientSecret,
                    author: userIdentity.name,
                    emoji: userIdentity.emoji,
                    category: userIdentity.category,
                    text: entry.text,
                  }),
                });
                if (res.status === 409) {
                  await registerIdentityPing(false);
                  if (communityNotes[qId]?.[userIdentity.userId]) {
                    communityNotes[qId][userIdentity.userId].author = userIdentity.name;
                    communityNotes[qId][userIdentity.userId].emoji = userIdentity.emoji;
                    communityNotes[qId][userIdentity.userId].category = userIdentity.category;
                  }
                  res = await fetch(url, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      userId: userIdentity.userId,
                      clientSecret: userIdentity.clientSecret,
                      author: userIdentity.name,
                      emoji: userIdentity.emoji,
                      category: userIdentity.category,
                      text: entry.text,
                    }),
                  });
                }
              } else {
                res = await fetch(url, {
                  method: "DELETE",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    userId: userIdentity.userId,
                    clientSecret: userIdentity.clientSecret,
                  }),
                });
              }

              if (res.ok) {
                anySaved = true;
                const resData = await res.json().catch(() => ({}));
                if (resData?.note && communityNotes[qId]?.[userIdentity.userId]) {
                  communityNotes[qId][userIdentity.userId] = resData.note;
                }
                const currentEntry = communityNotes[qId]?.[userIdentity.userId] || null;
                const sameText = (entry?.text || "") === (currentEntry?.text || "");
                const sameAuthor = (entry?.author || "") === (currentEntry?.author || "");
                if (sameText && sameAuthor) {
                  pendingDirtyQIds.delete(qId);
                }
              } else {
                allSaved = false;
              }
            } catch {
              allSaved = false;
            }
          }
          saveCommunityNotesCache();
        } else {
          allSaved = false;
        }

        if (serverOnline) {
          fetch("/api/community-notes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ version: 1, notes: communityNotes }),
          }).catch(() => {});
        }

        if (allSaved && anySaved) {
          noteSyncState = pendingDirtyQIds.size > 0 ? "saving" : "synced";
        } else if (!isCloudApiConfigured() && serverOnline) {
          pendingDirtyQIds.clear();
          noteSyncState = "synced";
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
    el("btnTheme").title = saved === "dark" ? "עבור למצב בהיר" : "עבור למצב כהה";
  }

  function toggleTheme() {
    const cur = document.documentElement.getAttribute("data-theme");
    const next = cur === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem(THEME_KEY, next);
    el("btnTheme").title = next === "dark" ? "עבור למצב בהיר" : "עבור למצב כהה";
  }

  // Server check (only probe local Python server when running on localhost / 127.0.0.1)
  async function checkServer() {
    const isLocalHost = location.hostname === "127.0.0.1" || location.hostname === "localhost";
    if (location.protocol === "file:" || !isLocalHost) return;
    try {
      const res = await fetch("/api/health");
      if (res.ok) {
        serverOnline = true;
        updateSyncStatusUI();
        // Load server progress if newer/non-empty
        const pRes = await fetch("/api/progress");
        if (pRes.ok) {
          const srvProg = await pRes.json();
          if (srvProg && Object.keys(srvProg.attempts || {}).length > Object.keys(progress.attempts || {}).length) {
            progress = { ...defaultProgress(), ...mergeProgressPayloads(progress, srvProg) };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
            renderCurrentView();
          }
        }
      }
    } catch {
      serverOnline = false;
      updateSyncStatusUI();
    }
  }

  const SUBJECT_EMOJIS = {
    "אונקולוגיה": "🎗️",
    "מבואות": "📚",
    "נוירולוגיה": "🧠",
    "פתולוגיה": "🔬",
    "קרדיולוגיה": "🫀",
    "ריאות": "🫁",
    "פתולוגיית קרדיולוגיה": "🫀🔬",
    "פתולוגיית ריאות": "🫁🔬",
  };

  function formatSubject(subj) {
    const emo = SUBJECT_EMOJIS[subj];
    return emo ? `${emo} ${subj}` : subj;
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
      btn.textContent = formatSubject(subj);
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
        const qProblems = getQuestionProblemsList(q.id);

        switch (filters.status) {
          case "unsolved": if (att) return false; break;
          case "wrong": if (!att || att.isCorrect) return false; break;
          case "starred": if (!fl.star) return false; break;
          case "unsure": if (!fl.unsure) return false; break;
          case "problematic": if (!fl.problem && qProblems.length === 0) return false; break;
          case "with_image": if (q.images.length === 0) return false; break;
          case "with_note": if (!myNote) return false; break;
          case "with_any_note": if (qCommNotes.length === 0 && !myNote) return false; break;
        }

        if (term) {
          const commText = qCommNotes.map((n) => `${n.emoji} ${n.author} ${n.text}`).join(" ");
          const probText = qProblems.map((p) => {
            const info = PROBLEM_TYPES[p.type];
            return `${info ? info.label : ""} ${p.author} ${p.text}`;
          }).join(" ");
          const hay = (
            q.stem + " " +
            q.options.map((o) => o.text).join(" ") + " " +
            myNote + " " +
            commText + " " +
            probText + " " +
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
    const hasCustomFilter = filters.exams.size > 0 || filters.subjects.size > 0 || filters.status !== "all" || !!filters.search.trim();
    const summaryParts = [];
    if (filters.exams.size > 0) summaryParts.push(`${filters.exams.size} מועדים`);
    if (filters.subjects.size > 0) summaryParts.push(`${filters.subjects.size} מקצועות`);
    if (filters.status !== "all") summaryParts.push("מסונן");
    const prefix = summaryParts.length > 0 ? summaryParts.join(" · ") : "הכל";
    el("filterSummaryBadge").textContent = `${prefix} · ${filteredList.length}/${QUESTIONS.length}`;
    el("filterActiveDot").classList.toggle("hidden", !hasCustomFilter);
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
    el("qSubjectBadge").textContent = formatSubject(getSubject(q));
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
    updateProblemFlagButton(el("btnFlagProblem"), el("btnFlagProblemCount"), q);
    el("adminQuestionActions")?.classList.toggle("hidden", !adminState.authenticated);

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

    renderProblemBanner(el("qProblemBanner"), q);

    el("qStem").textContent = q.stem;
    el("qContentGrid").classList.toggle("has-images", q.images.length > 0);

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
      strikeBtn.type = "button";
      strikeBtn.className = "strike-btn";
      strikeBtn.title = "פסול מסיח (לחיצה ימנית)";
      strikeBtn.setAttribute("aria-label", "פסול מסיח");
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
      html += `<div class="appeal-note">⚖️ הערת ערעור: כל התשובות התקבלו בשאלה זו.</div>`;
    } else if (q.appealNote) {
      html += `<div class="appeal-note">⚖️ הערת ערעור: ${escapeHtml(q.appealNote)}</div>`;
    }

    fb.innerHTML = html;
  }

  function handleAnswer(q, origIdx) {
    const now = Date.now();
    const isCorrect = q.correct.includes(origIdx);
    const firstTime = !progress.attempts[q.id];

    progress.attempts[q.id] = {
      selected: origIdx,
      isCorrect,
      ts: now,
    };
    if (progress.clearedAttempts) delete progress.clearedAttempts[q.id];

    if (currentMode === "drill") {
      if (!progress.drillStreakUpdatedAt) progress.drillStreakUpdatedAt = {};
      if (isCorrect) {
        progress.drillStreak[q.id] = (progress.drillStreak[q.id] || 0) + 1;
        if (progress.drillStreak[q.id] >= 2) {
          showToast("🎉 ענית נכון פעמיים! השאלה הושלמה בתיקון טעויות.");
        }
      } else {
        progress.drillStreak[q.id] = 0;
      }
      progress.drillStreakUpdatedAt[q.id] = now;
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
    if (!progress.struckUpdatedAt) progress.struckUpdatedAt = {};
    progress.struckUpdatedAt[qId] = Date.now();
    saveProgress();
    renderQuestion();
  }

  function toggleFlag(flagName) {
    if (filteredList.length === 0) return;
    const q = filteredList[currentIndex];
    const now = Date.now();
    if (!progress.flags[q.id]) progress.flags[q.id] = {};
    if (!progress.flagUpdatedAt) progress.flagUpdatedAt = {};
    if (!progress.flagUpdatedAt[q.id]) progress.flagUpdatedAt[q.id] = {};
    progress.flags[q.id][flagName] = !progress.flags[q.id][flagName];
    progress.flagUpdatedAt[q.id][flagName] = now;
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
    const now = Date.now();
    progress.attempts[q.id] = {
      selected: knew ? q.correct[0] : -1,
      isCorrect: knew,
      ts: now,
    };
    if (progress.clearedAttempts) delete progress.clearedAttempts[q.id];
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
    ["btnShuffleOptions", "btnShuffleOptionsMobile"].forEach((id) => {
      const b = el(id);
      if (!b) return;
      b.classList.toggle("btn-primary", shuffleOptionsEnabled);
      b.classList.toggle("btn-secondary", !shuffleOptionsEnabled);
    });
    renderQuestion();
    showToast(shuffleOptionsEnabled ? "🎲 ערבוב מסיחים הופעל" : "סדר מסיחים מקורי");
  }

  // Lightbox Pan & Zoom
  function openLightbox(src, caption) {
    lbScale = 1;
    lbX = 0;
    lbY = 0;
    const stage = el("lightboxStage");
    stage.innerHTML = "";
    const img = document.createElement("img");
    img.id = "lightboxImg";
    img.alt = "תמונה קלינית מוגדלת";
    img.draggable = false;
    img.src = src;
    stage.appendChild(img);
    el("lightboxCaption").textContent = caption;
    updateLightboxTransform();
    el("lightboxModal").classList.remove("hidden");
  }

  function closeLightbox() {
    el("lightboxModal").classList.add("hidden");
    el("lightboxStage").innerHTML = "";
  }

  function updateLightboxTransform() {
    const img = el("lightboxImg");
    if (img) img.style.transform = `translate(${lbX}px, ${lbY}px) scale(${lbScale})`;
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
    el("btnCloseLightbox").onclick = closeLightbox;
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
      btn.textContent = formatSubject(s);
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
            <span class="q-badge subject-badge">${escapeHtml(formatSubject(getSubject(q)))} · ${escapeHtml(q.exam)}</span>
          </div>
          <div class="q-flags">
            <button type="button" class="flag-btn ${simState.flagged.has(q.id) ? "active" : ""}" id="simFlagBtn" title="סמן לבדיקה">🚩 סמן לבדיקה</button>
            <button type="button" class="flag-btn" id="simProblemBtn" title="בעיות בשאלה – דווח או צפה בדיווחים" aria-label="בעיות בשאלה">
              <span aria-hidden="true">⚠️</span>
              <span class="flag-count hidden" id="simProblemCount"></span>
            </button>
          </div>
        </div>
        <div class="q-problem-banner hidden" id="simProblemBanner" role="alert"></div>
        <div class="q-content-grid${q.images.length > 0 ? " has-images" : ""}">
          <div class="q-stem">${escapeHtml(q.stem)}</div>
          <div class="q-images" id="simImages"></div>
        </div>
        <div class="q-options" id="simOptions"></div>
        <div class="q-nav-footer">
          <button type="button" class="btn-secondary nav-prev-btn" id="simPrevBtn">
            <svg class="ui-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
            <span>הקודמת</span>
          </button>
          <button type="button" class="btn-primary nav-next-btn" id="simNextBtn">
            <span>הבאה</span>
            <svg class="ui-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
        </div>
      </article>
    `;

    el("simFlagBtn").onclick = () => {
      if (simState.flagged.has(q.id)) simState.flagged.delete(q.id);
      else simState.flagged.add(q.id);
      renderSimQuestion();
    };
    el("simProblemBtn").onclick = () => openProblemModal(q.id);
    updateProblemFlagButton(el("simProblemBtn"), el("simProblemCount"), q);
    renderProblemBanner(el("simProblemBanner"), q);

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
      strikeBtn.type = "button";
      strikeBtn.className = "strike-btn";
      strikeBtn.setAttribute("aria-label", "פסול מסיח");
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
        if (progress.clearedAttempts) delete progress.clearedAttempts[q.id];
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
            <div class="prog-item-head"><span>${escapeHtml(formatSubject(subj))}</span><strong>${st.correct}/${st.total} (${sp}%)</strong></div>
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
        <button type="button" class="btn-primary" id="btnReviewSimWrong">🔥 תחקר טעויות מהסימולציה (${wrongIds.length})</button>
        <button type="button" class="btn-secondary" id="btnNewSim">🔄 סימולציה חדשה</button>
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
      <div class="kpi-card"><div class="kpi-label">📈 התקדמות כוללת</div><div class="kpi-value">${totalSolved} / ${QUESTIONS.length}</div></div>
      <div class="kpi-card"><div class="kpi-label">🎯 דיוק מצטבר</div><div class="kpi-value">${acc}%</div></div>
      <div class="kpi-card"><div class="kpi-label">📅 נפתרו היום</div><div class="kpi-value">${today.answered}</div></div>
      <div class="kpi-card"><div class="kpi-label">⭐ מועדפים לחזרה</div><div class="kpi-value">${starredCount}</div></div>
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
            <strong>${escapeHtml(formatSubject(s))} (${qs.length})</strong>
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
          ? `המקצוע שדורש הכי הרבה חיזוק כרגע: <strong>${escapeHtml(formatSubject(weakSubjs[0].s))}</strong> (${Math.round(weakSubjs[0].acc * 100)}% דיוק).`
          : "פתור כמה שאלות כדי לראות המלצות מותאמות אישית!"}
      </p>
      <p style="margin-top:10px;">יש לך <strong>${getDrillQuestions().length}</strong> שאלות שממתינות בתיקון טעויות 🔥.</p>
    `;

    // Readiness Matrix (Exam x Subject)
    const table = el("readinessMatrix");
    let head = `<tr><th>שנה / מקצוע</th>${subjs.map((s) => `<th>${escapeHtml(formatSubject(s))}</th>`).join("")}</tr>`;
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
      const qProbs = getQuestionProblemsList(q.id);
      const fl = progress.flags[q.id] || {};
      return (att && !att.isCorrect) || note || qComm.length > 0 || qProbs.length > 0 || fl.star || fl.problem;
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
          body: JSON.stringify({ progress, communityNotes, communityProblems, questionOverrides }),
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
      const qProbs = getQuestionProblemsList(q.id);
      const corrText = q.correct.map((i) => `${q.options[i].letter}. ${q.options[i].text}`).join(" / ");
      lines.push(`## ${q.exam} · שאלה ${q.num} (${q.subject})`);
      lines.push(q.stem);
      lines.push(`**תשובה נכונה:** ${corrText}`);
      qProbs.forEach((p) => {
        const info = PROBLEM_TYPES[p.type] || PROBLEM_TYPES.question_issue;
        const body = p.text ? `: ${p.text}` : "";
        lines.push(`> ⚠️ **${info.label} (${p.emoji} ${p.author})**${body}`);
      });
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
      el("btnToggleFilters").setAttribute("aria-expanded", hidden ? "false" : "true");
      el("filterToggleLabel").textContent = hidden ? "סינון" : "צמצם";
    };

    if (el("btnShuffleOptionsMobile")) {
      el("btnShuffleOptionsMobile").onclick = toggleShuffleOptions;
    }

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
    el("btnFlagProblem").onclick = () => {
      if (filteredList.length === 0) return;
      openProblemModal(filteredList[currentIndex].id);
    };

    // Problem Report Modal
    document.querySelectorAll('input[name="problemType"]').forEach((radio) => {
      radio.addEventListener("change", updateProblemModalFields);
    });
    el("btnCloseProblemModal").onclick = closeProblemModal;
    el("btnCancelProblemModal").onclick = closeProblemModal;
    el("btnSubmitProblem").onclick = submitProblemReport;
    el("btnDeleteMyProblem").onclick = () => {
      if (activeProblemModalQId) deleteMyProblemReport(activeProblemModalQId);
    };
    el("problemReportModal").addEventListener("click", (e) => {
      if (e.target === el("problemReportModal")) closeProblemModal();
    });

    el("btnClearAttempt").onclick = () => {
      if (filteredList.length === 0) return;
      const q = filteredList[currentIndex];
      delete progress.attempts[q.id];
      if (!progress.clearedAttempts) progress.clearedAttempts = {};
      progress.clearedAttempts[q.id] = Date.now();
      saveProgress();
      renderQuestion();
    };

    el("btnToggleNotes").onclick = () => toggleNotesDrawer();
    el("btnRefreshNotes").onclick = () => {
      bootstrapCloudState(true);
    };

    // Discrete admin entry: 5 consecutive clicks within 2s OR 1.2s long-press on identity pill
    let pillClickTimestamps = [];
    let pillLongPressTimer = null;
    let pillLongPressTriggered = false;
    const identityPillEl = el("userIdentityPill");
    if (identityPillEl) {
      identityPillEl.addEventListener("pointerdown", () => {
        pillLongPressTriggered = false;
        clearTimeout(pillLongPressTimer);
        pillLongPressTimer = setTimeout(() => {
          pillLongPressTriggered = true;
          pillClickTimestamps = [];
          openAdminEntry();
        }, 1200);
      });
      ["pointerup", "pointercancel", "pointerleave"].forEach((evt) => {
        identityPillEl.addEventListener(evt, () => {
          clearTimeout(pillLongPressTimer);
        });
      });
      identityPillEl.onclick = () => {
        if (pillLongPressTriggered) {
          pillLongPressTriggered = false;
          return;
        }
        const now = Date.now();
        pillClickTimestamps = pillClickTimestamps.filter((ts) => now - ts < 2000);
        pillClickTimestamps.push(now);
        if (pillClickTimestamps.length >= 5) {
          pillClickTimestamps = [];
          openAdminEntry();
          return;
        }
        showToast(`🔒 הכינוי שלך: ${userIdentity.emoji} ${userIdentity.name} · לחץ על כפתור הסנכרון למעבר בין מכשירים`);
      };
    }

    el("btnCancelEditNote").onclick = () => {
      if (filteredList.length === 0) return;
      cancelEditMyNote(filteredList[currentIndex].id);
    };

    async function submitNoteNow() {
      if (filteredList.length === 0) return;
      const q = filteredList[currentIndex];
      const rawText = el("qNoteInput").value;
      const trimmed = rawText.trim();
      const isEditing = editingNoteQIds.has(q.id);

      if (!trimmed) {
        if (isEditing) {
          await deleteMyNote(q.id);
        } else {
          showToast("✏️ כתוב הערה לפני השליחה.");
          el("qNoteInput").focus();
        }
        return;
      }

      identityNeedsCloudCheck = false;
      progress.notes[q.id] = rawText;
      if (!progress.noteUpdatedAt) progress.noteUpdatedAt = {};
      progress.noteUpdatedAt[q.id] = Date.now();
      saveProgress();

      if (!communityNotes[q.id] || typeof communityNotes[q.id] !== "object") {
        communityNotes[q.id] = {};
      }
      communityNotes[q.id][userIdentity.userId] = {
        author: userIdentity.name,
        emoji: userIdentity.emoji,
        category: userIdentity.category,
        text: rawText,
        updatedAt: Date.now(),
      };

      delete noteDrafts[q.id];
      editingNoteQIds.delete(q.id);
      el("qNoteInput").value = "";

      pendingDirtyQIds.add(q.id);
      saveCommunityNotesCache();
      noteSyncState = "saving";
      renderNotesSection(q, false);

      await enqueueCloudSync();
      if (noteSyncState === "synced") {
        showToast(isEditing ? "✏️ ההערה עודכנה בענן!" : "💬 ההערה נשלחה ונשמרה בענן!");
      }
    }

    el("qNoteInput").addEventListener("input", (e) => {
      if (filteredList.length === 0) return;
      const q = filteredList[currentIndex];
      noteDrafts[q.id] = e.target.value;
      updateNoteSyncBadge();
    });

    let lastNoteShiftDown = false;
    let lastNoteEnterSubmitAt = 0;

    function triggerEnterSubmit() {
      const now = Date.now();
      if (now - lastNoteEnterSubmitAt < 100) return;
      lastNoteEnterSubmitAt = now;
      submitNoteNow();
    }

    el("qNoteInput").addEventListener("keydown", (e) => {
      lastNoteShiftDown = e.shiftKey;
      const isEnter = e.key === "Enter" || e.code === "Enter" || e.code === "NumpadEnter" || e.keyCode === 13;
      if (isEnter && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        triggerEnterSubmit();
      }
    });

    el("qNoteInput").addEventListener("keyup", (e) => {
      lastNoteShiftDown = e.shiftKey;
    });

    el("qNoteInput").addEventListener("beforeinput", (e) => {
      if ((e.inputType === "insertLineBreak" || (e.inputType === "insertText" && e.data === "\n")) && !lastNoteShiftDown) {
        e.preventDefault();
        triggerEnterSubmit();
      }
    });

    el("btnSendNote").onclick = () => submitNoteNow();

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
    el("btnOpenSyncFromBackup")?.addEventListener("click", () => {
      el("backupModal").classList.add("hidden");
      openSyncModal();
    });
    el("btnSyncModal")?.addEventListener("click", () => openSyncModal());
    el("btnCloseSyncModal")?.addEventListener("click", () => closeSyncModal());
    el("syncModal")?.addEventListener("click", (e) => {
      if (e.target === el("syncModal")) closeSyncModal();
    });
    el("btnCopySyncCode")?.addEventListener("click", () => {
      if (!userIdentity.syncCode) return;
      copyTextToClipboard(userIdentity.syncCode, "📋 קוד הסנכרון הועתק!");
    });
    el("btnCopyMagicLink")?.addEventListener("click", () => {
      if (!userIdentity.syncCode) return;
      copyTextToClipboard(buildMagicLink(userIdentity.syncCode), "🔗 קישור הקסם הועתק!");
    });
    el("btnToggleQr")?.addEventListener("click", () => {
      const wrap = el("syncQrWrap");
      if (!wrap) return;
      const willShow = wrap.classList.contains("hidden");
      wrap.classList.toggle("hidden", !willShow);
      el("btnToggleQr").textContent = willShow ? "📱 הסתר QR" : "📱 הצג QR לסריקה";
      if (willShow) renderSyncQrCode();
    });
    el("btnSyncNow")?.addEventListener("click", async () => {
      await syncNowManual();
    });
    el("btnRotateSyncCode")?.addEventListener("click", async () => {
      await rotateSyncCodeFlow();
    });
    el("btnRevokeOtherDevices")?.addEventListener("click", async () => {
      await revokeOtherDevicesFlow();
    });
    el("btnPreviewSyncLink")?.addEventListener("click", async () => {
      await previewConnectSyncCode();
    });
    el("syncConnectInput")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        previewConnectSyncCode();
      }
    });
    el("btnConfirmSyncMerge")?.addEventListener("click", async () => {
      if (pendingSyncPreview?.syncCode) {
        await completeSyncLink(pendingSyncPreview.syncCode, "merge");
      }
    });
    el("btnConfirmSyncReplace")?.addEventListener("click", async () => {
      if (pendingSyncPreview?.syncCode) {
        await completeSyncLink(pendingSyncPreview.syncCode, "replace");
      }
    });
    el("btnCancelSyncPreview")?.addEventListener("click", () => {
      pendingSyncPreview = null;
      el("syncPreviewCard")?.classList.add("hidden");
    });

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
          const normalized = mergeProgressPayloads({}, parsed);
          if (
            Object.keys(normalized.dailyStatsByDevice).length === 0 &&
            Object.keys(normalized.dailyStats).length > 0
          ) {
            normalized.dailyStatsByDevice[deviceId] = { ...normalized.dailyStats };
            normalized.dailyStatsUpdatedAt = normalized.dailyStatsUpdatedAt || Date.now();
          } else if (normalized.dailyStatsByDevice._legacy) {
            normalized.dailyStatsByDevice[deviceId] = { ...normalized.dailyStatsByDevice._legacy };
            delete normalized.dailyStatsByDevice._legacy;
          }
          progress = { ...defaultProgress(), ...normalized };
          saveProgress({ syncCloud: true, immediateCloud: true });
          renderCurrentView();
          el("backupModal").classList.add("hidden");
          showToast("✅ הגיבוי שוחזר ויסתנכרן עם הענן!");
        } catch {
          showToast("❌ קובץ גיבוי לא תקין");
        }
      };
      reader.readAsText(file);
    };

    el("btnResetProgress").onclick = () => {
      if (confirm("בטוח שברצונך למחוק את כל ההתקדמות, הסימונים וההערות?")) {
        progress = defaultProgress();
        progress.resetAt = Date.now();
        saveProgress({ syncCloud: true, immediateCloud: true });
        renderCurrentView();
        el("backupModal").classList.add("hidden");
        showToast("ההתקדמות אופסה.");
      }
    };

    // Admin bindings
    el("btnAdminPanel")?.addEventListener("click", () => openAdminDashboardModal());
    el("btnAdminEditQ")?.addEventListener("click", () => {
      if (filteredList.length > 0) openAdminQuestionModal(filteredList[currentIndex].id);
    });
    el("btnAdminHideQ")?.addEventListener("click", () => {
      if (filteredList.length > 0) adminToggleHideQuestion(filteredList[currentIndex].id, true);
    });
    el("btnCloseAdminLogin")?.addEventListener("click", closeAdminLoginModal);
    el("btnCancelAdminLogin")?.addEventListener("click", closeAdminLoginModal);
    el("adminLoginModal")?.addEventListener("click", (e) => {
      if (e.target === el("adminLoginModal")) closeAdminLoginModal();
    });
    el("adminLoginForm")?.addEventListener("submit", handleAdminLoginSubmit);

    el("btnCloseAdminQuestion")?.addEventListener("click", closeAdminQuestionModal);
    el("btnCancelAdminQuestion")?.addEventListener("click", closeAdminQuestionModal);
    el("adminQuestionModal")?.addEventListener("click", (e) => {
      if (e.target === el("adminQuestionModal")) closeAdminQuestionModal();
    });
    el("btnAdminAddOption")?.addEventListener("click", addAdminDraftOption);
    el("btnAdminSaveQuestion")?.addEventListener("click", saveAdminQuestionOverride);
    el("btnAdminResetQuestion")?.addEventListener("click", () => {
      if (activeAdminEditQId) resetAdminQuestionOverride(activeAdminEditQId);
    });
    el("btnAdminToggleHideQuestion")?.addEventListener("click", () => {
      if (!activeAdminEditQId) return;
      const isHidden = Boolean(questionOverrides[activeAdminEditQId]?.hidden);
      adminToggleHideQuestion(activeAdminEditQId, !isHidden);
    });

    el("btnCloseAdminDashboard")?.addEventListener("click", closeAdminDashboardModal);
    el("adminDashboardModal")?.addEventListener("click", (e) => {
      if (e.target === el("adminDashboardModal")) closeAdminDashboardModal();
    });
    el("btnAdminLogout")?.addEventListener("click", adminLogout);
    el("btnAdminRefreshUsers")?.addEventListener("click", () => loadAdminUsers(true));
    el("adminUsersSearch")?.addEventListener("input", renderAdminUsersTab);
    el("adminOverridesSearch")?.addEventListener("input", renderAdminOverridesTab);
    el("adminModerationSearch")?.addEventListener("input", renderAdminModerationTab);

    document.querySelectorAll(".admin-tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => switchAdminTab(btn.dataset.adminTab));
    });
    el("adminOverridesFilterChips")?.querySelectorAll(".chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        el("adminOverridesFilterChips").querySelectorAll(".chip").forEach((x) => x.classList.remove("active"));
        chip.classList.add("active");
        adminOverridesFilter = chip.dataset.ovFilter || "all";
        renderAdminOverridesTab();
      });
    });
    el("adminModerationFilterChips")?.querySelectorAll(".chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        el("adminModerationFilterChips").querySelectorAll(".chip").forEach((x) => x.classList.remove("active"));
        chip.classList.add("active");
        adminModerationFilter = chip.dataset.modFilter || "all";
        renderAdminModerationTab();
      });
    });

    // Keyboard shortcuts
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeLightbox();
        closeProblemModal();
        closeSyncModal();
        closeAdminLoginModal();
        closeAdminQuestionModal();
        closeAdminDashboardModal();
        el("backupModal").classList.add("hidden");
        el("shortcutsModal").classList.add("hidden");
        return;
      }
      if (
        !el("problemReportModal").classList.contains("hidden") ||
        !el("syncModal")?.classList.contains("hidden") ||
        !el("adminLoginModal").classList.contains("hidden") ||
        !el("adminQuestionModal").classList.contains("hidden") ||
        !el("adminDashboardModal").classList.contains("hidden")
      ) {
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

  // ============================================================
  // Admin Auth, Question Overrides & Moderation Dashboard
  // ============================================================

  function saveAdminToken(token, expiresAt, rememberDevice) {
    clearAdminTokens();
    adminState = {
      authenticated: true,
      token,
      rememberDevice: Boolean(rememberDevice),
      expiresAt: Number(expiresAt) || 0,
    };
    try {
      const payload = JSON.stringify({ token, expiresAt: adminState.expiresAt });
      if (rememberDevice) localStorage.setItem(ADMIN_TOKEN_LOCAL_KEY, payload);
      else sessionStorage.setItem(ADMIN_TOKEN_SESSION_KEY, payload);
    } catch {}
  }

  function clearAdminTokens() {
    adminState = { authenticated: false, token: null, rememberDevice: false, expiresAt: 0 };
    try {
      localStorage.removeItem(ADMIN_TOKEN_LOCAL_KEY);
      sessionStorage.removeItem(ADMIN_TOKEN_SESSION_KEY);
    } catch {}
  }

  function loadStoredAdminToken() {
    try {
      const sessRaw = sessionStorage.getItem(ADMIN_TOKEN_SESSION_KEY);
      if (sessRaw) {
        const parsed = JSON.parse(sessRaw);
        if (parsed?.token) return { token: parsed.token, rememberDevice: false };
      }
      const localRaw = localStorage.getItem(ADMIN_TOKEN_LOCAL_KEY);
      if (localRaw) {
        const parsed = JSON.parse(localRaw);
        if (parsed?.token) return { token: parsed.token, rememberDevice: true };
      }
    } catch {}
    return null;
  }

  function updateAdminUI() {
    el("btnAdminPanel")?.classList.toggle("hidden", !adminState.authenticated);
    el("adminQuestionActions")?.classList.toggle("hidden", !adminState.authenticated);
    if (currentMode !== "exam" && currentMode !== "analytics" && filteredList.length > 0) {
      const q = filteredList[currentIndex];
      if (q) {
        renderProblemBanner(el("qProblemBanner"), q);
        renderNotesSection(q, true);
      }
    } else if (currentMode === "exam" && simState.active) {
      const simQ = simState.questions[simState.currentIndex];
      if (simQ) renderProblemBanner(el("simProblemBanner"), simQ);
    }
  }

  async function adminFetch(path, options = {}) {
    if (!isCloudApiConfigured()) {
      throw new Error("כתובת ה-Worker טרם הוגדרה ב-app.js (CLOUD_API_BASE).");
    }
    const headers = {
      ...(options.headers || {}),
    };
    if (options.body && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }
    if (adminState.token) {
      headers.Authorization = `Bearer ${adminState.token}`;
    }
    const res = await fetch(`${CLOUD_API_BASE}${path}`, {
      ...options,
      headers,
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      clearAdminTokens();
      updateAdminUI();
      closeAdminDashboardModal();
      closeAdminQuestionModal();
      showToast("🔒 פג תוקף חיבור המנהל — יש להתחבר מחדש.");
      openAdminLoginModal();
      throw new Error(data.error || "Unauthorized");
    }
    if (!res.ok) {
      throw new Error(data.error || `HTTP ${res.status}`);
    }
    return data;
  }

  async function initAdminAuth() {
    let shouldOpenAdmin = false;
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("admin") === "1") {
        shouldOpenAdmin = true;
        params.delete("admin");
        const qs = params.toString();
        const cleanUrl = window.location.pathname + (qs ? `?${qs}` : "") + window.location.hash;
        history.replaceState(null, "", cleanUrl);
      }
    } catch {}

    const stored = loadStoredAdminToken();
    if (stored && isCloudApiConfigured()) {
      try {
        const res = await fetch(`${CLOUD_API_BASE}/api/admin/verify`, {
          headers: { Authorization: `Bearer ${stored.token}` },
          cache: "no-store",
        });
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          adminState = {
            authenticated: true,
            token: stored.token,
            rememberDevice: stored.rememberDevice,
            expiresAt: Number(data.expiresAt) || 0,
          };
          updateAdminUI();
        } else {
          clearAdminTokens();
        }
      } catch {
        // Network issue: keep token for retry when online, don't unlock admin UI silently
      }
    } else if (stored && !isCloudApiConfigured()) {
      clearAdminTokens();
    }

    if (shouldOpenAdmin) {
      openAdminEntry();
    }
  }

  function openAdminEntry() {
    if (adminState.authenticated) openAdminDashboardModal();
    else openAdminLoginModal();
  }

  function openAdminLoginModal() {
    const errEl = el("adminLoginError");
    if (errEl) {
      errEl.classList.add("hidden");
      errEl.textContent = "";
    }
    const pwdEl = el("adminPasswordInput");
    if (pwdEl) pwdEl.value = "";
    el("adminLoginModal").classList.remove("hidden");
    setTimeout(() => pwdEl?.focus(), 30);
  }

  function closeAdminLoginModal() {
    el("adminLoginModal")?.classList.add("hidden");
  }

  async function handleAdminLoginSubmit(e) {
    e.preventDefault();
    const errEl = el("adminLoginError");
    const submitBtn = el("btnSubmitAdminLogin");
    const password = el("adminPasswordInput").value;
    const rememberDevice = el("adminRememberDevice").checked;

    errEl.classList.add("hidden");
    if (!isCloudApiConfigured()) {
      errEl.textContent = "יש להגדיר את כתובת ה-Worker ב-CLOUD_API_BASE בתוך app.js לאחר הפריסה.";
      errEl.classList.remove("hidden");
      return;
    }

    submitBtn.disabled = true;
    const origText = submitBtn.textContent;
    submitBtn.textContent = "מאמת...";

    try {
      const res = await fetch(`${CLOUD_API_BASE}/api/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.token) {
        throw new Error(data.error || "התחברות נכשלה");
      }
      saveAdminToken(data.token, data.expiresAt, rememberDevice);
      closeAdminLoginModal();
      updateAdminUI();
      showToast("🛡️ התחברת בהצלחה כמנהל!");
    } catch (err) {
      errEl.textContent = err?.message || "שגיאה בהתחברות";
      errEl.classList.remove("hidden");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = origText;
    }
  }

  function adminLogout() {
    clearAdminTokens();
    closeAdminDashboardModal();
    closeAdminQuestionModal();
    updateAdminUI();
    showToast("🚪 התנתקת ממצב מנהל.");
  }

  // Admin Question Editor
  function getAllKnownSubjects() {
    const set = new Set(Object.keys(SUBJECT_EMOJIS));
    RAW_QUESTIONS.forEach((q) => {
      if (q.subject) set.add(q.subject);
    });
    Object.values(questionOverrides).forEach((ov) => {
      if (ov?.subject) set.add(ov.subject);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "he"));
  }

  function renderAdminDraftOptions() {
    const listEl = el("adminEditOptionsList");
    listEl.innerHTML = "";
    adminDraftOptions.forEach((opt, idx) => {
      const row = document.createElement("div");
      row.className = "admin-option-row" + (opt.isCorrect ? " is-correct" : "");

      const letter = document.createElement("span");
      letter.className = "admin-opt-letter";
      letter.textContent = `${HEBREW_LETTERS[idx] || idx + 1}.`;

      const textarea = document.createElement("textarea");
      textarea.className = "admin-opt-input";
      textarea.rows = 2;
      textarea.value = opt.text;
      textarea.placeholder = `נוסח מסיח ${HEBREW_LETTERS[idx] || idx + 1}...`;
      textarea.addEventListener("input", (e) => {
        adminDraftOptions[idx].text = e.target.value;
      });

      const correctLabel = document.createElement("label");
      correctLabel.className = "admin-opt-correct-label";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = Boolean(opt.isCorrect);
      cb.addEventListener("change", (e) => {
        adminDraftOptions[idx].isCorrect = e.target.checked;
        row.classList.toggle("is-correct", e.target.checked);
      });
      const cbSpan = document.createElement("span");
      cbSpan.textContent = "נכונה";
      correctLabel.append(cb, cbSpan);

      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "note-card-action-btn danger admin-opt-del-btn";
      delBtn.textContent = "🗑️";
      delBtn.title = "הסר מסיח";
      delBtn.disabled = adminDraftOptions.length <= 2;
      delBtn.onclick = () => {
        if (adminDraftOptions.length <= 2) return;
        adminDraftOptions.splice(idx, 1);
        renderAdminDraftOptions();
      };

      row.append(letter, textarea, correctLabel, delBtn);
      listEl.appendChild(row);
    });

    const addBtn = el("btnAdminAddOption");
    if (addBtn) addBtn.disabled = adminDraftOptions.length >= 6;
  }

  function addAdminDraftOption() {
    if (adminDraftOptions.length >= 6) return;
    adminDraftOptions.push({ text: "", isCorrect: false });
    renderAdminDraftOptions();
  }

  function openAdminQuestionModal(qId) {
    if (!adminState.authenticated) {
      openAdminLoginModal();
      return;
    }
    const rawQ = RAW_Q_MAP.get(qId);
    if (!rawQ) return;
    activeAdminEditQId = qId;

    const ov = questionOverrides[qId];
    const effective = applyOverrideToQuestion(rawQ, ov);

    el("adminEditQLabel").textContent = `${rawQ.exam} · שאלה ${rawQ.num} · ${rawQ.id}`;

    const subjSelect = el("adminEditSubject");
    subjSelect.innerHTML = "";
    getAllKnownSubjects().forEach((subj) => {
      const opt = document.createElement("option");
      opt.value = subj;
      opt.textContent = formatSubject(subj);
      subjSelect.appendChild(opt);
    });
    subjSelect.value = effective.subject;

    el("adminEditStem").value = effective.stem;
    el("adminEditAllAccepted").checked = Boolean(effective.allAccepted);
    el("adminEditAppealNote").value = effective.appealNote || "";

    const correctSet = new Set(effective.correct || []);
    adminDraftOptions = (effective.options || []).map((opt, idx) => ({
      text: opt.text || "",
      isCorrect: correctSet.has(idx),
    }));
    renderAdminDraftOptions();

    const isHidden = Boolean(ov?.hidden);
    const hideBtn = el("btnAdminToggleHideQuestion");
    hideBtn.textContent = isHidden ? "♻️ שחזר שאלה לבנק" : "🗑️ הסר שאלה מהבנק";
    hideBtn.classList.toggle("btn-danger", !isHidden);
    hideBtn.classList.toggle("btn-success", isHidden);

    el("btnAdminResetQuestion").classList.toggle("hidden", !ov);
    el("adminQuestionModal").classList.remove("hidden");
  }

  function closeAdminQuestionModal() {
    activeAdminEditQId = null;
    el("adminQuestionModal")?.classList.add("hidden");
  }

  async function saveAdminQuestionOverride() {
    const qId = activeAdminEditQId;
    if (!qId) return;

    const stem = el("adminEditStem").value.trim();
    const subject = el("adminEditSubject").value;
    const allAccepted = el("adminEditAllAccepted").checked;
    const appealNote = el("adminEditAppealNote").value.trim();

    if (!stem) {
      showToast("❌ נוסח השאלה לא יכול להיות ריק.");
      return;
    }
    const cleanOptions = adminDraftOptions.map((opt, idx) => ({
      letter: HEBREW_LETTERS[idx],
      text: opt.text.trim(),
    }));
    if (cleanOptions.length < 2 || cleanOptions.some((o) => !o.text)) {
      showToast("❌ יש למלא נוסח תקין בכל המסיחים (מינימום 2).");
      return;
    }
    const correct = [];
    adminDraftOptions.forEach((opt, idx) => {
      if (opt.isCorrect) correct.push(idx);
    });
    if (correct.length === 0) {
      showToast("❌ יש לסמן לפחות תשובה נכונה אחת.");
      return;
    }

    const saveBtn = el("btnAdminSaveQuestion");
    saveBtn.disabled = true;
    try {
      const existingHidden = Boolean(questionOverrides[qId]?.hidden);
      const data = await adminFetch(`/api/admin/overrides/${encodeURIComponent(qId)}`, {
        method: "PUT",
        body: JSON.stringify({
          hidden: existingHidden,
          stem,
          options: cleanOptions,
          correct,
          allAccepted,
          appealNote,
          subject,
        }),
      });
      if (data.override) {
        questionOverrides[qId] = data.override;
        saveQuestionOverridesCache();
        rebuildEffectiveQuestions({ render: true });
        if (!el("adminDashboardModal").classList.contains("hidden")) {
          renderAdminOverridesTab();
        }
      }
      closeAdminQuestionModal();
      showToast("💾 השאלה עודכנה ונשמרה בענן לכולם!");
    } catch (err) {
      showToast(`❌ שגיאה בשמירה: ${err.message}`);
    } finally {
      saveBtn.disabled = false;
    }
  }

  async function adminToggleHideQuestion(qId, shouldHide) {
    const rawQ = RAW_Q_MAP.get(qId);
    if (!rawQ) return;
    if (shouldHide && !confirm(`להסיר את שאלה ${rawQ.num} (${rawQ.exam}) מהבנק עבור כל המשתמשים? ניתן לשחזר מלוח הבקרה.`)) {
      return;
    }
    try {
      const data = await adminFetch(`/api/admin/overrides/${encodeURIComponent(qId)}`, {
        method: "PUT",
        body: JSON.stringify({ hidden: Boolean(shouldHide) }),
      });
      if (data.override) {
        questionOverrides[qId] = data.override;
        saveQuestionOverridesCache();
        rebuildEffectiveQuestions({ render: true });
      }
      if (activeAdminEditQId === qId) closeAdminQuestionModal();
      if (!el("adminDashboardModal").classList.contains("hidden")) {
        renderAdminOverridesTab();
      }
      showToast(shouldHide ? "🗑️ השאלה הוסרה מהבנק לכולם." : "♻️ השאלה שוחזרה לבנק!");
    } catch (err) {
      showToast(`❌ שגיאה בעדכון שאלה: ${err.message}`);
    }
  }

  async function resetAdminQuestionOverride(qId) {
    if (!confirm("לאפס שאלה זו חזרה לנוסח המקורי מ-questions_data.js?")) return;
    try {
      await adminFetch(`/api/admin/overrides/${encodeURIComponent(qId)}`, {
        method: "DELETE",
      });
      delete questionOverrides[qId];
      saveQuestionOverridesCache();
      rebuildEffectiveQuestions({ render: true });
      if (activeAdminEditQId === qId) closeAdminQuestionModal();
      if (!el("adminDashboardModal").classList.contains("hidden")) {
        renderAdminOverridesTab();
      }
      showToast("↩️ השאלה אופסה למקור בהצלחה.");
    } catch (err) {
      showToast(`❌ שגיאה באיפוס שאלה: ${err.message}`);
    }
  }

  async function adminDeleteNote(qId, targetUserId) {
    if (!confirm("למחוק את הערת הקהילה של משתמש זה לצמיתות?")) return;
    try {
      await adminFetch(`/api/admin/notes/${encodeURIComponent(qId)}/${encodeURIComponent(targetUserId)}`, {
        method: "DELETE",
      });
      if (communityNotes[qId]) {
        delete communityNotes[qId][targetUserId];
        if (Object.keys(communityNotes[qId]).length === 0) delete communityNotes[qId];
      }
      saveCommunityNotesCache();
      if (filteredList.length > 0 && filteredList[currentIndex]?.id === qId) {
        renderNotesSection(filteredList[currentIndex], true);
      }
      if (!el("adminDashboardModal").classList.contains("hidden")) {
        renderAdminModerationTab();
      }
      showToast("🗑️ ההערה הוסרה בהצלחה.");
    } catch (err) {
      showToast(`❌ שגיאה במחיקת הערה: ${err.message}`);
    }
  }

  async function adminDeleteProblem(qId, targetUserId) {
    if (!confirm("להסיר את דיווח הבעיה של משתמש זה לצמיתות?")) return;
    try {
      await adminFetch(`/api/admin/problems/${encodeURIComponent(qId)}/${encodeURIComponent(targetUserId)}`, {
        method: "DELETE",
      });
      if (communityProblems[qId]) {
        delete communityProblems[qId][targetUserId];
        if (Object.keys(communityProblems[qId]).length === 0) delete communityProblems[qId];
      }
      saveCommunityProblemsCache();
      refreshActiveQuestionProblemViews();
      if (!el("adminDashboardModal").classList.contains("hidden")) {
        renderAdminModerationTab();
      }
      showToast("🗑️ הדיווח הוסר בהצלחה.");
    } catch (err) {
      showToast(`❌ שגיאה במחיקת דיווח: ${err.message}`);
    }
  }

  // Admin Dashboard Modal
  function openAdminDashboardModal() {
    if (!adminState.authenticated) {
      openAdminLoginModal();
      return;
    }
    el("adminDashboardModal").classList.remove("hidden");
    switchAdminTab(adminActiveTab);
    loadAdminUsers(false);
  }

  function closeAdminDashboardModal() {
    el("adminDashboardModal")?.classList.add("hidden");
  }

  function switchAdminTab(tab) {
    adminActiveTab = tab || "users";
    document.querySelectorAll(".admin-tab-btn").forEach((btn) => {
      const active = btn.dataset.adminTab === adminActiveTab;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
    });
    el("adminTabUsers").classList.toggle("hidden", adminActiveTab !== "users");
    el("adminTabOverrides").classList.toggle("hidden", adminActiveTab !== "overrides");
    el("adminTabModeration").classList.toggle("hidden", adminActiveTab !== "moderation");

    if (adminActiveTab === "users") renderAdminUsersTab();
    else if (adminActiveTab === "overrides") renderAdminOverridesTab();
    else if (adminActiveTab === "moderation") renderAdminModerationTab();
  }

  async function loadAdminUsers(showFeedback = false) {
    if (!adminState.authenticated) return;
    try {
      const data = await adminFetch("/api/admin/users");
      adminUsersCache = Array.isArray(data.users) ? data.users : [];
      takenNamesMap = {};
      adminUsersCache.forEach((u) => {
        if (u.name && u.userId) takenNamesMap[u.name] = u.userId;
      });
      saveTakenNamesCache();
      renderAdminUsersTab();
      if (showFeedback) showToast("🔄 רשימת המשתמשים רועננה.");
    } catch (err) {
      if (showFeedback) showToast(`❌ שגיאה בטעינת משתמשים: ${err.message}`);
    }
  }

  async function adminReleaseNickname(userId, name) {
    if (!confirm(`לשחרר את הכינוי "${name}" (${userId}) כך שיהיה פנוי למשתמש חדש?`)) return;
    try {
      await adminFetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
        method: "DELETE",
      });
      adminUsersCache = adminUsersCache.filter((u) => u.userId !== userId);
      if (takenNamesMap[name] === userId) {
        delete takenNamesMap[name];
        saveTakenNamesCache();
      }
      renderAdminUsersTab();
      showToast(`🔓 הכינוי "${name}" שוחרר.`);
    } catch (err) {
      showToast(`❌ שגיאה בשחרור כינוי: ${err.message}`);
    }
  }

  function renderAdminUsersTab() {
    const now = Date.now();
    const active24h = adminUsersCache.filter((u) => now - (Number(u.lastSeenAt) || 0) <= 24 * 60 * 60 * 1000).length;
    const takenNamesSet = new Set(adminUsersCache.map((u) => u.name));

    el("adminUsersKpis").innerHTML = `
      <div class="kpi-card"><div class="kpi-label">👥 סה״כ משתמשים</div><div class="kpi-value">${adminUsersCache.length}</div></div>
      <div class="kpi-card"><div class="kpi-label">🏷️ כינויים תפוסים</div><div class="kpi-value">${takenNamesSet.size} / ${IDENTITY_CATALOG.length}</div></div>
      <div class="kpi-card"><div class="kpi-label">🟢 פעילים ב-24 ש׳</div><div class="kpi-value">${active24h}</div></div>
    `;

    const namesGrid = el("adminNamesGrid");
    namesGrid.innerHTML = "";
    IDENTITY_CATALOG.forEach((item) => {
      const chip = document.createElement("span");
      const userObj = adminUsersCache.find((u) => u.name === item.name);
      chip.className = "admin-name-chip" + (userObj ? " taken" : "");
      chip.textContent = `${item.emoji} ${item.name}`;
      chip.title = userObj
        ? `תפוס · פעילות אחרונה: ${formatNoteTime(userObj.lastSeenAt)}`
        : `פנוי (${item.category})`;
      namesGrid.appendChild(chip);
    });

    const term = (el("adminUsersSearch")?.value || "").trim().toLowerCase();
    const filteredUsers = adminUsersCache.filter((u) => {
      if (!term) return true;
      return (
        String(u.name || "").toLowerCase().includes(term) ||
        String(u.category || "").toLowerCase().includes(term) ||
        String(u.userId || "").toLowerCase().includes(term)
      );
    });

    const listWrap = el("adminUsersList");
    if (filteredUsers.length === 0) {
      listWrap.innerHTML = `<div class="community-notes-empty" style="padding:16px;">לא נמצאו משתמשים תואמים.</div>`;
      return;
    }

    const table = document.createElement("table");
    table.className = "admin-users-table";
    table.innerHTML = `
      <thead>
        <tr>
          <th>כינוי</th>
          <th>קטגוריה</th>
          <th>כניסה ראשונה</th>
          <th>פעילות אחרונה</th>
          <th>הערות / דיווחים</th>
          <th>פעולות</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;
    const tbody = table.querySelector("tbody");
    filteredUsers.forEach((u) => {
      const tr = document.createElement("tr");
      const syncTag = u.hasSyncCode ? " · ☁️ מסונכרן" : "";
      tr.innerHTML = `
        <td><strong>${escapeHtml(u.emoji)} ${escapeHtml(u.name)}</strong><br/><span class="muted" style="font-size:0.72rem;">${escapeHtml(u.userId)}${syncTag}</span></td>
        <td>${escapeHtml(u.category || "—")}</td>
        <td>${escapeHtml(formatNoteTime(u.firstSeenAt) || "—")}</td>
        <td>${escapeHtml(formatNoteTime(u.lastSeenAt) || "—")}</td>
        <td>📝 ${Number(u.solvedCount) || 0} פתורות · 💬 ${Number(u.notesCount) || 0} · ⚠️ ${Number(u.problemsCount) || 0}</td>
        <td></td>
      `;
      const actionTd = tr.lastElementChild;
      const relBtn = document.createElement("button");
      relBtn.type = "button";
      relBtn.className = "note-card-action-btn danger";
      relBtn.textContent = "🔓 שחרר כינוי";
      relBtn.onclick = () => adminReleaseNickname(u.userId, u.name);
      actionTd.appendChild(relBtn);
      tbody.appendChild(tr);
    });

    listWrap.innerHTML = "";
    listWrap.appendChild(table);
  }

  function jumpToQuestionFromAdmin(qId) {
    const q = Q_MAP.get(qId);
    if (!q) {
      showToast("⚠️ השאלה מוסתרת כרגע — שחזר אותה כדי לצפות בה בתרגול.");
      return;
    }
    closeAdminDashboardModal();
    filters.exams.clear();
    filters.subjects.clear();
    filters.status = "all";
    filters.search = "";
    el("searchInput").value = "";
    el("clearSearchBtn").classList.add("hidden");
    el("statusChips").querySelectorAll(".chip").forEach((x) => x.classList.toggle("active", x.dataset.status === "all"));
    renderFilterChips();
    switchMode("practice");
    applyFilters(qId);
  }

  function renderAdminOverridesTab() {
    const term = (el("adminOverridesSearch")?.value || "").trim().toLowerCase();
    const listWrap = el("adminOverridesList");
    listWrap.innerHTML = "";

    const entries = Object.entries(questionOverrides)
      .map(([qId, ov]) => ({ qId, ov, rawQ: RAW_Q_MAP.get(qId) }))
      .filter(({ qId, ov, rawQ }) => {
        if (!ov) return false;
        if (adminOverridesFilter === "hidden" && !ov.hidden) return false;
        if (adminOverridesFilter === "edited" && ov.hidden) return false;
        if (!term) return true;
        const stem = ov.stem || rawQ?.stem || "";
        const hay = `${qId} ${rawQ?.exam || ""} ${rawQ?.num || ""} ${ov.subject || rawQ?.subject || ""} ${stem}`.toLowerCase();
        return hay.includes(term);
      })
      .sort((a, b) => (b.ov.updatedAt || 0) - (a.ov.updatedAt || 0));

    if (entries.length === 0) {
      listWrap.innerHTML = `<div class="community-notes-empty" style="padding:16px;">אין שאלות ערוכות או מוסתרות התואמות לסינון.</div>`;
      return;
    }

    entries.forEach(({ qId, ov, rawQ }) => {
      const card = document.createElement("div");
      card.className = "admin-feed-card" + (ov.hidden ? " is-hidden-q" : "");

      const head = document.createElement("div");
      head.className = "admin-feed-head";

      const badges = document.createElement("div");
      badges.className = "admin-feed-badges";

      const badge = document.createElement("span");
      badge.className = "admin-status-badge" + (ov.hidden ? " hidden-badge" : "");
      badge.textContent = ov.hidden ? "🗑️ מוסתרת" : "✏️ ערוכה";

      const refSpan = document.createElement("strong");
      refSpan.textContent = rawQ ? `${rawQ.exam} · שאלה ${rawQ.num}` : qId;

      const timeSpan = document.createElement("span");
      timeSpan.className = "muted";
      timeSpan.textContent = formatNoteTime(ov.updatedAt);

      badges.append(badge, refSpan, timeSpan);

      const actions = document.createElement("div");
      actions.className = "admin-feed-actions";

      if (!ov.hidden) {
        const jumpBtn = document.createElement("button");
        jumpBtn.type = "button";
        jumpBtn.className = "note-card-action-btn";
        jumpBtn.textContent = "🔍 קפוץ לשאלה";
        jumpBtn.onclick = () => jumpToQuestionFromAdmin(qId);
        actions.appendChild(jumpBtn);
      }

      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "note-card-action-btn";
      editBtn.textContent = "✏️ ערוך";
      editBtn.onclick = () => openAdminQuestionModal(qId);
      actions.appendChild(editBtn);

      if (ov.hidden) {
        const restoreBtn = document.createElement("button");
        restoreBtn.type = "button";
        restoreBtn.className = "note-card-action-btn";
        restoreBtn.textContent = "♻️ שחזר";
        restoreBtn.onclick = () => adminToggleHideQuestion(qId, false);
        actions.appendChild(restoreBtn);
      }

      const resetBtn = document.createElement("button");
      resetBtn.type = "button";
      resetBtn.className = "note-card-action-btn danger";
      resetBtn.textContent = "↩️ אפס למקור";
      resetBtn.onclick = () => resetAdminQuestionOverride(qId);
      actions.appendChild(resetBtn);

      head.append(badges, actions);

      const preview = document.createElement("div");
      preview.className = "admin-feed-text";
      const stemText = (ov.stem || rawQ?.stem || "").slice(0, 180);
      preview.textContent = stemText + ((ov.stem || rawQ?.stem || "").length > 180 ? "…" : "");

      card.append(head, preview);
      listWrap.appendChild(card);
    });
  }

  function renderAdminModerationTab() {
    const term = (el("adminModerationSearch")?.value || "").trim().toLowerCase();
    const listWrap = el("adminModerationList");
    listWrap.innerHTML = "";

    const feed = [];
    if (adminModerationFilter === "all" || adminModerationFilter === "notes") {
      Object.entries(communityNotes).forEach(([qId, byUser]) => {
        if (!byUser || typeof byUser !== "object") return;
        Object.entries(byUser).forEach(([userId, entry]) => {
          if (!entry || typeof entry.text !== "string" || !entry.text.trim()) return;
          feed.push({
            kind: "note",
            qId,
            userId,
            author: entry.author || "אנונימי",
            emoji: entry.emoji || "💬",
            text: entry.text.trim(),
            updatedAt: Number(entry.updatedAt) || 0,
          });
        });
      });
    }

    if (adminModerationFilter === "all" || adminModerationFilter === "problems") {
      Object.entries(communityProblems).forEach(([qId, byUser]) => {
        if (!byUser || typeof byUser !== "object") return;
        Object.entries(byUser).forEach(([userId, entry]) => {
          if (!isValidProblemEntry(entry)) return;
          const info = PROBLEM_TYPES[entry.type] || PROBLEM_TYPES.question_issue;
          feed.push({
            kind: "problem",
            problemType: info,
            qId,
            userId,
            author: entry.author || "אנונימי",
            emoji: entry.emoji || "⚠️",
            text: (entry.text || "").trim(),
            updatedAt: Number(entry.updatedAt) || 0,
          });
        });
      });
    }

    const filteredFeed = feed
      .filter((item) => {
        if (!term) return true;
        const rawQ = RAW_Q_MAP.get(item.qId);
        const hay = `${item.author} ${item.text} ${item.qId} ${rawQ?.exam || ""} ${rawQ?.num || ""}`.toLowerCase();
        return hay.includes(term);
      })
      .sort((a, b) => b.updatedAt - a.updatedAt);

    if (filteredFeed.length === 0) {
      listWrap.innerHTML = `<div class="community-notes-empty" style="padding:16px;">לא נמצאו תגובות או דיווחים תואמים.</div>`;
      return;
    }

    filteredFeed.forEach((item) => {
      const rawQ = RAW_Q_MAP.get(item.qId);
      const card = document.createElement("div");
      card.className = "admin-feed-card";

      const head = document.createElement("div");
      head.className = "admin-feed-head";

      const badges = document.createElement("div");
      badges.className = "admin-feed-badges";

      const kindBadge = document.createElement("span");
      if (item.kind === "note") {
        kindBadge.className = "admin-status-badge";
        kindBadge.textContent = "💬 הערת קהילה";
      } else {
        kindBadge.className = `problem-type-pill ${item.problemType.id}`;
        kindBadge.textContent = `${item.problemType.emoji} ${item.problemType.label}`;
      }

      const authorStrong = document.createElement("strong");
      authorStrong.textContent = `${item.emoji} ${item.author}`;

      const qRef = document.createElement("span");
      qRef.className = "muted";
      qRef.textContent = rawQ ? `· ${rawQ.exam} · שאלה ${rawQ.num}` : `· ${item.qId}`;

      const timeSpan = document.createElement("span");
      timeSpan.className = "muted";
      timeSpan.textContent = formatNoteTime(item.updatedAt);

      badges.append(kindBadge, authorStrong, qRef, timeSpan);

      const actions = document.createElement("div");
      actions.className = "admin-feed-actions";

      const jumpBtn = document.createElement("button");
      jumpBtn.type = "button";
      jumpBtn.className = "note-card-action-btn";
      jumpBtn.textContent = "🔍 קפוץ לשאלה";
      jumpBtn.onclick = () => jumpToQuestionFromAdmin(item.qId);

      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "note-card-action-btn danger admin-del";
      delBtn.textContent = "🗑️ הסר";
      delBtn.onclick = () => {
        if (item.kind === "note") adminDeleteNote(item.qId, item.userId);
        else adminDeleteProblem(item.qId, item.userId);
      };

      actions.append(jumpBtn, delBtn);
      head.append(badges, actions);

      const textDiv = document.createElement("div");
      textDiv.className = "admin-feed-text";
      textDiv.textContent = item.text || "(ללא פירוט טקסטואלי)";

      card.append(head, textDiv);
      listWrap.appendChild(card);
    });
  }

  // ============================================================
  // Cross-Device Progress & Identity Cloud Sync
  // ============================================================

  function getDeviceLabel() {
    const ua = navigator.userAgent || "";
    if (/iPad|Macintosh.*Mobile/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) {
      return "iPad";
    }
    if (/iPhone/i.test(ua)) return "iPhone";
    if (/Android/i.test(ua)) return "Android";
    if (/Windows/i.test(ua)) return "Windows";
    if (/Mac/i.test(ua)) return "Mac";
    return "Browser";
  }

  function buildMagicLink(syncCode) {
    const formatted = formatSyncCode(syncCode) || syncCode;
    return `${window.location.origin}${window.location.pathname}${window.location.search}#sync=${formatted}`;
  }

  function countSolvedQuestions(prog = progress) {
    return prog?.attempts && typeof prog.attempts === "object" ? Object.keys(prog.attempts).length : 0;
  }

  function hasSubstantialLocalProgress(prog = progress) {
    if (countSolvedQuestions(prog) > 0) return true;
    if (Object.values(prog?.flags || {}).some((f) => f && (f.star || f.unsure || f.problem))) return true;
    if (Object.values(prog?.notes || {}).some((t) => typeof t === "string" && t.trim())) return true;
    if (Object.values(prog?.struck || {}).some((a) => Array.isArray(a) && a.length > 0)) return true;
    if (Object.values(prog?.drillStreak || {}).some((n) => Number(n) > 0)) return true;
    if (Object.values(communityNotes || {}).some((byU) => byU && byU[userIdentity.userId])) return true;
    if (Object.values(communityProblems || {}).some((byU) => byU && byU[userIdentity.userId])) return true;
    return false;
  }

  function updateSyncStatusUI() {
    const pill = el("btnSyncModal");
    const textEl = el("syncText");
    const modalStatus = el("syncProfileStatus");
    let cls = "offline";
    let label = "שמירה בדפדפן";

    if (isCloudApiConfigured()) {
      if (cloudProgressSyncState === "syncing") {
        cls = "syncing";
        label = "מסנכרן...";
      } else if (cloudProgressSyncState === "synced") {
        cls = "online";
        label = "מסונכרן בענן";
      } else if (cloudProgressSyncState === "error") {
        cls = "error";
        label = "ממתין לסנכרון";
      } else {
        cls = "offline";
        label = "שמירה בדפדפן";
      }
    } else if (serverOnline) {
      cls = "online";
      label = "מחובר לשרת (סנכרון חי)";
    }

    if (pill) {
      pill.classList.remove("offline", "online", "syncing", "error");
      pill.classList.add(cls);
    }
    if (textEl) textEl.textContent = label;
    if (modalStatus) {
      modalStatus.classList.remove("online", "error");
      if (cls === "online") modalStatus.classList.add("online");
      else if (cls === "error") modalStatus.classList.add("error");
      modalStatus.textContent = label;
    }
  }

  function renderSyncQrCode() {
    const container = el("syncQrContainer");
    if (!container || !userIdentity.syncCode) return;
    if (window.QrSvg && typeof window.QrSvg.renderSvg === "function") {
      try {
        container.innerHTML = window.QrSvg.renderSvg(buildMagicLink(userIdentity.syncCode), { size: 196 });
      } catch {
        container.textContent = "לא ניתן ליצור QR עבור כתובת זו";
      }
    }
  }

  function renderSyncModal() {
    const identEl = el("syncProfileIdentity");
    if (identEl) {
      identEl.textContent = `${userIdentity.emoji} ${userIdentity.name}${userIdentity.category ? ` · ${userIdentity.category}` : ""}`;
    }
    const statsEl = el("syncProfileStats");
    if (statsEl) {
      const solved = countSolvedQuestions(progress);
      const myNotesCount = Object.values(communityNotes || {}).filter((byU) => byU && byU[userIdentity.userId]).length;
      statsEl.textContent = `${solved} שאלות פתורות · ${myNotesCount} הערות קהילה`;
    }
    const codeEl = el("syncCodeDisplay");
    if (codeEl) {
      codeEl.textContent = userIdentity.syncCode || "---- ---- ----";
    }
    const qrWrap = el("syncQrWrap");
    if (qrWrap && !qrWrap.classList.contains("hidden")) {
      renderSyncQrCode();
    }
    const previewCard = el("syncPreviewCard");
    if (previewCard) {
      if (pendingSyncPreview) {
        el("syncPreviewTarget").textContent = `${pendingSyncPreview.identity.emoji} ${pendingSyncPreview.identity.name}${pendingSyncPreview.identity.category ? ` · ${pendingSyncPreview.identity.category}` : ""}`;
        const localSolved = countSolvedQuestions(progress);
        const cloudSolved = Number(pendingSyncPreview.summary?.solvedCount) || 0;
        el("syncPreviewCompare").textContent = `בענן: ${cloudSolved} שאלות · במכשיר זה: ${localSolved} שאלות`;
        el("syncPreviewHint").textContent = "במכשיר זה קיימת התקדמות קודמת. מומלץ למזג כדי לא לאבד שאלות שפתרת.";
        previewCard.classList.remove("hidden");
      } else {
        previewCard.classList.add("hidden");
      }
    }
    updateSyncStatusUI();
  }

  function openSyncModal() {
    const errEl = el("syncConnectError");
    if (errEl) {
      errEl.classList.add("hidden");
      errEl.textContent = "";
    }
    renderSyncModal();
    el("syncModal")?.classList.remove("hidden");
    if (isCloudApiConfigured()) {
      ensureSyncCodeRegistered();
    }
  }

  function closeSyncModal() {
    el("syncModal")?.classList.add("hidden");
  }

  async function copyTextToClipboard(text, successMsg) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        showToast(successMsg);
        return;
      }
    } catch {}
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      showToast(successMsg);
    } catch {
      showToast("⚠️ לא ניתן להעתיק אוטומטית — סמן והעתק ידנית.");
    }
  }

  async function ensureSyncCodeRegistered(retried = false) {
    if (!isCloudApiConfigured()) return false;
    if (!userIdentity.syncCode) {
      userIdentity.syncCode = generateSyncCode();
      userIdentity.syncCodeRegistered = false;
      saveUserIdentity();
    }
    if (userIdentity.syncCodeRegistered) return true;
    try {
      const res = await fetch(`${CLOUD_API_BASE}/api/sync/register-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: userIdentity.userId,
          clientSecret: userIdentity.clientSecret,
          syncCode: userIdentity.syncCode,
          name: userIdentity.name,
          emoji: userIdentity.emoji,
          category: userIdentity.category,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409 && !retried) {
        if (data.conflict) {
          if (data.takenNames && typeof data.takenNames === "object") {
            takenNamesMap = data.takenNames;
            saveTakenNamesCache();
          }
          const fresh = pickRandomIdentity(true);
          userIdentity = { ...userIdentity, name: fresh.name, emoji: fresh.emoji, category: fresh.category };
          saveUserIdentity();
          return ensureSyncCodeRegistered(true);
        }
        if (data.codeConflict) {
          userIdentity.syncCode = generateSyncCode();
          userIdentity.syncCodeRegistered = false;
          saveUserIdentity();
          return ensureSyncCodeRegistered(true);
        }
        if (data.alreadyRegistered) {
          return false;
        }
      }
      if (res.ok) {
        userIdentity.syncCodeRegistered = true;
        saveUserIdentity();
        takenNamesMap[userIdentity.name] = userIdentity.userId;
        saveTakenNamesCache();
        return true;
      }
    } catch {}
    return false;
  }

  function applyMergedCloudProgress(serverProgress, { rerender = true } = {}) {
    if (!serverProgress || typeof serverProgress !== "object") return false;
    const beforeJson = JSON.stringify(progress);
    const merged = mergeProgressPayloads(progress, serverProgress);
    merged.identity = {
      userId: userIdentity.userId,
      name: userIdentity.name,
      emoji: userIdentity.emoji,
      category: userIdentity.category,
    };
    const afterJson = JSON.stringify(merged);
    if (beforeJson === afterJson) return false;
    progress = merged;
    try {
      localStorage.setItem(STORAGE_KEY, afterJson);
    } catch {}
    updateDrillBadge();
    if (rerender && !simState.active) {
      const activeTag = document.activeElement?.id;
      if (currentMode === "analytics") {
        renderAnalytics();
      } else if (currentMode !== "exam") {
        if (activeTag === "qNoteInput") {
          // Avoid interrupting an active note draft; refresh on next navigation
          updateDrillBadge();
        } else {
          applyFilters(filteredList[currentIndex]?.id);
        }
      }
    }
    if (!el("syncModal")?.classList.contains("hidden")) {
      renderSyncModal();
    }
    return true;
  }

  function scheduleCloudProgressPush({ immediate = false, keepalive = false } = {}) {
    cloudProgressDirty = true;
    if (!isCloudApiConfigured()) return;
    if (cloudProgressPushTimer) {
      clearTimeout(cloudProgressPushTimer);
      cloudProgressPushTimer = null;
    }
    if (immediate) {
      pushCloudProgress({ keepalive });
    } else {
      cloudProgressPushTimer = setTimeout(() => {
        cloudProgressPushTimer = null;
        pushCloudProgress();
      }, 2000);
    }
  }

  async function pushCloudProgress({ keepalive = false, replace = false, retried = false } = {}) {
    if (!isCloudApiConfigured()) return false;
    if (cloudProgressSyncPromise && !keepalive) {
      await cloudProgressSyncPromise.catch(() => {});
      if (!cloudProgressDirty) return true;
    }

    const snapshotJson = JSON.stringify(progress);
    cloudProgressSyncState = "syncing";
    updateSyncStatusUI();

    const runPush = async () => {
      try {
        const res = await fetch(`${CLOUD_API_BASE}/api/progress`, {
          method: "PUT",
          keepalive: Boolean(keepalive),
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: userIdentity.userId,
            clientSecret: userIdentity.clientSecret,
            identity: {
              name: userIdentity.name,
              emoji: userIdentity.emoji,
              category: userIdentity.category,
            },
            progress,
            replace,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.status === 409 && data.conflict && !retried) {
          await registerIdentityPing(false);
          return await pushCloudProgress({ keepalive, replace, retried: true });
        }
        if (!res.ok) {
          cloudProgressSyncState = "error";
          updateSyncStatusUI();
          return false;
        }
        if (data.progress) {
          const changedLocallyDuringFlight = JSON.stringify(progress) !== snapshotJson;
          applyMergedCloudProgress(data.progress, { rerender: true });
          if (!changedLocallyDuringFlight) {
            cloudProgressDirty = false;
          } else {
            scheduleCloudProgressPush({ immediate: false });
          }
        } else {
          cloudProgressDirty = false;
        }
        cloudProgressSyncState = "synced";
        updateSyncStatusUI();
        return true;
      } catch {
        cloudProgressSyncState = "error";
        updateSyncStatusUI();
        return false;
      }
    };

    if (keepalive) {
      return runPush();
    }
    cloudProgressSyncPromise = runPush().finally(() => {
      cloudProgressSyncPromise = null;
    });
    return cloudProgressSyncPromise;
  }

  async function pullCloudProgress({ silent = true } = {}) {
    if (!isCloudApiConfigured()) return false;
    if (cloudProgressDirty) {
      return pushCloudProgress();
    }
    try {
      const res = await fetch(`${CLOUD_API_BASE}/api/progress`, {
        method: "GET",
        headers: {
          "X-User-Id": userIdentity.userId,
          "X-Client-Secret": userIdentity.clientSecret,
        },
        cache: "no-store",
      });
      if (res.status === 403) {
        cloudProgressSyncState = "error";
        updateSyncStatusUI();
        if (!silent) showToast("⚠️ חיבור המכשיר בוטל ממכשיר אחר.");
        return false;
      }
      if (!res.ok) {
        cloudProgressSyncState = "error";
        updateSyncStatusUI();
        return false;
      }
      const data = await res.json().catch(() => ({}));
      if (data.progress) {
        applyMergedCloudProgress(data.progress, { rerender: true });
        cloudProgressSyncState = "synced";
        updateSyncStatusUI();
      } else if (hasSubstantialLocalProgress(progress)) {
        await pushCloudProgress();
      } else {
        cloudProgressSyncState = "synced";
        updateSyncStatusUI();
      }
      return true;
    } catch {
      cloudProgressSyncState = "offline";
      updateSyncStatusUI();
      return false;
    }
  }

  async function syncNowManual() {
    if (!isCloudApiConfigured()) {
      showToast("⚠️ סנכרון הענן אינו זמין כרגע.");
      return;
    }
    cloudProgressSyncState = "syncing";
    updateSyncStatusUI();
    await registerIdentityPing(false);
    await ensureSyncCodeRegistered();
    const okProg = cloudProgressDirty ? await pushCloudProgress() : await pullCloudProgress({ silent: false });
    const okBoot = await bootstrapCloudState(false);
    renderSyncModal();
    if (okProg && okBoot) {
      showToast("☁️ ההתקדמות וההערות סונכרנו בהצלחה!");
    } else {
      showToast("⚠️ הסנכרון לא הושלם — בדוק חיבור לאינטרנט.");
    }
  }

  async function rotateSyncCodeFlow() {
    if (!isCloudApiConfigured()) {
      showToast("⚠️ סנכרון הענן אינו זמין כרגע.");
      return;
    }
    if (!confirm("להפיק קוד סנכרון חדש? הקוד וקישורי הקסם הקודמים יפסיקו לעבוד (מכשירים שכבר מחוברים ימשיכו לפעול).")) {
      return;
    }
    await registerIdentityPing(false);
    await ensureSyncCodeRegistered();
    const nextCode = generateSyncCode();
    try {
      const res = await fetch(`${CLOUD_API_BASE}/api/sync/rotate-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: userIdentity.userId,
          clientSecret: userIdentity.clientSecret,
          newSyncCode: nextCode,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "הפקת קוד חדש נכשלה");
      }
      userIdentity.syncCode = nextCode;
      userIdentity.syncCodeRegistered = true;
      saveUserIdentity();
      renderSyncModal();
      showToast("🔑 הופק קוד סנכרון חדש!");
    } catch (err) {
      showToast(`❌ ${err.message}`);
    }
  }

  async function revokeOtherDevicesFlow() {
    if (!isCloudApiConfigured()) {
      showToast("⚠️ סנכרון הענן אינו זמין כרגע.");
      return;
    }
    if (!confirm("לנתק את כל שאר המכשירים המחוברים לפרופיל זה? מכשיר זה יישאר מחובר.")) {
      return;
    }
    try {
      const res = await fetch(`${CLOUD_API_BASE}/api/sync/revoke-other-devices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: userIdentity.userId,
          clientSecret: userIdentity.clientSecret,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "ניתוק מכשירים נכשל");
      }
      showToast("🧹 כל שאר המכשירים נותקו מפרופיל זה.");
    } catch (err) {
      showToast(`❌ ${err.message}`);
    }
  }

  async function fetchSyncPreview(syncCode) {
    const res = await fetch(`${CLOUD_API_BASE}/api/sync/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ syncCode }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.identity) {
      throw new Error(data.error || "לא ניתן לאמת את קוד הסנכרון");
    }
    return { syncCode: formatSyncCode(syncCode), ...data };
  }

  async function previewConnectSyncCode() {
    const errEl = el("syncConnectError");
    const btn = el("btnPreviewSyncLink");
    if (errEl) {
      errEl.classList.add("hidden");
      errEl.textContent = "";
    }

    if (!isCloudApiConfigured()) {
      if (errEl) {
        errEl.textContent = "שירות הסנכרון בענן אינו מוגדר.";
        errEl.classList.remove("hidden");
      }
      return;
    }

    const rawInput = el("syncConnectInput")?.value || "";
    const normalized = normalizeSyncCode(rawInput);
    if (!normalized) {
      if (errEl) {
        errEl.textContent = "פורמט קוד לא תקין. יש להזין קוד בן 12 תווים (לדוגמה ABCD-EFGH-JKLM) או קישור קסם.";
        errEl.classList.remove("hidden");
      }
      return;
    }

    if (normalizeSyncCode(userIdentity.syncCode || "") === normalized) {
      if (errEl) {
        errEl.textContent = "מכשיר זה כבר מחובר לפרופיל של הקוד הזה.";
        errEl.classList.remove("hidden");
      }
      return;
    }

    if (btn) btn.disabled = true;
    try {
      const preview = await fetchSyncPreview(normalized);
      if (preview.identity.userId === userIdentity.userId) {
        showToast("מכשיר זה כבר מחובר לפרופיל זה.");
        return;
      }
      if (!hasSubstantialLocalProgress(progress)) {
        await completeSyncLink(preview.syncCode, "replace");
        return;
      }
      pendingSyncPreview = preview;
      renderSyncModal();
    } catch (err) {
      if (errEl) {
        errEl.textContent = err?.message || "שגיאה בבדיקת הקוד";
        errEl.classList.remove("hidden");
      }
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function completeSyncLink(syncCode, mode) {
    const errEl = el("syncConnectError");
    if (errEl) {
      errEl.classList.add("hidden");
      errEl.textContent = "";
    }
    const mergeBtn = el("btnConfirmSyncMerge");
    const replaceBtn = el("btnConfirmSyncReplace");
    if (mergeBtn) mergeBtn.disabled = true;
    if (replaceBtn) replaceBtn.disabled = true;

    const newClientSecret = generateClientSecret();
    const guestUserId = userIdentity.userId;
    const guestClientSecret = userIdentity.clientSecret;

    try {
      const res = await fetch(`${CLOUD_API_BASE}/api/sync/link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          syncCode,
          newClientSecret,
          deviceLabel: getDeviceLabel(),
          mode,
          localProgress: mode === "merge" ? progress : undefined,
          guestUserId,
          guestClientSecret,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.identity) {
        throw new Error(data.error || "החיבור נכשל");
      }

      userIdentity = {
        userId: data.identity.userId,
        name: data.identity.name,
        emoji: data.identity.emoji,
        category: data.identity.category,
        clientSecret: newClientSecret,
        syncCode: formatSyncCode(syncCode),
        syncCodeRegistered: true,
        locked: true,
      };
      identityNeedsCloudCheck = false;
      saveUserIdentity();

      const nextProgress = mergeProgressPayloads({}, data.progress || {});
      nextProgress.identity = {
        userId: userIdentity.userId,
        name: userIdentity.name,
        emoji: userIdentity.emoji,
        category: userIdentity.category,
      };
      progress = { ...defaultProgress(), ...nextProgress };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
      } catch {}

      pendingSyncPreview = null;
      cloudProgressDirty = false;
      cloudProgressSyncState = "synced";
      const inputEl = el("syncConnectInput");
      if (inputEl) inputEl.value = "";

      updateIdentityUI();
      updateDrillBadge();
      updateSyncStatusUI();
      await bootstrapCloudState(false);
      renderCurrentView();
      renderSyncModal();
      showToast(`✅ התחברת לפרופיל ${userIdentity.emoji} ${userIdentity.name}!`);
    } catch (err) {
      if (errEl) {
        errEl.textContent = err?.message || "שגיאה בחיבור הפרופיל";
        errEl.classList.remove("hidden");
      } else {
        showToast(`❌ ${err?.message || "שגיאה בחיבור הפרופיל"}`);
      }
    } finally {
      if (mergeBtn) mergeBtn.disabled = false;
      if (replaceBtn) replaceBtn.disabled = false;
    }
  }

  function extractMagicSyncCodeFromHash() {
    try {
      const hash = window.location.hash || "";
      const match = hash.match(/sync=([^&]+)/i);
      if (!match) return null;
      const normalized = normalizeSyncCode(decodeURIComponent(match[1]));
      const cleanUrl = window.location.pathname + window.location.search;
      history.replaceState(null, "", cleanUrl);
      return normalized;
    } catch {
      return null;
    }
  }

  async function handleMagicSyncOnStartup(magicCode) {
    if (!magicCode || !isCloudApiConfigured()) return false;
    if (normalizeSyncCode(userIdentity.syncCode || "") === magicCode) {
      showToast(`☁️ מכשיר זה כבר מחובר לפרופיל ${userIdentity.emoji} ${userIdentity.name}`);
      return false;
    }
    try {
      const preview = await fetchSyncPreview(magicCode);
      if (preview.identity.userId === userIdentity.userId) {
        showToast(`☁️ מכשיר זה כבר מחובר לפרופיל ${userIdentity.emoji} ${userIdentity.name}`);
        return false;
      }
      if (!hasSubstantialLocalProgress(progress)) {
        await completeSyncLink(preview.syncCode, "replace");
        return true;
      }
      pendingSyncPreview = preview;
      openSyncModal();
      return true;
    } catch (err) {
      showToast(`❌ קישור הסנכרון לא תקין: ${err?.message || "שגיאה"}`);
      return false;
    }
  }

  // Init
  const initialMagicSyncCode = extractMagicSyncCodeFromHash();
  initTheme();
  initLightbox();
  updateIdentityUI();
  updateSyncStatusUI();
  renderFilterChips();
  initExamSetup();
  updateDrillBadge();
  bindEvents();
  applyFilters();
  checkServer();

  (async () => {
    await bootstrapCloudState(false);
    const linkedMagic = initialMagicSyncCode ? await handleMagicSyncOnStartup(initialMagicSyncCode) : false;
    if (!linkedMagic) {
      await registerIdentityPing(false);
      await ensureSyncCodeRegistered();
      await pullCloudProgress({ silent: true });
    }
  })();

  initAdminAuth();

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      if (cloudProgressDirty || cloudProgressPushTimer) {
        if (cloudProgressPushTimer) {
          clearTimeout(cloudProgressPushTimer);
          cloudProgressPushTimer = null;
        }
        pushCloudProgress({ keepalive: true });
      }
    } else if (document.visibilityState === "visible") {
      const now = Date.now();
      if (now - lastVisibilityPullAt > 10000) {
        lastVisibilityPullAt = now;
        bootstrapCloudState(false);
        pullCloudProgress({ silent: true });
      }
    }
  });

  window.addEventListener("pagehide", () => {
    if (cloudProgressDirty || cloudProgressPushTimer) {
      if (cloudProgressPushTimer) {
        clearTimeout(cloudProgressPushTimer);
        cloudProgressPushTimer = null;
      }
      pushCloudProgress({ keepalive: true });
    }
  });

  setInterval(() => {
    bootstrapCloudState(false);
    pullCloudProgress({ silent: true });
  }, 45000);
})();
