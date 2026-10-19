(function(root) {
  "use strict";
  const Core = root.QuizImageExportCore;
  const dialog = document.querySelector("#image-export-dialog");
  const $ = selector => dialog.querySelector(selector);
  const fontFamily = '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif';
  const cardPalettes = {
    correct: { background: "#deeee3", border: "#adcdb6", answers: "#285d3a", explanation: "#59665d" },
    incorrect: { background: "#f7e1df", border: "#e4b8b2", answers: "#8c3933", explanation: "#705c5a" },
    neutral: { background: "#ffffff", border: "#e1e4ee", answers: "#525d73", explanation: "#717688" }
  };
  let snapshot, images = [], current = 0, token = 0, working = false, sharing = false;
  function clearImages() {
    images.forEach(item => URL.revokeObjectURL(item.url));
    images = []; current = 0;
  }
  function error(message) {
    const node = $("#export-error");
    if (node) { node.textContent = message; node.hidden = !message; }
  }
  function canShare(files) {
    try { return Boolean(root.isSecureContext && navigator.share && navigator.canShare?.({ files })); }
    catch { return false; }
  }
  function updateControls() {
    const ready = images.length > 0 && !working;
    $("#export-with-answers").disabled = working || sharing;
    $("[data-action=export-download]").disabled = !ready || sharing;
    $("[data-action=export-download-current]").disabled = !ready || sharing;
    $("[data-action=export-share]").hidden = !ready || !canShare(images.map(item => item.file));
    $("[data-action=export-share]").disabled = sharing;
    $("[data-action=export-previous]").disabled = !ready || current === 0 || sharing;
    $("[data-action=export-next]").disabled = !ready || current >= images.length - 1 || sharing;
    $("#export-preview-area").hidden = !ready;
    if (!ready) return;
    $("#export-preview").src = images[current].url;
    $("#export-preview").alt = `${snapshot.title}，第 ${current + 1} 张，共 ${images.length} 张练习图片`;
    $("#export-page-label").textContent = `${current + 1} / ${images.length}`;
    $("[data-action=export-download]").textContent = images.length === 1 ? "下载图片 PNG" : "下载全部图片 ZIP";
    $("#export-save-note").textContent = canShare(images.map(item => item.file))
      ? "点击分享全部图片，在系统菜单中选择「存储图像」或相册（如提供）。也可以长按下方图片保存；分享完成不代表已存入相册。"
      : "可长按下方图片，选择保存到相册（如浏览器提供）。下载的文件通常在「下载项」中，多张图片将打包为 ZIP，需解压后保存。";
  }
  function rounded(ctx, x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
    else ctx.rect(x, y, w, h);
    ctx.fill(); ctx.stroke();
  }
  function paint(ctx, plan, page, index, includeAnswers) {
    ctx.textBaseline = "top";
    ctx.fillStyle = "#f5f6fb"; ctx.fillRect(0, 0, plan.width, page.height);
    ctx.fillStyle = "#5546e8"; ctx.font = `600 20px ${fontFamily}`;
    ctx.fillText("啃题 · 一点一点，学进心里", 56, 32);
    ctx.fillStyle = "#202334"; ctx.font = `600 34px ${fontFamily}`;
    const title = snapshot.username ? `${snapshot.username} · ${snapshot.title || "我的练习"}` : snapshot.title || "我的练习";
    const titleLines = Core.wrapText(title, plan.width - 112, text => ctx.measureText(text).width);
    ctx.fillText(titleLines[0] + (titleLines.length > 1 ? "…" : ""), 56, 70);
    const summary = root.QuizEngine.summary(snapshot);
    ctx.fillStyle = "#ffffff"; ctx.strokeStyle = "#e1e4ee"; ctx.lineWidth = 1;
    rounded(ctx, 56, 130, plan.width - 112, 154, 14);
    const metrics = [
      [summary.timingComplete ? "总耗时" : "已记录用时", root.QuizEngine.formatDuration(summary.elapsedMs), "#252a3d"],
      ["平均每题（已完成）", root.QuizEngine.formatDuration(summary.averageMs), "#5546e8"],
      ["回答正确", `${summary.correct} 题 · ${summary.accuracy === null ? "—" : summary.accuracy + "%"}`, "#285d3a"],
      ["回答错误", `${summary.incorrect} 题 · ${summary.errorPercent === null ? "—" : summary.errorPercent + "%"}`, "#8c3933"]
    ];
    metrics.forEach(([label, value, color], column) => {
      const x = 76 + column * 238;
      ctx.font = `400 18px ${fontFamily}`; ctx.fillStyle = "#73798b"; ctx.fillText(label, x, 148);
      ctx.font = `600 26px ${fontFamily}`; ctx.fillStyle = color; ctx.fillText(value, x, 178);
    });
    ctx.font = `400 18px ${fontFamily}`; ctx.fillStyle = "#616879";
    ctx.fillText(`全套 ${summary.total} 题 · 已完成 ${summary.completed} 题 · 无标准答案已完成 ${summary.ungraded} 题 · 待完成 ${summary.pending} 题`, 76, 222);
    ctx.font = `400 17px ${fontFamily}`;
    ctx.fillText(summary.timingComplete
      ? "对错占比按已判定题目计算（含自评）；平均用时 = 前台答题用时 ÷ 已完成题数。"
      : "旧练习缺少完整计时记录，平均用时暂不计算；对错占比按已判定题目计算（含自评）。", 76, 252);
    for (const card of page.cards) {
      const status = snapshot.responses?.[card.questionIndex]?.status;
      const palette = status === "correct" ? cardPalettes.correct : status === "incorrect" ? cardPalettes.incorrect : cardPalettes.neutral;
      ctx.fillStyle = palette.background;
      ctx.strokeStyle = palette.border; ctx.lineWidth = 1;
      rounded(ctx, card.x, card.y, card.width, card.height, 14);
      let y = card.y + 20;
      ctx.fillStyle = "#ffffff"; ctx.strokeStyle = palette.border;
      rounded(ctx, card.x + 24, y, card.numberWidth, 28, 7);
      ctx.font = `400 ${Core.FONTS.number}px ${fontFamily}`;
      ctx.fillStyle = "#525d73"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(card.number, card.x + 24 + card.numberWidth / 2, y + 14);
      ctx.textAlign = "left"; ctx.textBaseline = "top";
      for (const line of card.lines) {
        const fontSize = Core.FONTS[line.kind] || 26;
        ctx.font = `${line.kind === "stem" ? 500 : 400} ${fontSize}px ${fontFamily}`;
        ctx.fillStyle = line.kind === "explanation" ? palette.explanation : line.kind === "answers" ? palette.answers : "#252a3d";
        ctx.fillText(line.text, card.x + 24 + (line.kind === "stem" ? card.stemOffset : 0), y);
        y += Core.LINE_HEIGHT;
      }
    }
    ctx.font = `400 18px ${fontFamily}`; ctx.fillStyle = "#9298a9";
    ctx.fillText("啃题 · 练习图片", 56, page.height - 44);
    ctx.textAlign = "right"; ctx.fillText(`${index + 1} / ${plan.pages.length}`, plan.width - 56, page.height - 44); ctx.textAlign = "left";
  }
  async function generate() {
    const id = ++token, includeAnswers = $("#export-with-answers").checked;
    clearImages(); working = true; error(""); updateControls();
    $("#export-status").textContent = "正在整理全部题目…";
    const canvas = document.createElement("canvas");
    try {
      await new Promise(resolve => setTimeout(resolve, 0));
      await document.fonts?.ready;
      if (id !== token) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw Error("当前浏览器无法生成图片，请换用支持图片绘制的浏览器。");
      const measure = (text, size) => { ctx.font = `${size === 28 ? 500 : 400} ${size}px ${fontFamily}`; return ctx.measureText(text).width; };
      const plan = Core.layout(snapshot, { includeAnswers, measure });
      let bytes = 0;
      for (let index = 0; index < plan.pages.length; index++) {
        if (id !== token) return;
        $("#export-status").textContent = `正在生成第 ${index + 1} / ${plan.pages.length} 张图片…`;
        await new Promise(resolve => setTimeout(resolve, 0));
        if (id !== token) return;
        const page = plan.pages[index];
        // Bound canvas dimensions and memory on mobile, without splitting a 30-question group.
        const scale = Math.min(1, 16000 / page.height, Math.sqrt(15000000 / (plan.width * page.height)));
        if (scale < 0.5) throw Error("这组 30 题的内容过长，无法生成清晰图片。请取消附带答案与解析，或缩短过长的题目后重试。");
        canvas.width = Math.ceil(plan.width * scale); canvas.height = Math.ceil(page.height * scale);
        ctx.setTransform(scale, 0, 0, scale, 0, 0);
        paint(ctx, plan, page, index, includeAnswers);
        const blob = await new Promise((resolve, reject) => canvas.toBlob(result => result ? resolve(result) : reject(Error("图片生成失败，请重试。")), "image/png"));
        if (id !== token) return;
        bytes += blob.size;
        if (bytes > 80 * 1024 * 1024) throw Error("图片总量过大，请将题库分成几份后分别导出。");
        const file = new File([blob], `${Core.safeName(snapshot.title)}-${String(index + 1).padStart(3, "0")}.png`, { type: "image/png" });
        images.push({ file, url: URL.createObjectURL(file) });
      }
      working = false;
      $("#export-status").textContent = `已生成 ${images.length} 张图片，包含全部 ${snapshot.questions.length} 道练习题。`;
      updateControls();
    } catch (err) {
      if (id !== token) return;
      clearImages(); working = false; $("#export-status").textContent = "本次未完成导出。";
      error(err.message || "图片生成失败，请重新打开导出窗口重试。"); updateControls();
    } finally { canvas.width = canvas.height = 0; }
  }
  function open(session) {
    if (!session?.questions?.length || dialog.open) return;
    snapshot = JSON.parse(JSON.stringify(session));
    snapshot.username = Object.hasOwn(session, "username") ? session.username : root.QuizProfile?.getName() || "";
    dialog.innerHTML = `<div class="author-dialog-frame"><div class="author-dialog-head"><div><span class="eyebrow">YOUR PRACTICE, TO KEEP</span><h2 id="image-export-title">导出全部练习图片</h2></div><button class="icon-button" data-action="export-close" aria-label="关闭图片导出">×</button></div><div class="author-dialog-body"><label class="export-options"><input id="export-with-answers" type="checkbox" checked><span>附上我的作答、答案与解析</span></label><p class="field-help">每张 30 题，最后一张保留余下题目；图片高度随内容调整。</p><p class="export-status" id="export-status" role="status" aria-live="polite"></p><div class="alert error" id="export-error" role="alert" hidden></div><div id="export-preview-area" hidden><div class="export-pagination"><button class="icon-button" data-action="export-previous" aria-label="上一张图片">←</button><span id="export-page-label"></span><button class="icon-button" data-action="export-next" aria-label="下一张图片">→</button><button class="link-btn" data-action="export-download-current">下载本张</button></div><p class="export-save-note" id="export-save-note"></p><div class="export-image-wrap"><img id="export-preview" alt="练习图片预览"></div></div></div><div class="author-dialog-footer"><button class="btn primary" data-action="export-share" hidden>分享全部图片</button><button class="btn secondary" data-action="export-download" disabled>下载全部图片 ZIP</button></div></div>`;
    dialog.showModal(); void generate();
  }
  function download(blob, name) {
    const url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
    // Keep the download alive on mobile browsers after returning from their UI.
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  async function downloadAll() {
    if (working || sharing || !images.length) return;
    if (images.length === 1) { download(images[0].file, images[0].file.name); return; }
    const id = token, files = images.map(item => item.file);
    working = true; error(""); updateControls(); $("#export-status").textContent = "正在打包全部图片…";
    try {
      const entries = [];
      for (const file of files) {
        entries.push({ name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) });
        if (id !== token) return;
      }
      const zip = Core.createZip(entries);
      if (id !== token) return;
      download(new Blob([zip], { type: "application/zip" }), `${Core.safeName(snapshot.title)}-练习图片.zip`);
      $("#export-status").textContent = `已准备 ${files.length} 张图片的 ZIP 下载，可解压后查看或存入相册。`;
    } catch (err) { if (id === token) error("打包未完成，可逐张下载或长按保存图片。"); }
    finally { if (id === token) { working = false; updateControls(); } }
  }
  async function share() {
    if (working || sharing || !images.length) return;
    const files = images.map(item => item.file), id = token;
    if (!canShare(files)) { error("当前浏览器无法分享这些图片，请长按保存或下载。"); updateControls(); return; }
    sharing = true; error(""); updateControls();
    try {
      // Invoke directly within this click's activation; no rendering or await first.
      await navigator.share({ files });
      if (id === token) $("#export-status").textContent = "图片已交给系统分享，请在所选相册或应用中确认保存。";
    } catch (err) {
      if (id !== token) return;
      if (err.name === "AbortError") $("#export-status").textContent = "已取消分享，图片仍可预览或保存。";
      else error("系统未能分享这些图片，可以长按保存或下载全部图片。");
    } finally { if (id === token) { sharing = false; updateControls(); } }
  }
  function handleAction(action) {
    if (!action.startsWith("export-") || action === "export-bank" || action === "export-images") return false;
    if (!dialog.open) return false;
    if (action === "export-close") dialog.close();
    else if (action === "export-previous" || action === "export-next") {
      current = Math.max(0, Math.min(images.length - 1, current + (action === "export-next" ? 1 : -1))); updateControls();
    } else if (action === "export-share") void share();
    else if (action === "export-download") void downloadAll();
    else if (action === "export-download-current" && images[current]) download(images[current].file, images[current].file.name);
    return true;
  }
  dialog.addEventListener("change", event => { if (event.target.id === "export-with-answers") void generate(); });
  dialog.addEventListener("close", () => { token++; clearImages(); working = false; sharing = false; snapshot = null; dialog.innerHTML = ""; });
  root.addEventListener("pagehide", event => {
    // A cached document resumes with its dialog and event handlers intact.
    if (!event.persisted) { token++; clearImages(); }
  });
  root.QuizImageExport = { open, handleAction };
})(window);
