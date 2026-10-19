(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.QuizDailyBank=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const KEY='kenti-daily-draws-v1';
 const Review=typeof module==='object'&&module.exports?require('./math-review.js'):globalThis.QuizMathReview;
 function identity(stem){const m=stem.match(/^([\d./]+) ([+×]) ([\d./]+) = \?$/);return m?[m[1],m[3]].sort().join(m[2]):stem;}
 function create(data,storage){
  let records={};try{const raw=JSON.parse(storage.getItem(KEY)||'null');if(raw?.version===data.version&&raw.used&&typeof raw.used==='object')records=raw.used;}catch{}
  function grade(id){const g=data.grades.find(g=>g.id===Number(id));if(!g)throw Error('请选择 1–5 年级。');return g;}
  function pool(id,category){const g=grade(id);if(!['all','applications'].includes(category)&&!g.categories.some(c=>c.id===category))throw Error('请选择有效题型。');return g.categories.filter(c=>category==='all'||(category==='applications'?c.kind==='application':c.id===category)).flatMap(c=>c.items.map(([stem,answer,explanation])=>({stem,answer,explanation,kind:c.kind,category:c.name,categoryId:c.id,grade:g.id,key:identity(stem)})));}
  function shuffle(items){for(let i=items.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[items[i],items[j]]=[items[j],items[i]];}return items;}
  function drawBatch(id,selections,label,deferred=false){
   const g=grade(id),plans=selections.map(({category,count})=>{
    const items=pool(id,category);if(items.length<count)throw Error(`这个题型只有 ${items.length} 道不同题目，请减少数量或选择“全部题型”。`);
    return {category,count,items};
   });
   const valid=new Set(pool(id,'all').map(q=>q.key));const used=new Set(Array.isArray(records[id])?records[id].filter(k=>valid.has(k)):[]);
   const chosen=[],reserved=new Set(),warnings=[],reset=[];
   for(const plan of plans){
    const fresh=shuffle(plan.items.filter(q=>!used.has(q.key)&&!reserved.has(q.key))),part=fresh.slice(0,plan.count);
    if(part.length<plan.count){
     reset.push(plan.category);const picked=new Set(part.map(q=>q.key));for(const q of plan.items)used.delete(q.key);
     part.push(...shuffle(plan.items.filter(q=>!picked.has(q.key)&&!reserved.has(q.key))).slice(0,plan.count-part.length));
     const prefix=plans.length>1?`${g.categories.find(c=>c.id===plan.category).name}：`:'';
     warnings.push(prefix+'所选题型的本轮题库已抽完，已进入新一轮；本份练习内不会重复。');
    }
    for(const q of part){used.add(q.key);reserved.add(q.key);chosen.push(q);}
   }
   if(!deferred){records[id]=[...used];try{storage.setItem(KEY,JSON.stringify({version:data.version,used:records}));}catch{warnings.push('浏览器无法保存抽题记录，关闭页面后可能抽到重复题。');}}
   return {source:'daily-bank',...(deferred?{dailySelection:{grade:Number(id),reset}}:{}),title:`${g.name} · ${label} · ${chosen.length}题`,warnings,questions:shuffle(chosen).map((q,i)=>({id:'q'+(i+1),type:'calculation',grade:q.grade,categoryId:q.categoryId,categoryName:q.category,...(q.kind==='application'?{kind:'application'}:{}),stem:q.stem,answer:[q.answer],options:[],explanation:q.explanation||Review?.evaluate(q.stem)?.explanation||`${q.category}：${q.stem.replace('?',q.answer)}`}))};
  }
  function draw(id,category,count,deferred=false){
   count=Number(count);if(!Number.isInteger(count)||count<3||count>100)throw Error('每日练习请选择 3–100 道题。');
   const g=grade(id);pool(id,category);
   return drawBatch(id,[{category,count}],category==='all'?'综合练习':category==='applications'?'应用题综合':g.categories.find(c=>c.id===category).name,deferred);
  }
  function drawMixed(id,selections,deferred=false){
   const g=grade(id);if(!Array.isArray(selections)||!selections.length)throw Error('请至少勾选一种题型，并设置出题数量。');
   const categories=new Set(),parts=selections.map(item=>{
    if(!item||!g.categories.some(c=>c.id===item.category)||categories.has(item.category))throw Error('请选择不同的具体题型。');
    categories.add(item.category);const count=Number(item.count);
    if(!Number.isInteger(count)||count<1||count>100)throw Error('每个已选题型的数量须为 1–100 的整数。');
    return {category:item.category,count};
   });
   const total=parts.reduce((n,p)=>n+p.count,0);if(total<3||total>100)throw Error('混合练习总数须为 3–100 题，请调整各题型数量。');
   return drawBatch(id,parts,'自选混合练习',deferred);
  }

  function commit(result){
   if(!result?.dailySelection)return true;
   const id=result.dailySelection.grade,g=grade(id),all=pool(id,'all'),valid=new Set(all.map(q=>q.key));
   // Read the latest committed records; preview itself has made no writes.
   try{const raw=JSON.parse(storage.getItem(KEY)||'null');if(raw?.version===data.version&&raw.used)records=raw.used;}catch{}
   const used=new Set((Array.isArray(records[id])?records[id]:[]).filter(k=>valid.has(k)));
   const retained=new Set(result.questions.map(q=>identity(q.stem)));
   for(const cat of result.dailySelection.reset||[])if(['all','applications'].includes(cat)||g.categories.some(c=>c.id===cat)){
    const items=pool(id,cat);if(items.some(q=>retained.has(q.key)))for(const q of items)used.delete(q.key);
   }
   for(const q of result.questions){const k=identity(q.stem);if(valid.has(k))used.add(k);}
   records[id]=[...used];try{storage.setItem(KEY,JSON.stringify({version:data.version,used:records}));return true;}catch{return false;}
  }
  return {draw,drawMixed,pool,grade,commit,preview:(id,category,count)=>draw(id,category,count,true),previewMixed:(id,parts)=>drawMixed(id,parts,true)};
 }
 return {create,identity,KEY};
});
