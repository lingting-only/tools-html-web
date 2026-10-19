/* Local practice archive. IndexedDB first; bounded browser storage fallback. No network. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./bank-editor.js'):root.QuizBank,typeof module==='object'&&module.exports?require('./engine.js'):root.QuizEngine);if(typeof module==='object'&&module.exports)module.exports=api;else root.QuizPracticeLibrary=api;})(typeof globalThis!=='undefined'?globalThis:this,function(Bank,Engine){
 'use strict';
 const KEY='kenti-practice-library-v1',DB='kenti-practice-library',MAX_IMPORT=2000;
 const copy=x=>JSON.parse(JSON.stringify(x));
 const text=(v,n)=>typeof v==='string'?v.slice(0,n):'';
 const id=()=> 'h-'+(globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2));
 function clean(raw){
  if(!raw||raw.version!==1||!Array.isArray(raw.questions)||!raw.questions.length||raw.questions.length>Bank.LIMIT||!Number.isFinite(raw.createdAt)||raw.createdAt<0)throw Error('练习记录格式无效。');
  const questions=raw.questions.map((q,i)=>{
   const v=Bank.normalizeQuestion(q,i);
   for(const key of ['categoryId','categoryName','grade'])if(['string','number'].includes(typeof q[key]))v[key]=text(String(q[key]),100);
   return v;
  });
  const responses={};
  for(const [k,r]of Object.entries(raw.responses||{})){
   if(!/^(0|[1-9]\d*)$/.test(k)||!questions[k]||!r||!['draft','review','correct','incorrect','ungraded'].includes(r.status)||!(typeof r.value==='string'&&r.value.length<=10000||Array.isArray(r.value)&&r.value.length<=8&&r.value.every(v=>typeof v==='string'&&v.length<=3000)))throw Error('练习作答记录无效。');
   responses[k]={status:r.status,value:copy(r.value),...(r.selfAssessed===true?{selfAssessed:true}:{}),...(Number.isFinite(r.submittedAt)&&r.submittedAt>=0?{submittedAt:r.submittedAt}:{})};
  }
  return {version:1,id:/^[\w-]{1,100}$/.test(raw.id||'')?raw.id:id(),title:text(raw.title,200)||'我的练习',username:text(raw.username,20),createdAt:raw.createdAt,updatedAt:Number.isFinite(raw.updatedAt)?raw.updatedAt:raw.createdAt,questions,responses,index:Math.max(0,Math.min(Number(raw.index)||0,questions.length-1)),milestones:Array.isArray(raw.milestones)?raw.milestones.filter(n=>n===30||n===60):[],notice:text(raw.notice,30),...(Number.isFinite(raw.timing?.elapsedMs)&&raw.timing.elapsedMs>=0?{timing:{elapsedMs:raw.timing.elapsedMs,complete:raw.timing.complete===true}}:{}),source:text(raw.source,80),...(raw.parentId?{parentId:text(raw.parentId,100)}:{})};
 }
 // Include answers/options and learner: corrected editions and different children never merge.
 function questionKey(q,username=''){
  return JSON.stringify([username,q.type,q.stem.normalize('NFKC').replace(/\s+/g,' ').trim(),q.options,q.answer]);
 }
 function wrongs(sessions){
  const rows=new Map();
  const events=[];
  for(const s of sessions)for(const [i,r]of Object.entries(s.responses))if(['correct','incorrect'].includes(r.status))events.push({s,i,r,at:r.submittedAt??s.createdAt});
  events.sort((a,b)=>a.at-b.at||a.s.createdAt-b.s.createdAt||a.s.id.localeCompare(b.s.id));
  for(const {s,i,r,at}of events){
   const q=s.questions[i],key=questionKey(q,s.username);let row=rows.get(key);
   if(!row){row={key,question:copy(q),username:s.username,wrongCount:0,correctCount:0,firstWrong:null,resolved:false,lastAt:0,sessionId:s.id};rows.set(key,row);}
   if(r.status==='incorrect'){row.wrongCount++;if(row.firstWrong===null)row.firstWrong=copy(r.value);}
   else row.correctCount++;
   row.lastValue=copy(r.value);row.lastAt=at;row.resolved=r.status==='correct';row.sessionId=s.id;
  }
  return [...rows.values()].filter(r=>r.wrongCount).sort((a,b)=>b.lastAt-a.lastAt);
 }
 function create({storage,indexedDB=globalThis.indexedDB,onError=()=>{}}={}){
  let revision=0,wrongRevision=-1,cachedWrongs=[],records=new Map(),db=null,mode='本地存储',persisted=true,lastError='',queue=Promise.resolve();
  const fail=()=>{persisted=false;lastError='记录尚未成功保存到设备，请先导出备份，并释放浏览器存储空间。';onError(lastError);return false;};
  const fallbackLoad=()=>{try{const raw=JSON.parse(storage?.getItem(KEY)||'null');if(raw?.version===1&&Array.isArray(raw.sessions))for(const rawSession of raw.sessions){const s=clean(rawSession);records.set(s.id,s);}}catch{lastError='部分本地历史无法读取，请保留原有备份。';onError(lastError);}};
  const ready=(async()=>{
   fallbackLoad();
   if(!indexedDB){if(!storage){mode='仅本次页面';persisted=false;}return;}
   try{
    db=await new Promise((resolve,reject)=>{let done=false;const timer=setTimeout(()=>{done=true;reject(Error('timeout'));},2500);const req=indexedDB.open(DB,1);req.onupgradeneeded=()=>req.result.createObjectStore('sessions',{keyPath:'id'});req.onsuccess=()=>{clearTimeout(timer);if(done){req.result.close();return;}done=true;resolve(req.result);};req.onerror=()=>{clearTimeout(timer);done=true;reject(req.error);};req.onblocked=()=>{clearTimeout(timer);done=true;reject(Error('blocked'));};});
    const rows=await new Promise((resolve,reject)=>{const req=db.transaction('sessions','readonly').objectStore('sessions').getAll();req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
    for(const raw of rows){try{const s=clean(raw);records.set(s.id,s);}catch{lastError='有历史记录无法读取，请检查备份。';}}
    // Migrate fallback archives without deleting them until all IndexedDB writes finish.
    if(records.size)await new Promise((resolve,reject)=>{const tx=db.transaction('sessions','readwrite');records.forEach(s=>tx.objectStore('sessions').put(s));tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});
    try{storage?.removeItem(KEY);}catch{}
    mode='IndexedDB';
    db.onversionchange=()=>{db.close();db=null;mode='本地存储';fail();};
   }catch{db=null;if(!storage){mode='仅本次页面';persisted=false;}}
  })();
  async function persist(upserts=[],deletes=[]){
   try{
    if(db)await new Promise((resolve,reject)=>{const tx=db.transaction('sessions','readwrite'),st=tx.objectStore('sessions');upserts.forEach(s=>st.put(s));deletes.forEach(k=>st.delete(k));tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});
    else {if(!storage)throw Error('no storage');storage.setItem(KEY,JSON.stringify({version:1,sessions:[...records.values()]}));}
    persisted=true;lastError='';return true;
   }catch{return fail();}
  }
  function enqueue(fn){queue=queue.then(fn,fn);return queue;}
  const api={ready,
   put(raw){try{if(!raw.id)raw.id=id();const s=clean(raw),old=records.get(s.id);if(old&&persisted&&JSON.stringify({...s,updatedAt:old.updatedAt})===JSON.stringify(old))return queue.then(()=>persisted);s.updatedAt=Date.now();raw.updatedAt=s.updatedAt;records.set(s.id,s);revision++;return enqueue(async()=>{await ready;return persist([s]);});}catch{return Promise.resolve(fail());}},
   status:()=>({persisted,error:lastError}),
   list:()=>[...records.values()].sort((a,b)=>b.createdAt-a.createdAt||b.id.localeCompare(a.id)).map(copy),
   get:k=>records.has(k)?copy(records.get(k)):null,
   summaries:()=>[...records.values()].sort((a,b)=>b.createdAt-a.createdAt||b.id.localeCompare(a.id)).map(s=>({id:s.id,title:s.title,username:s.username,createdAt:s.createdAt,parentId:s.parentId,summary:Engine.summary(s)})),
   wrongs:()=>{if(wrongRevision!==revision){cachedWrongs=wrongs([...records.values()]);wrongRevision=revision;}return copy(cachedWrongs);},
   info:()=>({mode,persisted,error:lastError,count:records.size,bytes:new Blob([JSON.stringify([...records.values()])]).size}),
   async remove(k){await ready;return enqueue(async()=>{const previous=records.get(k);records.delete(k);revision++;const ok=await persist([],[k]);if(!ok&&previous){records.set(k,previous);revision++;}return ok;});},
   backup:()=>({format:'kenti-practice-backup',version:1,exportedAt:new Date().toISOString(),sessions:api.list()}),
   async restore(data){
    await ready;
    if(!data||data.format!=='kenti-practice-backup'||data.version!==1||!Array.isArray(data.sessions)||data.sessions.length>MAX_IMPORT)throw Error('请选择有效的啃题练习备份（最多2,000套）。');
    if(data.sessions.reduce((n,s)=>n+(s?.questions?.length||0),0)>100000)throw Error('备份题目过多，请分批恢复。');
    const incoming=data.sessions.map(clean),fresh=incoming.filter(s=>!records.has(s.id));
    // Validate the whole document before touching storage. Existing attempt IDs always win.
    return enqueue(async()=>{
     const previous=new Map(records);fresh.forEach(s=>records.set(s.id,s));revision++;
     const ok=await persist(fresh);if(!ok){records=previous;revision++;throw Error(lastError);}return fresh.length;
    });
   },
   async clear(){await ready;return enqueue(async()=>{const previous=new Map(records),keys=[...records.keys()];records.clear();revision++;const ok=await persist([],keys);if(!ok){records=previous;revision++;}return ok;});},
   flushed:()=>queue
  };
  return api;
 }
 return {KEY,clean,questionKey,wrongs,create,newId:id};
});
