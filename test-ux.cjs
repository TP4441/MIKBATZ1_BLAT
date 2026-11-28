const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const exporter = require("./export.js");
const app = fs.readFileSync(path.join(__dirname, "app.js"), "utf8");

// Exercise the production clock and submission handlers with one controllable tick.
function functionSource(name) {
  const start = app.indexOf("  function " + name + "(");
  assert.ok(start >= 0, name);
  return app.slice(start, app.indexOf("\n  }", start) + 4);
}
let now = 1000000, submitted = 0;
const nodes = new Map();
function el(id) {
  if (!nodes.has(id)) nodes.set(id, {
    showModal() { this.open = true; }, close() { this.open = false; },
    querySelector() { return null; }, classList: { add() {}, remove() {} }
  });
  return nodes.get(id);
}
const ctx = vm.createContext({
  simState: { active: true, hasTimer: true, secondsLeft: 600, initialSeconds: 600, elapsedSeconds: 0,
    questions: Array.from({length:50}, (_,i)=>({id:String(i)})), answers: new Map() },
  el, Date:{now:()=>now}, setInterval:()=>1, clearInterval(){}, updateSimTimerDisplay(){},
  persistActiveSimulation(){}, renderSimQuestion(){}, showExamSetupHome(){}, renderResumeSimBanner(){}, showToast(){},
  submitSimulation(){if(ctx.simState.active) submitted++; ctx.simState.active = false; el("submissionDialog").close();}
});
const run = code => vm.runInContext(code,ctx);
for (const name of ["updateSimClock","tickSimClock","startSimTimer","pauseSimulation"]) run(functionSource(name));
const handlers = app.indexOf('    el("finishSubmission").onclick');
run(app.slice(handlers, app.indexOf('    el("examHistoryFilterChips")?', handlers)));
run("startSimTimer()"); now += 300000; run("tickSimClock()");
assert.equal(ctx.simState.secondsLeft,300);
run("pauseSimulation()"); now += 20000; ctx.simState.active=true; run("startSimTimer()");
assert.equal(ctx.simState.secondsLeft,300);
for(let i=0;i<50;i++) if(![1,13,49].includes(i)) ctx.simState.answers.set(String(i),0);
el("btnSubmitSim").onclick();
assert.match(el("submissionCount").textContent,/47.*50/);
el("returnUnanswered").onclick();
assert.equal(ctx.simState.currentIndex,1);
assert.equal(ctx.simState.answers.size,47);
el("btnSubmitSim").onclick();
now+=300000; run("tickSimClock();tickSimClock()");
assert.equal(submitted,1);assert.equal(el("submissionDialog").open,false);
console.log("PASS clock, pause, skipped-question routing, expiry");

const qs=["a","b","c"].map((id,i)=>({id,num:i+1,exam:"2026",subject:"S",stem:"Question",options:[{text:"Answer"}],correct:[0],images:[]}));
const data={progress:{attempts:{a:{isCorrect:true,selected:0},b:{isCorrect:false,selected:1}}}};
for(const [attempts,expected] of [[["correct"],["a"]],[["wrong"],["b"]],[["unsolved"],["c"]],[["correct","unsolved"],["a","c"]]]){
  const config={attempts,groupBy:"none",subjects:["S"],exams:["2026"]};
  const items=exporter.filterQuestions(qs,config,data);
  const json=JSON.parse(exporter.buildJsonOutput(items,config,data));
  assert.deepEqual(json.groups.flatMap(g=>g.questions.map(q=>q.id)),expected);
  assert.equal(json.totalQuestions,items.length);
}
assert.equal(exporter.filterQuestions(qs,{exams:["missing"]},data).length,0);
console.log("PASS export status, count, IDs, subject and year");


Object.assign(ctx, {
  Q_MAP: new Map(qs.map(q => [q.id,q])), getSubject: q => q.subject,
  simReviewState: {}, updateExamFocusModeUI(){}, escapeHtml: String, formatSubject: String,
  formatSimDate: () => "", getScoreTierClass: () => "", showExamSetupHome(){},
  retakeSimulation(){}, openSimReview(){}, reviewSimQuestions(){}
});
el("examResults").dataset = {};
el("examResults").querySelectorAll = () => [];
for (const id of ["btnOpenSimReviewUnsure","btnReviewSimWrongAndUnsure"]) el(id).addEventListener = () => {};
run(functionSource("computeSimEntryAnalysis"));
run(functionSource("renderSimResults"));
for (const [answers, unsure, primary] of [
  [{a:1}, [], "btnOpenSimReviewMistakes"], [{}, [], "btnOpenSimReviewMistakes"],
  [{a:0}, ["a"], "btnOpenSimReviewUnsure"], [{a:0}, [], "btnOpenSimReviewAll"]
]) {
  ctx.entry = {questionIds:["a"],answers,unsure};
  run("renderSimResults(entry)");
  const html = el("examResults").innerHTML;
  assert.ok(html.indexOf("sim-results-actions") < html.indexOf("subject-progress-list"));
  assert.match(html,new RegExp('class="btn-primary" id="'+primary+'"'));
}
console.log("PASS four results states and action placement");

const simItems = [
  { simNum: 1, qId: "q1", subject: "Cardio", isCorrect: false, isWrong: true, isSkipped: false, isUnsure: false, isFlagged: false },
  { simNum: 2, qId: "q2", subject: "Cardio", isCorrect: true, isWrong: false, isSkipped: false, isUnsure: true, isFlagged: false },
  { simNum: 3, qId: "q3", subject: "Pulm", isCorrect: false, isWrong: false, isSkipped: true, isUnsure: false, isFlagged: true },
  { simNum: 4, qId: "q4", subject: "Pulm", isCorrect: true, isWrong: false, isSkipped: false, isUnsure: false, isFlagged: false },
];
const simAnalysis = { items: simItems };
const filterStart = app.indexOf("  const SIM_REVIEW_FILTER_KEYS");
const filterEnd = app.indexOf("  function openSimReview(");
assert.ok(filterStart >= 0 && filterEnd > filterStart, "simReview filter helpers found");
run(app.slice(filterStart, filterEnd));
assert.deepEqual(Array.from(run(`filterSimReviewItems(${JSON.stringify(simAnalysis)}, "all", "all")`).map((x) => x.qId)), ["q1", "q2", "q3", "q4"]);
assert.deepEqual(Array.from(run(`filterSimReviewItems(${JSON.stringify(simAnalysis)}, ["wrong", "unsure"], "all")`).map((x) => x.qId)), ["q1", "q2"]);
assert.deepEqual(Array.from(run(`filterSimReviewItems(${JSON.stringify(simAnalysis)}, ["wrong", "unsure", "flagged"], "all")`).map((x) => x.qId)), ["q1", "q2", "q3"]);
assert.deepEqual(Array.from(run(`filterSimReviewItems(${JSON.stringify(simAnalysis)}, ["wrong", "unsure"], "Cardio")`).map((x) => x.qId)), ["q1", "q2"]);
assert.deepEqual(Array.from(run(`filterSimReviewItems(${JSON.stringify(simAnalysis)}, ["wrong", "unsure"], "Pulm")`).map((x) => x.qId)), []);
assert.deepEqual(Array.from(run(`Array.from(normalizeSimReviewFilters(new Set(["wrong", "unsure"])))`)), ["wrong", "unsure"]);
assert.deepEqual(Array.from(run(`Array.from(normalizeSimReviewFilters("all"))`)), []);
console.log("PASS multi-select sim review filters");

// Custom exam simulation year filtering (single + multi-year + fallback)
const customSimStart = app.indexOf("  const CUSTOM_SIM_SUBJECT_WEIGHTS");
const customSimEnd = app.indexOf("  // Exam Simulation");
assert.ok(customSimStart >= 0 && customSimEnd > customSimStart, "custom sim helpers found");
const simDocs = new Map();
const makeChip = (attrs = {}, active = true) => ({
  dataset: { ...attrs },
  classList: {
    _set: new Set(active ? ["chip", "active"] : ["chip"]),
    toggle(c, force) {
      if (force === undefined) { if (this._set.has(c)) this._set.delete(c); else this._set.add(c); }
      else if (force) this._set.add(c); else this._set.delete(c);
    },
    contains(c) { return this._set.has(c); }
  }
});
const simExamWrap = {
  _chips: [makeChip({ exam: "2026" }, true), makeChip({ exam: "2025" }, true), makeChip({ exam: "2016" }, false)],
  querySelectorAll(sel) {
    if (sel === ".chip.active") return this._chips.filter((c) => c.classList.contains("active"));
    if (sel === ".chip[data-exam]") return this._chips;
    return [];
  }
};
const simSubjWrap = {
  _chips: [makeChip({ subj: "ריאות" }, true), makeChip({ subj: "קרדיולוגיה" }, true)],
  querySelectorAll(sel) {
    if (sel === ".chip.active") return this._chips.filter((c) => c.classList.contains("active"));
    if (sel === ".chip[data-subj]") return this._chips;
    return [];
  }
};
const simRatioHintEl = { textContent: "" };
const simCountEl = { value: "10" };
const customSimCtx = vm.createContext({
  EXAMS: [{ name: "2026" }, { name: "2025" }, { name: "2016" }],
  QUESTIONS: [
    { id: "q1", exam: "2026", subject: "ריאות" },
    { id: "q2", exam: "2026", subject: "קרדיולוגיה" },
    { id: "q3", exam: "2025", subject: "ריאות" },
    { id: "q4", exam: "2016", subject: "ריאות" },
  ],
  SIM_HIDE_TIMER_KEY: "sim_hide_timer",
  getSubject: (q) => q.subject,
  getUniqueSubjects: () => ["ריאות", "קרדיולוגיה"],
  document: { querySelector: () => null },
  el: (id) => ({
    simExamChips: simExamWrap,
    simSubjectChips: simSubjWrap,
    simRatioHint: simRatioHintEl,
    simCustomCount: simCountEl,
  }[id] || null),
});
vm.runInContext(app.slice(customSimStart, customSimEnd), customSimCtx);
assert.equal(vm.runInContext(`isRecentExamName("2018 מועד ב׳")`, customSimCtx), true);
assert.equal(vm.runInContext(`isRecentExamName("2016")`, customSimCtx), false);
assert.equal(vm.runInContext(`isRecentExamName("תרגוליישן")`, customSimCtx), false);
const singlePool = vm.runInContext(`buildWeightedCustomSimPool(new Set(["ריאות", "קרדיולוגיה"]), 10, new Set(["2026"]))`, customSimCtx);
assert.deepEqual(Array.from(singlePool.map((q) => q.id)).sort(), ["q1", "q2"]);
const multiPool = vm.runInContext(`buildWeightedCustomSimPool(new Set(["ריאות"]), 10, new Set(["2026", "2025"]))`, customSimCtx);
assert.deepEqual(Array.from(multiPool.map((q) => q.id)).sort(), ["q1", "q3"]);
const emptyExamsPool = vm.runInContext(`buildWeightedCustomSimPool(new Set(["ריאות"]), 10, new Set())`, customSimCtx);
assert.deepEqual(Array.from(emptyExamsPool.map((q) => q.id)).sort(), ["q1", "q3", "q4"]);
vm.runInContext(`updateCustomSimRatioHint()`, customSimCtx);
assert.match(simRatioHintEl.textContent, /2026, 2025/);
assert.match(simRatioHintEl.textContent, /3 שאלות/);
console.log("PASS custom simulation single and multi-year filtering");

// Exercise site-wide broadcast popup show / dismiss / pending queue
{
  const annStart = app.indexOf("  function getDismissedAnnouncementId()");
  const annEnd = app.indexOf("  function updateAdminBroadcastCharCount()");
  assert.ok(annStart >= 0 && annEnd > annStart, "site announcement helpers found");
  const storage = new Map();
  const makeCls = (initiallyHidden = false) => {
    const s = new Set(initiallyHidden ? ["hidden"] : []);
    return {
      add(c) { s.add(c); },
      remove(c) { s.delete(c); },
      toggle(c, f) { if (f === undefined) { if (s.has(c)) s.delete(c); else s.add(c); } else if (f) s.add(c); else s.delete(c); },
      contains(c) { return s.has(c); }
    };
  };
  const modalNodes = {
    siteAnnouncementModal: { classList: makeCls(true) },
    siteAnnouncementTitle: { textContent: "" },
    siteAnnouncementBody: { textContent: "" },
    siteAnnouncementMeta: { textContent: "", classList: makeCls(false) },
    btnAckSiteAnnouncement: { textContent: "", focus() {} },
  };
  let blocking = false;
  const annCtx = vm.createContext({
    SITE_ANNOUNCEMENT_DISMISSED_KEY: "dismissed_ann_test",
    activeSiteAnnouncement: null,
    lastKnownAnnouncementId: "",
    pendingSiteAnnouncement: null,
    siteAnnouncementPreviewMode: false,
    tourState: { active: false },
    localStorage: {
      getItem: (k) => (storage.has(k) ? storage.get(k) : null),
      setItem: (k, v) => storage.set(k, String(v)),
      removeItem: (k) => storage.delete(k),
    },
    isAnyBlockingModalOpen: () => blocking,
    formatNoteTime: (ts) => `t:${ts}`,
    setTimeout: () => 0,
    el: (id) => modalNodes[id] || null,
  });
  vm.runInContext(app.slice(annStart, annEnd), annCtx);

  // 1. New announcement opens modal immediately when unblocked
  vm.runInContext(`applyServerAnnouncementUpdate({ id: "ann_1", title: "כותרת", message: "שלום לכולם", createdAt: 1000, expiresAt: 0 })`, annCtx);
  assert.equal(modalNodes.siteAnnouncementModal.classList.contains("hidden"), false);
  assert.equal(modalNodes.siteAnnouncementTitle.textContent, "כותרת");
  assert.equal(modalNodes.siteAnnouncementBody.textContent, "שלום לכולם");

  // 2. Closing stores dismissed ID so same announcement does not reopen
  vm.runInContext(`closeSiteAnnouncementModal()`, annCtx);
  assert.equal(modalNodes.siteAnnouncementModal.classList.contains("hidden"), true);
  assert.equal(storage.get("dismissed_ann_test"), "ann_1");
  vm.runInContext(`applyServerAnnouncementUpdate({ id: "ann_1", title: "כותרת", message: "שלום לכולם", createdAt: 1000, expiresAt: 0 })`, annCtx);
  assert.equal(modalNodes.siteAnnouncementModal.classList.contains("hidden"), true);

  // 3. Announcement arriving while another modal is open queues until unblocked
  blocking = true;
  vm.runInContext(`applyServerAnnouncementUpdate({ id: "ann_2", title: "", message: "הודעה שנייה", createdAt: 2000, expiresAt: 0 })`, annCtx);
  assert.equal(modalNodes.siteAnnouncementModal.classList.contains("hidden"), true);
  blocking = false;
  vm.runInContext(`maybeShowPendingSiteAnnouncement()`, annCtx);
  assert.equal(modalNodes.siteAnnouncementModal.classList.contains("hidden"), false);
  assert.equal(modalNodes.siteAnnouncementTitle.textContent, "הודעה מהמנהל");
  assert.equal(modalNodes.siteAnnouncementBody.textContent, "הודעה שנייה");
  console.log("PASS site-wide broadcast popup show, dismiss, and pending queue");
}

// Verify question & option shuffling is one-time per session and never persisted/restored on refresh
{
  const extractFn = (name) => {
    const start = app.indexOf("  function " + name + "(");
    assert.ok(start >= 0, name);
    const skipCommentsAndStrings = (i, inStr, esc) => {
      const ch = app[i];
      if (esc) return { nextI: i, inStr, esc: false, skip: true };
      if (inStr) {
        if (ch === "\\") return { nextI: i, inStr, esc: true, skip: true };
        if (ch === inStr) return { nextI: i, inStr: null, esc: false, skip: true };
        return { nextI: i, inStr, esc: false, skip: true };
      }
      if (ch === "/" && app[i + 1] === "/") {
        const nl = app.indexOf("\n", i);
        return { nextI: nl >= 0 ? nl : app.length, inStr: null, esc: false, skip: true };
      }
      if (ch === "/" && app[i + 1] === "*") {
        const end = app.indexOf("*/", i + 2);
        return { nextI: end >= 0 ? end + 1 : app.length, inStr: null, esc: false, skip: true };
      }
      if (ch === "'" || ch === '"' || ch === "`") return { nextI: i, inStr: ch, esc: false, skip: true };
      return { nextI: i, inStr: null, esc: false, skip: false };
    };
    let parenDepth = 0, bodyStart = -1, inStr = null, esc = false;
    for (let i = app.indexOf("(", start); i < app.length; i++) {
      const st = skipCommentsAndStrings(i, inStr, esc);
      i = st.nextI; inStr = st.inStr; esc = st.esc;
      if (st.skip) continue;
      const ch = app[i];
      if (ch === "(") parenDepth++;
      else if (ch === ")") {
        parenDepth--;
        if (parenDepth === 0) { bodyStart = app.indexOf("{", i); break; }
      }
    }
    assert.ok(bodyStart >= 0, name + " body");
    let depth = 0; inStr = null; esc = false;
    for (let i = bodyStart; i < app.length; i++) {
      const st = skipCommentsAndStrings(i, inStr, esc);
      i = st.nextI; inStr = st.inStr; esc = st.esc;
      if (st.skip) continue;
      const ch = app[i];
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) return app.slice(start, i + 1);
      }
    }
    throw new Error("Unclosed function " + name);
  };

  const makeBtnCls = () => {
    const s = new Set(["btn-secondary"]);
    return {
      toggle(c, f) { if (f === undefined) { if (s.has(c)) s.delete(c); else s.add(c); } else if (f) s.add(c); else s.delete(c); },
      contains(c) { return s.has(c); }
    };
  };
  const btnOptDesktop = { classList: makeBtnCls() };
  const btnOptMobile = { classList: makeBtnCls() };
  const qSample = [
    { id: "q1", exam: "2026", num: 1, options: [{ text: "a" }, { text: "b" }, { text: "c" }, { text: "d" }] },
    { id: "q2", exam: "2026", num: 2, options: [{ text: "a" }, { text: "b" }, { text: "c" }, { text: "d" }] },
    { id: "q3", exam: "2026", num: 3, options: [{ text: "a" }, { text: "b" }, { text: "c" }, { text: "d" }] },
  ];
  const shufCtx = vm.createContext({
    VALID_STUDY_MODES: new Set(["practice", "flashcard", "drill"]),
    MAX_SESSION_ARRAY_LEN: 2000,
    MAX_SIM_HISTORY_LEN: 100,
    EXAMS: [{ name: "2026" }],
    currentMode: "practice",
    filteredList: [...qSample],
    currentIndex: 0,
    optionPermutations: new Map(),
    shuffleOptionsEnabled: false,
    shuffledQuestionOrder: null,
    drillShuffledOrder: null,
    lastQIdByMode: {},
    lastIndexByMode: {},
    isRestoringSession: false,
    hasUserInteractedWithNav: false,
    deviceId: "dev1",
    progress: { studySession: null, studySessionUpdatedAt: 0 },
    filters: { exams: new Set(), subjects: new Set(), statuses: new Set(), search: "", mergePathology: true },
    drillFilters: { exams: new Set(), subjects: new Set(), search: "" },
    isStudyMode: (m) => m === "practice" || m === "flashcard" || m === "drill",
    getUniqueSubjects: () => ["Cardio"],
    getStatusKeys: () => [],
    setFilterPanelCollapsed() {},
    renderFilterChips() {},
    initExamSetup() {},
    renderQuestion() {},
    showToast() {},
    saveProgress() {},
    switchMode(mode) { shufCtx.currentMode = mode; },
    el: (id) => ({
      btnShuffleOptions: btnOptDesktop,
      btnShuffleOptionsMobile: btnOptMobile,
    }[id] || null),
  });
  for (const fn of [
    "getActiveShuffledOrder", "setActiveShuffledOrder", "sanitizeStudySession",
    "setShuffleOptionsEnabled", "recordCurrentModePosition", "persistStudySession",
    "getOptionOrder", "shuffleFilteredQuestions", "toggleShuffleOptions", "applyStudySessionState"
  ]) {
    vm.runInContext(extractFn(fn), shufCtx);
  }

  // 1. Legacy saved studySession with shuffle flags is sanitized without shuffle fields and resets active shuffle
  vm.runInContext(`
    shuffledQuestionOrder = ["q3", "q1", "q2"];
    drillShuffledOrder = ["q2", "q1"];
    setShuffleOptionsEnabled(true);
    applyStudySessionState({
      mode: "practice",
      shuffleOptions: true,
      shuffledOrder: ["q3", "q1", "q2"],
      drillShuffledOrder: ["q2", "q1"],
      lastQIdByMode: { practice: "q1" },
      lastIndexByMode: { practice: 0 },
    });
  `, shufCtx);
  assert.equal(shufCtx.shuffledQuestionOrder, null);
  assert.equal(shufCtx.drillShuffledOrder, null);
  assert.equal(shufCtx.shuffleOptionsEnabled, false);
  assert.equal(btnOptDesktop.classList.contains("btn-primary"), false);
  assert.deepEqual(Array.from(vm.runInContext(`getOptionOrder({ id: "q1", options: [0,1,2,3] })`, shufCtx)), [0, 1, 2, 3]);

  // 2. One-time shuffle works in memory, and persistStudySession does NOT save shuffle state
  vm.runInContext(`
    shuffleFilteredQuestions();
    toggleShuffleOptions();
    persistStudySession();
  `, shufCtx);
  assert.equal(Array.isArray(shufCtx.shuffledQuestionOrder), true);
  assert.equal(shufCtx.shuffleOptionsEnabled, true);
  assert.equal("shuffledOrder" in shufCtx.progress.studySession, false);
  assert.equal("drillShuffledOrder" in shufCtx.progress.studySession, false);
  assert.equal("shuffleOptions" in shufCtx.progress.studySession, false);
  console.log("PASS one-time question and option shuffle (not persisted across refreshes)");
}

// Verify exam simulation shuffle is never retained across refreshes (setup checkbox, activeSim, and resume)
{
  const extractFn = (name) => {
    const start = app.indexOf("  function " + name + "(");
    assert.ok(start >= 0, name);
    const skipCommentsAndStrings = (i, inStr, esc) => {
      const ch = app[i];
      if (esc) return { nextI: i, inStr, esc: false, skip: true };
      if (inStr) {
        if (ch === "\\") return { nextI: i, inStr, esc: true, skip: true };
        if (ch === inStr) return { nextI: i, inStr: null, esc: false, skip: true };
        return { nextI: i, inStr, esc: false, skip: true };
      }
      if (ch === "/" && app[i + 1] === "/") {
        const nl = app.indexOf("\n", i);
        return { nextI: nl >= 0 ? nl : app.length, inStr: null, esc: false, skip: true };
      }
      if (ch === "/" && app[i + 1] === "*") {
        const end = app.indexOf("*/", i + 2);
        return { nextI: end >= 0 ? end + 1 : app.length, inStr: null, esc: false, skip: true };
      }
      if (ch === "'" || ch === '"' || ch === "`") return { nextI: i, inStr: ch, esc: false, skip: true };
      return { nextI: i, inStr: null, esc: false, skip: false };
    };
    let parenDepth = 0, bodyStart = -1, inStr = null, esc = false;
    for (let i = app.indexOf("(", start); i < app.length; i++) {
      const st = skipCommentsAndStrings(i, inStr, esc);
      i = st.nextI; inStr = st.inStr; esc = st.esc;
      if (st.skip) continue;
      const ch = app[i];
      if (ch === "(") parenDepth++;
      else if (ch === ")") {
        parenDepth--;
        if (parenDepth === 0) { bodyStart = app.indexOf("{", i); break; }
      }
    }
    assert.ok(bodyStart >= 0, name + " body");
    let depth = 0; inStr = null; esc = false;
    for (let i = bodyStart; i < app.length; i++) {
      const st = skipCommentsAndStrings(i, inStr, esc);
      i = st.nextI; inStr = st.inStr; esc = st.esc;
      if (st.skip) continue;
      const ch = app[i];
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) return app.slice(start, i + 1);
      }
    }
    throw new Error("Unclosed function " + name);
  };

  const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
  assert.match(html, /<input[^>]+id="simShuffleOpts"[^>]+autocomplete="off"/);

  const makeMockNode = (extra = {}) => ({
    checked: false,
    value: "",
    innerHTML: "",
    textContent: "",
    dataset: {},
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    appendChild() {},
    ...extra,
  });
  const simExamSelect = makeMockNode();
  const simExamChips = makeMockNode();
  const simSubjectChips = makeMockNode();
  const simHideTimer = makeMockNode();
  const simShuffleOpts = makeMockNode({ checked: true }); // Simulate browser form restore on refresh
  const simSetupNodes = {
    simExamSelect,
    simExamChips,
    simSubjectChips,
    simHideTimer,
    simShuffleOpts,
    simRatioHint: makeMockNode(),
    examSetup: makeMockNode(),
    examHistorySection: makeMockNode(),
    examResults: makeMockNode(),
    examReview: makeMockNode(),
    examActive: makeMockNode(),
  };

  const simQuestions = [
    { id: "2026_q001", exam: "2026", num: 1, options: [{ text: "a" }, { text: "b" }] },
    { id: "2026_q002", exam: "2026", num: 2, options: [{ text: "a" }, { text: "b" }] },
    { id: "2026_q003", exam: "2026", num: 3, options: [{ text: "a" }, { text: "b" }] },
  ];
  const simCtx = vm.createContext({
    MAX_SESSION_ARRAY_LEN: 2000,
    PRACTICE_EXAM_NAME: "תרגוליישן",
    EXAMS: [{ name: "2026", expectedCount: 3 }],
    QUESTIONS: simQuestions,
    Q_MAP: new Map(simQuestions.map((q) => [q.id, q])),
    deviceId: "dev1",
    hasUserInteractedWithNav: false,
    optionPermutations: new Map([["2026_q001", [1, 0]]]),
    simReviewState: { active: false },
    simState: {
      active: true,
      questions: [...simQuestions],
      answers: new Map(),
      flagged: new Set(),
      struck: new Map(),
      currentIndex: 0,
      deadline: 0,
      secondsLeft: 0,
      initialSeconds: 0,
      elapsedSeconds: 0,
      hasTimer: false,
      timerHidden: false,
      label: "2026 (3 שאלות)",
      simType: "full",
      examName: "2026",
      timerId: null,
      shuffleOpts: true,
    },
    progress: { activeSim: null, activeSimUpdatedAt: 0 },
    document: { createElement: () => makeMockNode() },
    el: (id) => simSetupNodes[id] || null,
    getUniqueSubjects: () => ["ריאות"],
    formatSubject: (s) => s,
    loadSimHideTimerPref: () => false,
    updateCustomSimRatioHint() {},
    renderExamHistory() {},
    saveProgress() {},
    renderResumeSimBanner() {},
    clearInterval() {},
    switchMode() {},
    updateExamFocusModeUI() {},
    startSimTimer() {},
    renderSimQuestion() {},
    showToast() {},
    clearActiveSimulation() {},
    getSelectedSimExams: () => new Set(["2026"]),
    getSelectedSimSubjects: () => new Set(["ריאות"]),
  });

  for (const fn of [
    "sanitizeActiveSim", "initExamSetup", "persistActiveSimulation", "resumeSavedSimulation"
  ]) {
    vm.runInContext(extractFn(fn), simCtx);
  }

  // 1. Initial initExamSetup resets pre-checked simShuffleOpts (e.g. after browser refresh)
  vm.runInContext(`initExamSetup()`, simCtx);
  assert.equal(simShuffleOpts.checked, false);

  // 2. Subsequent background initExamSetup does not clobber explicit user check before refresh
  simShuffleOpts.checked = true;
  vm.runInContext(`initExamSetup()`, simCtx);
  assert.equal(simShuffleOpts.checked, true);

  // 3. persistActiveSimulation and sanitizeActiveSim do not persist shuffleOpts: true
  vm.runInContext(`persistActiveSimulation({ syncCloud: false })`, simCtx);
  assert.equal(simCtx.progress.activeSim.shuffleOpts, false);
  const sanitized = vm.runInContext(`sanitizeActiveSim({ questionIds: ["2026_q001"], shuffleOpts: true })`, simCtx);
  assert.equal(sanitized.shuffleOpts, false);

  // 4. resumeSavedSimulation resets shuffleOpts to false and restores normal full-exam question order
  simCtx.progress.activeSim = {
    label: "2026 (3 שאלות)",
    simType: "full",
    examName: "2026",
    questionIds: ["2026_q003", "2026_q001", "2026_q002"],
    currentIndex: 0, // points to 2026_q003
    shuffleOpts: true,
    hasTimer: false,
  };
  vm.runInContext(`resumeSavedSimulation()`, simCtx);
  assert.equal(simCtx.simState.shuffleOpts, false);
  assert.deepEqual(Array.from(simCtx.simState.questions.map((q) => q.id)), ["2026_q001", "2026_q002", "2026_q003"]);
  assert.equal(simCtx.simState.currentIndex, 2); // still on 2026_q003
  assert.equal(simCtx.optionPermutations.size, 0);
  console.log("PASS exam simulation refresh resets shuffle and keeps normal exam order");
}

// Verify Crowd Wisdom ("חכמת ההמונים") filtering, communityProblems exclusion, and hierarchical grouping
{
  const extractFn = (name) => {
    const start = app.indexOf("  function " + name + "(");
    assert.ok(start >= 0, name);
    const skipCommentsAndStrings = (i, inStr, esc) => {
      const ch = app[i];
      if (esc) return { nextI: i, inStr, esc: false, skip: true };
      if (inStr) {
        if (ch === "\\") return { nextI: i, inStr, esc: true, skip: true };
        if (ch === inStr) return { nextI: i, inStr: null, esc: false, skip: true };
        return { nextI: i, inStr, esc: false, skip: true };
      }
      if (ch === "/" && app[i + 1] === "/") {
        const nl = app.indexOf("\n", i);
        return { nextI: nl >= 0 ? nl : app.length, inStr: null, esc: false, skip: true };
      }
      if (ch === "/" && app[i + 1] === "*") {
        const end = app.indexOf("*/", i + 2);
        return { nextI: end >= 0 ? end + 1 : app.length, inStr: null, esc: false, skip: true };
      }
      if (ch === "'" || ch === '"' || ch === "`") return { nextI: i, inStr: ch, esc: false, skip: true };
      return { nextI: i, inStr: null, esc: false, skip: false };
    };
    let parenDepth = 0, bodyStart = -1, inStr = null, esc = false;
    for (let i = app.indexOf("(", start); i < app.length; i++) {
      const st = skipCommentsAndStrings(i, inStr, esc);
      i = st.nextI; inStr = st.inStr; esc = st.esc;
      if (st.skip) continue;
      const ch = app[i];
      if (ch === "(") parenDepth++;
      else if (ch === ")") {
        parenDepth--;
        if (parenDepth === 0) { bodyStart = app.indexOf("{", i); break; }
      }
    }
    assert.ok(bodyStart >= 0, name + " body");
    let depth = 0; inStr = null; esc = false;
    for (let i = bodyStart; i < app.length; i++) {
      const st = skipCommentsAndStrings(i, inStr, esc);
      i = st.nextI; inStr = st.inStr; esc = st.esc;
      if (st.skip) continue;
      const ch = app[i];
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) return app.slice(start, i + 1);
      }
    }
    throw new Error("Unclosed function " + name);
  };

  const wisdomStart = app.indexOf('  // Crowd Wisdom ("חכמת ההמונים")');
  const wisdomEnd = app.indexOf("  function appendHighlightedText(");
  assert.ok(wisdomStart >= 0 && wisdomEnd > wisdomStart, "wisdom helpers found");

  const wisdomQuestions = [
    { id: "q_note_no_reply", exam: "2026", num: 5, subject: "פתולוגיית ריאות", baseSubject: "ריאות", stem: "שאלה עם הערה ללא תגובה", options: [{ text: "אופציה 1" }], correct: [0], appealNote: "" },
    { id: "q_problem_only", exam: "2026", num: 2, subject: "קרדיולוגיה", baseSubject: "קרדיולוגיה", stem: "שאלה עם דיווח בעיה בלבד", options: [{ text: "אופציה 2" }], correct: [0], appealNote: "" },
    { id: "q_note_with_reply", exam: "2025", num: 1, subject: "פתולוגיית קרדיולוגיה", baseSubject: "קרדיולוגיה", stem: "שאלה אחרת", options: [{ text: "תרופה" }], correct: [0], appealNote: "" },
    { id: "q_practice_note", exam: "תרגוליישן", num: 10, subject: "נוירולוגיה", baseSubject: "נוירולוגיה", stem: "שאלת תרגול עם הערה", options: [{ text: "נוירו" }], correct: [0], appealNote: "" },
  ];

  const wisdomCtx = vm.createContext({
    WISDOM_PREFS_KEY: "wisdom_prefs_test",
    WISDOM_RENDER_CHUNK: 40,
    EXAMS: [{ name: "2026" }, { name: "2025" }, { name: "תרגוליישן" }],
    QUESTIONS: wisdomQuestions,
    userIdentity: { userId: "u1", name: "תפוח", emoji: "🍎" },
    communityNotes: {
      q_note_no_reply: { u2: { author: "מנגו", emoji: "🥭", text: "הערה חשובה בריאות", updatedAt: 100 } },
      q_note_with_reply: { u2: { author: "מנגו", emoji: "🥭", text: "הערה בקרדיו", updatedAt: 200 } },
      q_practice_note: { u1: { author: "תפוח", emoji: "🍎", text: "הערה בתרגוליישן", updatedAt: 300 } },
      q_problem_only: {},
    },
    communityNoteReplies: {
      q_note_with_reply: {
        u2: [{ replyId: "r1", parentReplyId: null, userId: "u3", author: "תות", emoji: "🍓", text: "הסבר על אמיודרון", createdAt: 210 }],
      },
    },
    communityProblems: {
      q_problem_only: { u4: { type: "question_issue", text: "בעיה בשאלה בלבד", updatedAt: 500 } },
    },
    localStorage: { getItem: () => null, setItem() {} },
    formatSubject: (s) => s,
  });

  for (const fn of ["getQuestionCommunityNotesList", "getNoteRepliesList", "getQuestionRepliesCount"]) {
    vm.runInContext(extractFn(fn), wisdomCtx);
  }
  vm.runInContext(app.slice(wisdomStart, wisdomEnd), wisdomCtx);

  const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
  assert.match(html, /data-mode="wisdom"/);
  assert.match(html, /id="wisdomView"/);

  // 1. Only questions with communityNotes appear; communityProblems-only is excluded; תרגוליישן is included
  const notedIds = Array.from(vm.runInContext(`getWisdomNotedQuestionsPool().map(q => q.id)`, wisdomCtx));
  assert.deepEqual(notedIds, ["q_note_no_reply", "q_note_with_reply", "q_practice_note"]);
  assert.equal(notedIds.includes("q_problem_only"), false);

  // 2. Search matches inside replies as well as notes/stems
  vm.runInContext(`wisdomState.search = "אמיודרון"`, wisdomCtx);
  assert.deepEqual(Array.from(vm.runInContext(`getWisdomMatchingQuestions().map(q => q.id)`, wisdomCtx)), ["q_note_with_reply"]);
  vm.runInContext(`wisdomState.search = ""`, wisdomCtx);

  // 3. Grouping: year_subject preserves EXAMS order (2026 -> 2025 -> תרגוליישן) and respects mergePathology
  const byYearUnmerged = vm.runInContext(`groupWisdomQuestions(getWisdomMatchingQuestions(), "year_subject", false)`, wisdomCtx);
  assert.deepEqual(Array.from(byYearUnmerged.map((g) => g.key)), ["2026", "2025", "תרגוליישן"]);
  assert.equal(byYearUnmerged[0].subgroups[0].key, "פתולוגיית ריאות");

  // 4. Grouping: subject_year with mergePathology=true merges פתולוגיית ריאות -> ריאות and פתולוגיית קרדיולוגיה -> קרדיולוגיה
  const bySubjectMerged = vm.runInContext(`groupWisdomQuestions(getWisdomMatchingQuestions(), "subject_year", true)`, wisdomCtx);
  assert.deepEqual(Array.from(bySubjectMerged.map((g) => g.key)), ["נוירולוגיה", "קרדיולוגיה", "ריאות"]);
  assert.equal(bySubjectMerged[1].subgroups[0].key, "2025");
  console.log("PASS Crowd Wisdom filtering, communityProblems exclusion, search, and grouping");
}

// Verify 2020 exam data and AI-answer notice in UI feedback + export
{
  const dataCtx = vm.createContext({ window: {} });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "questions_data.js"), "utf8"), dataCtx);
  const examData = dataCtx.window.EXAM_DATA;
  const exam2020 = examData.exams.find((e) => e.name === "2020");
  assert.ok(exam2020, "2020 exam exists in EXAM_DATA");
  assert.equal(exam2020.expectedCount, 113);
  const qs2020 = examData.questions.filter((q) => q.exam === "2020");
  assert.equal(qs2020.length, 113);
  assert.ok(qs2020.every((q) => q.aiAnswers === true), "All 2020 questions flagged aiAnswers");
  assert.equal(qs2020.find((q) => q.num === 9).options.length, 4);
  assert.deepEqual(Array.from(qs2020.find((q) => q.num === 88).correct), [2, 3]);

  const fbNode = {
    innerHTML: "",
    classList: {
      _set: new Set(),
      add(...cls) { cls.forEach((c) => this._set.add(c)); },
      remove(...cls) { cls.forEach((c) => this._set.delete(c)); },
    },
  };
  const aiCtx = vm.createContext({
    HEBREW_LETTERS: ["א", "ב", "ג", "ד", "ה", "ו"],
    el: (id) => (id === "qFeedback" ? fbNode : null),
    getOptionOrder: (q) => q.options.map((_, i) => i),
    escapeHtml: (s) => String(s),
  });
  vm.runInContext(functionSource("getAiAnswerNoticeHtml"), aiCtx);
  vm.runInContext(functionSource("showFeedbackBox"), aiCtx);
  aiCtx.qAi = {
    options: [{ text: "אופציה א" }, { text: "אופציה ב" }],
    correct: [0],
    aiAnswers: true,
    explanation: "",
  };
  aiCtx.qHuman = {
    options: [{ text: "אופציה א" }, { text: "אופציה ב" }],
    correct: [0],
  };

  for (const flag of [true, false, null]) {
    vm.runInContext(`showFeedbackBox(qAi, ${JSON.stringify(flag)})`, aiCtx);
    assert.match(fbNode.innerHTML, /\(תשובות מבחן זה נקבעו על ידי AI\)/);
    vm.runInContext(`showFeedbackBox(qHuman, ${JSON.stringify(flag)})`, aiCtx);
    assert.doesNotMatch(fbNode.innerHTML, /נקבעו על ידי AI/);
  }

  const mdAi = exporter.buildMarkdownDocument(
    [{ q: { id: "2020_q001", exam: "2020", examIndex: 5, num: 1, subject: "מבואות", stem: "שאלה", options: [{ letter: "א", text: "תשובה" }], correct: [0], aiAnswers: true, images: [] }, effSubj: "מבואות", att: null, attemptStatus: "unsolved", fl: {}, streak: 0, qProblems: [], exportedNotes: [] }],
    { groupBy: "none", detailLevel: "full", notesScope: "none" },
    { cloudCommunityLoaded: true, problemTypes: {} }
  );
  assert.match(mdAi, /\*\(תשובות מבחן זה נקבעו על ידי AI\)\*/);
  console.log("PASS 2020 exam data and AI-answer notice in UI feedback + export");
}
