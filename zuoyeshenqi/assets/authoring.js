(function(root) {
  "use strict";
  const escape = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const types = { single: "单选题", multiple: "多选题", boolean: "判断题", short: "简答题", calculation: "计算题" };
  const $ = selector => document.querySelector(selector);
  const SETTINGS_KEY = "kenti-ai-settings-v1";
  const clone = value => JSON.parse(JSON.stringify(value));
  function create(hooks) {
    const ai = { description: "", count: "", type: "mixed", difficulty: "medium", error: "", progress: "" };
    let historyStorage;
    try { historyStorage = root.localStorage; } catch {}
    const history = root.QuizQuestionVariety.createHistory(historyStorage);
    const bankCache = root.QuizAIBankCache.create(historyStorage);
    const cacheOptions = () => ({...ai, model:config.model});
    try {
      const draft = JSON.parse(historyStorage?.getItem("kenti-bank-draft-v1") || "null");
      if (!history.list().length && ["ai", "local-math"].includes(draft?.source) && Array.isArray(draft.questions)) history.remember(draft.questions);
    } catch {}
    let config = { apiKey: "", model: root.QuizAI.DEFAULT_MODEL, remember: false };
    try {
      const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "null");
      if (saved) config = { apiKey: typeof saved.apiKey === "string" ? saved.apiKey : "", model: typeof saved.model === "string" ? saved.model : root.QuizAI.DEFAULT_MODEL, remember: Boolean(saved.apiKey) };
    } catch { /* Restricted browser storage does not block this session. */ }
    let generating = false, requestId = 0, controller, editing, editingBank, editingIndex, undo;
    function localMath() { return Boolean(root.QuizMathPractice.plan(ai)); }
    function costNote() { return localMath() ? "本套计算题在本机生成并校验，不消耗 AI token" : "去重提示≤1,800字符 · 最多补题1次 · 可0 token复用"; }
    function reuseMarkup() {
      return bankCache.get(cacheOptions()) ? '<div class="ai-reuse"><span>相同要求已有题库，复用会保留原题，不再请求 AI。</span><button class="btn secondary" data-action="ai-reuse">复用上次题库 · 0 token</button></div>' : '';
    }
    function renderAI() {
      return `<div class="ai-intro"><span class="ai-emblem" aria-hidden="true">✦</span><div><strong>从一个想法，开始一份练习</strong><p>告诉 AI 你想学什么，它来整理题目、答案和解析。</p></div></div>
        <div class="ai-config-line"><span class="ai-model-badge">${localMath() ? "数学快速出题" : "DeepSeek"}</span><button class="link-btn" data-action="ai-settings" ${generating ? "disabled" : ""}>${config.apiKey ? "已配置密钥 · 修改设置" : localMath() ? "其他题型的 AI 设置" : "先设置 API Key"}</button></div>
        <label class="field-label" for="ai-description">学习内容 / 出题要求</label>
        <textarea class="author-input ai-description" id="ai-description" maxlength="12000" placeholder="小学3年级数学计算练习题（20道口算➕10道综合算式）" ${generating ? "disabled" : ""}>${escape(ai.description)}</textarea>
        <div class="input-meta"><span>可描述总题数及分类数量；较多题目建议分批生成</span><span id="ai-character-count">${ai.description.length.toLocaleString()} / 12,000</span></div>
        <div class="ai-options"><div><label class="field-label" for="ai-count">题目数量（选填）</label><input class="author-input" type="number" id="ai-count" min="1" max="${root.QuizBank.LIMIT}" step="1" placeholder="按描述决定" value="${escape(ai.count)}" ${generating ? "disabled" : ""}><span class="field-help">留空按描述出题，也可自定数量</span></div>
        <div><label class="field-label" for="ai-type">题型</label><select class="author-input" id="ai-type" ${generating ? "disabled" : ""}>${Object.entries({ mixed: "混合题型", ...types }).map(([value, label]) => `<option value="${value}" ${ai.type === value ? "selected" : ""}>${label}</option>`).join("")}</select></div>
        <div><label class="field-label" for="ai-difficulty">难度</label><select class="author-input" id="ai-difficulty" ${generating ? "disabled" : ""}>${Object.entries({ easy: "基础巩固", medium: "理解应用", hard: "综合挑战" }).map(([value, label]) => `<option value="${value}" ${ai.difficulty === value ? "selected" : ""}>${label}</option>`).join("")}</select></div></div>
        <div id="ai-reuse-block">${reuseMarkup()}</div>
        ${ai.error ? `<div class="alert error error-focus" id="ai-error" role="alert" tabindex="-1">${escape(ai.error)}</div>` : ""}
        ${generating ? `<div class="ai-loading" role="status"><span class="ai-spinner" aria-hidden="true"></span><div><strong>${escape(ai.progress || "正在出题并整理答案…")}</strong><p>${localMath() ? "在本机计算答案并排除近期旧题，无需联网。" : "通常需要几十秒，最多等待 2 分钟。生成后可逐题修改。"}</p></div></div>` : ""}
        <div class="import-action"><span class="privacy-note ai-cost-note">${costNote()}</span><button class="btn ${generating ? "secondary" : "primary"}" data-action="${generating ? "ai-cancel" : "ai-generate"}">${generating ? "取消生成" : "✦ 生成题库"}</button></div><button class="link-btn ai-offline-link" data-action="ai-open-daily" ${generating ? 'disabled' : ''}>1–5年级常规计算，改用每日计算 · 0 token →</button>`;
    }
    function openSettings() {
      const dialog = $("#ai-settings-dialog");
      dialog.innerHTML = `<form id="ai-settings-form" class="author-dialog-frame"><div class="author-dialog-head"><div><span class="eyebrow">YOUR PREFERENCES</span><h2 id="ai-settings-title">设置</h2></div><button class="icon-button" type="button" data-action="ai-close-settings" aria-label="关闭设置">×</button></div><div class="author-dialog-body">
        <label class="field-label" for="profile-username">用户名（选填）</label><input class="author-input" id="profile-username" maxlength="20" autocomplete="nickname" placeholder="例如：小明" value="${escape(root.QuizProfile?.getName() || "")}"><p class="field-help">最多 20 个字，可留空。用于练习提示和导出图片，仅保存在当前浏览器。</p><h3 class="settings-section-title">AI 出题</h3><label class="field-label" for="ai-api-key">API Key</label><div class="secret-field"><input class="author-input" id="ai-api-key" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="输入你的 DeepSeek API Key"><button class="link-btn" type="button" data-action="ai-toggle-key" aria-label="显示 API Key">显示</button></div><p class="field-help">密钥只用于请求 DeepSeek，不会写入 HTML 或题库文件。</p>
        <label class="field-label spaced" for="ai-model">模型</label><input class="author-input" id="ai-model" list="ai-models" maxlength="80" autocomplete="off" value="${escape(config.model)}"><datalist id="ai-models"><option value="deepseek-flash"></option><option value="deepseek-v4-pro"></option></datalist><p class="field-help">默认 deepseek-flash，也可填写账户支持的其他模型名称。</p>
        <label class="remember-key"><input type="checkbox" id="ai-remember-key" ${config.remember ? "checked" : ""}><span>在此浏览器记住密钥<small>仅建议在自己的设备上开启；否则关闭页面后需重新填写。</small></span></label>
        <div class="alert error" id="ai-settings-error" role="alert" hidden></div></div><div class="author-dialog-footer"><button class="link-btn danger" type="button" data-action="ai-clear-key">清除密钥</button><button class="btn primary" type="submit" data-action="ai-save-settings">保存设置</button></div></form>`;
      $("#ai-api-key").value = config.apiKey;
      dialog.showModal();
    }
    function saveSettings() {
      const key = $("#ai-api-key").value.trim(), model = $("#ai-model").value.trim(), remember = $("#ai-remember-key").checked;
      if (/\s/.test(key) || !/^[a-zA-Z0-9._-]{1,80}$/.test(model)) {
        $("#ai-settings-error").textContent = "密钥不能包含空格；模型名称只可包含字母、数字、点、下划线和连字符。";
        $("#ai-settings-error").hidden = false;
        return;
      }
      config = { apiKey: key, model, remember };
      let stored = true;
      try { localStorage.setItem(SETTINGS_KEY, JSON.stringify({ model, ...(remember && key ? { apiKey: key } : {}) })); }
      catch { stored = false; config.remember = false; }
      if (root.QuizProfile && !root.QuizProfile.setName($("#profile-username").value)) stored = false;
      ai.error = "";
      ai.progress = "";
      $("#ai-settings-dialog").close(); hooks.refresh();
      hooks.toast(stored ? "设置已保存。" : "当前浏览器无法保存设置，本次打开期间仍可使用。");
    }
    function clearKey() {
      config.apiKey = ""; config.remember = false;
      try { localStorage.removeItem(SETTINGS_KEY); } catch {}
      $("#ai-api-key").value = ""; $("#ai-remember-key").checked = false;
      hooks.refresh(); hooks.toast("已清除密钥。");
    }
    async function generate() {
      if (generating) return;
      ai.error = "";
      ai.progress = "";
      if (!config.apiKey && !localMath()) { openSettings(); return; }
      try { root.QuizAI.buildRequest({ ...ai, model: config.model }); }
      catch (error) { ai.error = error.message; hooks.refresh("#ai-error"); return; }
      const currentId = ++requestId;
      controller = new AbortController(); generating = true; hooks.busy(true);
      try {
        const result = await root.QuizAI.generate({ ...ai, ...config, signal: controller.signal, maxRepairAttempts: 1, hintQuestions: history.list(), previousQuestions: [...history.list(), ...(hooks.getCurrentQuestions?.() || [])], onRetry: ({ attempt, repeated }) => {
          if (currentId !== requestId) return;
          ai.progress = `正在补出 ${repeated} 道新题（第 ${attempt}/1 次）…`;
          hooks.refresh();
        } });
        if (currentId !== requestId) return;
        if (!history.remember(result.questions)) result.warnings.push("当前浏览器无法保存去重记录，本次页面内仍可去重；关闭后记录可能丢失。");
        bankCache.remember(cacheOptions(), result);
        generating = false; controller = null; undo = null;
        hooks.preview(result);
      } catch (error) {
        if (currentId !== requestId) return;
        ai.error = error.message || "生成失败，请稍后重试。";
      } finally {
        if (currentId === requestId) { generating = false; controller = null; hooks.busy(false, ai.error ? "#ai-error" : "#bank-title"); }
      }
    }
    function cancel() {
      requestId++; controller?.abort(); controller = null; generating = false; ai.error = "";
      hooks.busy(false); hooks.toast("已取消生成，出题要求已保留。");
    }
    function editorMessage(message) {
      const node = $("#editor-error"); node.textContent = message; node.hidden = false; node.tabIndex = -1; node.focus({ preventScroll: true }); node.scrollIntoView({ block: "nearest" });
    }
    function renderEditor() {
      const q = editing;
      $("#question-editor").innerHTML = `<form id="question-editor-form" class="author-dialog-frame"><div class="author-dialog-head"><div><span class="eyebrow">QUESTION ${String(editingIndex + 1).padStart(2, "0")}</span><h2 id="editor-title">编辑题目</h2></div><button class="icon-button" type="button" data-action="editor-close" aria-label="关闭题目编辑">×</button></div><div class="author-dialog-body">
        <label class="field-label" for="editor-type">题型</label><select class="author-input" id="editor-type">${Object.entries(types).map(([value, label]) => `<option value="${value}" ${q.type === value ? "selected" : ""}>${label}</option>`).join("")}</select><p class="field-help">切换题型会清空原答案，请重新确认选项和答案。</p>
        <label class="field-label spaced" for="editor-stem">题干</label><textarea class="author-input" id="editor-stem" rows="3" maxlength="10000">${escape(q.stem)}</textarea>
        ${!["short", "calculation"].includes(q.type) ? `<div class="label-row spaced"><span class="field-label">选项</span>${q.type !== "boolean" ? `<button class="link-btn" type="button" data-action="editor-add-option" ${q.options.length >= 8 ? "disabled" : ""}>＋ 添加选项</button>` : ""}</div><div class="editor-options">${q.options.map(o => `<div class="editor-option"><label for="editor-option-${escape(o.id)}">${escape(o.id)}</label><textarea class="author-input" id="editor-option-${escape(o.id)}" data-editor-option="${escape(o.id)}" rows="2" maxlength="3000">${escape(o.text)}</textarea>${q.type !== "boolean" ? `<button class="icon-button danger" type="button" data-action="editor-remove-option" data-option="${escape(o.id)}" aria-label="删除选项 ${escape(o.id)}" ${q.options.length <= 2 ? "disabled" : ""}>×</button>` : ""}</div>`).join("")}</div><div class="label-row spaced"><span class="field-label">正确答案</span><button class="link-btn" type="button" data-action="editor-clear-answer">清除答案</button></div><div class="editor-answers" role="group" aria-label="正确答案">${q.options.map(o => `<label class="answer-choice"><input type="${q.type === "multiple" ? "checkbox" : "radio"}" name="editor-answer" value="${escape(o.id)}" ${q.answer.includes(o.id) ? "checked" : ""}><span>${escape(o.id)}${q.type === "boolean" ? ` · ${escape(o.text)}` : ""}</span></label>`).join("")}</div>` : q.type === "calculation" ? `<label class="field-label spaced" for="editor-answer-text">正确结果</label><input class="author-input" id="editor-answer-text" type="text" maxlength="120" autocomplete="off" spellcheck="false" placeholder="例如：24、-3、0.5 或 1/2" value="${escape(q.answer[0] ?? "")}"><p class="field-help">填写一个数值结果；练习时会自动校验，等值的小数和分数也可判对。</p>` : `<label class="field-label spaced" for="editor-answer-text">参考答案</label><textarea class="author-input" id="editor-answer-text" rows="3" maxlength="10000">${escape(q.answer.join("；"))}</textarea>`}
        <p class="field-help">答案可留空；无标准答案的题只记录完成，不计正确率。</p><label class="field-label spaced" for="editor-explanation">解析</label><textarea class="author-input" id="editor-explanation" rows="3" maxlength="10000" placeholder="写下解题思路或需要记住的知识点">${escape(q.explanation)}</textarea><div class="alert error" id="editor-error" role="alert" hidden></div>
        </div><div class="author-dialog-footer"><button class="btn secondary" type="button" data-action="editor-close">取消</button><button class="btn primary" type="submit" data-action="editor-save">保存修改</button></div></form>`;
    }
    function openEditor(index) {
      const bank = hooks.getPreview();
      if (!bank?.questions[index]) return;
      editingBank = bank; editingIndex = index; editing = clone(bank.questions[index]);
      renderEditor(); $("#question-editor").showModal();
    }
    function saveEditor() {
      if (!editing || editingBank !== hooks.getPreview()) return;
      try {
        const question = root.QuizBank.normalizeQuestion(editing, editingIndex);
        editingBank.questions[editingIndex] = question; editingBank.edited = true;
        const index = editingIndex;
        $("#question-editor").close(); hooks.changed(`[data-action="edit-question"][data-index="${index}"]`);
        hooks.toast("题目已更新。");
      } catch (error) { editorMessage(error.message); }
    }
    function removeQuestion(index) {
      const bank = hooks.getPreview();
      if (!bank?.questions[index]) return;
      undo = { bank, index, question: bank.questions[index] };
      bank.questions.splice(index, 1); bank.questions.forEach((q, i) => q.id = `q${i + 1}`); bank.edited = true;
      hooks.changed("#undo-delete");
    }
    function undoDelete() {
      if (!undo || hooks.getPreview() !== undo.bank) return;
      const { bank, index, question } = undo;
      bank.questions.splice(index, 0, question); bank.questions.forEach((q, i) => q.id = `q${i + 1}`); undo = null;
      hooks.changed(`[data-action="edit-question"][data-index="${index}"]`); hooks.toast("已恢复删除的题目。");
    }
    function undoMarkup() {
      return undo && undo.bank === hooks.getPreview() ? `<div class="undo-banner" role="status"><span>已删除一道题目</span><button class="link-btn" id="undo-delete" data-action="undo-delete">撤销删除</button></div>` : "";
    }
    function exportBank() {
      const bank = hooks.getPreview(); if (!bank?.questions.length) return;
      const title = $("#bank-title")?.value.trim() || "我的题库";
      const blob = new Blob([root.QuizBank.toJSON(bank.questions, title)], { type: "application/json;charset=utf-8" });
      const anchor = document.createElement("a"); anchor.href = URL.createObjectURL(blob); anchor.download = `${title.replace(/[\\/:*?"<>|]/g, "_")}.json`; anchor.click();
      setTimeout(() => URL.revokeObjectURL(anchor.href), 1000);
    }
    function handleAction(action, el) {
      const actions = {
        "ai-settings": openSettings, "ai-close-settings": () => $("#ai-settings-dialog").close(), "ai-save-settings": saveSettings,
        "ai-clear-key": clearKey, "ai-toggle-key": () => { const input = $("#ai-api-key"); input.type = input.type === "password" ? "text" : "password"; el.textContent = input.type === "password" ? "显示" : "隐藏"; el.setAttribute("aria-label", `${el.textContent} API Key`); },
        "ai-reuse": () => { const bank = bankCache.get(cacheOptions()); if (bank) { hooks.preview(bank); hooks.refresh(); hooks.toast('已复用上次题库，本次未调用 AI。'); } },
        "ai-open-daily": () => hooks.openDaily?.(),
        "ai-generate": () => void generate(), "ai-cancel": cancel,
        "edit-question": () => openEditor(Number(el.dataset.index)), "delete-question": () => removeQuestion(Number(el.dataset.index)), "undo-delete": undoDelete, "export-bank": exportBank,
        "editor-close": () => $("#question-editor").close(), "editor-save": saveEditor,
        "editor-clear-answer": () => { editing.answer = []; renderEditor(); $('.editor-answers input')?.focus(); },
        "editor-add-option": () => { if (editing.options.length >= 8) return; const id = [..."ABCDEFGH"].find(id => !editing.options.some(o => o.id === id)); editing.options.push({ id, text: "" }); renderEditor(); $(`#editor-option-${id}`).focus(); },
        "editor-remove-option": () => { if (editing.options.length <= 2) return; const id = el.dataset.option, wasAnswer = editing.answer.includes(id); editing.options = editing.options.filter(o => o.id !== id); editing.answer = editing.answer.filter(a => a !== id); renderEditor(); if (wasAnswer) editorMessage("已删除原答案对应的选项，请重新确认正确答案。"); }
      };
      if (!actions[action]) return false;
      actions[action](); return true;
    }
    function updateModeNotice() {
      const badge = $(".ai-model-badge"), note = $(".ai-cost-note"), settings = $(".ai-config-line [data-action=ai-settings]");
      const reuse = $('#ai-reuse-block'); if (reuse) reuse.innerHTML = reuseMarkup();
      if (badge) badge.textContent = localMath() ? "数学快速出题" : "DeepSeek";
      if (note) note.textContent = costNote();
      if (settings) settings.textContent = config.apiKey ? "已配置密钥 · 修改设置" : localMath() ? "其他题型的 AI 设置" : "先设置 API Key";
    }
    function handleInput(event) {
      if (event.target.id.startsWith("ai-")) queueMicrotask(updateModeNotice);
      const el = event.target;
      if (el.id === "ai-description") { ai.description = el.value; $("#ai-character-count").textContent = `${el.value.length.toLocaleString()} / 12,000`; }
      else if (el.id === "ai-count") ai.count = el.value === "" ? "" : Number(el.value);
      else if (el.id === "ai-type") ai.type = el.value;
      else if (el.id === "ai-difficulty") ai.difficulty = el.value;
      if (!editing || !el.closest("#question-editor")) return;
      if (el.id === "editor-stem") editing.stem = el.value;
      else if (el.id === "editor-explanation") editing.explanation = el.value;
      else if (el.id === "editor-answer-text") editing.answer = el.value ? [el.value] : [];
      else if (el.dataset.editorOption) editing.options.find(o => o.id === el.dataset.editorOption).text = el.value;
      else if (el.name === "editor-answer") editing.answer = [...document.querySelectorAll('input[name="editor-answer"]:checked')].map(input => input.value);
      else if (el.id === "editor-type") {
        editing.type = el.value; editing.answer = [];
        if (["short", "calculation"].includes(editing.type)) editing.options = [];
        else if (editing.type === "boolean") editing.options = [{ id: "A", text: "正确" }, { id: "B", text: "错误" }];
        else if (!editing.options.length) editing.options = [..."ABCD"].map(id => ({ id, text: "" }));
        renderEditor(); $("#editor-type").focus({ preventScroll: true });
      }
    }
    document.addEventListener("submit", event => {
      if (event.target.id === "ai-settings-form") { event.preventDefault(); saveSettings(); }
      if (event.target.id === "question-editor-form") { event.preventDefault(); saveEditor(); }
    });
    $("#question-editor").addEventListener("close", () => { editing = null; editingBank = null; $("#question-editor").innerHTML = ""; });
    $("#ai-settings-dialog").addEventListener("close", () => { $("#ai-settings-dialog").innerHTML = ""; });
    window.addEventListener("pagehide", () => { requestId++; controller?.abort(); });
    const updateHeight = () => {
      document.documentElement.style.setProperty("--author-viewport-height", `${window.visualViewport?.height || window.innerHeight}px`);
      document.documentElement.style.setProperty("--author-viewport-top", `${window.visualViewport?.offsetTop || 0}px`);
    };
    window.visualViewport?.addEventListener("resize", updateHeight);
    window.visualViewport?.addEventListener("scroll", updateHeight);
    window.addEventListener("resize", updateHeight); updateHeight();
    return { renderAI, handleAction, handleInput, undoMarkup, resetUndo: () => { undo = null; } };
  }
  root.QuizAuthoring = { create };
})(window);
