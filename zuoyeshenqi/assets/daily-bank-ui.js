(function(root){
 'use strict';
 const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function create(hooks){
  let storage;try{storage=root.localStorage;}catch{storage={getItem(){return null;},setItem(){throw Error();}};}
  const data=root.QuizDailyBankData,bank=root.QuizDailyBank.create(data,storage);
  let grade=3,category='all',count='10',error='',mixed=false,mixes={},mixCounts={};
  try{
   const p=JSON.parse(storage.getItem('kenti-daily-options-v1'));
   if(data.grades.some(g=>g.id===p?.grade)){
    grade=p.grade;category=p.category==='applications'||bank.grade(grade).categories.some(c=>c.id===p.category)?p.category:'all';
    if(Number.isInteger(Number(p.count))&&p.count>=3&&p.count<=100)count=String(p.count);
   }
   mixed=p?.mixed===true;
   for(const g of data.grades){
    const saved=p?.mixes?.[g.id];if(!saved||typeof saved!=='object')continue;
    mixes[g.id]={};for(const c of g.categories)if(Object.hasOwn(saved,c.id)&&['string','number'].includes(typeof saved[c.id]))mixes[g.id][c.id]=String(saved[c.id]).slice(0,10);
   }
   for(const g of data.grades){
    mixCounts[g.id]={};const saved=p?.mixCounts?.[g.id];
    for(const c of g.categories)if(saved&&Object.hasOwn(saved,c.id)&&['string','number'].includes(typeof saved[c.id]))mixCounts[g.id][c.id]=String(saved[c.id]).slice(0,10);
    Object.assign(mixCounts[g.id],mixes[g.id]||{});
   }
  }catch{}
  function save(){try{storage.setItem('kenti-daily-options-v1',JSON.stringify({grade,category,count,mixed,mixes,mixCounts}));}catch{}}
  function selected(){return mixes[grade]||(mixes[grade]={});}
  function remembered(){return mixCounts[grade]||(mixCounts[grade]={});}
  function parts(){return Object.entries(selected()).map(([category,count])=>({category,count}));}
  function summary(){
   const rows=parts(),valid=rows.every(p=>Number.isInteger(Number(p.count))&&Number(p.count)>=1&&Number(p.count)<=100),total=rows.reduce((n,p)=>n+(Number(p.count)||0),0);
   return {valid:rows.length>0&&valid&&total>=3&&total<=100,text:!rows.length?'尚未选择题型 · 请选择题型并填写数量':!valid?'请为已选题型填写 1–100 的整数':`已选 ${rows.length} 种题型 · 合计 ${total} 题${total<3||total>100?' · 总数须为 3–100 题':''}`};
  }
  function summaryMarkup(){const state=summary();return `<div class="daily-mix-summary ${state.valid?'':'needs-adjustment'}" id="daily-mix-summary" role="status" aria-live="polite" aria-atomic="true">${state.text}</div>`;}
  function updateSummary(){const node=document.getElementById('daily-mix-summary'),state=summary();if(node){node.textContent=state.text;node.classList.toggle('needs-adjustment',!state.valid);}}
  function groupLabel(g,c,i){return c.kind==='application'&&g.categories[i-1]?.kind!=='application'?'<span class="daily-group-label">应用题 · 按情境列式，只填数值</span>':'';}
  function mixedCards(g){
   const choices=selected();
   return `<fieldset class="daily-categories daily-mixed-categories" aria-labelledby="daily-type-heading">${g.categories.map((c,i)=>{
    const checked=Object.hasOwn(choices,c.id),id=`daily-mix-count-${c.id}`;
    return `${groupLabel(g,c,i)}<div class="daily-mix-card ${checked?'is-selected':''}"><label class="daily-mix-check"><input type="checkbox" data-daily-mix-check="${c.id}" ${checked?'checked':''}><span><strong>${esc(c.name)}</strong><small>${esc(c.range)} · ${c.items.length} 道</small></span></label><label class="daily-mix-quantity" for="${id}"><span>出题数量</span><input id="${id}" data-daily-mix-count="${c.id}" type="number" inputmode="numeric" min="1" max="100" step="1" value="${esc(checked?choices[c.id]:remembered()[c.id]??'10')}" ${checked?'':'disabled'} aria-label="${esc(c.name)}出题数量" aria-describedby="daily-mix-summary"></label></div>`;
   }).join('')}</fieldset>${summaryMarkup()}`;
  }
  function singleCards(g){
   return `<fieldset class="daily-categories" aria-labelledby="daily-type-heading"><button type="button" data-action="daily-category" data-category="all" aria-pressed="${category==='all'}"><strong>全部题型</strong><span>混合抽取 · ${bank.pool(grade,'all').length} 道</span></button>${g.categories.map((c,i)=>`${groupLabel(g,c,i)}${c.kind==='application'&&g.categories[i-1]?.kind!=='application'?`<button type="button" data-action="daily-category" data-category="applications" aria-pressed="${category==='applications'}"><strong>应用题综合</strong><span>混合抽取 · ${bank.pool(grade,'applications').length} 道</span></button>`:''}<button type="button" data-action="daily-category" data-category="${c.id}" aria-pressed="${category===c.id}"><strong>${esc(c.name)}</strong><span>${esc(c.range)} · ${c.items.length} 道</span></button>`).join('')}</fieldset><div class="daily-count"><label for="daily-count">本次练习题数<input id="daily-count" type="number" inputmode="numeric" min="3" max="100" step="1" value="${esc(count)}"></label><span>3–100 道 · 当前可选 ${bank.pool(grade,category).length} 道</span></div>`;
  }
  function render(){
   const g=bank.grade(grade),total=data.grades.reduce((n,g)=>n+g.categories.reduce((n,c)=>n+c.items.length,0),0);
   return `<section class="daily-bank" aria-label="每日练习题库"><div class="daily-intro"><span class="daily-badge">离线题库 · 无需 AI</span><h3>每天练一练，进步一点点</h3><p>1–5 年级 · ${total.toLocaleString()} 道 · 按年级与题型分类保存</p></div><fieldset class="daily-grades"><legend>选择年级</legend>${data.grades.map(g=>`<button type="button" data-action="daily-grade" data-grade="${g.id}" aria-pressed="${g.id===grade}">${g.name}</button>`).join('')}</fieldset><div class="daily-type-header"><h4 id="daily-type-heading">选择题型</h4><button type="button" class="daily-mode-switch" id="daily-mixed-switch" role="switch" aria-checked="${mixed}" aria-labelledby="daily-mixed-label" data-action="daily-toggle-mixed"><span id="daily-mixed-label">混合题型</span><span class="daily-switch-track" aria-hidden="true"><i></i></span></button></div>${mixed?'<p class="daily-mode-help">勾选多个题型，分别设置数量；每类至少 1 题，总数 3–100 题。</p>':''}${mixed?mixedCards(g):singleCards(g)}<p class="daily-note">应用题按题目提示填写数值，提交后查看解题算式。优先抽取当前浏览器中未抽过的题，抽完一轮再循环。开始练习后才记入抽题记录，放弃预览不消耗题库。年级范围按常见训练难度划分，进阶题请按学习进度选择。</p>${error?`<div id="daily-error" class="alert error" role="alert" tabindex="-1">${esc(error)}</div>`:''}<div class="daily-actions"><button class="btn secondary" data-action="daily-download" ${mixed||category==='all'?'disabled':''}>${mixed?'预览后可导出本次题目':category==='all'?'选单项题型可导出题库':'导出所选分类题库'}</button><button class="btn primary" data-action="daily-draw">抽取题目并预览 →</button></div></section>`;
  }
  document.addEventListener('input',e=>{
   if(e.target.id==='daily-count'){count=e.target.value;save();}
   else if(e.target.dataset.dailyMixCount&&mixed){selected()[e.target.dataset.dailyMixCount]=e.target.value;remembered()[e.target.dataset.dailyMixCount]=e.target.value;error='';document.getElementById('daily-error')?.remove();save();updateSummary();}
  });
  document.addEventListener('change',e=>{
   const id=e.target.dataset.dailyMixCheck;if(!id||!mixed)return;
   if(e.target.checked)selected()[id]=remembered()[id]??'10';else {remembered()[id]=selected()[id];delete selected()[id];}
   error='';save();hooks.refresh(`[data-daily-mix-check="${id}"]`);
  });
  function handleAction(action,el){
   if(!action.startsWith('daily-'))return false;error='';
   if(action==='daily-grade'){grade=Number(el.dataset.grade);category='all';save();hooks.refresh(`[data-action=daily-grade][data-grade="${grade}"]`);}
   else if(action==='daily-toggle-mixed'){mixed=!mixed;save();hooks.refresh('#daily-mixed-switch');}
   else if(action==='daily-category'){category=el.dataset.category;save();hooks.refresh();}
   else if(action==='daily-draw'){try{const result=mixed?bank.previewMixed(grade,parts()):bank.preview(grade,category,count);hooks.preview(result);hooks.refresh();}catch(e){error=e.message;hooks.refresh('#daily-error');}}
   else if(action==='daily-download'&&!mixed){
    const questions=bank.pool(grade,category).map(q=>({type:'calculation',...(q.kind==='application'?{kind:'application'}:{}),stem:q.stem,answer:[q.answer],options:[],explanation:q.explanation||q.category}));
    const title=`${grade}年级-${category==='all'?'全部练习':category==='applications'?'应用题综合':bank.grade(grade).categories.find(c=>c.id===category).name}`;
    const url=URL.createObjectURL(new Blob([JSON.stringify({title,questions},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=title+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
   }
   return true;
  }
  return {render,handleAction,commit:result=>{if(!bank.commit(result))hooks.toast?.('无法保存去重记录，之后可能抽到重复题。');}};
 }
 root.QuizDailyUI={create};
})(window);
