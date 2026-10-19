(function(root) {
  "use strict";
  function create(title, questions) {
    return { version: 1, title: title || "我的题库", questions, index: 0, responses: {}, milestones: [], notice: "", createdAt: Date.now(), timing: { elapsedMs: 0, complete: true } };
  }
  function stats(s) {
    const list = Object.values(s.responses), correct = list.filter((r) => r.status === "correct").length, incorrect = list.filter((r) => r.status === "incorrect").length, ungraded = list.filter((r) => r.status === "ungraded").length;
    const completed = correct + incorrect + ungraded, total = s.questions.length;
    return { correct, incorrect, ungraded, completed, total, percent: Math.floor(completed / total * 100), accuracy: correct + incorrect ? Math.round(correct / (correct + incorrect) * 100) : null };
  }
  function select(s, index, value) {
    if (!s.questions[index] || s.responses[index]?.status && s.responses[index].status !== "draft") return;
    s.responses[index] = { value, status: "draft" };
  }
  function milestone(s) {
    const percent = stats(s).completed / s.questions.length * 100;
    const hits = [30, 60].filter((v) => percent >= v && !s.milestones.includes(v));
    if (hits.length) {
      s.milestones.push(...hits);
      s.notice = hits.join(",");
    }
    if (percent >= 100) s.notice = "complete";
  }
  function submit(s, index, parser) {
    if (!s.questions[index]) throw Error("找不到这道题。");
    const response = s.responses[index];
    if (response && response.status !== "draft") return;
    if (!response || (Array.isArray(response.value) ? !response.value.length : !String(response.value).trim())) throw Error("请先作答，再提交。");
    response.status = parser.grade(s.questions[index], response.value);
    response.submittedAt = Date.now();
    milestone(s);
  }
  function assess(s, index, status) {
    if (!["correct", "incorrect"].includes(status) || s.responses[index]?.status !== "review") return;
    s.responses[index].status = status;
    s.responses[index].selfAssessed = true;
    s.responses[index].submittedAt = Date.now();
    milestone(s);
  }
  function hasTiming(s) {
    return Number.isFinite(s?.timing?.elapsedMs) && s.timing.elapsedMs >= 0;
  }
  function formatDuration(ms) {
    if (!Number.isFinite(ms) || ms < 0) return "—";
    const seconds = Math.floor(ms / 1000), hours = Math.floor(seconds / 3600);
    return (hours ? String(hours).padStart(2, "0") + ":" : "") + String(Math.floor(seconds / 60) % 60).padStart(2, "0") + ":" + String(seconds % 60).padStart(2, "0");
  }
  function summary(s) {
    const result = stats(s), elapsedMs = hasTiming(s) ? s.timing.elapsedMs : null;
    const timingComplete = hasTiming(s) && s.timing.complete === true;
    return { ...result, elapsedMs, timingComplete,
      averageMs: timingComplete && result.completed ? elapsedMs / result.completed : null,
      errorPercent: result.accuracy === null ? null : 100 - result.accuracy,
      pending: result.total - result.completed };
  }
  function createClock(now) {
    let current = null, started = null;
    function flush() {
      if (!current || started === null) return;
      const end = now();
      current.timing.elapsedMs += Math.max(0, end - started);
      started = end;
    }
    function sync(session, active) {
      flush();
      current = session;
      if (active && current && !hasTiming(current)) current.timing = { elapsedMs: 0, complete: false };
      started = active && current ? now() : null;
    }
    return { flush, sync, get running() { return started !== null; } };
  }
  const api = { create, stats, select, submit, assess, summary, formatDuration, createClock };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.QuizEngine = api;
})(typeof window !== "undefined" ? window : globalThis);
