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
