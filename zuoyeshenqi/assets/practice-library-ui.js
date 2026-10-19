(function(root){
 'use strict';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const date=n=>new Date(n).toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
 const answer=(q,v)=>Array.isArray(v)?v.map(a=>q.options.find(o=>o.id===a)?.text||a).join('；'):String(v??'');
 function create(hooks){
  const store=hooks.store;let page='history',filter='all',learner=null,topic='all',limit=20,working=false,confirmAction=null;
  function rows(){return page==='history'?store.summaries():store.wrongs();}
  function filtered(){return rows().filter(r=>{
   if(learner!==null&&r.username!==learner)return false;
   if(page==='history'){const s=r.summary;return filter==='all'||(filter==='finished'?s.completed===s.total:s.completed<s.total);}
   if(topic!=='all'&&topicName(r)!==topic)return false;
   return filter==='all'||(filter==='resolved'?r.resolved:!r.resolved);
  });}
  const topicName=r=>r.question.categoryName||({single:'单选题',multiple:'多选题',boolean:'判断题',short:'简答题',calculation:r.question.kind==='application'?'应用题':'计算题'})[r.question.type];
  function open(which){page=which;filter=page==='wrongs'?'pending':'all';learner=null;topic='all';limit=20;}
  function filters(){
   const names=[...new Set(rows().map(s=>s.username))],labels=page==='history'?[['all','全部'],['unfinished','未完成'],['finished','已完成']]:[['pending','待巩固'],['resolved','已订正'],['all','全部错题']];
   return `<div class="library-filters"><div class="library-segments" role="group" aria-label="筛选记录">${labels.map(([k,n])=>`<button class="btn ${filter===k?'primary':'secondary'}" data-action="library-filter" data-filter="${k}" aria-pressed="${filter===k}">${n}</button>`).join('')}</div><label class="library-learner">练习者<select id="library-learner" class="author-input"><option value="">所有练习者</option>${names.map(n=>`<option value="${esc(JSON.stringify(n))}" ${learner===n?'selected':''}>${esc(n||'未填写姓名')}</option>`).join('')}</select></label>${page==='wrongs'?`<label class="library-learner">题型<select id="library-topic" class="author-input"><option value="all">所有题型</option>${[...new Set(rows().map(topicName))].map(t=>`<option value="${esc(t)}" ${topic===t?'selected':''}>${esc(t)}</option>`).join('')}</select></label>`:''}</div>`;
  }
  function historyCard(s){const stat=s.summary;return `<article class="library-card"><div class="library-card-head"><div><span class="library-date">${esc(date(s.createdAt))}${s.parentId?' · 重练记录':''}</span><h2>${esc(s.title)}</h2><p>${esc(s.username||'未填写姓名')} · ${stat.completed===stat.total?'已完成':'进行中'} · ${stat.completed}/${stat.total} 题</p></div><span class="library-score">${stat.accuracy===null?'—':stat.accuracy+'%'}<small>正确率</small></span></div><div class="library-metrics"><span>答对 ${stat.correct}</span><span>答错 ${stat.incorrect}</span><span>用时 ${root.QuizEngine.formatDuration(stat.elapsedMs)}</span></div><div class="library-card-actions"><button class="btn primary" data-action="library-load" data-id="${s.id}">${stat.completed===stat.total?'查看作答':'继续练习'}</button><button class="btn secondary" data-action="library-reuse" data-id="${s.id}">复用题目 · 0 token</button><button class="link-btn danger" data-action="library-delete" data-id="${s.id}" aria-label="删除练习：${esc(s.title)}">删除</button></div></article>`;}
  function wrongCard(r,i){return `<article class="library-card wrong-card"><div class="library-card-head"><div><span class="library-date">${esc(r.username||'未填写姓名')} · ${esc(date(r.lastAt))}${r.question.categoryName?' · '+esc(r.question.categoryName):''}</span><h2><span class="wrong-number">${String(i+1).padStart(2,'0')}</span> ${esc(r.question.stem)}</h2></div><span class="status-pill ${r.resolved?'correct':'incorrect'}">${r.resolved?'已订正':'待巩固'}</span></div><p>做错 ${r.wrongCount} 次 · 答对 ${r.correctCount} 次</p><details><summary>查看作答与解析</summary><p>首次错答：${esc(answer(r.question,r.firstWrong))}</p><p>最近作答：${esc(answer(r.question,r.lastValue))}</p><p>正确答案：${esc(answer(r.question,r.question.answer))}</p><p class="library-explanation">${esc(r.question.explanation||'暂无解析，可在题库预览中补充。')}</p></details><button class="btn secondary" data-action="library-retry-one" data-index="${i}">再练这道题</button></article>`;}
  function render(){
   const info=store.info(),list=filtered(),count=rows().length;
   return `<div class="page-heading"><div><span class="eyebrow">EVERY PRACTICE COUNTS</span><h1>${page==='history'?'我的练习历史':'我的错题本'}</h1><p>${page==='history'?'每次练习独立留存，重练也会保留原始成绩。':'记录首次错答与订正情况。重新答对后移入“已订正”，原始作答不会被覆盖。'}</p></div><button class="btn secondary" data-action="home">新建练习</button></div><section class="panel library-storage"><div><strong>${count} ${page==='history'?'套练习':'道错题'}</strong><p>${esc(info.mode)} · 练习记录约 ${(info.bytes/1024).toFixed(0)} KB · 仅在当前浏览器</p></div><div class="library-card-actions"><button class="btn secondary" data-action="library-backup">导出记录备份</button><button class="btn secondary" data-action="library-import" ${working?'disabled':''}>${working?'正在处理…':'恢复备份'}</button><input type="file" id="library-backup-file" accept=".json,application/json" hidden><button class="link-btn danger" data-action="library-clear" ${working?'disabled':''}>清空练习记录</button></div><p class="library-storage-note">备份包含题目、作答、用时和姓名；不含 API Key。清理浏览器或更换 HTML 打开位置可能影响本地记录，请定期备份。</p></section>${!info.persisted||info.error?`<div class="alert warning" role="alert">${esc(info.error||'当前仅保留在页面中，请导出备份后再关闭。')}</div>`:''}${filters()}${page==='wrongs'&&list.length?`<div class="library-batch"><span>当前筛选 ${list.length} 道</span><button class="btn primary" data-action="library-retry">重练${filter==='resolved'?'已订正题':'错题'}（前 ${Math.min(list.length,100)} 道）</button></div>`:''}<div class="library-grid">${list.slice(0,limit).map(page==='history'?historyCard:wrongCard).join('')}</div>${!list.length?`<section class="panel library-empty"><h2>${page==='history'?'这里还没有练习记录':filter==='pending'?'当前没有待巩固的错题':'当前没有符合条件的错题'}</h2><p>${page==='history'?'开始练习后，题目和进度会自动保存在这里。':'完成练习后，答错的题会自动收录。可以切换筛选查看已订正题。'}</p><button class="btn primary" data-action="home">去练一练</button></section>`:''}${list.length>limit?'<button class="btn secondary library-more" data-action="library-more">加载更多记录</button>':''}`;
  }
  function download(){const url=URL.createObjectURL(new Blob([JSON.stringify(store.backup(),null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='啃题-练习记录备份-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function confirm(kind,id){confirmAction={kind,id};const dialog=document.getElementById('library-confirm-dialog');dialog.innerHTML=`<div class="dialog-content"><h2>${kind==='clear'?'清空全部练习记录？':'删除这套练习？'}</h2><p>历史作答和由这些记录产生的错题统计将被删除，当前练习也会同步移除。建议先导出备份。此操作不会清除 API 设置、题库草稿、AI生成缓存或每日计算设置。</p><div class="dialog-actions"><button class="btn secondary" data-action="library-cancel-delete">取消</button><button class="btn danger" data-action="library-confirm-delete">确认删除</button></div></div>`;dialog.showModal();}
  async function run(fn){if(working)return;working=true;try{await fn();}catch(e){hooks.toast(e.message||'操作失败，请先备份。');}finally{working=false;hooks.refresh();}}
  function retry(items){if(!items.length)return;const names=new Set(items.map(r=>r.username));if(names.size>1){hooks.toast('请先选择一位练习者，再批量重练。');return;}hooks.retry(items.slice(0,100).map(r=>r.question),items[0].username,items[0].sessionId);}
  function handleAction(action,el){
   if(!action.startsWith('library-'))return false;
   if(working)return true;
   if(action==='library-filter'){filter=el.dataset.filter;limit=20;hooks.refresh();}
   else if(action==='library-more'){limit+=20;hooks.refresh();}
   else if(action==='library-load')void run(()=>hooks.load(store.get(el.dataset.id)));
   else if(action==='library-reuse')hooks.preview(store.get(el.dataset.id));
   else if(action==='library-retry')retry(filtered());
   else if(action==='library-retry-one')retry([filtered()[Number(el.dataset.index)]]);
   else if(action==='library-backup')download();
   else if(action==='library-import')document.getElementById('library-backup-file')?.click();
   else if(action==='library-delete')confirm('delete',el.dataset.id);
   else if(action==='library-clear')confirm('clear');
   else if(action==='library-cancel-delete')document.getElementById('library-confirm-dialog').close();
   else if(action==='library-confirm-delete'){
    const intent=confirmAction;confirmAction=null;document.getElementById('library-confirm-dialog').close();
    if(intent)void run(async()=>{const ok=intent.kind==='clear'?await store.clear():await store.remove(intent.id);if(ok){hooks.detach(intent.kind==='clear'?null:intent.id);hooks.toast('练习记录已删除。');}});
   }
   return true;
  }
  document.addEventListener('change',e=>{
   if(e.target.id==='library-learner'){learner=e.target.value?JSON.parse(e.target.value):null;limit=20;hooks.refresh();}
   if(e.target.id==='library-topic'){topic=e.target.value;limit=20;hooks.refresh();}
   if(e.target.id==='library-backup-file'&&e.target.files[0]){const file=e.target.files[0];void run(async()=>{if(file.size>20*1024*1024)throw Error('备份文件不能超过20MB。');const n=await store.restore(JSON.parse(await file.text()));hooks.toast(`已恢复 ${n} 套新记录，已有记录保持不变。`);});}
  });
  return {render,open,handleAction};
 }
 root.QuizPracticeLibraryUI={create};
})(window);
