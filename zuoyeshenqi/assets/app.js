(async function() {
  "use strict";
  const P = window.QuizParser, E = window.QuizEngine, $ = (s) => document.querySelector(s);
  const escape = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const paths = { arrow: "M5 12h14m-5-5 5 5-5 5", left: "M19 12H5m5-5-5 5 5 5", text: "M5 5h14M12 5v14m-4 0h8", upload: "M12 16V4m-5 5 5-5 5 5M4 15v5h16v-5", file: "M14 3H6v18h12V7zM14 3v5h5M9 12h6m-6 4h6", spark: "m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z", shield: "m12 3 8 3v5c0 5-8 10-8 10S4 16 4 11V6zM8 12l3 3 5-6", book: "M12 6C8 3 3 4 3 4v15s5-1 9 2c4-3 9-2 9-2V4s-5-1-9 2v15", check: "m5 12 4 4L19 6", cross: "m6 6 12 12M18 6 6 18", chart: "M5 20V10m7 10V4m7 16v-7", flag: "M5 21V3m0 1c4-3 8 3 14 0v10c-6 3-10-3-14 0", lock: "M6 10h12v11H6zM8 10V7a4 4 0 0 1 8 0v3", refresh: "M20 6v5h-5M4 18v-5h5M5 8a8 8 0 0 1 13-3l2 3M4 16l2 3a8 8 0 0 0 13-3", clock: "M12 8v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0", trophy: "M8 3h8v8a4 4 0 0 1-8 0zM8 5H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4m-4 3v6m-4 0h8" };
  const icon = (name, cls = "") => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name] || paths.spark}"/></svg>`;
  const types = { single: "单选题", multiple: "多选题", boolean: "判断题", short: "简答题", calculation: "计算题" };
  const statuses = { correct: "答对了", incorrect: "答错了", ungraded: "已完成", review: "待自评", draft: "未提交" };
  let session = null, view = "import", tab = "daily", input = "", files = [], preview = null, previewDraft = null, error = "", busy = false, loading = "", title = "", storageFailed = false, toastTimer;
  const KEY = "kenti-session-v1";
  let localStore; try { localStore = window.localStorage; } catch {}
  let archiveWarningShown = false, reviewFilter = 'all';
  const library = window.QuizPracticeLibrary.create({storage: localStore, onError: message => {
    if (!archiveWarningShown) { archiveWarningShown = true; toast(message); }
  }});
  await library.ready;
  const DRAFT_KEY = "kenti-bank-draft-v1";
  const practiceClock = E.createClock(() => performance.now());
  let pageHidden = false;
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "null");
    if (raw?.version === 1 && Array.isArray(raw.questions) && raw.questions.length && raw.questions.length <= P.LIMIT && raw.questions.every((q) => q && typeof q.stem === "string" && Array.isArray(q.options) && Array.isArray(q.answer) && types[q.type])) {
      session = raw;
      if (!Object.hasOwn(session, 'username')) session.username = '';
      session.responses = raw.responses && typeof raw.responses === "object" ? raw.responses : {};
      session.milestones = Array.isArray(raw.milestones) ? raw.milestones : [];
      session.index = Math.max(0, Math.min(Number(raw.index) || 0, raw.questions.length - 1));
      for (const [key, r] of Object.entries(session.responses)) {
        if (!session.questions[key] || !r || !statuses[r.status] || !(typeof r.value === "string" || Array.isArray(r.value))) delete session.responses[key];
      }
      view = "practice";
    }
  } catch {
  }
  try {
    const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
    if (draft?.version === 1 && Array.isArray(draft.questions) && draft.questions.length <= P.LIMIT && draft.questions.every(q => q && typeof q.stem === "string" && typeof q.explanation === "string" && types[q.type] && Array.isArray(q.options) && q.options.every(o => o && typeof o.id === "string" && typeof o.text === "string") && Array.isArray(q.answer) && q.answer.every(a => typeof a === "string"))) {
      preview = { title: draft.title, questions: draft.questions, warnings: Array.isArray(draft.warnings) ? draft.warnings.filter(w => typeof w === "string").slice(0, 20) : [], source: draft.source, dailySelection: draft.dailySelection, learner: draft.learner, parentId: draft.parentId, edited: true };
      title = typeof draft.title === "string" ? draft.title : "我的题库";
    }
  } catch {}
  function savePreview() {
    const draft = preview || previewDraft;
    if (preview) preview.title = title;
    try {
      if (draft) localStorage.setItem(DRAFT_KEY, JSON.stringify({ version: 1, title: draft.title || title, questions: draft.questions, warnings: draft.warnings, source: draft.source, dailySelection: draft.dailySelection, learner: draft.learner, parentId: draft.parentId }));
      else localStorage.removeItem(DRAFT_KEY);
    } catch { toast("当前浏览器无法保存题库草稿，可先导出题库再关闭页面。"); }
  }
  const authoring = window.QuizAuthoring.create({
    refresh: focus => render(focus), toast,
    busy: (value, focus) => { busy = value; render(focus); },
    getPreview: () => preview,
    getCurrentQuestions: () => session?.questions || [],
    openDaily: () => { view = 'import'; tab = 'daily'; render(); },
    changed: focus => { savePreview(); render(focus); },
    preview: result => { preview = result; previewDraft = null; title = result.title; error = ""; view = "import"; savePreview(); }
  });
  const daily = window.QuizDailyUI.create({
    toast, refresh: focus => render(focus),
    preview: result => { preview = result; previewDraft = null; title = result.title; error = ""; view = "import"; authoring.resetUndo(); savePreview(); }
  });
  const libraryUI = window.QuizPracticeLibraryUI.create({store: library, refresh: () => render(), toast,
    load: async record => {
      if (!record) return;
      syncTiming(); save(); await library.flushed();
      session = record; view = E.stats(record).completed === record.questions.length ? 'results' : 'practice';
      reviewFilter = 'all'; render(); window.scrollTo({top:0,behavior:'instant'});
    },
    preview: record => {
      if (!record) return;
      preview = {title: record.title, questions: JSON.parse(JSON.stringify(record.questions)), warnings: [], source: 'history', learner: record.username, parentId: record.id};
      title = record.title; previewDraft = null; view = 'import'; authoring.resetUndo(); savePreview(); render();
    },
    retry: (questions, username, parentId) => {
      syncTiming(); save();
      session = newAttempt('错题订正 · ' + questions.length + '题', questions, username, parentId);
      view = 'practice'; reviewFilter = 'all'; render('#question-stem');
    },
    detach: id => { if (session && (id === null || session.id === id)) { session = null; try { localStorage.removeItem(KEY); } catch {} } }
  });
  function newAttempt(name, questions, username = window.QuizProfile.getName(), parentId = '') {
    const result = E.create(name, JSON.parse(JSON.stringify(questions)));
    result.id = window.QuizPracticeLibrary.newId(); result.username = username || '';
    if (parentId) result.parentId = parentId;
    return result;
  }
  function save() {
    if (!session) return;
    practiceClock.flush();
    if (!session.id) session.id = window.QuizPracticeLibrary.newId();
    if (!Object.hasOwn(session, 'username')) session.username = '';
    void library.put(session).catch(() => { if (!archiveWarningShown) { archiveWarningShown = true; toast('历史记录保存失败，请导出备份。'); } });
    try {
      localStorage.setItem(KEY, JSON.stringify(session));
    } catch {
      if (!storageFailed) {
        storageFailed = true;
        toast("浏览器未能保存进度。本次仍可练习，请勿关闭页面。");
      }
    }
  }
  function syncTiming() {
    const active = session && view === "practice" && !document.hidden && !pageHidden
      && !document.querySelector("dialog[open]") && E.stats(session).completed < session.questions.length;
    practiceClock.sync(session, Boolean(active));
  }
  function timingMarkup() {
    const summary = E.summary(session);
    return `<div class="practice-timer" title="仅累计前台答题用时，离开练习、切到后台或打开弹窗时暂停"><span>${summary.timingComplete ? "累计用时" : "已记录用时"}</span><strong data-practice-time>${E.formatDuration(summary.elapsedMs)}</strong><span data-timer-state>${summary.completed === summary.total ? "已完成" : practiceClock.running ? "计时中" : "已暂停"}</span></div>`;
  }
  function updateTimingDisplay() {
    if (!session) return;
    document.querySelectorAll("[data-practice-time]").forEach(node => { node.textContent = E.formatDuration(E.summary(session).elapsedMs); });
    document.querySelectorAll("[data-timer-state]").forEach(node => { node.textContent = E.stats(session).completed === session.questions.length ? "已完成" : practiceClock.running ? "计时中" : "已暂停"; });
  }
  function toast(message) {
    clearTimeout(toastTimer);
    const el = $("#toast");
    el.textContent = message;
    el.hidden = false;
    toastTimer = setTimeout(() => {
      el.hidden = true;
    }, 4200);
  }
  function practiceAddress(message) { return session?.username ? `${session.username}，${message}` : message; }
  function notifyMilestone(previous) {
    if (!mobileLayout.matches || !session.notice || session.notice === previous) return;
    toast(practiceAddress(E.stats(session).completed === session.questions.length ? "全部完成！这套练习已经做完啦。" : session.notice.includes(",") ? "30% 和 60% 里程碑达成！每一步都算数。" : session.notice === "60" ? "完成 60%！已经走过大半程，继续加油。" : "完成 30%！好的开始，已经在路上。"));
  }
  function stepper(stage = 1) {
    return `<div class="stepper" aria-label="第 ${stage} 步，共 3 步">${["创建题库", "编辑预览", "开始练习"].map((label, i) => `${i ? '<i class="step-line"></i>' : ""}<span class="step ${stage === i + 1 ? "current" : ""}"><span class="step-number">${stage > i + 1 ? "✓" : i + 1}</span>${label}</span>`).join("")}</div>`;
  }
  function aside() {
    return `<aside class="import-aside"><section class="panel aside-card"><details class="import-guide" ${mobileLayout.matches ? "" : "open"}><summary>${icon("book")}导入格式与示例<span class="guide-chevron" aria-hidden="true">⌄</span></summary><div class="import-guide-content"><p>每题使用编号，选项和答案分行。<br>从 AI 复制过来，就可以开始。</p><pre class="format-example"><span class="small-label">题库示例</span>1. 下列哪项是有效的学习方法？
A. 不断重复阅读
B. 主动回忆知识
C. 只记住答案

<span class="code-answer">答案：B</span>
解析：主动提取，让知识记得更牢。</pre><div class="format-tags"><span class="tag">单选</span><span class="tag">多选</span><span class="tag">判断</span><span class="tag">简答</span><span class="tag">计算</span></div><details class="help-details"><summary>查看其他格式与导入说明</summary><p>表格第一行使用以下表头：题目、题型、A、B、C、D、答案、解析。每行一道题，多选答案写成 AC。</p><pre>题目,A,B,答案,解析
天空通常是什么颜色？,蓝色,绿色,A,晴天时呈蓝色</pre><p>JSON 支持题目数组，也支持 { "questions": [...] }：</p><pre>{"question":"1 + 1 = ?",
 "options":["2","3"],
 "answer":"A"}</pre><p>判断题加 [判断] 标签，答案填“正确 / 错误”。简答题加 [简答]，支持参考答案；计算题加 [计算题]，答案填写数值，提交后自动校验。没有答案也可练习。</p><p>PDF 需包含可复制文字。扫描件请先转为文字；旧版 .doc 请另存为 .docx。</p><button class="link-btn" data-action="download-sample">${icon("file")}下载示例题库</button></details></div></details></section><section class="tip-card"><span class="small-label">ONE QUESTION AT A TIME</span><span class="tip-decoration" aria-hidden="true">“</span><h3>不用一口气学会所有，<br>先把眼前这一题吃透。</h3><p>让每一次练习，都有一点新收获。</p></section></aside>`;
  }
  function importPage() {
    return `<div class="page-heading"><div><span class="eyebrow">YOUR KNOWLEDGE, IN PRACTICE</span><h1>把题库，变成你的练习<span style="color:var(--primary)">。</span></h1><p>${window.QuizProfile.getName() ? `${escape(window.QuizProfile.getName())}，今天也来练一练吧。<br>` : ""}口算、混合运算与应用题离线练习，也可用 AI 出题、粘贴文本或导入文件。确认题目后，一题一题来。</p></div>${stepper(preview ? 2 : 1)}</div><div class="workspace"><div><section class="panel import-panel">${preview ? previewPanel() : inputPanel()}</section><div class="flow-strip"><div class="flow-item"><span class="flow-icon">${icon("file")}</span><div><h3>01 &nbsp; 放入你的题库</h3><p>AI 出题、粘贴文本或导入文件</p></div></div><div class="flow-item"><span class="flow-icon">${icon("check")}</span><div><h3>02 &nbsp; 确认识别结果</h3><p>修改、删除，留下适合你的题目</p></div></div><div class="flow-item"><span class="flow-icon">${icon("chart")}</span><div><h3>03 &nbsp; 见证每一步进步</h3><p>逐题反馈，积累一点掌握</p></div></div></div></div>${aside()}</div>`;
  }
  function inputPanel() {
    const tabs = `<div class="tabs" role="tablist" aria-label="创建题库方式">${[["daily","book","每日计算"],["ai","spark","AI 出题"],["text","text","粘贴文本"],["file","upload","导入文件"]].map(([value,name,label]) => `<button class="tab ${tab === value ? "active" : ""}" role="tab" aria-selected="${tab === value}" aria-controls="input-area" id="tab-${value}" data-action="tab-${value}" ${busy ? "disabled" : ""}>${icon(name)}${label}</button>`).join("")}</div>`;
    const draftBanner = previewDraft ? `<div class="draft-banner"><span>已保留 ${previewDraft.questions.length} 道题，可查看、修改后开始练习。</span><button class="btn primary preview-return-button" data-action="resume-preview" ${busy ? "disabled" : ""}>查看并编辑题目${icon("arrow")}</button></div>` : "";
    const textInput = `<div class="label-row"><label for="question-input">题库内容</label><button class="link-btn" data-action="sample" ${busy ? "disabled" : ""}>${icon("spark")}试试示例题库</button></div><div class="text-entry"><textarea id="question-input" spellcheck="false" maxlength="2000000" placeholder="把你的题库粘贴到这里…&#10;&#10;1. 你的第一道题目？&#10;A. 选项一&#10;B. 选项二&#10;C. 选项三&#10;D. 选项四&#10;答案：B&#10;解析：可选，写下这道题的解题思路。" ${busy ? "disabled" : ""}>${escape(input)}</textarea></div><div class="input-meta"><span>支持常见 AI 输出、Markdown 和 JSON 格式</span><span id="character-count">${input.length.toLocaleString()} 字</span></div>`;
    const fileInput = `<div class="dropzone" id="dropzone"><span class="upload-icon">${icon("upload")}</span><h3><span class="desktop-label">把题库文件拖到这里</span><span class="mobile-label">从手机选择题库文件</span></h3><p>支持一次选择多个文件，合并成一份练习</p><button class="btn" data-action="pick-files" ${busy ? "disabled" : ""}>选择文件</button><span class="file-support">TXT / MD / JSON / CSV / XLSX / XLS / DOCX / PDF<br>每个文件最多 15 MB · 每次最多 1,500 题</span><input type="file" id="file-input" accept=".txt,.md,.markdown,.json,.csv,.tsv,.xlsx,.xls,.docx,.pdf" multiple hidden></div><div class="file-list">${files.map((f, i) => `<div class="file-item">${icon("file")}<span class="file-name">${escape(f.name)}</span><span class="subtle">${(f.size / 1024).toFixed(0)} KB</span><button data-action="remove-file" data-index="${i}" aria-label="移除 ${escape(f.name)}" ${busy ? "disabled" : ""}>×</button></div>`).join("")}</div><div class="input-meta"><span>Word 支持 .docx；PDF 需要有可复制的文字</span></div>`;
    return `<div class="panel-title"><h2>开始一份新练习</h2><span class="subtle">你的题库，你的节奏</span></div>${tabs}${draftBanner}<div id="input-area" role="tabpanel" aria-labelledby="tab-${tab}">${tab === "daily" ? daily.render() : tab === "ai" ? authoring.renderAI() : tab === "text" ? textInput : fileInput}</div>${!["ai", "daily"].includes(tab) ? `${error ? `<div class="alert error error-focus" id="import-error" role="alert" tabindex="-1">${escape(error)}</div>` : ""}${busy ? `<div class="alert info loading" id="loading-status" role="status">${escape(loading)}</div>` : ""}<div class="import-action"><span class="privacy-note">${icon("lock")}文件在本地处理，不会上传</span><button class="btn primary" data-action="parse" ${busy ? "disabled" : ""}>${busy ? "正在识别…" : "识别题目"}${icon("arrow")}</button></div>` : ""}`;
  }
  function previewPanel() {
    const qs = preview.questions, answered = qs.filter(q => q.answer.length).length;
    return `<div class="panel-title preview-heading"><h2>预览与编辑题库</h2><button class="btn secondary preview-back-button" data-action="edit-import">${icon("left")}返回选题 / 导入</button></div><p class="preview-back-help">返回后，当前题目和修改仍会保留。</p>${preview.source === "daily-bank" ? `<div class="ai-review-note">${icon("book")}离线练习题库已抽好，不消耗 AI token。请核对后开始练习。</div>` : ""}${preview.source === "local-math" ? `<div class="ai-review-note">${icon("check")}计算题已在本机生成并校验，未调用 AI。请核对题目后开始练习。</div>` : ""}${preview.source === "ai" ? `<div class="ai-review-note">${icon("spark")}AI 已整理好题目。请核对答案与解析，再开始练习。</div>` : ""}<div class="preview-summary"><span class="preview-count">${qs.length}</span><div><strong>道题目，等你来挑战</strong><p>${answered} 题含答案 · ${qs.length - answered} 题仅记录完成</p></div></div><label for="bank-title" class="subtle">给这份练习起个名字</label><input class="name-input" id="bank-title" maxlength="60" value="${escape(title || "我的题库")}" autocomplete="off">${preview.warnings.length ? `<div class="alert warning" role="status"><strong>${preview.edited ? "原始识别提示（修改前题号）" : `有 ${preview.warnings.length} 项需要核对`}</strong><br>${preview.warnings.slice(0, 20).map(escape).join("<br>")}${preview.warnings.length > 20 ? "<br>其余提示请检查原文件。" : ""}</div>` : ""}${authoring.undoMarkup()}<div class="label-row"><span>核对题目与答案</span><button class="link-btn" data-action="export-bank" ${qs.length ? "" : "disabled"}>${icon("file")}导出题库</button></div><div class="preview-list">${qs.length ? qs.map((q, i) => `<article class="preview-row"><span class="preview-number">${String(i + 1).padStart(2, "0")}</span><div class="preview-content"><div class="preview-row-top"><div><span class="type-label">${q.kind === "application" ? "应用题" : types[q.type]}</span><span class="answer-label">${q.answer.length ? "含参考答案" : "无标准答案"}</span></div><div class="preview-tools"><button class="link-btn" data-action="edit-question" data-index="${i}" aria-label="编辑第 ${i + 1} 题">编辑</button><button class="link-btn danger" data-action="delete-question" data-index="${i}" aria-label="删除第 ${i + 1} 题">删除</button></div></div><p>${escape(q.stem)}</p><details><summary>查看${q.options.length ? "选项、" : ""}答案与解析</summary>${q.options.map(o => `<p>${escape(o.id)}. ${escape(o.text)}</p>`).join("")}<p class="preview-answer"><strong>${q.type === "short" ? "参考答案" : "正确答案"}：</strong>${escape(q.answer.length ? q.type === "short" ? q.answer.join("；") : q.answer.map(a => { const o = q.options.find(o => o.id === a); return o ? `${o.id}. ${o.text}` : a; }).join("；") : "暂无答案，仅记录完成")}</p>${q.explanation ? `<p><strong>解析：</strong>${escape(q.explanation)}</p>` : ""}</details></div></article>`).join("") : `<div class="empty-preview"><strong>题目已全部移除</strong><p>可以撤销删除，或点击“返回选题 / 导入”，重新选择或生成题目。</p></div>`}</div><div class="import-action"><span class="privacy-note">${session ? "开始新练习，原作答会保存在历史记录中" : "可编辑题目；练习时提交后再显示答案"}</span><button class="btn primary" data-action="start" ${qs.length ? "" : "disabled"}>开始练习${icon("arrow")}</button></div>`;
  }
  function progress() {
    const stats = E.stats(session);
    return `<aside class="practice-sidebar"><section class="panel progress-card"><div class="progress-top"><span>我的练习进度</span><span class="progress-percent">${stats.percent}<small>%</small></span></div><div class="progress-track" role="progressbar" aria-label="已完成进度" aria-valuenow="${stats.completed}" aria-valuemin="0" aria-valuemax="${stats.total}"><div class="progress-fill" style="width:${stats.percent}%"></div><i class="milestone-mark" style="left:30%"></i><i class="milestone-mark" style="left:60%"></i></div><div class="progress-caption"><span>已完成 ${stats.completed} / ${stats.total} 题</span><span>${stats.completed === stats.total ? "全部完成" : "继续加油"}</span></div><div class="stats-row"><div class="stat correct"><strong>${stats.correct}</strong><small>答对</small></div><div class="stat incorrect"><strong>${stats.incorrect}</strong><small>答错</small></div><div class="stat"><strong>${stats.total - stats.completed}</strong><small>待完成</small></div></div><div class="map-title"><strong>答题卡</strong><span class="subtle">点击跳转</span></div><div class="question-map" aria-label="题号导航">${session.questions.map((q, i) => {
      const r = session.responses[i];
      return `<button class="map-item ${session.index === i ? "current" : ""} ${r?.status || ""}" data-action="jump" data-index="${i}" aria-current="${session.index === i ? "step" : "false"}" aria-label="第 ${i + 1} 题，${statuses[r?.status] || "未作答"}">${i + 1}</button>`;
    }).join("")}</div><div class="map-legend"><span><i class="legend-square green"></i>答对</span><span><i class="legend-square red"></i>答错</span><span><i class="legend-square"></i>无答案 / 未答</span></div><p class="progress-note">${icon("shield")}${storageFailed ? "当前浏览器无法保存进度" : "进度自动保存在当前浏览器"}</p></section><section class="tip-card"><span class="small-label">KEEP GOING</span><h3>每一道认真做过的题，<br>都算数。</h3><p>不着急，按自己的节奏来。</p></section></aside>`;
  }
  const mobileLayout = window.matchMedia("(max-width: 820px), (max-width: 1024px) and (max-height: 500px) and (pointer: coarse)");
  let actionObserver, viewportFrame;
  function mobileProgress() {
    const stats = E.stats(session);
    return `<section class="mobile-progress" aria-label="当前练习进度"><div class="mobile-progress-top"><span>已完成 <strong>${stats.completed} / ${stats.total}</strong><span class="mobile-percent">${stats.percent}%</span></span><button class="link-btn" data-action="open-map" aria-haspopup="dialog" aria-controls="answer-sheet">${icon("book")}答题卡</button></div><div class="mobile-progress-track" role="progressbar" aria-label="完成进度" aria-valuenow="${stats.completed}" aria-valuemin="0" aria-valuemax="${stats.total}"><span style="width:${stats.percent}%"></span></div></section>`;
  }
  function closeMap() {
    const sheet = $("#answer-sheet");
    if (sheet.open) sheet.close();
  }
  function openMap() {
    if (!session) return;
    const sheet = $("#answer-sheet");
    sheet.innerHTML = `<div class="sheet-header"><h2>答题卡</h2><button class="link-btn" data-action="close-map" aria-label="收起答题卡">收起 ${icon("cross")}</button></div>${progress()}`;
    sheet.showModal();
    const current = sheet.querySelector('.map-item.current');
    if (current) current.scrollIntoView({ block: "nearest" });
  }
  function scrollToQuestion() {
    if (!mobileLayout.matches) return;
    const panel = $(".question-panel"), heading = $(".practice-heading");
    if (!panel || !heading) return;
    const beforeQuestion = panel.getBoundingClientRect().top - heading.getBoundingClientRect().top;
    const usableHeight = (window.visualViewport?.height || window.innerHeight) - ($(".practice-actions")?.getBoundingClientRect().height || 78) - 24;
    if (beforeQuestion + Math.min(panel.getBoundingClientRect().height, 240) < usableHeight) {
      window.scrollTo({ top: Math.max(0, heading.getBoundingClientRect().top + window.scrollY - 12), behavior: "instant" });
    } else {
      panel.scrollIntoView({ block: "start", behavior: "instant" });
    }
  }
  function updateKeyboard() {
    const active = document.activeElement;
    const editing = active?.matches('textarea, input:not([type="file"])');
    const viewport = window.visualViewport;
    document.documentElement.style.setProperty("--keyboard-inset", `${mobileLayout.matches && editing && viewport ? Math.max(0, window.innerHeight - viewport.height) : 0}px`);
    document.body.classList.toggle("keyboard-open", Boolean(mobileLayout.matches && editing && viewport && window.innerHeight - viewport.height > 140));
  }
  function updateViewport() {
    updateKeyboard();
    cancelAnimationFrame(viewportFrame);
    viewportFrame = requestAnimationFrame(() => {
      if ($("#answer-sheet").open) $("#answer-sheet .map-item.current")?.scrollIntoView({ block: "nearest" });
      else if (document.body.classList.contains("keyboard-open") && !document.querySelector("dialog[open]")) {
        const active = document.activeElement, viewport = window.visualViewport;
        if (active?.matches("input, textarea") && viewport) {
          const rect = active.getBoundingClientRect();
          const top = viewport.offsetTop + 12;
          const bottom = viewport.offsetTop + viewport.height - ($(".practice-actions")?.getBoundingClientRect().height || 0) - 16;
          if (rect.bottom > bottom) window.scrollBy({ top: rect.bottom - bottom, behavior: "instant" });
          else if (rect.top < top) window.scrollBy({ top: rect.top - top, behavior: "instant" });
        }
      }
    });
  }
  function encouragement() {
    if (!session.notice) return "";
    const complete = E.stats(session).completed === session.questions.length;
    const combined = session.notice.includes(","), sixty = session.notice === "60";
    return `<div class="encourage" role="status"><span class="encourage-icon">${icon(complete ? "trophy" : "flag")}</span><div><strong>${escape(practiceAddress(complete ? "全部完成！这套练习已经做完啦。" : combined ? "30% 和 60% 里程碑，一起达成！" : sixty ? "60% 啦！你已经走过大半程。" : "完成 30%！好的开始，已经在路上。"))}</strong><p>${complete ? "查看结果和逐题回顾，巩固这次练习。" : sixty ? "继续保持，再一点点就能完成这次挑战。" : "每一道认真做过的题，都让知识更牢固一点。"}</p></div><button data-action="dismiss-notice" aria-label="关闭鼓励提示">×</button></div>`;
  }
  function feedback(q, r) {
    if (!r || r.status === "draft") return "";
    const review = r.status === "review", neutral = r.status === "ungraded";
    const heading = review ? "先对照答案，再给自己一个评价" : neutral ? "这道题，已完成" : r.status === "correct" ? "回答正确，掌握得不错！" : "这次没答对，正是巩固的好机会";
    return `<section class="feedback ${r.status}" aria-label="答案反馈"><div class="feedback-title">${icon(r.status === "correct" ? "check" : r.status === "incorrect" ? "cross" : "book")}${heading}</div>${neutral ? "<p>这道题没有标准答案，已记录你的作答，不计入正确率。</p>" + (q.explanation ? "<p><strong>解析：</strong>" + escape(q.explanation) + "</p>" : "") : `<p><strong>${q.type === "short" ? "参考答案" : "正确答案"}：</strong>${escape(q.type === "short" ? q.answer.join("；") : q.answer.map((a) => {
      const o = q.options.find((o2) => o2.id === a);
      return o ? `${a}. ${o.text}` : a;
    }).join("；"))}</p>${q.explanation ? `<p><strong>解析：</strong>${escape(q.explanation)}</p>` : ""}`}${review ? `<p><small>意思相近即可，不必逐字一致。完成自评后计入进度。</small></p><div class="self-actions"><button class="btn secondary" data-action="assess-incorrect">还需巩固</button><button class="btn primary" data-action="assess-correct">我答对了 ${icon("check")}</button></div>` : r.selfAssessed ? "<p><small>本题结果来自你的自评。</small></p>" : ""}</section>`;
  }
  function sideNavigation() {
    return `<nav class="side-navigation" aria-label="切换题目"><button class="side-button side-previous" data-action="previous" ${session.index === 0 ? "disabled" : ""} aria-label="上一题">${icon("left")}<span>上一题</span></button><button class="side-button side-next" data-action="next" ${session.index === session.questions.length - 1 ? "disabled" : ""} aria-label="下一题">${icon("arrow")}<span>下一题</span></button></nav>`;
  }
  function practicePage() {
    if (!session) {
      view = "import";
      return importPage();
    }
    const q = session.questions[session.index], r = session.responses[session.index], locked = r && r.status !== "draft", stats = E.stats(session);
    return `<div class="page-heading practice-heading"><div><span class="eyebrow">ONE QUESTION AT A TIME</span><h1>${escape(session.title)}</h1><p>专注眼前这一题，让进步慢慢发生。</p>${timingMarkup()}</div><button class="text-button" data-action="reset">${icon("refresh")} 重新练习</button></div>${mobileProgress()}${encouragement()}<div class="workspace practice-layout"><section class="panel question-panel">${sideNavigation()}<div class="question-top"><span class="type-label">${q.kind === "application" ? "应用题" : types[q.type]}</span><span class="question-counter"><strong>${String(session.index + 1).padStart(2, "0")}</strong> / ${session.questions.length}</span></div><h2 class="question-stem" id="question-stem" tabindex="-1">${escape(q.stem)}</h2><p class="question-hint">${q.type === "multiple" ? "选择所有正确选项，确认后提交" : q.type === "calculation" ? "输入结果，提交后自动校验" : q.type === "short" ? "先写下你的理解，再查看参考答案" : q.type === "boolean" ? "判断这个说法是否正确" : "选择一个你认为正确的答案"}${!q.answer.length ? " · 本题无标准答案" : ""}</p>${q.type === "calculation" ? `<div class="calculation-field ${locked ? r.status : ""}"><label class="field-label" for="calculation-answer">你的计算结果</label><input id="calculation-answer" class="calculation-answer" type="text" enterkeyhint="done" maxlength="120" autocomplete="off" autocapitalize="off" spellcheck="false" aria-describedby="calculation-help" placeholder="例如：24 或 1/2" value="${escape(r?.value ?? "")}" ${locked ? "disabled" : ""}><p class="field-help" id="calculation-help">支持整数、小数和分数，请只填写结果。</p></div>` : q.type === "short" ? `<label class="skip-link" for="short-answer">你的答案</label><textarea id="short-answer" class="short-answer" maxlength="10000" placeholder="用自己的话，写下你的回答…" ${locked ? "disabled" : ""}>${escape(r?.value || "")}</textarea>` : `<div class="options" role="group" aria-label="答案选项">${q.options.map((o) => {
      const chosen = Array.isArray(r?.value) && r.value.includes(o.id), correct = locked && q.answer.includes(o.id), incorrect = locked && chosen && q.answer.length && !correct;
      return `<button class="option ${chosen ? "selected" : ""} ${correct ? "correct" : ""} ${incorrect ? "incorrect" : ""}" data-action="option" data-option="${escape(o.id)}" aria-pressed="${Boolean(chosen)}" ${locked ? "disabled" : ""}><span class="option-letter">${escape(o.id)}</span><span class="option-text">${escape(o.text)}</span>${correct ? '<span class="option-status">✓</span>' : incorrect ? '<span class="option-status">×</span>' : ""}</button>`;
    }).join("")}</div>`}${feedback(q, r)}<div class="practice-actions ${locked ? "is-submitted" : ""}" aria-label="答题操作">${!locked ? `<div class="submit-row"><button class="btn primary" id="submit-answer" data-action="submit" ${r && (Array.isArray(r.value) ? r.value.length : String(r.value).trim()) ? "" : "disabled"}>提交答案 ${icon("check")}</button></div>` : ""}${session.index === stats.total - 1 ? `<div class="practice-end">${stats.completed === stats.total ? '<button class="btn primary" data-action="results">查看结果 →</button>' : '<button class="btn secondary" data-action="next-unfinished">查找待完成题</button>'}</div>` : ""}${locked && session.index < stats.total - 1 ? '<p class="navigation-hint"><span class="desktop-label">使用页面两侧按钮，或键盘 ← → 切题</span><span class="mobile-label">左滑下一题 · 右滑上一题</span></p>' : ""}</div><p class="swipe-instruction">左滑下一题 · 右滑上一题，作答会保留</p></section>${progress()}</div>`;
  }
  function resultPage() {
    const stats = E.summary(session);
    return `<div class="page-heading"><div><span class="eyebrow">A LITTLE BETTER, EVERY TIME</span><h1>今天，又向前走了一步。</h1></div></div>${encouragement()}<section class="panel summary-panel"><span class="completion-icon">${icon("trophy")}</span><h1>${stats.completed === stats.total ? "这份练习，完成啦！" : "看看你的练习进展"}</h1><p>${escape(session.title)} · 每一次认真作答，都有收获</p><div class="summary-stats"><div class="stat"><strong>${stats.completed}<span style="font-size:14px;color:var(--muted)">/${stats.total}</span></strong><small>已完成</small></div><div class="stat correct"><strong>${stats.correct}</strong><small>回答正确</small></div><div class="stat incorrect"><strong>${stats.incorrect}</strong><small>需要巩固</small></div><div class="stat"><strong>${stats.accuracy === null ? "—" : stats.accuracy + "%"}</strong><small>正确率</small></div></div><div class="summary-timing"><div><span>${stats.timingComplete ? "总耗时" : "已记录用时"}</span><strong>${E.formatDuration(stats.elapsedMs)}</strong></div><div><span>平均每题（已完成）</span><strong>${E.formatDuration(stats.averageMs)}</strong></div></div>${!stats.timingComplete ? `<p class="summary-footnote">旧练习没有完整计时记录，平均用时暂不计算；重新练习可完整计时。</p>` : ""}<p class="summary-footnote">正确率仅计算有答案且已判定的题目，包含简答自评。${stats.ungraded ? `${stats.ungraded} 道无答案题仅记录完成。` : ""}</p><div class="summary-actions"><button class="btn secondary" data-action="practice">返回答题</button><button class="btn primary" data-action="reset">${icon("refresh")}再练一遍</button><button class="text-button" data-action="home">导入新题库</button></div><div class="summary-list"><div class="summary-review-heading"><h2>逐题回顾 <span class="subtle">· ${stats.total} 题</span></h2><button class="btn secondary" data-action="export-images">${icon("file")}导出练习图片</button></div><div class="review-filters" role="group" aria-label="回顾题目筛选">${[['all','全部'],['incorrect','错题'],['pending','未完成']].map(([k,n])=>`<button class="btn ${reviewFilter===k?'primary':'secondary'}" data-action="review-filter" data-filter="${k}" aria-pressed="${reviewFilter===k}">${n}</button>`).join('')}${stats.incorrect?'<button class="btn primary" data-action="retry-wrongs">只重练错题</button>':''}</div><div class="summary-review-grid">${session.questions.map((q, i) => ({q,i})).filter(({i}) => reviewFilter === "all" || (reviewFilter === "incorrect" ? session.responses[i]?.status === "incorrect" : !session.responses[i] || ["draft","review"].includes(session.responses[i].status))).map(({q,i}) => `<button class="summary-question" data-action="jump" data-index="${i}" aria-label="查看第 ${i + 1} 题：${escape(q.stem)}，${statuses[session.responses[i]?.status] || "未作答"}"><span class="review-card-top"><span class="preview-number">${String(i + 1).padStart(2, "0")}</span><span class="status-pill ${session.responses[i]?.status || ""}">${statuses[session.responses[i]?.status] || "未作答"}</span></span><span class="review-stem">${escape(q.stem)}</span></button>`).join("")}</div></div></section>`;
  }
  function render(focus, { autoFocusAnswer = true } = {}) {
    syncTiming();
    save();
    document.body.dataset.view = view;
    $("#main").innerHTML = view === "import" ? importPage() : view === "results" ? resultPage() : ["history", "wrongs"].includes(view) ? libraryUI.render() : practicePage();
    $("#nav-import").classList.toggle("active", view === "import");
    $("#nav-practice").classList.toggle("active", ['practice','results'].includes(view));
    $('#nav-history').classList.toggle('active', view === 'history');
    $('#nav-wrongs').classList.toggle('active', view === 'wrongs');
    $("#nav-practice").disabled = !session;
    const info = library.status();
    if (!info.persisted && !['history','wrongs'].includes(view)) $('#main').insertAdjacentHTML('afterbegin', '<div class="alert warning archive-warning" role="alert">本地历史尚未成功保存，请到“历史记录”导出备份后再关闭页面。</div>');
    bindDrop();
    if (focus) {
      const target = $(focus);
      // Do not summon a phone keyboard just by opening a preview or a sample.
      if (!(mobileLayout.matches && target?.matches("input, textarea"))) target?.focus({ preventScroll: true });
      if (focus === "#question-stem") scrollToQuestion();
      else if (mobileLayout.matches) target?.scrollIntoView({ block: "nearest", behavior: "instant" });
    }
    if (autoFocusAnswer && view === "practice" && !document.querySelector("dialog[open]")) {
      const answer = $("#calculation-answer:not(:disabled), #short-answer:not(:disabled)");
      if (answer) {
        // Focus synchronously so touch navigation can also request the phone keyboard.
        answer.focus();
        answer.setSelectionRange(answer.value.length, answer.value.length);
      }
    }
    actionObserver?.disconnect();
    const actions = $(".practice-actions");
    if (actions && window.ResizeObserver) {
      actionObserver = new ResizeObserver(() => {
        if (mobileLayout.matches) document.documentElement.style.setProperty("--practice-actions-height", `${actions.getBoundingClientRect().height}px`);
      });
      actionObserver.observe(actions);
    }
    updateKeyboard();
  }
  function addFiles(list) {
    if (busy) return;
    const incoming = Array.from(list);
    if (files.length + incoming.length > 20) {
      error = "每次最多选择 20 个文件，请分批导入。";
      render("#import-error");
      return;
    }
    for (const f of incoming) {
      if (!files.some((existing) => existing.name === f.name && existing.size === f.size && existing.lastModified === f.lastModified)) files.push(f);
    }
    error = "";
    preview = null;
    render();
  }
  function bindDrop() {
    const drop = $("#dropzone");
    if (!drop) return;
    drop.addEventListener("dragover", (e) => {
      e.preventDefault();
      if (!busy) drop.classList.add("drag");
    });
    drop.addEventListener("dragleave", () => drop.classList.remove("drag"));
    drop.addEventListener("drop", (e) => {
      e.preventDefault();
      drop.classList.remove("drag");
      addFiles(e.dataTransfer.files);
    });
    $("#file-input").addEventListener("change", (e) => addFiles(e.target.files));
  }
  async function parse() {
    if (busy) return;
    error = "";
    busy = true;
    loading = "正在识别题库…";
    render();
    await new Promise((resolve) => setTimeout(resolve, 30));
    try {
      if (tab === "text") {
        preview = P.parseText(input);
        title = input === window.QUIZ_SAMPLE ? "学习热身 · 10 题小练习" : title || "我的题库";
      } else {
        if (!files.length) throw Error("请先选择至少一个题库文件。");
        const questions = [], warnings = [];
        for (let i = 0; i < files.length; i++) {
          loading = `正在读取 ${i + 1}/${files.length}：${files[i].name}`;
          const status = $("#loading-status");
          if (status) status.textContent = loading;
          try {
            const result = await window.QuizFiles.read(files[i], (message) => {
              if ($("#loading-status")) $("#loading-status").textContent = message;
            });
            questions.push(...result.questions);
            warnings.push(...result.warnings.map((w) => `${files[i].name}：${w}`));
          } catch (err) {
            warnings.push(`${files[i].name} 未导入：${err.message}`);
          }
        }
        if (!questions.length) throw Error(warnings.join("\n"));
        if (questions.length > P.LIMIT) throw Error(`共识别 ${questions.length} 题，超过 ${P.LIMIT} 题，请分批导入。`);
        questions.forEach((q, i) => q.id = `q${i + 1}`);
        preview = { questions, warnings };
        title = files.length === 1 ? files[0].name.replace(/\.[^.]+$/, "") : "合并题库";
      }
    } catch (err) {
      preview = null;
      error = err.message || "识别失败，请检查题库格式后重试。";
    } finally {
      busy = false;
      if (preview) { previewDraft = null; authoring.resetUndo(); savePreview(); }
      render(error ? "#import-error" : "#bank-title");
    }
  }
  function move(index) {
    if (!session) return;
    closeMap();
    session.index = Math.max(0, Math.min(index, session.questions.length - 1));
    view = "practice";
    save();
    render("#question-stem");
  }
  function onAction(action, el) {
    if (busy && !["download-sample", "ai-cancel"].includes(action)) return;
    if (window.QuizImageExport.handleAction(action)) return;
    if (libraryUI.handleAction(action, el)) return;
    if (authoring.handleAction(action, el)) return;
    if (daily.handleAction(action, el)) return;
    if (action === "export-images") { if (session) { syncTiming(); save(); window.QuizImageExport.open(session); } }
    else if (action === 'history' || action === 'wrongs') {
      view = action; libraryUI.open(action); render(); window.scrollTo({top:0,behavior:'instant'});
    }
    else if (action === 'review-filter') { reviewFilter = el.dataset.filter; render(); }
    else if (action === 'retry-wrongs') {
      const questions = session.questions.filter((_,i)=>session.responses[i]?.status === 'incorrect');
      if (!questions.length) return;
      syncTiming(); save();
      session = newAttempt('错题订正 · ' + questions.length + '题', questions, session.username, session.id);
      view = 'practice'; reviewFilter = 'all'; render('#question-stem');
    }
    else if (action === "open-map") openMap();
    else if (action === "close-map") closeMap();
    else if (action === "home") {
      view = "import";
      render();
      if (mobileLayout.matches) window.scrollTo({top: 0, behavior: "instant"});
    } else if (action === "practice") {
      if (session) {
        view = "practice";
        if (el?.id === "nav-practice") {
          // Top-level navigation follows the other tabs, without question scrolling or keyboard focus.
          render(undefined, { autoFocusAnswer: false });
          window.scrollTo({ top: 0, behavior: "instant" });
        } else render("#question-stem");
      }
    } else if (["tab-daily", "tab-text", "tab-file", "tab-ai"].includes(action)) {
      tab = action.slice(4);
      error = "";
      render("#tab-" + tab);
    } else if (action === "sample") {
      input = window.QUIZ_SAMPLE;
      title = "学习热身 · 10 题小练习";
      error = "";
      tab = "text";
      render("#question-input");
      toast("已填入 10 道示例题，点击「识别题目」试试看。");
    } else if (action === "pick-files") $("#file-input").click();
    else if (action === "remove-file") {
      files.splice(Number(el.dataset.index), 1);
      render();
    } else if (action === "parse") void parse();
    else if (action === "edit-import") {
      if (preview) preview.title = title;
      previewDraft = preview;
      if (["ai", "local-math"].includes(preview?.source)) tab = "ai";
      if (preview?.source === "daily-bank") tab = "daily";
      preview = null;
      render();
    } else if (action === "resume-preview") {
      preview = previewDraft;
      title = preview?.title || "我的题库";
      previewDraft = null;
      render("#bank-title");
    } else if (action === "start") {
      if (!preview?.questions.length) return;
      syncTiming(); save();
      daily.commit(preview);
      session = newAttempt($('#bank-title')?.value.trim() || '我的题库', preview.questions, preview.learner ?? window.QuizProfile.getName(), preview.parentId);
      session.source = preview.source;
      reviewFilter = 'all';
      preview = null;
      previewDraft = null;
      authoring.resetUndo();
      savePreview();
      view = "practice";
      save();
      render("#question-stem");
    } else if (action === "option") {
      const q = session.questions[session.index], r = session.responses[session.index], letter = el.dataset.option;
      if (!q.options.some((o) => o.id === letter)) return;
      let selected = Array.isArray(r?.value) ? [...r.value] : [];
      selected = q.type === "multiple" ? selected.includes(letter) ? selected.filter((a) => a !== letter) : [...selected, letter] : [letter];
      E.select(session, session.index, selected);
      save();
      render(`[data-action="option"][data-option="${letter}"]`);
    } else if (action === "submit") {
      try {
        const previousMilestone = session.notice;
        E.submit(session, session.index, P);
        save();
        render();
        if (mobileLayout.matches) $(".feedback")?.scrollIntoView({ block: "nearest", behavior: "instant" });
        notifyMilestone(previousMilestone);
        requestAnimationFrame(() => {
          const target = session.responses[session.index].status === "review" ? '[data-action="assess-correct"]' : '[data-action="next"], [data-action="results"], [data-action="next-unfinished"]';
          $(target)?.focus({ preventScroll: true });
        });
      } catch (err) {
        toast(err.message);
      }
    } else if (action === "assess-correct" || action === "assess-incorrect") {
      const previousMilestone = session.notice;
      E.assess(session, session.index, action === "assess-correct" ? "correct" : "incorrect");
      save();
      render();
      notifyMilestone(previousMilestone);
    } else if (action === "previous") move(session.index - 1);
    else if (action === "next") move(session.index + 1);
    else if (action === "jump") move(Number(el.dataset.index));
    else if (action === "next-unfinished") {
      const index = session.questions.findIndex((_, i) => !session.responses[i] || ["draft", "review"].includes(session.responses[i].status));
      if (index >= 0) {
        move(index);
        toast("已跳转到第一道尚未完成的题目。");
      }
    } else if (action === "dismiss-notice") {
      session.notice = "";
      save();
      render();
    } else if (action === "results") {
      view = "results";
      render();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else if (action === "reset") $("#confirm-dialog").showModal();
    else if (action === "cancel-reset") $("#confirm-dialog").close();
    else if (action === "confirm-reset") {
      syncTiming(); save();
      session = newAttempt(session.title, session.questions, session.username, session.id);
      reviewFilter = 'all';
      view = "practice";
      save();
      $("#confirm-dialog").close();
      render("#question-stem");
    } else if (action === "download-sample") {
      const blob = new Blob([window.QUIZ_SAMPLE], { type: "text/plain;charset=utf-8" }), a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "啃题-示例题库.txt";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1e3);
    }
  }
  let swipe = null, ignoreTouchClickUntil = 0;
  const activeTouches = new Set();
  document.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "touch") return;
    activeTouches.add(event.pointerId);
    if (activeTouches.size !== 1) { swipe = null; return; }
    const target = event.target;
    const excluded = target.closest('textarea, input, select, a, summary, [contenteditable], button:not(.option)');
    if (!mobileLayout.matches || view !== "practice" || !session || excluded || !target.closest(".question-panel") || document.querySelector("dialog[open]") || !window.getSelection()?.isCollapsed) return;
    swipe = { id: event.pointerId, x: event.clientX, y: event.clientY, started: performance.now(), index: session.index };
  }, { passive: true });
  document.addEventListener("pointermove", (event) => {
    if (!swipe || event.pointerId !== swipe.id) return;
    const dx = Math.abs(event.clientX - swipe.x), dy = Math.abs(event.clientY - swipe.y);
    // Give vertical reading gestures to the browser as soon as their direction is clear.
    if (dy > 14 && dy > dx * 0.8) swipe = null;
  }, { passive: true });
  document.addEventListener("pointercancel", (event) => {
    activeTouches.delete(event.pointerId);
    swipe = null;
  }, { passive: true });
  document.addEventListener("pointerup", (event) => {
    activeTouches.delete(event.pointerId);
    const gesture = swipe;
    swipe = null;
    if (!gesture || event.pointerId !== gesture.id || !session || session.index !== gesture.index || document.querySelector("dialog[open]")) return;
    const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
    const threshold = Math.max(60, Math.min(90, window.innerWidth * 0.18));
    if (Math.abs(dx) < threshold || Math.abs(dx) < Math.abs(dy) * 1.6 || performance.now() - gesture.started > 900 || !window.getSelection()?.isCollapsed) return;
    ignoreTouchClickUntil = performance.now() + 400;
    const next = session.index + (dx < 0 ? 1 : -1);
    if (next < 0) toast("已经是第一题了。");
    else if (next >= session.questions.length) toast("已经是最后一题了。");
    else move(next);
  }, { passive: true });
  document.addEventListener("click", (event) => {
    if (event.detail > 0 && performance.now() < ignoreTouchClickUntil) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);
  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-action]");
    if (!el || el.disabled) return;
    e.preventDefault();
    onAction(el.dataset.action, el);
  });
  document.addEventListener("input", (e) => {
    authoring.handleInput(e);
    if (e.target.id === "question-input") {
      input = e.target.value;
      $("#character-count").textContent = input.length.toLocaleString() + " 字";
      title = "";
    } else if (e.target.id === "bank-title") { title = e.target.value; savePreview(); }
    else if (["short-answer", "calculation-answer"].includes(e.target.id)) {
      E.select(session, session.index, e.target.value);
      $("#submit-answer").disabled = !e.target.value.trim();
      save();
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.target.getAttribute("role") === "tab" && ["ArrowLeft", "ArrowRight"].includes(e.key)) {
      e.preventDefault();
      const tabs = ["daily", "ai", "text", "file"];
      onAction("tab-" + tabs[(tabs.indexOf(tab) + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length], e.target);
      return;
    }
    if (e.target.id === "calculation-answer" && e.key === "Enter" && !e.isComposing && !e.altKey && !e.metaKey && !e.ctrlKey && !document.querySelector("dialog[open]") && $("#submit-answer") && !$("#submit-answer").disabled) {
      e.preventDefault(); onAction("submit", $("#submit-answer")); return;
    }
    if (e.altKey || e.metaKey || e.ctrlKey || ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName) || e.target.isContentEditable || document.querySelector("dialog[open]") || view !== "practice" || !session) return;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      move(session.index + 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      move(session.index - 1);
    } else if (/^[1-8]$/.test(e.key)) {
      const q = session.questions[session.index], o = q.options[Number(e.key) - 1];
      if (o && !session.responses[session.index]?.status?.match(/correct|ungraded|review/)) {
        e.preventDefault();
        onAction("option", { dataset: { option: o.id } });
      }
    }
  });
  $("#answer-sheet").addEventListener("click", (event) => {
    if (event.target !== event.currentTarget) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeMap();
  });
  $("#answer-sheet").addEventListener("close", () => { $("#answer-sheet").innerHTML = ""; });
  window.visualViewport?.addEventListener("resize", updateViewport);
  window.addEventListener("resize", updateViewport);
  document.addEventListener("focusin", updateKeyboard);
  document.addEventListener("focusout", () => requestAnimationFrame(updateKeyboard));
  mobileLayout.addEventListener("change", () => { updateKeyboard(); if (!mobileLayout.matches) closeMap(); });
  document.addEventListener("visibilitychange", () => { syncTiming(); save(); updateTimingDisplay(); });
  window.addEventListener("pagehide", () => { pageHidden = true; syncTiming(); save(); });
  window.addEventListener("pageshow", () => { pageHidden = false; syncTiming(); updateTimingDisplay(); });
  const dialogTimingObserver = new MutationObserver(() => { syncTiming(); save(); updateTimingDisplay(); });
  document.querySelectorAll("dialog").forEach(dialog => dialogTimingObserver.observe(dialog, { attributes: true, attributeFilter: ["open"] }));
  let timingTicks = 0;
  setInterval(() => {
    syncTiming(); updateTimingDisplay();
    if (++timingTicks % 5 === 0 && practiceClock.running) save();
  }, 1000);
  render();
  const context = document.modelContext;
  if (context?.registerTool) {
    const lifecycle = new AbortController();
    window.addEventListener("pagehide", () => lifecycle.abort(), { once: true });
    for (const tool of [{ name: "get_quiz_progress", description: "Read current practice progress without revealing answers to unsubmitted questions.", inputSchema: { type: "object", properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, untrustedContentHint: true }, execute: () => session ? { title: session.title, index: session.index + 1, ...E.stats(session) } : { active: false } }, { name: "navigate_quiz_question", description: "Navigate to a one-based question number in the active practice. This does not submit an answer.", inputSchema: { type: "object", properties: { questionNumber: { type: "integer", minimum: 1 } }, required: ["questionNumber"], additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: true }, execute: (input2) => {
      const n = input2?.questionNumber;
      if (!session || !Number.isInteger(n) || n < 1 || n > session.questions.length) throw Error("题号无效或没有当前练习");
      move(n - 1);
      return { questionNumber: n, stem: session.questions[n - 1].stem };
    } }]) {
      try {
        Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(() => {
        });
      } catch {
      }
    }
  }
})();
