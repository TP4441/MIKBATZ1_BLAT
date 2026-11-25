(() => {
  "use strict";

  const STORAGE_KEY = "med_exam_cluster1_progress_v1";
  const THEME_KEY = "med_exam_theme_v1";
  const IDENTITY_KEY = "med_exam_user_identity_v1";
  const DEVICE_ID_KEY = "med_exam_device_id_v1";
  const ONBOARDING_SEEN_KEY = "med_exam_onboarding_v1_seen";
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
  let currentMode = "practice"; // practice | exam | drill | flashcard | analytics | leaderboard
  let communityNotes = loadCommunityNotesCache(); // { qId: { userId: { author, emoji, category, text, updatedAt } } }
  let communityProblems = loadCommunityProblemsCache(); // { qId: { userId: { type, text, author, emoji, category, updatedAt } } }
  let questionOverrides = loadQuestionOverridesCache(); // { qId: { hidden, stem, options, correct, allAccepted, appealNote, subject, updatedAt } }
  let takenNamesMap = loadTakenNamesCache(); // { name: userId }
  let identityNeedsCloudCheck = false;
  let deviceId = loadOrInitDeviceId();
  let userIdentity = loadOrInitIdentity();
  let progress = loadProgress();
  const CLOUD_POLL_INTERVAL_MS = 90000;
  const USER_IDLE_TIMEOUT_MS = 180000;
  const VISIBILITY_POLL_COOLDOWN_MS = 15000;
  let cloudProgressSyncState = isCloudApiConfigured() ? "synced" : "offline";
  let cloudProgressDirty = false;
  let cloudProgressPushTimer = null;
  let cloudProgressSyncPromise = null;
  let lastVisibilityPullAt = Date.now();
  let lastCommunityVersion = 0;
  let lastSyncedProgressVersion = 0;
  let lastUserActivityAt = Date.now();
  let lastActivityThrottleAt = 0;
  let lastCloudPollAt = 0;
  let cloudPollInFlight = null;
  let pendingSyncPreview = null;
  let onlineUsersList = [];
  let onlineUsersLoaded = false;
  let onlineUsersLoading = false;
  let onlineUsersServerTimeOffset = 0;
  let leaderboardEntries = [];
  let leaderboardLoaded = false;
  let leaderboardLoading = false;
  let leaderboardError = false;
  let leaderboardSort = "answers"; // "answers" | "notes"
  let leaderboardLastFetchedAt = 0;
  let cloudCommunityLoaded = false;
  let lastNoteMutationAt = 0;
  let identityRegisteredInCloud = false;
  let filteredList = [];
  let currentIndex = 0;
  let optionPermutations = new Map(); // qId -> array of original indices
  let shuffleOptionsEnabled = false;
  let shuffledQuestionOrder = null; // null or array of qIds
  let drillShuffledOrder = null;    // null or array of qIds for drill mode
  let lastQIdByMode = {};           // mode -> last viewed qId
  let lastIndexByMode = {};         // mode -> fallback index
  let isRestoringSession = false;
  let hasUserInteractedWithNav = false;
  let flashcardRevealed = false;
  let sessionAnswered = 0;
  let sessionCorrect = 0;
  let notesExpanded = false; // Always closed by default (strict manual spoiler toggle)
  let lastRenderedQId = null;
  let markerMode = false;
  let pendingMarkerSelection = null; // { qId, stemEl, start, end }
  let markerSelectionTimer = null;
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
    statuses: new Set(), // empty = all
    search: "",
    mergePathology: true,
  };

  // Separate filter state for Drill ("תיקון טעויות") so practice filters don't leak into mistakes
  const drillFilters = {
    exams: new Set(), // empty = all
    subjects: new Set(), // empty = all
    search: "",
  };

  function getActiveFilters() {
    return currentMode === "drill" ? drillFilters : filters;
  }

  function getActiveShuffledOrder() {
    return currentMode === "drill" ? drillShuffledOrder : shuffledQuestionOrder;
  }

  function setActiveShuffledOrder(order) {
    if (currentMode === "drill") {
      drillShuffledOrder = order;
    } else {
      shuffledQuestionOrder = order;
    }
  }

  // Exam simulation state
  let simState = {
    active: false,
    questions: [],
    answers: new Map(), // qId -> selected original option idx
    flagged: new Set(),
    struck: new Map(), // qId -> Set of original option idx
    currentIndex: 0,
    secondsLeft: 0,
    hasTimer: false,
    label: "",
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

  // Onboarding tour state
  let tourState = {
    active: false,
    stepIndex: 0,
    steps: [],
    returnMode: null,
    pendingAfterSyncModal: false,
    manual: false,
  };
  let tourScrollTimer = null;

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
      highlights: {}, // qId -> [start, end][]
      highlightUpdatedAt: {}, // qId -> ts
      drillStreak: {}, // qId -> number (0..2)
      drillStreakUpdatedAt: {}, // qId -> ts
      dailyStats: {},  // YYYY-MM-DD -> { answered: number, correct: number }
      dailyStatsByDevice: {}, // deviceId -> { YYYY-MM-DD -> { answered, correct } }
      dailyStatsUpdatedAt: 0,
      studySession: null,
      studySessionUpdatedAt: 0,
      activeSim: null,
      activeSimUpdatedAt: 0,
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

  const VALID_STUDY_MODES = new Set(["practice", "flashcard", "drill"]);
  const MAX_SESSION_ARRAY_LEN = 2000;

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

    return {
      label: typeof raw.label === "string" ? raw.label.slice(0, 160) : "",
      questionIds,
      answers,
      flagged,
      struck,
      currentIndex,
      secondsLeft,
      hasTimer,
      shuffleOpts: Boolean(raw.shuffleOpts),
      deviceId: typeof raw.deviceId === "string" ? raw.deviceId.slice(0, 80) : "",
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
      const cleanRanges = normalizeHighlightRanges(winArr);
      if (cleanRanges.length > 0) {
        merged.highlights[qId] = cleanRanges;
      }
      merged.highlightUpdatedAt[qId] = winTs;
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

  function showToast(msg, options = {}) {
    const { actionLabel = "", onAction = null, duration = 3200 } = options || {};
    const container = el("toastContainer");
    if (!container) return;
    const t = document.createElement("div");
    t.className = "toast";

    const textSpan = document.createElement("span");
    textSpan.className = "toast-msg";
    textSpan.textContent = msg;
    t.appendChild(textSpan);

    let timerId = null;
    if (actionLabel && typeof onAction === "function") {
      t.classList.add("has-action");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "toast-action-btn";
      btn.textContent = actionLabel;
      btn.onclick = () => {
        if (timerId) clearTimeout(timerId);
        t.remove();
        onAction();
      };
      t.appendChild(btn);
    }

    container.appendChild(t);
    timerId = setTimeout(() => t.remove(), duration);
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
    if (cloudCommunityLoaded && !pendingDirtyQIds.has(qId)) return "";
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
    lastNoteMutationAt = Date.now();
    leaderboardLastFetchedAt = 0;
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
        identityRegisteredInCloud = true;
        takenNamesMap[userIdentity.name] = userIdentity.userId;
        saveTakenNamesCache();
        if (Array.isArray(data.onlineUsers)) {
          updateOnlineUsersState(data.onlineUsers, {
            loaded: true,
            serverTime: Number(data.serverTime) || 0,
          });
        }
        return true;
      }
    } catch {}
    return false;
  }

  function updateOnlineUsersState(users, { loaded = true, serverTime = 0 } = {}) {
    if (serverTime > 0) {
      onlineUsersServerTimeOffset = serverTime - Date.now();
    }
    if (Array.isArray(users)) {
      const deduped = new Map();
      users.forEach((u) => {
        if (!u || typeof u !== "object") return;
        const userId = String(u.userId || "").trim();
        const name = String(u.name || "").trim();
        if (!userId || !name) return;
        const prev = deduped.get(userId);
        const lastSeenAt = Number(u.lastSeenAt) || 0;
        if (!prev || lastSeenAt > prev.lastSeenAt) {
          deduped.set(userId, {
            userId,
            name,
            emoji: String(u.emoji || "👤").trim(),
            category: String(u.category || "").trim(),
            lastSeenAt,
          });
        }
      });
      onlineUsersList = Array.from(deduped.values());
    }
    onlineUsersLoaded = loaded;
    renderOnlineUsersUI();
  }

  function formatOnlineRelativeTime(lastSeenAt) {
    if (!lastSeenAt) return "מחובר";
    const approxServerNow = Date.now() + onlineUsersServerTimeOffset;
    const diffSec = Math.max(0, Math.floor((approxServerNow - lastSeenAt) / 1000));
    if (diffSec < 50) return "פעיל עכשיו";
    const mins = Math.max(1, Math.round(diffSec / 60));
    return mins === 1 ? "לפני דקה" : `לפני ${mins} דק׳`;
  }

  function renderOnlineUsersUI() {
    const countEl = el("onlineUsersCount");
    const btnEl = el("btnOnlineUsers");
    const popoverEl = el("onlineUsersPopover");
    const titleEl = el("onlinePopoverTitle");
    const subEl = el("onlinePopoverSub");
    const listEl = el("onlineUsersList");
    const refreshBtn = el("btnRefreshOnlineUsers");

    const count = onlineUsersList.length;
    const isLive = onlineUsersLoaded && isCloudApiConfigured();

    if (countEl) {
      countEl.textContent = onlineUsersLoaded ? String(count) : "—";
    }
    if (btnEl) {
      btnEl.classList.toggle("is-live", isLive);
      const label = onlineUsersLoaded
        ? `מחוברים עכשיו: ${count} — לחץ לצפייה בשמות`
        : "מחוברים עכשיו — לחץ לצפייה";
      btnEl.title = label;
      btnEl.setAttribute("aria-label", label);
    }
    if (popoverEl) {
      popoverEl.classList.toggle("is-live", isLive);
    }
    if (refreshBtn) {
      refreshBtn.classList.toggle("is-spinning", onlineUsersLoading);
      refreshBtn.disabled = onlineUsersLoading;
    }

    if (!popoverEl || popoverEl.classList.contains("hidden")) return;

    if (titleEl) {
      titleEl.textContent = onlineUsersLoaded ? `מחוברים עכשיו (${count})` : "מחוברים עכשיו";
    }
    if (subEl) {
      if (!isCloudApiConfigured()) {
        subEl.textContent = "מצב לא מקוון — סנכרון ענן אינו פעיל";
      } else if (onlineUsersLoading && !onlineUsersLoaded) {
        subEl.textContent = "טוען רשימת מחוברים...";
      } else {
        subEl.textContent = "פעילים ב-3 הדקות האחרונות";
      }
    }
    if (!listEl) return;

    if (!isCloudApiConfigured()) {
      listEl.innerHTML = `<li class="online-users-empty">חיבור הענן כבוי כרגע.</li>`;
      return;
    }

    if (!onlineUsersLoaded) {
      listEl.innerHTML = onlineUsersLoading
        ? `<li class="online-users-empty">בודק מי מחובר...</li>`
        : `<li class="online-users-empty">לא ניתן לטעון כרגע את רשימת המחוברים.</li>`;
      return;
    }

    if (onlineUsersList.length === 0) {
      listEl.innerHTML = `<li class="online-users-empty">אין משתמשים פעילים ב-3 הדקות האחרונות.</li>`;
      return;
    }

    const sorted = [...onlineUsersList].sort((a, b) => {
      const aMe = a.userId === userIdentity.userId;
      const bMe = b.userId === userIdentity.userId;
      if (aMe !== bMe) return aMe ? -1 : 1;
      return b.lastSeenAt - a.lastSeenAt;
    });

    listEl.innerHTML = sorted
      .map((u) => {
        const isMe = u.userId === userIdentity.userId;
        return `<li class="online-user-item${isMe ? " is-me" : ""}">
          <span class="online-user-main">
            <span class="online-user-emoji" aria-hidden="true">${escapeHtml(u.emoji)}</span>
            <span class="online-user-name">${escapeHtml(u.name)}</span>
            ${isMe ? `<span class="online-user-me-badge">את/ה</span>` : ""}
          </span>
          <span class="online-user-meta">
            <span class="online-user-dot" aria-hidden="true"></span>
            <span>${escapeHtml(formatOnlineRelativeTime(u.lastSeenAt))}</span>
          </span>
        </li>`;
      })
      .join("");
  }

  async function refreshOnlineUsers({ pingMe = false } = {}) {
    if (!isCloudApiConfigured()) {
      renderOnlineUsersUI();
      return false;
    }
    if (onlineUsersLoading) return false;
    onlineUsersLoading = true;
    renderOnlineUsersUI();
    try {
      if ((pingMe || !identityRegisteredInCloud) && !identityNeedsCloudCheck) {
        const pinged = await registerIdentityPing(false);
        if (pinged && onlineUsersLoaded) {
          return true;
        }
      }
      const res = await fetch(`${CLOUD_API_BASE}/api/online`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        updateOnlineUsersState(Array.isArray(data?.onlineUsers) ? data.onlineUsers : [], {
          loaded: true,
          serverTime: Number(data?.serverTime) || 0,
        });
        return true;
      }
    } catch {}
    finally {
      onlineUsersLoading = false;
      renderOnlineUsersUI();
    }
    return false;
  }

  function openOnlineUsersPopover() {
    const popoverEl = el("onlineUsersPopover");
    const btnEl = el("btnOnlineUsers");
    if (!popoverEl) return;
    popoverEl.classList.remove("hidden");
    if (btnEl) btnEl.setAttribute("aria-expanded", "true");
    renderOnlineUsersUI();
    refreshOnlineUsers({ pingMe: true });
  }

  function closeOnlineUsersPopover() {
    const popoverEl = el("onlineUsersPopover");
    const btnEl = el("btnOnlineUsers");
    if (!popoverEl || popoverEl.classList.contains("hidden")) return;
    popoverEl.classList.add("hidden");
    if (btnEl) btnEl.setAttribute("aria-expanded", "false");
  }

  function toggleOnlineUsersPopover() {
    const popoverEl = el("onlineUsersPopover");
    if (!popoverEl) return;
    if (popoverEl.classList.contains("hidden")) {
      openOnlineUsersPopover();
    } else {
      closeOnlineUsersPopover();
    }
  }

  async function fetchBootstrapPayload() {
    if (isCloudApiConfigured()) {
      try {
        const res = await fetch(`${CLOUD_API_BASE}/api/bootstrap`, { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          return {
            source: "cloud",
            communityVersion: Number(data?.communityVersion) || 0,
            notes: data?.notes && typeof data.notes === "object" ? data.notes : {},
            problems: data?.problems && typeof data.problems === "object" ? data.problems : {},
            overrides: data?.overrides && typeof data.overrides === "object" ? data.overrides : {},
            takenNames: data?.takenNames && typeof data.takenNames === "object" ? data.takenNames : {},
            onlineUsers: Array.isArray(data?.onlineUsers) ? data.onlineUsers : null,
            serverTime: Number(data?.serverTime) || 0,
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
      return { source: "local", communityVersion: 0, notes, problems, overrides, takenNames: takenNamesMap };
    }
    throw new Error("Cloud API unreachable");
  }

  function applyCloudCommunityPayload(
    {
      notes = null,
      problems = null,
      overrides = null,
      takenNames = null,
      onlineUsers = null,
      serverTime = 0,
      communityVersion = 0,
      mirrorToLocalServer = false,
      runIdentityCheck = false,
      fromCloud = false,
    } = {}
  ) {
    if (communityVersion > 0) {
      lastCommunityVersion = communityVersion;
    }

    if (Array.isArray(onlineUsers)) {
      updateOnlineUsersState(onlineUsers, {
        loaded: true,
        serverTime: Number(serverTime) || 0,
      });
    }

    const hasCommunityData = Boolean(notes || problems || overrides || takenNames);
    if (!hasCommunityData) return;

    const prevOverridesJson = JSON.stringify(questionOverrides);

    if (notes && typeof notes === "object") {
      mergeCloudIntoLocal({ version: 1, notes });
    }
    if (problems && typeof problems === "object") {
      mergeCloudProblemsIntoLocal({ version: 1, problems });
    }
    if (fromCloud) {
      cloudCommunityLoaded = true;
      let progressReconciled = false;
      if (notes && typeof notes === "object" && progress.notes && typeof progress.notes === "object") {
        Object.keys(progress.notes).forEach((qId) => {
          if (pendingDirtyQIds.has(qId)) return;
          const cloudMine = communityNotes[qId]?.[userIdentity.userId];
          if (!cloudMine || typeof cloudMine.text !== "string" || !cloudMine.text.trim()) {
            delete progress.notes[qId];
            progressReconciled = true;
          }
        });
      }
      if (problems && typeof problems === "object" && progress.flags && typeof progress.flags === "object") {
        Object.keys(progress.flags).forEach((qId) => {
          if (pendingProblemDirtyQIds.has(qId)) return;
          if (progress.flags[qId]?.problem && !isValidProblemEntry(communityProblems[qId]?.[userIdentity.userId])) {
            delete progress.flags[qId].problem;
            if (Object.keys(progress.flags[qId]).length === 0) {
              delete progress.flags[qId];
            }
            progressReconciled = true;
          }
        });
      }
      if (progressReconciled) {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
        } catch {}
      }
    }
    if (takenNames && typeof takenNames === "object") {
      takenNamesMap = takenNames;
      saveTakenNamesCache();
    }
    if (overrides && typeof overrides === "object") {
      questionOverrides = overrides;
      saveQuestionOverridesCache();
    }

    if (runIdentityCheck && identityNeedsCloudCheck) {
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

    if (mirrorToLocalServer && serverOnline) {
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
      if (filteredList.length > 0 && currentMode !== "exam" && currentMode !== "analytics" && currentMode !== "leaderboard") {
        renderNotesSection(filteredList[currentIndex], true);
      }
      refreshActiveQuestionProblemViews();
      updateProblemSyncBadge();
    }
  }

  async function bootstrapCloudState(showFeedback = false) {
    try {
      const data = await fetchBootstrapPayload();
      applyCloudCommunityPayload({
        notes: data.notes,
        problems: data.problems,
        overrides: data.overrides,
        takenNames: data.takenNames,
        onlineUsers: data.onlineUsers,
        serverTime: data.serverTime,
        communityVersion: Number(data.communityVersion) || 0,
        mirrorToLocalServer: data.source === "cloud",
        runIdentityCheck: true,
        fromCloud: data.source === "cloud",
      });

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
    const hasLegacyFlag = !cloudCommunityLoaded && !!fl.problem;
    btnEl.classList.toggle("active", hasMine || hasLegacyFlag);
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
        editBtn.textContent = "✏️ ערוך";
        editBtn.onclick = () => openProblemModal(q.id);

        const delBtn = document.createElement("button");
        delBtn.type = "button";
        delBtn.className = "note-card-action-btn danger";
        delBtn.title = "הסר דיווח";
        delBtn.textContent = "🗑️ הסר";
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
    const hasProblemFlag = Boolean(progress.flags[qId]?.problem);
    const chosenType = hasValidMine && PROBLEM_TYPES[mine.type] ? mine.type : "question_issue";

    document.querySelectorAll('input[name="problemType"]').forEach((r) => {
      r.checked = r.value === chosenType;
    });
    el("problemDetailInput").value = hasValidMine ? (mine.text || "") : "";
    el("btnSubmitProblem").textContent = hasValidMine ? "💾 עדכן אזהרה" : "⚠️ פרסם אזהרה לכולם";
    const delBtn = el("btnDeleteMyProblem");
    delBtn.textContent = hasValidMine ? "🗑️ הסר דיווח שלי" : "🗑️ הסר סימון בעיה";
    delBtn.classList.toggle("hidden", !(hasValidMine || hasProblemFlag));

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
    if (currentMode !== "analytics" && currentMode !== "leaderboard" && filteredList.length > 0) {
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
    const hadCommunityProblem = Boolean(communityProblems[qId]?.[userIdentity.userId]);
    if (progress.flags[qId]?.problem) {
      delete progress.flags[qId].problem;
      if (Object.keys(progress.flags[qId]).length === 0) {
        delete progress.flags[qId];
      }
      if (!progress.flagUpdatedAt) progress.flagUpdatedAt = {};
      if (!progress.flagUpdatedAt[qId]) progress.flagUpdatedAt[qId] = {};
      progress.flagUpdatedAt[qId].problem = Date.now();
      saveProgress();
    }
    if (hadCommunityProblem) {
      delete communityProblems[qId][userIdentity.userId];
      if (Object.keys(communityProblems[qId]).length === 0) {
        delete communityProblems[qId];
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
    } else {
      if (activeProblemModalQId === qId) closeProblemModal();
      refreshActiveQuestionProblemViews();
      showToast("🗑️ סימון הבעיה הוסר.");
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

        if (filteredList.length > 0 && currentMode !== "exam" && currentMode !== "analytics" && currentMode !== "leaderboard") {
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
          const srvAttempts = Object.keys(srvProg?.attempts || {}).length;
          const curAttempts = Object.keys(progress.attempts || {}).length;
          const srvStudyTs = Number(srvProg?.studySessionUpdatedAt) || 0;
          const curStudyTs = Number(progress.studySessionUpdatedAt) || 0;
          const srvSimTs = Number(srvProg?.activeSimUpdatedAt) || 0;
          const curSimTs = Number(progress.activeSimUpdatedAt) || 0;
          if (srvProg && (srvAttempts > curAttempts || srvStudyTs > curStudyTs || srvSimTs > curSimTs)) {
            progress = { ...defaultProgress(), ...mergeProgressPayloads(progress, srvProg) };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
            const nextStudyTs = Number(progress.studySessionUpdatedAt) || 0;
            if (!hasUserInteractedWithNav && !simState.active && progress.studySession && nextStudyTs > curStudyTs) {
              applyStudySessionState(progress.studySession, { showToastInfo: false });
            } else {
              renderCurrentView();
            }
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

  function getStatusKeys() {
    return Array.from(el("statusChips").querySelectorAll(".chip[data-status]"))
      .map((c) => c.dataset.status)
      .filter(Boolean);
  }

  // Build filter chips
  function renderFilterChips() {
    const activeFilters = getActiveFilters();
    const isDrill = currentMode === "drill";
    let drillExamCounts = null;
    let drillSubjCounts = null;
    if (isDrill) {
      drillExamCounts = new Map();
      drillSubjCounts = new Map();
      for (const q of getDrillQuestions()) {
        drillExamCounts.set(q.exam, (drillExamCounts.get(q.exam) || 0) + 1);
        const s = getSubject(q);
        drillSubjCounts.set(s, (drillSubjCounts.get(s) || 0) + 1);
      }
    }

    const examWrap = el("examChips");
    examWrap.innerHTML = "";
    EXAMS.forEach((ex) => {
      const count = isDrill ? (drillExamCounts.get(ex.name) || 0) : ex.expectedCount;
      const isSelected = activeFilters.exams.has(ex.name);
      const btn = document.createElement("button");
      btn.className = "chip" + (isSelected ? " active" : "") + (isDrill && count === 0 && !isSelected ? " chip-empty" : "");
      btn.textContent = `${ex.name} (${count})`;
      btn.onclick = () => {
        hasUserInteractedWithNav = true;
        if (activeFilters.exams.has(ex.name)) activeFilters.exams.delete(ex.name);
        else activeFilters.exams.add(ex.name);
        renderFilterChips();
        applyFilters();
        persistStudySession();
      };
      examWrap.appendChild(btn);
    });

    const subjWrap = el("subjectChips");
    subjWrap.innerHTML = "";
    getUniqueSubjects().forEach((subj) => {
      const count = isDrill ? (drillSubjCounts.get(subj) || 0) : null;
      const isSelected = activeFilters.subjects.has(subj);
      const btn = document.createElement("button");
      btn.className = "chip" + (isSelected ? " active" : "") + (isDrill && count === 0 && !isSelected ? " chip-empty" : "");
      btn.textContent = isDrill ? `${formatSubject(subj)} (${count})` : formatSubject(subj);
      btn.onclick = () => {
        hasUserInteractedWithNav = true;
        if (activeFilters.subjects.has(subj)) activeFilters.subjects.delete(subj);
        else activeFilters.subjects.add(subj);
        renderFilterChips();
        applyFilters();
        persistStudySession();
      };
      subjWrap.appendChild(btn);
    });

    el("statusChips").querySelectorAll(".chip[data-status]").forEach((c) => {
      c.classList.toggle("active", filters.statuses.has(c.dataset.status));
    });
  }

  function matchesQuestionStatus(statusKey, q, att, fl, myNote, qCommNotes, qProblems) {
    switch (statusKey) {
      case "unsolved": return !att;
      case "wrong": return !!att && !att.isCorrect;
      case "starred": return !!fl.star;
      case "unsure": return !!fl.unsure;
      case "problematic": return qProblems.length > 0 || (!cloudCommunityLoaded && !!fl.problem);
      case "with_image": return q.images.length > 0;
      case "with_note": return !!myNote;
      case "with_any_note": return qCommNotes.length > 0 || !!myNote;
      default: return false;
    }
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

  function isStudyMode(mode = currentMode) {
    return VALID_STUDY_MODES.has(mode);
  }

  function setFilterPanelCollapsed(collapsed) {
    const body = el("filterBody");
    const btn = el("btnToggleFilters");
    const label = el("filterToggleLabel");
    if (body) body.classList.toggle("hidden", Boolean(collapsed));
    if (btn) btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
    if (label) label.textContent = collapsed ? "סינון" : "צמצם";
  }

  function setShuffleOptionsEnabled(enabled) {
    shuffleOptionsEnabled = Boolean(enabled);
    optionPermutations.clear();
    ["btnShuffleOptions", "btnShuffleOptionsMobile"].forEach((id) => {
      const b = el(id);
      if (!b) return;
      b.classList.toggle("btn-primary", shuffleOptionsEnabled);
      b.classList.toggle("btn-secondary", !shuffleOptionsEnabled);
    });
  }

  function recordCurrentModePosition() {
    if (!isStudyMode(currentMode)) return;
    const curQ = filteredList[currentIndex];
    if (curQ?.id) {
      lastQIdByMode[currentMode] = curQ.id;
    }
    lastIndexByMode[currentMode] = Math.max(0, currentIndex);
  }

  function persistStudySession({ syncCloud = true } = {}) {
    if (isRestoringSession) return;
    recordCurrentModePosition();
    const prevMode = progress.studySession?.mode;
    const activeStudyMode = isStudyMode(currentMode)
      ? currentMode
      : isStudyMode(prevMode)
      ? prevMode
      : "practice";
    progress.studySession = {
      mode: activeStudyMode,
      filters: {
        exams: Array.from(filters.exams),
        subjects: Array.from(filters.subjects),
        statuses: Array.from(filters.statuses),
        search: filters.search,
        mergePathology: Boolean(filters.mergePathology),
      },
      filterCollapsed: Boolean(el("filterBody")?.classList.contains("hidden")),
      shuffleOptions: Boolean(shuffleOptionsEnabled),
      shuffledOrder: Array.isArray(shuffledQuestionOrder) ? [...shuffledQuestionOrder] : null,
      drillFilters: {
        exams: Array.from(drillFilters.exams),
        subjects: Array.from(drillFilters.subjects),
        search: drillFilters.search,
      },
      drillShuffledOrder: Array.isArray(drillShuffledOrder) ? [...drillShuffledOrder] : null,
      lastQIdByMode: { ...lastQIdByMode },
      lastIndexByMode: { ...lastIndexByMode },
      deviceId,
    };
    progress.studySessionUpdatedAt = Date.now();
    saveProgress({ syncCloud });
  }

  function recomputeFilteredList({ preserveShuffle = false } = {}) {
    const isDrill = currentMode === "drill";
    const activeFilters = getActiveFilters();

    if (!preserveShuffle) {
      setActiveShuffledOrder(null);
    }

    const basePool = isDrill ? getDrillQuestions() : QUESTIONS;
    const term = activeFilters.search.trim().toLowerCase();

    filteredList = basePool.filter((q) => {
      if (activeFilters.exams.size > 0 && !activeFilters.exams.has(q.exam)) return false;
      const s = getSubject(q);
      if (activeFilters.subjects.size > 0 && !activeFilters.subjects.has(s)) return false;

      const att = progress.attempts[q.id];
      const fl = progress.flags[q.id] || {};
      const myNote = getMyNoteText(q.id).trim();
      const qCommNotes = getQuestionCommunityNotesList(q.id);
      const qProblems = getQuestionProblemsList(q.id);

      if (!isDrill && filters.statuses.size > 0) {
        let anyStatusMatch = false;
        for (const st of filters.statuses) {
          if (matchesQuestionStatus(st, q, att, fl, myNote, qCommNotes, qProblems)) {
            anyStatusMatch = true;
            break;
          }
        }
        if (!anyStatusMatch) return false;
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

    const activeOrder = getActiveShuffledOrder();
    if (preserveShuffle && Array.isArray(activeOrder) && activeOrder.length > 0) {
      const orderMap = new Map(activeOrder.map((id, idx) => [id, idx]));
      filteredList.sort((a, b) => {
        const ia = orderMap.has(a.id) ? orderMap.get(a.id) : Number.MAX_SAFE_INTEGER;
        const ib = orderMap.has(b.id) ? orderMap.get(b.id) : Number.MAX_SAFE_INTEGER;
        return ia - ib;
      });
    }

    updateFilterCountsUI(basePool.length);
  }

  function updateFilterCountsUI(totalPoolCount = null) {
    const isDrill = currentMode === "drill";
    const activeFilters = getActiveFilters();
    const poolCount = totalPoolCount !== null
      ? totalPoolCount
      : (isDrill ? getDrillQuestions().length : QUESTIONS.length);

    el("filteredCountText").textContent = isDrill
      ? (poolCount === 0
        ? "אין שאלות שממתינות לתיקון"
        : `מציג ${filteredList.length} מתוך ${poolCount} שאלות לתיקון`)
      : `מציג ${filteredList.length} מתוך ${poolCount} שאלות`;
    el("jumpInput").max = Math.max(1, filteredList.length);

    const totalExams = EXAMS.length;
    const totalSubjs = getUniqueSubjects().length;
    const hasExamFilter = activeFilters.exams.size > 0 && activeFilters.exams.size < totalExams;
    const hasSubjectFilter = activeFilters.subjects.size > 0 && activeFilters.subjects.size < totalSubjs;
    const hasStatusFilter = !isDrill && filters.statuses.size > 0;
    const hasCustomFilter = hasExamFilter || hasSubjectFilter || hasStatusFilter || !!activeFilters.search.trim();

    const summaryParts = [];
    if (hasExamFilter) summaryParts.push(`${activeFilters.exams.size} מועדים`);
    if (hasSubjectFilter) summaryParts.push(`${activeFilters.subjects.size} מקצועות`);
    if (hasStatusFilter) summaryParts.push(filters.statuses.size === 1 ? "מסונן" : `${filters.statuses.size} סטטוסים`);
    const prefix = summaryParts.length > 0 ? summaryParts.join(" · ") : "הכל";
    el("filterSummaryBadge").textContent = `${prefix} · ${filteredList.length}/${poolCount}`;
    el("filterActiveDot").classList.toggle("hidden", !hasCustomFilter);
  }

  function applyFilters(keepCurrentId = null, { preserveShuffle = false, fallbackIndex = null } = {}) {
    recomputeFilteredList({ preserveShuffle });

    if (keepCurrentId) {
      const idx = filteredList.findIndex((q) => q.id === keepCurrentId);
      if (idx >= 0) {
        currentIndex = idx;
      } else if (Number.isInteger(fallbackIndex) && filteredList.length > 0) {
        currentIndex = Math.max(0, Math.min(filteredList.length - 1, fallbackIndex));
      } else {
        currentIndex = 0;
      }
    } else if (Number.isInteger(fallbackIndex) && filteredList.length > 0) {
      currentIndex = Math.max(0, Math.min(filteredList.length - 1, fallbackIndex));
    } else {
      currentIndex = 0;
    }

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

  function normalizeHighlightRanges(ranges, maxLen = Infinity) {
    if (!Array.isArray(ranges)) return [];
    const cap = Number.isFinite(maxLen) ? Math.max(0, Math.floor(maxLen)) : Infinity;
    if (cap === 0) return [];
    const valid = [];
    for (const r of ranges) {
      if (!Array.isArray(r) || r.length < 2) continue;
      const s = Math.max(0, Math.min(cap, Math.floor(Number(r[0]))));
      const e = Math.max(0, Math.min(cap, Math.floor(Number(r[1]))));
      if (Number.isFinite(s) && Number.isFinite(e) && e > s) {
        valid.push([s, e]);
      }
    }
    if (valid.length === 0) return [];
    valid.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const merged = [valid[0]];
    for (let idx = 1; idx < valid.length; idx++) {
      const last = merged[merged.length - 1];
      const cur = valid[idx];
      if (cur[0] <= last[1]) {
        last[1] = Math.max(last[1], cur[1]);
      } else {
        merged.push(cur);
      }
    }
    return merged;
  }

  function renderHighlightedStem(stemEl, stemText, qId) {
    if (!stemEl) return;
    const text = typeof stemText === "string" ? stemText : "";
    const ranges = normalizeHighlightRanges(progress.highlights?.[qId], text.length);
    stemEl.textContent = "";
    if (ranges.length === 0) {
      stemEl.textContent = text;
      return;
    }
    let cursor = 0;
    const frag = document.createDocumentFragment();
    for (let i = 0; i < ranges.length; i++) {
      const [s, e] = ranges[i];
      if (s > cursor) {
        frag.appendChild(document.createTextNode(text.slice(cursor, s)));
      }
      const mark = document.createElement("mark");
      mark.className = "q-mark";
      mark.dataset.rangeIdx = String(i);
      mark.title = "לחץ להסרת המרקור (במצב מרקר) או לחיצה ימנית";
      mark.textContent = text.slice(s, e);
      frag.appendChild(mark);
      cursor = e;
    }
    if (cursor < text.length) {
      frag.appendChild(document.createTextNode(text.slice(cursor)));
    }
    stemEl.appendChild(frag);
  }

  function getActiveStemContext() {
    if (currentMode === "exam") {
      if (!simState.active || simState.questions.length === 0) return null;
      const q = simState.questions[simState.currentIndex];
      const stemEl = el("simStem");
      if (!q || !stemEl || !stemEl.isConnected) return null;
      return { q, stemEl };
    }
    if (!isStudyMode(currentMode) || filteredList.length === 0) return null;
    const q = filteredList[currentIndex];
    const stemEl = el("qStem");
    if (!q || !stemEl || !stemEl.isConnected) return null;
    return { q, stemEl };
  }

  function updateMarkerControlsUI(qId = null) {
    const ctx = getActiveStemContext();
    const targetQId = qId || ctx?.q?.id || null;
    const hasHighlights = Boolean(targetQId && progress.highlights?.[targetQId]?.length > 0);

    const studyBtn = el("btnFlagMarker");
    if (studyBtn) {
      studyBtn.classList.toggle("active", markerMode);
      studyBtn.setAttribute("aria-pressed", markerMode ? "true" : "false");
    }
    const simBtn = el("simMarkerBtn");
    if (simBtn) {
      simBtn.classList.toggle("active", markerMode);
      simBtn.setAttribute("aria-pressed", markerMode ? "true" : "false");
    }

    el("btnClearMarkers")?.classList.toggle("hidden", !hasHighlights);
    el("simClearMarkersBtn")?.classList.toggle("hidden", !hasHighlights);

    el("qStem")?.classList.toggle("marker-active", markerMode);
    el("simStem")?.classList.toggle("marker-active", markerMode);
  }

  function hideMarkerFloatingPill() {
    pendingMarkerSelection = null;
    el("markerFloatingPill")?.classList.add("hidden");
  }

  function showMarkerFloatingPill(ctx, offsets) {
    const pill = el("markerFloatingPill");
    if (!pill || !ctx || !offsets) return;
    pendingMarkerSelection = {
      qId: ctx.q.id,
      stemEl: ctx.stemEl,
      start: offsets.start,
      end: offsets.end,
    };
    const { rect } = offsets;
    const centerX = Math.max(72, Math.min(window.innerWidth - 72, rect.left + rect.width / 2));
    const topY = Math.max(46, rect.top - 8);
    pill.style.left = `${centerX}px`;
    pill.style.top = `${topY}px`;
    pill.classList.remove("hidden");
  }

  function getStemSelectionOffsets(stemEl) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
    if (!stemEl || !stemEl.isConnected) return null;
    const rawRange = sel.getRangeAt(0);
    if (!rawRange.intersectsNode(stemEl)) return null;

    const stemRange = document.createRange();
    stemRange.selectNodeContents(stemEl);
    const clipped = rawRange.cloneRange();
    if (clipped.compareBoundaryPoints(Range.START_TO_START, stemRange) < 0) {
      clipped.setStart(stemRange.startContainer, stemRange.startOffset);
    }
    if (clipped.compareBoundaryPoints(Range.END_TO_END, stemRange) > 0) {
      clipped.setEnd(stemRange.endContainer, stemRange.endOffset);
    }

    const selectedText = clipped.toString();
    if (!selectedText.trim()) return null;

    const preRange = document.createRange();
    preRange.selectNodeContents(stemEl);
    preRange.setEnd(clipped.startContainer, clipped.startOffset);
    const start = preRange.toString().length;
    const end = start + selectedText.length;
    if (end <= start) return null;

    const rect = clipped.getBoundingClientRect();
    if (!rect || (rect.width === 0 && rect.height === 0)) return null;
    return { start, end, rect };
  }

  function addStemHighlight(qId, start, end) {
    const q = Q_MAP.get(qId);
    if (!q) return;
    if (!progress.highlights) progress.highlights = {};
    if (!progress.highlightUpdatedAt) progress.highlightUpdatedAt = {};

    const existing = Array.isArray(progress.highlights[qId]) ? progress.highlights[qId] : [];
    const next = normalizeHighlightRanges([...existing, [start, end]], q.stem.length);
    if (next.length > 0) {
      progress.highlights[qId] = next;
    } else {
      delete progress.highlights[qId];
    }
    progress.highlightUpdatedAt[qId] = Date.now();
    saveProgress();

    try {
      window.getSelection()?.removeAllRanges();
    } catch {}
    hideMarkerFloatingPill();

    const ctx = getActiveStemContext();
    if (ctx && ctx.q.id === qId) {
      renderHighlightedStem(ctx.stemEl, ctx.q.stem, qId);
      updateMarkerControlsUI(qId);
    }
  }

  function removeStemHighlightAt(qId, rangeIdx) {
    const q = Q_MAP.get(qId);
    if (!q || !progress.highlights?.[qId]) return;
    const current = normalizeHighlightRanges(progress.highlights[qId], q.stem.length);
    if (rangeIdx < 0 || rangeIdx >= current.length) return;
    current.splice(rangeIdx, 1);
    if (!progress.highlightUpdatedAt) progress.highlightUpdatedAt = {};
    if (current.length > 0) {
      progress.highlights[qId] = current;
    } else {
      delete progress.highlights[qId];
    }
    progress.highlightUpdatedAt[qId] = Date.now();
    saveProgress();
    hideMarkerFloatingPill();

    const ctx = getActiveStemContext();
    if (ctx && ctx.q.id === qId) {
      renderHighlightedStem(ctx.stemEl, ctx.q.stem, qId);
      updateMarkerControlsUI(qId);
    }
  }

  function clearQuestionHighlights(qId) {
    if (!qId) return;
    if (!progress.highlights) progress.highlights = {};
    if (!progress.highlightUpdatedAt) progress.highlightUpdatedAt = {};
    delete progress.highlights[qId];
    progress.highlightUpdatedAt[qId] = Date.now();
    saveProgress();
    hideMarkerFloatingPill();

    const ctx = getActiveStemContext();
    if (ctx && ctx.q.id === qId) {
      renderHighlightedStem(ctx.stemEl, ctx.q.stem, qId);
      updateMarkerControlsUI(qId);
    }
  }

  function toggleMarkerMode(forceState = null) {
    markerMode = forceState === null ? !markerMode : Boolean(forceState);
    if (markerMode) {
      const ctx = getActiveStemContext();
      if (ctx) {
        const offsets = getStemSelectionOffsets(ctx.stemEl);
        if (offsets) {
          addStemHighlight(ctx.q.id, offsets.start, offsets.end);
        }
      }
    }
    hideMarkerFloatingPill();
    updateMarkerControlsUI();
  }

  function renderQuestion() {
    if (currentMode === "exam" || currentMode === "analytics" || currentMode === "leaderboard") return;

    const card = el("questionCard");
    const empty = el("emptyState");
    if (filteredList.length === 0) {
      card.classList.add("hidden");
      empty.classList.remove("hidden");
      const titleEl = el("emptyStateTitle");
      const descEl = el("emptyStateDesc");
      const resetBtn = el("btnResetFiltersEmpty");
      if (currentMode === "drill") {
        const totalDrill = getDrillQuestions().length;
        if (totalDrill === 0) {
          if (titleEl) titleEl.textContent = "🎉 כל הטעויות תוקנו!";
          if (descEl) descEl.textContent = "אין כרגע שאלות שממתינות בתיקון טעויות.";
          resetBtn?.classList.add("hidden");
        } else {
          if (titleEl) titleEl.textContent = "לא נמצאו שאלות לתיקון התואמות לסינון";
          if (descEl) descEl.textContent = "נסה לנקות חלק מהמסננים או לבחור שנה או מקצוע אחרים.";
          resetBtn?.classList.remove("hidden");
        }
      } else {
        if (titleEl) titleEl.textContent = "לא נמצאו שאלות התואמות לסינון";
        if (descEl) descEl.textContent = "נסה לנקות חלק מהמסננים או לשנות את מילת החיפוש.";
        resetBtn?.classList.remove("hidden");
      }
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

    renderHighlightedStem(el("qStem"), q.stem, q.id);
    updateMarkerControlsUI(q.id);
    hideMarkerFloatingPill();
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
    hasUserInteractedWithNav = true;
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

    persistStudySession();
    if (currentMode === "drill") {
      renderFilterChips();
      updateFilterCountsUI();
    }
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

  /**
   * Toggle a persistent per-question flag ('star' | 'unsure' | 'problem') and sync progress.
   */
  function toggleQuestionFlag(qId, flagName) {
    if (!qId) return;
    const now = Date.now();
    if (!progress.flags[qId]) progress.flags[qId] = {};
    if (!progress.flagUpdatedAt) progress.flagUpdatedAt = {};
    if (!progress.flagUpdatedAt[qId]) progress.flagUpdatedAt[qId] = {};
    progress.flags[qId][flagName] = !progress.flags[qId][flagName];
    progress.flagUpdatedAt[qId][flagName] = now;
    saveProgress();
  }

  function toggleFlag(flagName) {
    if (filteredList.length === 0) return;
    const q = filteredList[currentIndex];
    toggleQuestionFlag(q.id, flagName);
    if (currentMode === "drill") {
      renderFilterChips();
      updateFilterCountsUI();
    }
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
    hasUserInteractedWithNav = true;
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
    saveProgress({ syncCloud: false });
    nextQuestion();
  }

  function prevQuestion() {
    if (currentIndex > 0) {
      hasUserInteractedWithNav = true;
      currentIndex--;
      renderQuestion();
      persistStudySession();
    }
  }

  function nextQuestion() {
    hasUserInteractedWithNav = true;
    if (currentMode === "drill") {
      const prevId = filteredList[currentIndex]?.id;
      const prevIdx = currentIndex;
      recomputeFilteredList({ preserveShuffle: true });
      if (filteredList.length === 0) {
        renderQuestion();
        persistStudySession();
        return;
      }
      const idxOfPrev = prevId ? filteredList.findIndex((q) => q.id === prevId) : -1;
      if (idxOfPrev >= 0) {
        currentIndex = (idxOfPrev + 1) % filteredList.length;
      } else {
        currentIndex = prevIdx % filteredList.length;
      }
      renderQuestion();
      persistStudySession();
      return;
    }
    if (currentIndex < filteredList.length - 1) {
      currentIndex++;
      renderQuestion();
      persistStudySession();
    } else {
      persistStudySession();
      showToast("הגעת לסוף הרשימה!");
    }
  }

  // Shuffle
  function shuffleFilteredQuestions() {
    if (filteredList.length === 0) {
      showToast("אין שאלות לערבוב.");
      return;
    }
    hasUserInteractedWithNav = true;
    for (let i = filteredList.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [filteredList[i], filteredList[j]] = [filteredList[j], filteredList[i]];
    }
    setActiveShuffledOrder(filteredList.map((q) => q.id));
    currentIndex = 0;
    renderQuestion();
    persistStudySession();
    showToast("🔀 סדר השאלות עורבב!");
  }

  function toggleShuffleOptions() {
    hasUserInteractedWithNav = true;
    setShuffleOptionsEnabled(!shuffleOptionsEnabled);
    renderQuestion();
    persistStudySession();
    showToast(shuffleOptionsEnabled ? "🎲 ערבוב מסיחים הופעל" : "סדר מסיחים מקורי");
  }

  function resetStudySessionToStart() {
    hasUserInteractedWithNav = true;
    filters.exams.clear();
    filters.subjects.clear();
    filters.statuses.clear();
    filters.search = "";
    filters.mergePathology = true;
    drillFilters.exams.clear();
    drillFilters.subjects.clear();
    drillFilters.search = "";
    if (el("mergePathologyToggle")) el("mergePathologyToggle").checked = true;
    if (el("searchInput")) el("searchInput").value = "";
    el("clearSearchBtn")?.classList.add("hidden");
    setShuffleOptionsEnabled(false);
    shuffledQuestionOrder = null;
    drillShuffledOrder = null;
    lastQIdByMode = {};
    lastIndexByMode = {};
    renderFilterChips();
    initExamSetup();
    switchMode("practice", { persist: false });
    persistStudySession({ syncCloud: true });
    showToast("🔄 התחלת מהתחלה (שאלה 1)");
  }

  function applyStudySessionState(session, { showToastInfo = false, fromOtherDevice = false } = {}) {
    if (!session || typeof session !== "object") return false;
    const clean = sanitizeStudySession(session);
    if (!clean) return false;

    isRestoringSession = true;
    try {
      const f = clean.filters || {};
      filters.mergePathology = f.mergePathology !== undefined ? Boolean(f.mergePathology) : true;
      if (el("mergePathologyToggle")) {
        el("mergePathologyToggle").checked = filters.mergePathology;
      }

      const validExamNames = new Set(EXAMS.map((ex) => ex.name));
      filters.exams = new Set((f.exams || []).filter((x) => validExamNames.has(x)));

      const validSubjects = new Set(getUniqueSubjects());
      filters.subjects = new Set((f.subjects || []).filter((x) => validSubjects.has(x)));

      const validStatuses = new Set(getStatusKeys());
      filters.statuses = new Set((f.statuses || []).filter((x) => validStatuses.has(x)));

      filters.search = typeof f.search === "string" ? f.search : "";

      const df = clean.drillFilters || {};
      drillFilters.exams = new Set((df.exams || []).filter((x) => validExamNames.has(x)));
      drillFilters.subjects = new Set((df.subjects || []).filter((x) => validSubjects.has(x)));
      drillFilters.search = typeof df.search === "string" ? df.search : "";

      const activeSearch = clean.mode === "drill" ? drillFilters.search : filters.search;
      if (el("searchInput")) el("searchInput").value = activeSearch;
      el("clearSearchBtn")?.classList.toggle("hidden", !activeSearch);

      setFilterPanelCollapsed(Boolean(clean.filterCollapsed));
      setShuffleOptionsEnabled(Boolean(clean.shuffleOptions));
      shuffledQuestionOrder = Array.isArray(clean.shuffledOrder) && clean.shuffledOrder.length > 0
        ? [...clean.shuffledOrder]
        : null;
      drillShuffledOrder = Array.isArray(clean.drillShuffledOrder) && clean.drillShuffledOrder.length > 0
        ? [...clean.drillShuffledOrder]
        : null;
      lastQIdByMode = { ...(clean.lastQIdByMode || {}) };
      lastIndexByMode = { ...(clean.lastIndexByMode || {}) };

      renderFilterChips();
      initExamSetup();
      switchMode(clean.mode, { persist: false });
    } finally {
      isRestoringSession = false;
    }

    if (showToastInfo) {
      const curQ = filteredList[currentIndex];
      const loc = curQ ? `${curQ.exam} שאלה ${curQ.num}` : "";
      if (fromOtherDevice) {
        showToast(loc ? `☁️ המשכת מהמכשיר האחר · ${loc}` : "☁️ המשכת מהמכשיר האחר", {
          actionLabel: "התחל מהתחלה",
          onAction: resetStudySessionToStart,
          duration: 6000,
        });
      } else {
        showToast(loc ? `📌 חזרת אל ${loc}` : "📌 חזרת למקום בו עצרת", {
          actionLabel: "התחל מהתחלה",
          onAction: resetStudySessionToStart,
          duration: 5000,
        });
      }
    }
    return true;
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

  function formatMmSs(totalSec) {
    const sec = Math.max(0, Math.floor(Number(totalSec) || 0));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  function persistActiveSimulation({ syncCloud = true } = {}) {
    if (!simState.active || !Array.isArray(simState.questions) || simState.questions.length === 0) return;
    const answersObj = {};
    simState.answers.forEach((val, qId) => {
      if (Number.isInteger(val)) answersObj[qId] = val;
    });
    const struckObj = {};
    simState.struck.forEach((setVal, qId) => {
      if (setVal && setVal.size > 0) struckObj[qId] = Array.from(setVal);
    });
    progress.activeSim = {
      label: simState.label || `סימולציה (${simState.questions.length} שאלות)`,
      questionIds: simState.questions.map((q) => q.id),
      answers: answersObj,
      flagged: Array.from(simState.flagged),
      struck: struckObj,
      currentIndex: simState.currentIndex,
      secondsLeft: simState.hasTimer ? Math.max(0, simState.secondsLeft) : 0,
      hasTimer: Boolean(simState.hasTimer),
      shuffleOpts: Boolean(simState.shuffleOpts),
      deviceId,
    };
    progress.activeSimUpdatedAt = Date.now();
    saveProgress({ syncCloud });
    renderResumeSimBanner();
  }

  function clearActiveSimulation({ syncCloud = true } = {}) {
    progress.activeSim = null;
    progress.activeSimUpdatedAt = Date.now();
    saveProgress({ syncCloud });
    renderResumeSimBanner();
  }

  function renderResumeSimBanner() {
    const banner = el("resumeSimBanner");
    const textEl = el("resumeSimText");
    if (!banner || !textEl) return;

    const saved = progress.activeSim;
    if (!saved || simState.active || !Array.isArray(saved.questionIds) || saved.questionIds.length === 0) {
      banner.classList.add("hidden");
      return;
    }

    const validSet = new Set(saved.questionIds.filter((id) => Q_MAP.has(id)));
    if (validSet.size === 0) {
      banner.classList.add("hidden");
      return;
    }

    const answeredCount = saved.answers && typeof saved.answers === "object"
      ? Object.keys(saved.answers).filter((id) => validSet.has(id)).length
      : 0;
    const totalCount = validSet.size;
    const timerPart = saved.hasTimer ? ` · נותרו ${formatMmSs(saved.secondsLeft)}` : " · ללא טיימר";
    const labelPart = saved.label ? ` · ${saved.label}` : "";
    textEl.textContent = `יש לך סימולציה שלא הושלמה${labelPart} (${answeredCount}/${totalCount} שאלות${timerPart})`;
    banner.classList.remove("hidden");
  }

  function startSimTimer() {
    clearInterval(simState.timerId);
    simState.timerId = null;
    if (simState.hasTimer && simState.secondsLeft > 0) {
      updateSimTimerDisplay();
      simState.timerId = setInterval(() => {
        simState.secondsLeft--;
        updateSimTimerDisplay();
        if (simState.secondsLeft <= 0) {
          clearInterval(simState.timerId);
          simState.timerId = null;
          submitSimulation();
        } else if (simState.secondsLeft % 5 === 0) {
          persistActiveSimulation({ syncCloud: false });
        }
      }, 1000);
    } else {
      el("simTimerDisplay").textContent = "ללא הגבלה";
    }
  }

  function resumeSavedSimulation() {
    const saved = progress.activeSim;
    if (!saved || !Array.isArray(saved.questionIds)) return;

    const questions = saved.questionIds.map((id) => Q_MAP.get(id)).filter(Boolean);
    if (questions.length === 0) {
      clearActiveSimulation({ syncCloud: true });
      showToast("לא נמצאו שאלות לשחזור הסימולציה.");
      return;
    }

    hasUserInteractedWithNav = true;
    const qIdSet = new Set(questions.map((q) => q.id));
    const answers = new Map();
    if (saved.answers && typeof saved.answers === "object") {
      Object.entries(saved.answers).forEach(([qId, idx]) => {
        if (qIdSet.has(qId) && Number.isInteger(idx) && idx >= 0) {
          answers.set(qId, idx);
        }
      });
    }
    const flagged = new Set(
      Array.isArray(saved.flagged) ? saved.flagged.filter((id) => qIdSet.has(id)) : []
    );
    const struck = new Map();
    if (saved.struck && typeof saved.struck === "object") {
      Object.entries(saved.struck).forEach(([qId, arr]) => {
        if (qIdSet.has(qId) && Array.isArray(arr) && arr.length > 0) {
          struck.set(qId, new Set(arr.filter((i) => Number.isInteger(i) && i >= 0)));
        }
      });
    }

    const safeIdx = Math.max(0, Math.min(questions.length - 1, Number(saved.currentIndex) || 0));
    const hasTimer = Boolean(saved.hasTimer);
    const secondsLeft = hasTimer ? Math.max(1, Number(saved.secondsLeft) || 1) : 0;

    clearInterval(simState.timerId);
    simState = {
      active: true,
      questions,
      answers,
      flagged,
      struck,
      currentIndex: safeIdx,
      secondsLeft,
      hasTimer,
      label: saved.label || `סימולציה (${questions.length} שאלות)`,
      timerId: null,
      shuffleOpts: Boolean(saved.shuffleOpts),
    };

    optionPermutations.clear();
    switchMode("exam", { persist: false });
    el("examSetup").classList.add("hidden");
    el("examResults").classList.add("hidden");
    el("examActive").classList.remove("hidden");

    renderResumeSimBanner();
    startSimTimer();
    renderSimQuestion();
    showToast("⏱️ הסימולציה שוחזרה מהמקום שבו עצרת!");
  }

  function startSimulation() {
    hasUserInteractedWithNav = true;
    const simType = document.querySelector('input[name="simType"]:checked').value;
    let pool = [];
    let label = "";
    if (simType === "full") {
      const examName = el("simExamSelect").value;
      pool = QUESTIONS.filter((q) => q.exam === examName);
      label = `${examName} (${pool.length} שאלות)`;
    } else {
      const chosenSubjs = new Set(
        Array.from(el("simSubjectChips").querySelectorAll(".chip.active")).map((b) => b.dataset.subj)
      );
      const count = Math.max(5, Math.min(200, parseInt(el("simCustomCount").value, 10) || 30));
      let candidates = QUESTIONS.filter((q) => chosenSubjs.size === 0 || chosenSubjs.has(getSubject(q)));
      candidates = [...candidates].sort(() => Math.random() - 0.5);
      pool = candidates.slice(0, count);
      label = `סימולציה מותאמת (${pool.length} שאלות)`;
    }

    if (pool.length === 0) {
      showToast("אין שאלות זמינות לבחירה זו");
      return;
    }

    const mins = parseInt(el("simMinutes").value, 10) || 0;
    clearInterval(simState.timerId);
    simState = {
      active: true,
      questions: pool,
      answers: new Map(),
      flagged: new Set(),
      struck: new Map(),
      currentIndex: 0,
      secondsLeft: mins * 60,
      hasTimer: mins > 0,
      label,
      timerId: null,
      shuffleOpts: el("simShuffleOpts").checked,
    };

    optionPermutations.clear();
    el("examSetup").classList.add("hidden");
    el("examResults").classList.add("hidden");
    el("examActive").classList.remove("hidden");

    startSimTimer();
    persistActiveSimulation({ syncCloud: true });
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
      const isAnswered = simState.answers.has(q.id);
      const isFlagged = simState.flagged.has(q.id);
      const isUnsure = Boolean(progress.flags[q.id]?.unsure);
      if (isAnswered) cell.classList.add("answered");
      if (isFlagged) cell.classList.add("flagged");
      if (isUnsure) cell.classList.add("unsure");
      if (idx === simState.currentIndex) cell.classList.add("current");
      cell.textContent = idx + 1;
      const tags = [];
      if (isFlagged) tags.push("סומנה לבדיקה");
      if (isUnsure) tags.push("התלבטתי");
      if (tags.length > 0) cell.title = `שאלה ${idx + 1} (${tags.join(" · ")})`;
      cell.onclick = () => {
        simState.currentIndex = idx;
        persistActiveSimulation({ syncCloud: true });
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
    const isFlagged = simState.flagged.has(q.id);
    const isUnsure = Boolean(progress.flags[q.id]?.unsure);

    mount.innerHTML = `
      <article class="question-card card">
        <div class="q-header">
          <div class="q-meta">
            <span class="q-badge exam-badge">שאלה ${simState.currentIndex + 1} מתוך ${simState.questions.length}</span>
            <span class="q-badge subject-badge">${escapeHtml(formatSubject(getSubject(q)))} · ${escapeHtml(q.exam)}</span>
          </div>
          <div class="q-flags">
            <button type="button" class="flag-btn marker-toggle-btn" id="simMarkerBtn" title="מרקר צהוב — סמן מילות מפתח בשאלה (M)" aria-label="מצב מרקר צהוב" aria-pressed="false">🖍️</button>
            <button type="button" class="flag-btn marker-clear-btn hidden" id="simClearMarkersBtn" title="נקה את כל המרקור בשאלה זו" aria-label="נקה מרקור בשאלה">🧹</button>
            <button type="button" class="flag-btn ${isUnsure ? "active" : ""}" id="simUnsureBtn" title="ניחשתי / התלבטתי — לחזור אחר כך" aria-label="סמן התלבטות" aria-pressed="${isUnsure ? "true" : "false"}">🤔 התלבטתי</button>
            <button type="button" class="flag-btn ${isFlagged ? "active" : ""}" id="simFlagBtn" title="סמן לבדיקה" aria-pressed="${isFlagged ? "true" : "false"}">🚩 סמן לבדיקה</button>
            <button type="button" class="flag-btn" id="simProblemBtn" title="בעיות בשאלה – דווח או צפה בדיווחים" aria-label="בעיות בשאלה">
              <span aria-hidden="true">⚠️</span>
              <span class="flag-count hidden" id="simProblemCount"></span>
            </button>
          </div>
        </div>
        <div class="q-problem-banner hidden" id="simProblemBanner" role="alert"></div>
        <div class="q-content-grid${q.images.length > 0 ? " has-images" : ""}">
          <div class="q-stem" id="simStem"></div>
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

    el("simMarkerBtn").onclick = () => toggleMarkerMode();
    el("simClearMarkersBtn").onclick = () => clearQuestionHighlights(q.id);
    el("simUnsureBtn").onclick = () => {
      toggleQuestionFlag(q.id, "unsure");
      renderSimQuestion();
    };
    el("simFlagBtn").onclick = () => {
      if (simState.flagged.has(q.id)) simState.flagged.delete(q.id);
      else simState.flagged.add(q.id);
      persistActiveSimulation({ syncCloud: true });
      renderSimQuestion();
    };
    el("simProblemBtn").onclick = () => openProblemModal(q.id);
    updateProblemFlagButton(el("simProblemBtn"), el("simProblemCount"), q);
    renderProblemBanner(el("simProblemBanner"), q);
    renderHighlightedStem(el("simStem"), q.stem, q.id);
    updateMarkerControlsUI(q.id);
    hideMarkerFloatingPill();

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
        persistActiveSimulation({ syncCloud: true });
        renderSimQuestion();
      };
      btn.oncontextmenu = (e) => {
        e.preventDefault();
        if (!simState.struck.has(q.id)) simState.struck.set(q.id, new Set());
        const st = simState.struck.get(q.id);
        if (st.has(origIdx)) st.delete(origIdx); else st.add(origIdx);
        persistActiveSimulation({ syncCloud: true });
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
        persistActiveSimulation({ syncCloud: true });
        renderSimQuestion();
      };

      row.append(btn, strikeBtn);
      optWrap.appendChild(row);
    });

    el("simPrevBtn").onclick = () => {
      if (simState.currentIndex > 0) {
        simState.currentIndex--;
        persistActiveSimulation({ syncCloud: true });
        renderSimQuestion();
      }
    };
    el("simNextBtn").onclick = () => {
      if (simState.currentIndex < simState.questions.length - 1) {
        simState.currentIndex++;
        persistActiveSimulation({ syncCloud: true });
        renderSimQuestion();
      }
    };
  }

  /**
   * Open Practice mode focused on a specific list of simulation question IDs.
   */
  function reviewSimQuestions(ids, labelText) {
    if (!ids || ids.length === 0) return;
    switchMode("practice");
    filteredList = ids.map((id) => Q_MAP.get(id)).filter(Boolean);
    currentIndex = 0;
    el("filteredCountText").textContent = labelText;
    renderQuestion();
  }

  function submitSimulation() {
    clearInterval(simState.timerId);
    simState.timerId = null;
    simState.active = false;

    let correctCount = 0;
    const bySubj = {};
    const wrongIds = [];
    const unsureIds = [];
    const wrongOrUnsureIds = [];

    simState.questions.forEach((q) => {
      const s = getSubject(q);
      if (!bySubj[s]) bySubj[s] = { total: 0, correct: 0 };
      bySubj[s].total++;

      const chosen = simState.answers.get(q.id);
      const isOk = chosen !== undefined && q.correct.includes(chosen);
      const isUnsure = Boolean(progress.flags[q.id]?.unsure);
      if (isOk) {
        correctCount++;
        bySubj[s].correct++;
      } else {
        wrongIds.push(q.id);
      }
      if (isUnsure) {
        unsureIds.push(q.id);
      }
      if (!isOk || isUnsure) {
        wrongOrUnsureIds.push(q.id);
      }

      if (chosen !== undefined) {
        progress.attempts[q.id] = { selected: chosen, isCorrect: isOk, ts: Date.now() };
        if (progress.clearedAttempts) delete progress.clearedAttempts[q.id];
        recordDaily(isOk);
      }
    });
    clearActiveSimulation({ syncCloud: true });

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

    const showCombinedBtn = wrongOrUnsureIds.length > wrongIds.length && wrongOrUnsureIds.length > unsureIds.length;
    const unsureBtnClass = wrongIds.length === 0 && unsureIds.length > 0 ? "btn-primary" : "btn-secondary";

    resEl.innerHTML = `
      <h2>🏁 תוצאות הסימולציה</h2>
      <div class="kpi-grid" style="margin-top:14px;">
        <div class="kpi-card"><div class="kpi-label">ציון סופי</div><div class="kpi-value">${pct}%</div></div>
        <div class="kpi-card"><div class="kpi-label">תשובות נכונות</div><div class="kpi-value">${correctCount} / ${simState.questions.length}</div></div>
        <div class="kpi-card"><div class="kpi-label">טעויות / דילוגים</div><div class="kpi-value">${wrongIds.length}</div></div>
        <div class="kpi-card"><div class="kpi-label">🤔 התלבטתי</div><div class="kpi-value">${unsureIds.length}</div></div>
      </div>
      <h3>פילוח לפי מקצוע</h3>
      <div class="subject-progress-list">${subjRows}</div>
      <div style="display:flex;gap:10px;margin-top:20px;flex-wrap:wrap;">
        <button type="button" class="btn-primary" id="btnReviewSimWrong" ${wrongIds.length === 0 ? "disabled" : ""}>🔥 תחקר טעויות מהסימולציה (${wrongIds.length})</button>
        <button type="button" class="${unsureBtnClass}" id="btnReviewSimUnsure" ${unsureIds.length === 0 ? "disabled" : ""}>🤔 תחקר התלבטויות מהסימולציה (${unsureIds.length})</button>
        ${showCombinedBtn ? `<button type="button" class="btn-secondary" id="btnReviewSimWrongAndUnsure">🎯 תחקר טעויות והתלבטויות (${wrongOrUnsureIds.length})</button>` : ""}
        <button type="button" class="btn-secondary" id="btnNewSim">🔄 סימולציה חדשה</button>
      </div>
    `;

    el("btnReviewSimWrong").onclick = () => {
      reviewSimQuestions(wrongIds, `מתחקר ${wrongIds.length} טעויות מהסימולציה`);
    };
    el("btnReviewSimUnsure").onclick = () => {
      reviewSimQuestions(unsureIds, `מתחקר ${unsureIds.length} שאלות שהתלבטת בהן מהסימולציה`);
    };
    el("btnReviewSimWrongAndUnsure")?.addEventListener("click", () => {
      reviewSimQuestions(wrongOrUnsureIds, `מתחקר ${wrongOrUnsureIds.length} טעויות והתלבטויות מהסימולציה`);
    });
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
        filters.statuses.clear();
        renderFilterChips();
        switchMode("practice");
      };
    });
  }

  // Leaderboard
  function getMyLocalNotesCount() {
    let count = 0;
    Object.values(communityNotes || {}).forEach((byUser) => {
      const entry = byUser?.[userIdentity.userId];
      if (entry && typeof entry.text === "string" && entry.text.trim()) {
        count += 1;
      }
    });
    return count;
  }

  function getMergedLeaderboardEntries() {
    const onlineSet = new Set((onlineUsersList || []).map((u) => u.userId));
    const localSolved = Object.keys(progress.attempts || {}).length;
    const localNotes = getMyLocalNotesCount();
    const useLocalNotes = pendingDirtyQIds.size > 0 || lastNoteMutationAt > leaderboardLastFetchedAt;
    const byId = new Map();

    (leaderboardEntries || []).forEach((item) => {
      if (!item || !item.userId || !item.name) return;
      const isMe = item.userId === userIdentity.userId;
      const solvedCount = isMe
        ? (cloudProgressDirty ? localSolved : Math.max(Number(item.solvedCount) || 0, localSolved))
        : (Number(item.solvedCount) || 0);
      const notesCount = isMe
        ? (useLocalNotes ? localNotes : (Number(item.notesCount) || 0))
        : (Number(item.notesCount) || 0);
      byId.set(item.userId, {
        userId: item.userId,
        name: isMe ? userIdentity.name : item.name,
        emoji: isMe ? userIdentity.emoji : (item.emoji || "👤"),
        category: isMe ? userIdentity.category : (item.category || ""),
        solvedCount,
        notesCount,
        lastSeenAt: Number(item.lastSeenAt) || 0,
        isOnline: isMe || Boolean(item.isOnline) || onlineSet.has(item.userId),
      });
    });

    if (!byId.has(userIdentity.userId) && (localSolved > 0 || localNotes > 0)) {
      byId.set(userIdentity.userId, {
        userId: userIdentity.userId,
        name: userIdentity.name,
        emoji: userIdentity.emoji,
        category: userIdentity.category,
        solvedCount: localSolved,
        notesCount: localNotes,
        lastSeenAt: Date.now(),
        isOnline: true,
      });
    }

    return Array.from(byId.values());
  }

  function getMedalForRank(rank) {
    if (rank === 1) return { emoji: "🥇", label: "מקום 1", cls: "rank-gold" };
    if (rank === 2) return { emoji: "🥈", label: "מקום 2", cls: "rank-silver" };
    if (rank === 3) return { emoji: "🥉", label: "מקום 3", cls: "rank-bronze" };
    return null;
  }

  async function fetchLeaderboard({ force = false, showFeedback = false } = {}) {
    if (!isCloudApiConfigured()) {
      leaderboardError = true;
      renderLeaderboard();
      return false;
    }
    if (leaderboardLoading) return false;
    if (!force && leaderboardLoaded && Date.now() - leaderboardLastFetchedAt < 15000) {
      renderLeaderboard();
      return true;
    }

    leaderboardLoading = true;
    leaderboardError = false;
    renderLeaderboard();

    try {
      if (cloudProgressDirty) {
        await pushCloudProgress().catch(() => {});
      }
      if (!identityRegisteredInCloud && !identityNeedsCloudCheck) {
        await registerIdentityPing(false).catch(() => {});
      }
      const res = await fetch(`${CLOUD_API_BASE}/api/leaderboard`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data?.ok || !Array.isArray(data.entries)) {
        throw new Error("Invalid leaderboard payload");
      }
      leaderboardEntries = data.entries;
      leaderboardLoaded = true;
      leaderboardError = false;
      leaderboardLastFetchedAt = Date.now();
      if (showFeedback) showToast("🏆 הדירוג עודכן מהענן!");
      return true;
    } catch {
      leaderboardError = true;
      if (showFeedback) showToast("⚠️ לא ניתן לרענן את הלידרבורד כרגע.");
      return false;
    } finally {
      leaderboardLoading = false;
      if (currentMode === "leaderboard") {
        renderLeaderboard();
      }
    }
  }

  function openLeaderboardView() {
    renderLeaderboard();
    fetchLeaderboard({ force: !leaderboardLoaded || lastNoteMutationAt > leaderboardLastFetchedAt });
  }

  function setLeaderboardSort(sortBy) {
    const next = sortBy === "notes" ? "notes" : "answers";
    if (leaderboardSort === next) return;
    leaderboardSort = next;
    renderLeaderboard();
  }

  function renderLeaderboard() {
    const viewEl = el("leaderboardView");
    if (!viewEl) return;

    const sortAnswersBtn = el("btnLbSortAnswers");
    const sortNotesBtn = el("btnLbSortNotes");
    const refreshBtn = el("btnRefreshLeaderboard");
    const jumpMeBtn = el("btnLbJumpToMe");
    const myStripEl = el("leaderboardMySummary");
    const podiumEl = el("leaderboardPodium");
    const listTitleEl = el("leaderboardListTitle");
    const totalMetaEl = el("leaderboardTotalMeta");
    const listMountEl = el("leaderboardListMount");

    const isNotesSort = leaderboardSort === "notes";
    if (sortAnswersBtn) {
      sortAnswersBtn.classList.toggle("active", !isNotesSort);
      sortAnswersBtn.setAttribute("aria-selected", isNotesSort ? "false" : "true");
    }
    if (sortNotesBtn) {
      sortNotesBtn.classList.toggle("active", isNotesSort);
      sortNotesBtn.setAttribute("aria-selected", isNotesSort ? "true" : "false");
    }
    if (refreshBtn) {
      refreshBtn.classList.toggle("is-spinning", leaderboardLoading);
      refreshBtn.disabled = leaderboardLoading;
    }

    const localSolved = Object.keys(progress.attempts || {}).length;
    const localNotes = getMyLocalNotesCount();
    const totalQuestions = Math.max(1, QUESTIONS.length);

    if (leaderboardLoading && !leaderboardLoaded) {
      if (myStripEl) {
        myStripEl.innerHTML = `
          <div class="lb-my-identity">
            <span class="lb-my-emoji" aria-hidden="true">${escapeHtml(userIdentity.emoji)}</span>
            <div>
              <strong>${escapeHtml(userIdentity.name)}</strong>
              <span class="lb-my-rank-pill">טוען מיקום...</span>
            </div>
          </div>
          <div class="lb-my-metrics tabular-text">
            <span><strong>${localSolved}</strong> תשובות</span>
            <span class="lb-my-sep" aria-hidden="true">·</span>
            <span><strong>${localNotes}</strong> הערות</span>
          </div>
        `;
      }
      if (jumpMeBtn) jumpMeBtn.classList.add("hidden");
      if (podiumEl) {
        podiumEl.classList.remove("hidden");
        podiumEl.innerHTML = [1, 2, 3]
          .map(
            (n) => `
          <div class="podium-card podium-slot-${n} lb-skeleton-card" aria-hidden="true">
            <div class="lb-skel lb-skel-pill"></div>
            <div class="lb-skel lb-skel-title"></div>
            <div class="lb-skel lb-skel-stat"></div>
            <div class="lb-skel lb-skel-bar"></div>
          </div>`
          )
          .join("");
      }
      if (totalMetaEl) totalMetaEl.textContent = "טוען נתונים...";
      if (listMountEl) {
        listMountEl.innerHTML = `<div class="lb-skeleton-list" aria-hidden="true">${Array.from({ length: 6 }, () => `<div class="lb-skel lb-skel-row"></div>`).join("")}</div>`;
      }
      return;
    }

    if (leaderboardError && !leaderboardLoaded) {
      if (myStripEl) {
        myStripEl.innerHTML = `
          <div class="lb-my-identity">
            <span class="lb-my-emoji" aria-hidden="true">${escapeHtml(userIdentity.emoji)}</span>
            <div>
              <strong>${escapeHtml(userIdentity.name)}</strong>
              <span class="lb-my-rank-pill">מצב לא מקוון</span>
            </div>
          </div>
          <div class="lb-my-metrics tabular-text">
            <span><strong>${localSolved}</strong> תשובות</span>
            <span class="lb-my-sep" aria-hidden="true">·</span>
            <span><strong>${localNotes}</strong> הערות</span>
          </div>
        `;
      }
      if (jumpMeBtn) jumpMeBtn.classList.add("hidden");
      if (podiumEl) {
        podiumEl.classList.add("hidden");
        podiumEl.innerHTML = "";
      }
      if (totalMetaEl) totalMetaEl.textContent = "";
      if (listMountEl) {
        listMountEl.innerHTML = `
          <div class="lb-empty-state">
            <p class="muted">לא ניתן לטעון כרגע את נתוני הלידרבורד מהענן.</p>
            <button type="button" class="btn-primary btn-sm" id="btnLbRetryLoad">🔄 נסה שוב</button>
          </div>
        `;
        el("btnLbRetryLoad")?.addEventListener("click", () => fetchLeaderboard({ force: true, showFeedback: true }));
      }
      return;
    }

    const merged = getMergedLeaderboardEntries();
    const ranked = merged
      .filter((entry) => (isNotesSort ? entry.notesCount > 0 : entry.solvedCount > 0))
      .sort((a, b) => {
        if (isNotesSort) {
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

    const myIndex = ranked.findIndex((e) => e.userId === userIdentity.userId);
    const myRank = myIndex >= 0 ? myIndex + 1 : null;
    const myMedal = myRank ? getMedalForRank(myRank) : null;
    const myEntry = myIndex >= 0 ? ranked[myIndex] : null;
    const mySolvedDisplay = myEntry ? myEntry.solvedCount : localSolved;
    const myNotesDisplay = myEntry ? myEntry.notesCount : localNotes;

    if (myStripEl) {
      let rankBadgeText = "";
      if (myMedal) {
        rankBadgeText = `${myMedal.emoji} ${myMedal.label} מתוך ${ranked.length}`;
      } else if (myRank) {
        rankBadgeText = `מקום #${myRank} מתוך ${ranked.length}`;
      } else {
        rankBadgeText = isNotesSort
          ? "כתוב הערה ראשונה כדי להיכנס לדירוג"
          : "פתור שאלה ראשונה כדי להיכנס לדירוג";
      }
      myStripEl.innerHTML = `
        <div class="lb-my-identity">
          <span class="lb-my-emoji" aria-hidden="true">${escapeHtml(userIdentity.emoji)}</span>
          <div class="lb-my-text">
            <div class="lb-my-name-row">
              <strong>${escapeHtml(userIdentity.name)}</strong>
              <span class="lb-me-badge">את/ה</span>
            </div>
            <span class="lb-my-rank-pill tabular-text${myMedal ? ` ${myMedal.cls}` : ""}">${escapeHtml(rankBadgeText)}</span>
          </div>
        </div>
        <div class="lb-my-metrics tabular-text">
          <div class="lb-my-metric${!isNotesSort ? " is-primary" : ""}">
            <span class="lb-my-metric-val">${mySolvedDisplay}</span>
            <span class="lb-my-metric-lbl">תשובות</span>
          </div>
          <div class="lb-my-metric-divider" aria-hidden="true"></div>
          <div class="lb-my-metric${isNotesSort ? " is-primary" : ""}">
            <span class="lb-my-metric-val">${myNotesDisplay}</span>
            <span class="lb-my-metric-lbl">הערות</span>
          </div>
        </div>
      `;
    }

    if (jumpMeBtn) {
      jumpMeBtn.classList.toggle("hidden", !myRank || ranked.length <= 5);
    }

    // Top 3 Podium
    const topThree = ranked.slice(0, 3);
    if (podiumEl) {
      if (topThree.length === 0) {
        podiumEl.classList.add("hidden");
        podiumEl.innerHTML = "";
      } else {
        podiumEl.classList.remove("hidden");
        podiumEl.innerHTML = topThree
          .map((entry, idx) => {
            const rank = idx + 1;
            const medal = getMedalForRank(rank);
            const isMe = entry.userId === userIdentity.userId;
            const primaryValue = isNotesSort ? entry.notesCount : entry.solvedCount;
            const primaryUnit = isNotesSort ? (primaryValue === 1 ? "הערה" : "הערות") : (primaryValue === 1 ? "תשובה" : "תשובות");
            const secondaryText = isNotesSort
              ? `${entry.solvedCount} תשובות`
              : `${entry.notesCount} הערות · ${Math.round((entry.solvedCount / totalQuestions) * 100)}% מהבנק`;
            const pct = Math.min(100, Math.round((entry.solvedCount / totalQuestions) * 100));

            return `
              <article class="podium-card podium-slot-${rank} ${medal.cls}${isMe ? " is-me" : ""}">
                <div class="podium-top">
                  <span class="podium-medal-badge ${medal.cls}">
                    <span class="podium-medal-emoji" aria-hidden="true">${medal.emoji}</span>
                    <span>${medal.label}</span>
                  </span>
                  ${entry.isOnline ? `<span class="lb-online-tag" title="פעיל/ה עכשיו"><span class="online-user-dot" aria-hidden="true"></span>מחובר/ת</span>` : ""}
                </div>
                <div class="podium-user">
                  <span class="podium-user-emoji" aria-hidden="true">${escapeHtml(entry.emoji)}</span>
                  <div class="podium-user-names">
                    <div class="podium-user-name-line">
                      <strong>${escapeHtml(entry.name)}</strong>
                      ${isMe ? `<span class="lb-me-badge">את/ה</span>` : ""}
                    </div>
                  </div>
                </div>
                <div class="podium-score-block tabular-text">
                  <div class="podium-score-main">
                    <span class="podium-score-num">${primaryValue}</span>
                    <span class="podium-score-unit">${primaryUnit}</span>
                  </div>
                  <div class="podium-score-sub">${escapeHtml(secondaryText)}</div>
                  ${!isNotesSort ? `<div class="lb-mini-bar-bg" aria-hidden="true"><div class="lb-mini-bar-fill" style="width:${pct}%"></div></div>` : ""}
                </div>
              </article>
            `;
          })
          .join("");
      }
    }

    if (listTitleEl) {
      listTitleEl.textContent = isNotesSort ? "דירוג לפי תרומת הערות" : "דירוג לפי שאלות שנפתרו";
    }
    if (totalMetaEl) {
      totalMetaEl.textContent = ranked.length > 0 ? `${ranked.length} משתתפים בדירוג` : "";
    }

    if (!listMountEl) return;

    if (ranked.length === 0) {
      listMountEl.innerHTML = `
        <div class="lb-empty-state">
          <p class="muted">${isNotesSort ? "עדיין לא פורסמו הערות בדירוג." : "עדיין אין שאלות פתורות בדירוג."}</p>
          <button type="button" class="btn-primary btn-sm" id="btnLbGoPractice">📖 עבור לתרגול</button>
        </div>
      `;
      el("btnLbGoPractice")?.addEventListener("click", () => switchMode("practice"));
      return;
    }

    const rowsHtml = ranked
      .map((entry, idx) => {
        const rank = idx + 1;
        const medal = getMedalForRank(rank);
        const isMe = entry.userId === userIdentity.userId;
        const pct = Math.min(100, Math.round((entry.solvedCount / totalQuestions) * 100));
        const rankCell = medal
          ? `<span class="lb-rank-medal" title="${medal.label}" aria-label="${medal.label}">${medal.emoji}</span>`
          : `<span class="lb-rank-num tabular-text">${rank}</span>`;

        return `
          <tr class="lb-row${isMe ? " is-me" : ""}${medal ? ` ${medal.cls}` : ""}"${isMe ? ' id="lbMyRow"' : ""}>
            <td class="lb-col-rank">${rankCell}</td>
            <td class="lb-col-user">
              <div class="lb-user-cell">
                <span class="lb-user-emoji" aria-hidden="true">${escapeHtml(entry.emoji)}</span>
                <div class="lb-user-info">
                  <span class="lb-user-name">${escapeHtml(entry.name)}</span>
                  ${isMe ? `<span class="lb-me-badge">את/ה</span>` : ""}
                  ${entry.isOnline ? `<span class="online-user-dot" title="פעיל/ה עכשיו" aria-label="מחובר/ת עכשיו"></span>` : ""}
                </div>
              </div>
            </td>
            <td class="lb-col-metric tabular-text${!isNotesSort ? " is-sorted-col" : ""}">
              <div class="lb-metric-cell">
                <strong>${entry.solvedCount}</strong>
                <span class="lb-metric-sub">${pct}%</span>
              </div>
            </td>
            <td class="lb-col-metric tabular-text${isNotesSort ? " is-sorted-col" : ""}">
              <strong>${entry.notesCount}</strong>
            </td>
          </tr>
        `;
      })
      .join("");

    listMountEl.innerHTML = `
      <div class="lb-table-scroll">
        <table class="lb-table">
          <thead>
            <tr>
              <th class="lb-col-rank">דירוג</th>
              <th class="lb-col-user">משתתף</th>
              <th class="lb-col-metric${!isNotesSort ? " is-sorted-col" : ""}">📝 תשובות</th>
              <th class="lb-col-metric${isNotesSort ? " is-sorted-col" : ""}">💬 הערות</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    `;
  }

  // Export to Obsidian Mistakes Notebook
  async function exportToObsidian() {
    const wrongOrNoted = QUESTIONS.filter((q) => {
      const att = progress.attempts[q.id];
      const note = getMyNoteText(q.id).trim();
      const qComm = getQuestionCommunityNotesList(q.id);
      const qProbs = getQuestionProblemsList(q.id);
      const fl = progress.flags[q.id] || {};
      return (att && !att.isCorrect) || note || qComm.length > 0 || qProbs.length > 0 || fl.star || (!cloudCommunityLoaded && !!fl.problem);
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
  function switchMode(mode, { persist = true, fromUser = false } = {}) {
    if (fromUser) hasUserInteractedWithNav = true;
    if (isStudyMode(currentMode) && currentMode !== mode && !isRestoringSession) {
      recordCurrentModePosition();
    }

    currentMode = mode;
    notesExpanded = false;
    lastRenderedQId = null;
    hideMarkerFloatingPill();
    document.querySelectorAll("#modeTabs .tab-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.mode === mode);
    });

    const isStudy = isStudyMode(mode);
    el("filterPanel").classList.toggle("hidden", !isStudy);
    el("statusFilterRow")?.classList.toggle("hidden", mode === "drill");
    el("studyView").classList.toggle("hidden", !isStudy);
    el("examView").classList.toggle("hidden", mode !== "exam");
    el("analyticsView").classList.toggle("hidden", mode !== "analytics");
    el("leaderboardView")?.classList.toggle("hidden", mode !== "leaderboard");

    if (isStudy) {
      const activeFilters = getActiveFilters();
      if (el("searchInput")) el("searchInput").value = activeFilters.search;
      el("clearSearchBtn")?.classList.toggle("hidden", !activeFilters.search);
      renderFilterChips();
      const savedQId = lastQIdByMode[mode] || null;
      const savedIdx = Number.isInteger(lastIndexByMode[mode]) ? lastIndexByMode[mode] : null;
      applyFilters(savedQId, { preserveShuffle: true, fallbackIndex: savedIdx });
    } else if (mode === "analytics") {
      renderAnalytics();
    } else if (mode === "leaderboard") {
      openLeaderboardView();
    }

    if (persist && !isRestoringSession) {
      persistStudySession();
    }
  }

  function renderCurrentView() {
    if (currentMode === "analytics") renderAnalytics();
    else if (currentMode === "leaderboard") renderLeaderboard();
    else if (currentMode !== "exam") {
      applyFilters(filteredList[currentIndex]?.id, { preserveShuffle: true, fallbackIndex: currentIndex });
    }
    renderResumeSimBanner();
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
      btn.onclick = () => switchMode(btn.dataset.mode, { fromUser: true });
    });

    el("btnResumeSim")?.addEventListener("click", () => resumeSavedSimulation());
    el("btnDiscardSim")?.addEventListener("click", () => {
      if (confirm("למחוק את הסימולציה השמורה? פעולה זו תמחק אותה בכל המכשירים המחוברים.")) {
        clearActiveSimulation({ syncCloud: true });
        showToast("🗑️ הסימולציה השמורה נמחקה.");
      }
    });

    el("btnLbSortAnswers")?.addEventListener("click", () => setLeaderboardSort("answers"));
    el("btnLbSortNotes")?.addEventListener("click", () => setLeaderboardSort("notes"));
    el("btnRefreshLeaderboard")?.addEventListener("click", () => fetchLeaderboard({ force: true, showFeedback: true }));
    el("btnLbJumpToMe")?.addEventListener("click", () => {
      const myRow = el("lbMyRow");
      if (!myRow) return;
      myRow.scrollIntoView({ behavior: "smooth", block: "center" });
      myRow.classList.remove("lb-row-flash");
      void myRow.offsetWidth;
      myRow.classList.add("lb-row-flash");
    });

    el("btnTheme").onclick = toggleTheme;
    el("btnExportObsidian").onclick = exportToObsidian;

    // Search
    el("searchInput").addEventListener("input", (e) => {
      hasUserInteractedWithNav = true;
      const activeFilters = getActiveFilters();
      activeFilters.search = e.target.value;
      el("clearSearchBtn").classList.toggle("hidden", !activeFilters.search);
      applyFilters();
      persistStudySession();
    });
    el("clearSearchBtn").onclick = () => {
      hasUserInteractedWithNav = true;
      const activeFilters = getActiveFilters();
      activeFilters.search = "";
      el("searchInput").value = "";
      el("clearSearchBtn").classList.add("hidden");
      applyFilters();
      persistStudySession();
    };

    // Merge pathology toggle
    el("mergePathologyToggle").onchange = (e) => {
      hasUserInteractedWithNav = true;
      filters.mergePathology = e.target.checked;
      filters.subjects.clear();
      drillFilters.subjects.clear();
      renderFilterChips();
      initExamSetup();
      applyFilters();
      persistStudySession();
    };

    el("btnToggleFilters").onclick = () => {
      const hidden = !el("filterBody")?.classList.contains("hidden");
      setFilterPanelCollapsed(hidden);
      persistStudySession();
    };

    if (el("btnShuffleOptionsMobile")) {
      el("btnShuffleOptionsMobile").onclick = toggleShuffleOptions;
    }

    // Year quick buttons
    el("btnRecentYears").onclick = () => {
      hasUserInteractedWithNav = true;
      getActiveFilters().exams = new Set(["2026", "2025", "2024", "2022", "2021"]);
      renderFilterChips();
      applyFilters();
      persistStudySession();
    };
    el("btnAllYears").onclick = () => {
      hasUserInteractedWithNav = true;
      getActiveFilters().exams = new Set(EXAMS.map((ex) => ex.name));
      renderFilterChips();
      applyFilters();
      persistStudySession();
    };
    el("btnClearYears").onclick = () => {
      hasUserInteractedWithNav = true;
      getActiveFilters().exams.clear();
      renderFilterChips();
      applyFilters();
      persistStudySession();
    };
    el("btnAllSubjects").onclick = () => {
      hasUserInteractedWithNav = true;
      getActiveFilters().subjects = new Set(getUniqueSubjects());
      renderFilterChips();
      applyFilters();
      persistStudySession();
    };
    el("btnClearSubjects").onclick = () => {
      hasUserInteractedWithNav = true;
      getActiveFilters().subjects.clear();
      renderFilterChips();
      applyFilters();
      persistStudySession();
    };
    el("btnAllStatuses").onclick = () => {
      hasUserInteractedWithNav = true;
      filters.statuses = new Set(getStatusKeys());
      renderFilterChips();
      applyFilters();
      persistStudySession();
    };
    el("btnClearStatuses").onclick = () => {
      hasUserInteractedWithNav = true;
      filters.statuses.clear();
      renderFilterChips();
      applyFilters();
      persistStudySession();
    };

    // Status chips (multi-select toggle)
    el("statusChips").querySelectorAll(".chip[data-status]").forEach((c) => {
      c.onclick = () => {
        hasUserInteractedWithNav = true;
        const st = c.dataset.status;
        if (filters.statuses.has(st)) filters.statuses.delete(st);
        else filters.statuses.add(st);
        renderFilterChips();
        applyFilters();
        persistStudySession();
      };
    });

    el("btnResetFiltersEmpty").onclick = () => {
      hasUserInteractedWithNav = true;
      const activeFilters = getActiveFilters();
      activeFilters.exams.clear();
      activeFilters.subjects.clear();
      if (currentMode !== "drill") filters.statuses.clear();
      activeFilters.search = "";
      el("searchInput").value = "";
      el("clearSearchBtn").classList.add("hidden");
      renderFilterChips();
      applyFilters();
      persistStudySession();
    };

    el("btnShuffleQuestions").onclick = shuffleFilteredQuestions;
    el("btnShuffleOptions").onclick = toggleShuffleOptions;

    el("btnJump").onclick = () => {
      const v = parseInt(el("jumpInput").value, 10);
      if (v >= 1 && v <= filteredList.length) {
        hasUserInteractedWithNav = true;
        currentIndex = v - 1;
        renderQuestion();
        persistStudySession();
      }
    };

    // Question controls
    el("btnPrevQ").onclick = prevQuestion;
    el("btnNextQ").onclick = nextQuestion;
    el("btnFlagMarker").onclick = () => toggleMarkerMode();
    el("btnClearMarkers").onclick = () => {
      if (filteredList.length > 0) clearQuestionHighlights(filteredList[currentIndex].id);
    };
    el("btnFlagStar").onclick = () => toggleFlag("star");
    el("btnFlagUnsure").onclick = () => toggleFlag("unsure");
    el("btnFlagProblem").onclick = () => {
      if (filteredList.length === 0) return;
      openProblemModal(filteredList[currentIndex].id);
    };

    // Stem highlighter interactions (Practice, Drill, Flashcard & Exam Simulation)
    const handleStemMarkClick = (e) => {
      const markEl = e.target?.closest?.(".q-mark");
      if (!markEl) return;
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed) return;
      if (!markerMode) return;
      const ctx = getActiveStemContext();
      if (!ctx || !ctx.stemEl.contains(markEl)) return;
      const idx = parseInt(markEl.dataset.rangeIdx || "-1", 10);
      if (idx >= 0) removeStemHighlightAt(ctx.q.id, idx);
    };
    const handleStemMarkContext = (e) => {
      const markEl = e.target?.closest?.(".q-mark");
      if (!markEl) return;
      const ctx = getActiveStemContext();
      if (!ctx || !ctx.stemEl.contains(markEl)) return;
      e.preventDefault();
      const idx = parseInt(markEl.dataset.rangeIdx || "-1", 10);
      if (idx >= 0) removeStemHighlightAt(ctx.q.id, idx);
    };
    el("qStem")?.addEventListener("click", handleStemMarkClick);
    el("qStem")?.addEventListener("contextmenu", handleStemMarkContext);
    el("simQuestionMount")?.addEventListener("click", handleStemMarkClick);
    el("simQuestionMount")?.addEventListener("contextmenu", handleStemMarkContext);

    const floatingPill = el("markerFloatingPill");
    floatingPill?.addEventListener("mousedown", (e) => e.preventDefault());
    floatingPill?.addEventListener("click", (e) => {
      e.stopPropagation();
      if (pendingMarkerSelection) {
        addStemHighlight(pendingMarkerSelection.qId, pendingMarkerSelection.start, pendingMarkerSelection.end);
      } else {
        hideMarkerFloatingPill();
      }
    });

    document.addEventListener("mouseup", (e) => {
      if (e.target === floatingPill) return;
      const ctx = getActiveStemContext();
      if (!ctx) {
        hideMarkerFloatingPill();
        return;
      }
      const offsets = getStemSelectionOffsets(ctx.stemEl);
      if (!offsets) {
        hideMarkerFloatingPill();
        return;
      }
      if (markerMode) {
        addStemHighlight(ctx.q.id, offsets.start, offsets.end);
      } else {
        showMarkerFloatingPill(ctx, offsets);
      }
    });

    document.addEventListener("selectionchange", () => {
      clearTimeout(markerSelectionTimer);
      markerSelectionTimer = setTimeout(() => {
        const ctx = getActiveStemContext();
        if (!ctx) {
          hideMarkerFloatingPill();
          return;
        }
        const offsets = getStemSelectionOffsets(ctx.stemEl);
        if (!offsets) {
          hideMarkerFloatingPill();
          return;
        }
        if (!markerMode || window.matchMedia?.("(pointer: coarse)")?.matches) {
          showMarkerFloatingPill(ctx, offsets);
        }
      }, 140);
    });

    window.addEventListener("scroll", () => {
      if (pendingMarkerSelection) hideMarkerFloatingPill();
    }, { passive: true });

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
      if (currentMode === "drill") {
        renderFilterChips();
        updateFilterCountsUI();
      }
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
      lastNoteMutationAt = Date.now();
      leaderboardLastFetchedAt = 0;
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

    // Online users indicator & popover
    el("btnOnlineUsers")?.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleOnlineUsersPopover();
    });
    el("btnCloseOnlineUsers")?.addEventListener("click", () => closeOnlineUsersPopover());
    el("btnRefreshOnlineUsers")?.addEventListener("click", () => refreshOnlineUsers({ pingMe: true }));
    document.addEventListener("click", (e) => {
      const wrap = el("onlineUsersWrap");
      if (wrap && !wrap.contains(e.target)) {
        closeOnlineUsersPopover();
      }
    });

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

    // Onboarding Spotlight Tour
    el("btnHelpTour")?.addEventListener("click", () => startOnboardingTour({ manual: true }));
    el("btnTourNext")?.addEventListener("click", nextTourStep);
    el("btnTourPrev")?.addEventListener("click", prevTourStep);
    el("btnTourSkip")?.addEventListener("click", () => closeOnboardingTour({ markSeen: true }));
    el("btnTourClose")?.addEventListener("click", () => closeOnboardingTour({ markSeen: true }));
    el("tourBackdrop")?.addEventListener("click", (e) => e.stopPropagation());

    const handleTourViewportChange = () => {
      if (!tourState.active) return;
      requestAnimationFrame(() => {
        if (tourState.active) positionTourSpotlightAndPopover();
      });
    };
    window.addEventListener("resize", handleTourViewportChange);
    window.addEventListener("scroll", handleTourViewportChange, { passive: true });

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
          if (progress.studySession && !simState.active) {
            applyStudySessionState(progress.studySession, { showToastInfo: false });
          } else {
            renderCurrentView();
          }
          renderResumeSimBanner();
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
        shuffledQuestionOrder = null;
        drillShuffledOrder = null;
        lastQIdByMode = {};
        lastIndexByMode = {};
        setShuffleOptionsEnabled(false);
        filters.exams.clear();
        filters.subjects.clear();
        filters.statuses.clear();
        filters.search = "";
        drillFilters.exams.clear();
        drillFilters.subjects.clear();
        drillFilters.search = "";
        if (el("searchInput")) el("searchInput").value = "";
        el("clearSearchBtn")?.classList.add("hidden");
        renderFilterChips();
        saveProgress({ syncCloud: true, immediateCloud: true });
        renderResumeSimBanner();
        if (currentMode === "analytics") renderAnalytics();
        else if (currentMode === "leaderboard") renderLeaderboard();
        else if (currentMode !== "exam") applyFilters();
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
      if (tourState.active) {
        if (e.key === "Escape") {
          e.preventDefault();
          closeOnboardingTour({ markSeen: true });
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          nextTourStep();
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          prevTourStep();
        } else if (e.key === "Enter") {
          const activeEl = document.activeElement;
          const popoverEl = el("tourPopover");
          if (!activeEl || !popoverEl?.contains(activeEl) || activeEl === popoverEl) {
            e.preventDefault();
            nextTourStep();
          }
        }
        return;
      }
      if (e.key === "Escape") {
        closeLightbox();
        closeOnlineUsersPopover();
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
      if (e.key.toLowerCase() === "m") {
        if (getActiveStemContext()) {
          e.preventDefault();
          toggleMarkerMode();
        }
        return;
      }
      if (currentMode === "analytics" || currentMode === "leaderboard" || currentMode === "exam") return;
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
    if (currentMode !== "exam" && currentMode !== "analytics" && currentMode !== "leaderboard" && filteredList.length > 0) {
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
      if (targetUserId === userIdentity.userId && progress.notes && Object.prototype.hasOwnProperty.call(progress.notes, qId)) {
        delete progress.notes[qId];
        if (!progress.noteUpdatedAt) progress.noteUpdatedAt = {};
        progress.noteUpdatedAt[qId] = Date.now();
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
        } catch {}
      }
      lastNoteMutationAt = Date.now();
      leaderboardLastFetchedAt = 0;
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
      if (targetUserId === userIdentity.userId && progress.flags?.[qId]?.problem) {
        delete progress.flags[qId].problem;
        if (Object.keys(progress.flags[qId]).length === 0) delete progress.flags[qId];
        if (!progress.flagUpdatedAt) progress.flagUpdatedAt = {};
        if (!progress.flagUpdatedAt[qId]) progress.flagUpdatedAt[qId] = {};
        progress.flagUpdatedAt[qId].problem = Date.now();
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
        } catch {}
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
    filters.statuses.clear();
    filters.search = "";
    el("searchInput").value = "";
    el("clearSearchBtn").classList.add("hidden");
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
    if (prog?.activeSim && Array.isArray(prog.activeSim.questionIds) && prog.activeSim.questionIds.length > 0) return true;
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
      if (cloudProgressSyncState === "error") {
        cls = "error";
        label = "ממתין לסנכרון";
      } else if (cloudProgressSyncState === "offline") {
        cls = "offline";
        label = "שמירה בדפדפן";
      } else {
        cls = "online";
        label = "מסונכרן בענן";
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
      const myNotesCount = getMyLocalNotesCount();
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
    if (tourState.pendingAfterSyncModal && !hasSeenOnboarding()) {
      tourState.pendingAfterSyncModal = false;
      setTimeout(() => {
        if (!tourState.active && !simState.active && !isAnyBlockingModalOpen()) {
          startOnboardingTour({ manual: false });
        }
      }, 120);
    }
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
        identityRegisteredInCloud = true;
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
    const prevStudyTs = Number(progress.studySessionUpdatedAt) || 0;
    const prevActiveSimJson = JSON.stringify(progress.activeSim || null);
    const prevActiveSimTs = Number(progress.activeSimUpdatedAt) || 0;

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

    const nextActiveSimJson = JSON.stringify(progress.activeSim || null);
    const nextActiveSimTs = Number(progress.activeSimUpdatedAt) || 0;
    if (nextActiveSimJson !== prevActiveSimJson || nextActiveSimTs !== prevActiveSimTs) {
      renderResumeSimBanner();
    }

    const nextStudyTs = Number(progress.studySessionUpdatedAt) || 0;
    const nextSess = progress.studySession;
    const arrivedFromOtherDevice = Boolean(
      nextSess &&
      nextStudyTs > prevStudyTs &&
      nextSess.deviceId &&
      nextSess.deviceId !== deviceId
    );
    const arrivedNewSessionOnStartup = Boolean(
      nextSess &&
      prevStudyTs === 0 &&
      nextStudyTs > 0 &&
      !hasUserInteractedWithNav
    );

    let handledSessionSwitch = false;
    if (arrivedFromOtherDevice && rerender && !simState.active && !tourState.active) {
      const targetMode = nextSess.mode || "practice";
      const targetQId = nextSess.lastQIdByMode?.[targetMode];
      const targetQ = targetQId ? Q_MAP.get(targetQId) : null;
      const locLabel = targetQ ? `${targetQ.exam} שאלה ${targetQ.num}` : "";

      if (!hasUserInteractedWithNav) {
        applyStudySessionState(nextSess, { showToastInfo: true, fromOtherDevice: true });
        handledSessionSwitch = true;
      } else {
        const msg = locLabel
          ? `☁️ התקדמות חדשה ממכשיר אחר (${locLabel})`
          : "☁️ התקדמות חדשה ממכשיר אחר";
        showToast(msg, {
          actionLabel: "עבור לשם",
          onAction: () => {
            if (simState.active) {
              showToast("⏱️ לא ניתן לעבור בזמן סימולציה פעילה");
              return;
            }
            if (progress.studySession) {
              applyStudySessionState(progress.studySession, { showToastInfo: false });
            }
          },
          duration: 7000,
        });
      }
    } else if (arrivedNewSessionOnStartup && rerender && !simState.active && !tourState.active) {
      applyStudySessionState(nextSess, { showToastInfo: false, fromOtherDevice: false });
      handledSessionSwitch = true;
    }

    if (!handledSessionSwitch && rerender && !simState.active) {
      const activeTag = document.activeElement?.id;
      if (currentMode === "analytics") {
        renderAnalytics();
      } else if (currentMode === "leaderboard") {
        renderLeaderboard();
      } else if (currentMode !== "exam") {
        if (activeTag === "qNoteInput") {
          // Avoid interrupting an active note draft; refresh on next navigation
          updateDrillBadge();
        } else {
          applyFilters(filteredList[currentIndex]?.id, { preserveShuffle: true, fallbackIndex: currentIndex });
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
        if (Number(data.version) > 0) {
          lastSyncedProgressVersion = Number(data.version);
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
        if (Number(data.version) > 0) {
          lastSyncedProgressVersion = Number(data.version);
        }
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

  async function pollCloudState({ touchPresence = true, silent = true } = {}) {
    if (!isCloudApiConfigured()) return false;
    if (cloudPollInFlight) return cloudPollInFlight;

    const runPoll = async () => {
      try {
        if (!identityRegisteredInCloud) {
          await registerIdentityPing(false);
        }
        if (cloudProgressDirty) {
          await pushCloudProgress();
        }

        const params = new URLSearchParams({
          communityVersion: String(lastCommunityVersion || 0),
          progressVersion: String(lastSyncedProgressVersion || 0),
          touchPresence: touchPresence ? "1" : "0",
        });
        const res = await fetch(`${CLOUD_API_BASE}/api/poll?${params.toString()}`, {
          method: "GET",
          headers: {
            "X-User-Id": userIdentity.userId,
            "X-Client-Secret": userIdentity.clientSecret,
          },
          cache: "no-store",
        });

        if (res.status === 404) {
          const okProg = await pullCloudProgress({ silent });
          const okBoot = await bootstrapCloudState(false);
          lastCloudPollAt = Date.now();
          return okProg && okBoot;
        }

        if (!res.ok) {
          cloudProgressSyncState = "error";
          updateSyncStatusUI();
          return false;
        }

        const data = await res.json().catch(() => ({}));
        lastCloudPollAt = Date.now();

        if (Array.isArray(data.onlineUsers)) {
          updateOnlineUsersState(data.onlineUsers, {
            loaded: true,
            serverTime: Number(data.serverTime) || 0,
          });
        }

        if (data.progressStatus === 403) {
          cloudProgressSyncState = "error";
          updateSyncStatusUI();
          if (!silent) showToast("⚠️ חיבור המכשיר בוטל ממכשיר אחר.");
        } else if (data.progressStatus === 200) {
          if (data.progressChanged && data.progress) {
            applyMergedCloudProgress(data.progress, { rerender: true });
            if (Number(data.progressVersion) > 0) {
              lastSyncedProgressVersion = Number(data.progressVersion);
            }
            cloudProgressSyncState = "synced";
            updateSyncStatusUI();
          } else if (!data.hasServerProgress && hasSubstantialLocalProgress(progress)) {
            await pushCloudProgress();
          } else {
            if (Number(data.progressVersion) > 0) {
              lastSyncedProgressVersion = Number(data.progressVersion);
            }
            if (!cloudProgressDirty) {
              cloudProgressSyncState = "synced";
              updateSyncStatusUI();
            }
          }
        }

        if (data.communityChanged) {
          applyCloudCommunityPayload({
            notes: data.notes && typeof data.notes === "object" ? data.notes : {},
            problems: data.problems && typeof data.problems === "object" ? data.problems : {},
            overrides: data.overrides && typeof data.overrides === "object" ? data.overrides : {},
            communityVersion: Number(data.communityVersion) || 0,
            mirrorToLocalServer: true,
            fromCloud: true,
          });
        } else if (Number(data.communityVersion) > 0) {
          lastCommunityVersion = Number(data.communityVersion);
        }

        return true;
      } catch {
        cloudProgressSyncState = "offline";
        updateSyncStatusUI();
        return false;
      }
    };

    cloudPollInFlight = runPoll().finally(() => {
      cloudPollInFlight = null;
    });
    return cloudPollInFlight;
  }

  async function syncNowManual() {
    if (!isCloudApiConfigured()) {
      showToast("⚠️ סנכרון הענן אינו זמין כרגע.");
      return;
    }
    await registerIdentityPing(false);
    await ensureSyncCodeRegistered();
    const okProg = cloudProgressDirty ? await pushCloudProgress() : await pullCloudProgress({ silent: false });
    const okBoot = await bootstrapCloudState(false);
    lastCloudPollAt = Date.now();
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
      identityRegisteredInCloud = true;
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
      if (Number(data.version) > 0) {
        lastSyncedProgressVersion = Number(data.version);
      }
      const inputEl = el("syncConnectInput");
      if (inputEl) inputEl.value = "";

      updateIdentityUI();
      updateDrillBadge();
      updateSyncStatusUI();
      await bootstrapCloudState(false);
      lastCloudPollAt = Date.now();
      if (progress.studySession && !simState.active && !hasUserInteractedWithNav) {
        const fromOther = Boolean(progress.studySession.deviceId && progress.studySession.deviceId !== deviceId);
        applyStudySessionState(progress.studySession, { showToastInfo: fromOther, fromOtherDevice: fromOther });
      } else {
        renderCurrentView();
      }
      renderResumeSimBanner();
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

  // ============================================================
  // Onboarding Spotlight Tour
  // ============================================================

  function hasSeenOnboarding() {
    try {
      return localStorage.getItem(ONBOARDING_SEEN_KEY) === "1";
    } catch {
      return false;
    }
  }

  function markOnboardingSeen() {
    try {
      localStorage.setItem(ONBOARDING_SEEN_KEY, "1");
    } catch {}
  }

  function isAnyBlockingModalOpen() {
    const modalIds = [
      "syncModal",
      "backupModal",
      "shortcutsModal",
      "problemReportModal",
      "adminLoginModal",
      "adminQuestionModal",
      "adminDashboardModal",
      "lightboxModal",
    ];
    return modalIds.some((id) => {
      const node = el(id);
      return node && !node.classList.contains("hidden");
    });
  }

  function getTourSteps() {
    const identityLabel = escapeHtml(`${userIdentity?.emoji || "🩺"} ${userIdentity?.name || "אנונימי"}`);
    return [
      {
        target: null,
        title: "🩺 ברוכים הבאים למבחני עבר – מקבץ 1",
        html: `
          <p class="tour-lead">הכינוי האנונימי שלך במכשיר זה הוא <span class="tour-tag">${identityLabel}</span>.</p>
          <ul class="tour-points">
            <li><strong>שמירה אוטומטית מלאה:</strong> ההתקדמות, הסימונים וההערות שלך נשמרים אוטומטית בדפדפן ובענן מרגע הפתרון — ללא צורך בהרשמה.</li>
            <li>סיור קצר בן 7 צעדים יראה לך איפה נמצא כל כלי באתר.</li>
          </ul>
        `,
      },
      {
        target: "#modeTabs",
        title: "🧭 6 מצבי לימוד",
        html: `
          <ul class="tour-points">
            <li><strong>תרגול:</strong> פתרון חופשי עם משוב מיידי והערות.</li>
            <li><strong>סימולציית מבחן:</strong> תנאי מבחן אמיתיים עם טיימר ומפת שאלות.</li>
            <li><strong>תיקון טעויות:</strong> חזרה ממוקדת עד <strong>2 הצלחות ברצף</strong> לכל שאלה.</li>
            <li><strong>כרטיסיות, אנליטיקה ולידרבורד:</strong> שינון מהיר, מעקב מוכנות ודירוג משתתפים.</li>
          </ul>
        `,
      },
      {
        target: "#btnSyncModal",
        title: "☁️ סנכרון ושמירה בין מכשירים",
        html: `
          <ul class="tour-points">
            <li>מציג את מצב הסנכרון בענן בזמן אמת.</li>
            <li>לחיצה פותחת <strong>קוד סנכרון בן 12 תווים, קישור קסם ו-QR</strong> כדי להעביר או למזג את ההתקדמות והכינוי שלך בין המחשב, האייפד והטלפון.</li>
          </ul>
        `,
      },
      {
        target: ".topbar-utils",
        title: "🛠️ כלים שימושיים בסרגל העליון",
        html: `
          <ul class="tour-points">
            <li>הכינוי שלך (<span class="tour-tag">${identityLabel}</span>) וכפתור <strong>מחוברים עכשיו</strong> לראות מי מתרגל כרגע.</li>
            <li><strong>ייצוא</strong> שגיאות והערות ל-Markdown/Obsidian ו<strong>גיבוי</strong> מלא לקובץ JSON.</li>
            <li>החלפת <strong>מצב כהה/בהיר</strong>, ובמחשב גם <strong>קיצורי מקלדת</strong>.</li>
          </ul>
        `,
      },
      {
        target: "#filterPanel",
        compactTarget: "#filterPanel .filter-header",
        title: "🔍 חיפוש, סינון וערבוב",
        html: `
          <ul class="tour-points">
            <li>חיפוש חופשי בכל השאלות, המסיחים וההערות.</li>
            <li>ערבוב שאלות או מסיחים (<span class="tour-tag">🔀</span> / <span class="tour-tag">🎲</span>).</li>
            <li>פתיחת <strong>סינון</strong> לפילוח לפי שנה, מקצוע וסטטוס (טעיתי, מועדפים, עם תמונה, עם הערות קהילה) או קפיצה ישירה לשאלה.</li>
          </ul>
        `,
      },
      {
        target: "#questionCard .q-header",
        title: "⭐ סימונים, פסילה ודיווח",
        html: `
          <ul class="tour-points">
            <li><span class="tour-tag">⭐</span> מועדפים, <span class="tour-tag">🤔</span> התלבטתי, <span class="tour-tag">⚠️</span> דיווח בעיה לכולם, וקישור <span class="tour-tag">📖</span> למבחן המקורי.</li>
            <li><strong>בשאלה עצמה:</strong> לחיצה על <span class="tour-tag">✂️</span> (או קליק ימני / <span class="tour-tag">Shift+1–5</span>) פוסלת מסיח, ולחיצה על תמונה פותחת זום.</li>
          </ul>
        `,
      },
      {
        target: "#qNotesContainer",
        title: "💬 הערות ופנינים משותפות",
        html: `
          <ul class="tour-points">
            <li>המגירה סגורה כברירת מחדל כדי למנוע ספוילרים (לחיצה או <span class="tour-tag">N</span> לפתיחה).</li>
            <li>אפשר לקרוא פנינים של כולם ולפרסם, לערוך או למחוק הערה משלך בענן.</li>
            <li>ניתן לפתוח את המדריך שוב בכל רגע דרך כפתור <span class="tour-tag">?</span> בסרגל העליון.</li>
          </ul>
        `,
      },
    ];
  }

  function getTourTargetElement(step) {
    if (!step || !step.target) return null;
    const isVisibleNode = (node) => {
      if (!node) return false;
      if (node.closest(".hidden")) return false;
      const style = window.getComputedStyle(node);
      if (style.display === "none" || style.visibility === "hidden") return false;
      const rect = node.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };
    const node = document.querySelector(step.target);
    if (!isVisibleNode(node)) return null;
    if (step.compactTarget) {
      const topbarEl = document.querySelector(".topbar");
      const topbarH = topbarEl ? topbarEl.getBoundingClientRect().height : 0;
      const rect = node.getBoundingClientRect();
      if (rect.height > window.innerHeight - topbarH - 270) {
        const compactNode = document.querySelector(step.compactTarget);
        if (isVisibleNode(compactNode)) return compactNode;
      }
    }
    return node;
  }

  function positionTourSpotlightAndPopover() {
    if (!tourState.active) return;
    const step = tourState.steps[tourState.stepIndex];
    const backdrop = el("tourBackdrop");
    const spotlight = el("tourSpotlight");
    const popover = el("tourPopover");
    if (!step || !backdrop || !spotlight || !popover) return;

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const margin = 12;
    const gap = 12;
    const targetEl = getTourTargetElement(step);

    if (!targetEl) {
      backdrop.classList.add("is-centered");
      spotlight.classList.add("hidden");
      const popRect = popover.getBoundingClientRect();
      const left = Math.max(margin, Math.round((vw - popRect.width) / 2));
      const top = Math.max(margin, Math.round((vh - popRect.height) / 2));
      popover.style.left = `${left}px`;
      popover.style.top = `${top}px`;
      return;
    }

    backdrop.classList.remove("is-centered");
    spotlight.classList.remove("hidden");

    const pad = 6;
    const raw = targetEl.getBoundingClientRect();
    const spotLeft = Math.max(4, raw.left - pad);
    const spotTop = Math.max(4, raw.top - pad);
    const spotRight = Math.min(vw - 4, raw.right + pad);
    const spotBottom = Math.min(vh - 4, raw.bottom + pad);
    const spotW = Math.max(24, spotRight - spotLeft);
    const spotH = Math.max(24, spotBottom - spotTop);

    spotlight.style.left = `${Math.round(spotLeft)}px`;
    spotlight.style.top = `${Math.round(spotTop)}px`;
    spotlight.style.width = `${Math.round(spotW)}px`;
    spotlight.style.height = `${Math.round(spotH)}px`;

    const popRect = popover.getBoundingClientRect();
    const popW = popRect.width;
    const popH = popRect.height;

    const spaceBelow = vh - spotBottom - gap - margin;
    const spaceAbove = spotTop - gap - margin;
    const spaceLeft = spotLeft - gap - margin;
    const spaceRight = vw - spotRight - gap - margin;

    let left;
    let top;

    if (vw <= 720) {
      left = Math.max(margin, Math.round((vw - popW) / 2));
      if (spaceBelow >= popH && (spotTop < vh / 2 || spaceBelow >= spaceAbove)) {
        top = Math.min(vh - popH - margin, Math.round(spotBottom + gap));
      } else if (spaceAbove >= popH) {
        top = Math.max(margin, Math.round(spotTop - gap - popH));
      } else if (spaceBelow >= spaceAbove) {
        top = Math.max(margin, vh - popH - margin);
      } else {
        top = margin;
      }
    } else {
      const centeredX = Math.round(spotLeft + (spotW - popW) / 2);
      const rtlAlignedX = Math.round(spotRight - popW);
      const preferredX = spotW > popW ? centeredX : rtlAlignedX;
      const clampedX = Math.min(vw - popW - margin, Math.max(margin, preferredX));

      if (spaceBelow >= popH) {
        left = clampedX;
        top = Math.round(spotBottom + gap);
      } else if (spaceAbove >= popH) {
        left = clampedX;
        top = Math.round(spotTop - gap - popH);
      } else if (spaceLeft >= popW) {
        left = Math.round(spotLeft - gap - popW);
        top = Math.min(vh - popH - margin, Math.max(margin, Math.round(spotTop)));
      } else if (spaceRight >= popW) {
        left = Math.round(spotRight + gap);
        top = Math.min(vh - popH - margin, Math.max(margin, Math.round(spotTop)));
      } else {
        left = clampedX;
        top = spaceBelow >= spaceAbove ? Math.max(margin, vh - popH - margin) : margin;
      }
    }

    left = Math.min(Math.max(margin, vw - popW - margin), Math.max(margin, left));
    top = Math.min(Math.max(margin, vh - popH - margin), Math.max(margin, top));
    popover.style.left = `${left}px`;
    popover.style.top = `${top}px`;
  }

  function renderTourStep() {
    if (!tourState.active) return;
    const total = tourState.steps.length;
    const step = tourState.steps[tourState.stepIndex];
    if (!step) return;

    const counterEl = el("tourStepCounter");
    const titleEl = el("tourTitle");
    const bodyEl = el("tourBody");
    const dotsEl = el("tourDots");
    const prevBtn = el("btnTourPrev");
    const nextBtn = el("btnTourNext");
    const skipBtn = el("btnTourSkip");

    if (counterEl) counterEl.textContent = `${tourState.stepIndex + 1} / ${total}`;
    if (titleEl) titleEl.textContent = step.title;
    if (bodyEl) bodyEl.innerHTML = step.html;
    if (dotsEl) {
      dotsEl.innerHTML = tourState.steps
        .map((_, idx) => `<span class="tour-dot${idx === tourState.stepIndex ? " active" : ""}"></span>`)
        .join("");
    }
    if (prevBtn) prevBtn.disabled = tourState.stepIndex === 0;
    if (nextBtn) nextBtn.textContent = tourState.stepIndex === total - 1 ? "סיום!" : "הבא";
    if (skipBtn) skipBtn.classList.toggle("hidden", tourState.stepIndex === total - 1);

    const targetEl = getTourTargetElement(step);
    if (targetEl && !targetEl.closest(".topbar")) {
      const rect = targetEl.getBoundingClientRect();
      const topbarEl = document.querySelector(".topbar");
      const topbarH = topbarEl ? topbarEl.getBoundingClientRect().height : 0;
      const inView = rect.top >= topbarH + 12 && rect.bottom <= window.innerHeight - 16;
      if (!inView) {
        const availableH = window.innerHeight - topbarH;
        const desiredTop = rect.height <= availableH - 160
          ? window.scrollY + rect.top - topbarH - Math.max(16, (availableH - rect.height) / 2)
          : window.scrollY + rect.top - topbarH - 12;
        window.scrollTo({ top: Math.max(0, Math.round(desiredTop)), behavior: "smooth" });
      }
    }

    if (tourScrollTimer) {
      clearTimeout(tourScrollTimer);
      tourScrollTimer = null;
    }
    requestAnimationFrame(() => positionTourSpotlightAndPopover());
    tourScrollTimer = setTimeout(() => {
      tourScrollTimer = null;
      if (tourState.active) positionTourSpotlightAndPopover();
    }, 260);
  }

  function nextTourStep() {
    if (!tourState.active) return;
    if (tourState.stepIndex < tourState.steps.length - 1) {
      tourState.stepIndex += 1;
      renderTourStep();
    } else {
      closeOnboardingTour({ markSeen: true });
    }
  }

  function prevTourStep() {
    if (!tourState.active) return;
    if (tourState.stepIndex > 0) {
      tourState.stepIndex -= 1;
      renderTourStep();
    }
  }

  function startOnboardingTour({ manual = false } = {}) {
    if (simState.active) {
      if (manual) showToast("⏱️ לא ניתן לפתוח את המדריך בזמן סימולציית מבחן פעילה.");
      return false;
    }
    if (isAnyBlockingModalOpen()) return false;
    closeOnlineUsersPopover();

    const previousMode = currentMode;
    if (currentMode !== "practice") {
      switchMode("practice", { persist: false });
    }

    const steps = getTourSteps().filter((s) => !s.target || Boolean(getTourTargetElement(s)));
    if (steps.length === 0) {
      if (previousMode !== currentMode) switchMode(previousMode, { persist: false });
      return false;
    }

    tourState.active = true;
    tourState.stepIndex = 0;
    tourState.steps = steps;
    tourState.returnMode = previousMode !== "practice" ? previousMode : null;
    tourState.pendingAfterSyncModal = false;
    tourState.manual = Boolean(manual);

    const layer = el("tourLayer");
    if (layer) {
      layer.classList.remove("hidden");
      layer.setAttribute("aria-hidden", "false");
    }

    renderTourStep();
    requestAnimationFrame(() => {
      el("btnTourNext")?.focus({ preventScroll: true });
    });
    return true;
  }

  function closeOnboardingTour({ markSeen = true } = {}) {
    if (!tourState.active) return;
    if (tourScrollTimer) {
      clearTimeout(tourScrollTimer);
      tourScrollTimer = null;
    }
    const wasReturnMode = tourState.returnMode;
    const wasManual = tourState.manual;

    tourState.active = false;
    tourState.stepIndex = 0;
    tourState.steps = [];
    tourState.returnMode = null;
    tourState.manual = false;

    const layer = el("tourLayer");
    if (layer) {
      layer.classList.add("hidden");
      layer.setAttribute("aria-hidden", "true");
    }
    if (markSeen) {
      markOnboardingSeen();
    }
    if (wasReturnMode && wasReturnMode !== currentMode) {
      switchMode(wasReturnMode, { persist: false });
    }
    if (wasManual) {
      el("btnHelpTour")?.focus();
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
  if (progress.studySession) {
    const s = progress.studySession;
    const f = s.filters || {};
    const df = s.drillFilters || {};
    const curModeKey = s.mode || "practice";
    const hasNonDefault =
      (s.mode && s.mode !== "practice") ||
      (Array.isArray(f.exams) && f.exams.length > 0) ||
      (Array.isArray(f.subjects) && f.subjects.length > 0) ||
      (Array.isArray(f.statuses) && f.statuses.length > 0) ||
      (typeof f.search === "string" && f.search.trim().length > 0) ||
      (Array.isArray(s.shuffledOrder) && s.shuffledOrder.length > 0) ||
      (Array.isArray(df.exams) && df.exams.length > 0) ||
      (Array.isArray(df.subjects) && df.subjects.length > 0) ||
      (typeof df.search === "string" && df.search.trim().length > 0) ||
      (Array.isArray(s.drillShuffledOrder) && s.drillShuffledOrder.length > 0) ||
      Boolean(s.shuffleOptions) ||
      Boolean(s.filterCollapsed) ||
      (s.lastIndexByMode?.[curModeKey] || 0) > 0;
    applyStudySessionState(s, { showToastInfo: hasNonDefault, fromOtherDevice: false });
  } else {
    applyFilters();
  }
  renderResumeSimBanner();
  checkServer();

  (async () => {
    await bootstrapCloudState(false);
    const linkedMagic = initialMagicSyncCode ? await handleMagicSyncOnStartup(initialMagicSyncCode) : false;
    if (!linkedMagic) {
      await registerIdentityPing(false);
      await ensureSyncCodeRegistered();
      await pullCloudProgress({ silent: true });
    }
    lastCloudPollAt = Date.now();
    if (!hasSeenOnboarding() && !tourState.active && !simState.active) {
      if (!el("syncModal")?.classList.contains("hidden")) {
        tourState.pendingAfterSyncModal = true;
      } else if (!isAnyBlockingModalOpen()) {
        startOnboardingTour({ manual: false });
      }
    }
  })();

  initAdminAuth();

  function markUserActivity() {
    const now = Date.now();
    if (now - lastActivityThrottleAt < 5000) return;
    lastActivityThrottleAt = now;
    const wasIdle = now - lastUserActivityAt > USER_IDLE_TIMEOUT_MS;
    lastUserActivityAt = now;
    if (
      wasIdle &&
      document.visibilityState !== "hidden" &&
      isCloudApiConfigured() &&
      now - lastCloudPollAt > CLOUD_POLL_INTERVAL_MS
    ) {
      pollCloudState({ touchPresence: true });
    }
  }

  ["pointerdown", "keydown", "touchstart", "scroll"].forEach((evt) => {
    document.addEventListener(evt, markUserActivity, { passive: true, capture: true });
  });

  function flushPendingCloudSyncOnExit() {
    if (simState.active) {
      persistActiveSimulation({ syncCloud: false });
      cloudProgressDirty = true;
    }
    if (cloudProgressDirty || cloudProgressPushTimer) {
      if (cloudProgressPushTimer) {
        clearTimeout(cloudProgressPushTimer);
        cloudProgressPushTimer = null;
      }
      pushCloudProgress({ keepalive: true });
    }
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      flushPendingCloudSyncOnExit();
    } else if (document.visibilityState === "visible") {
      const now = Date.now();
      lastUserActivityAt = now;
      if (now - lastVisibilityPullAt > VISIBILITY_POLL_COOLDOWN_MS) {
        lastVisibilityPullAt = now;
        pollCloudState({ touchPresence: true });
      }
    }
  });

  window.addEventListener("pagehide", () => {
    flushPendingCloudSyncOnExit();
  });

  setInterval(() => {
    if (document.visibilityState === "hidden") return;
    if (Date.now() - lastUserActivityAt > USER_IDLE_TIMEOUT_MS) return;
    pollCloudState({ touchPresence: true });
  }, CLOUD_POLL_INTERVAL_MS);
})();
