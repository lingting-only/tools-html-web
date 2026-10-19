(function(){
 'use strict';
 const counter=document.getElementById('visit-counter');if(!counter||counter.dataset.started)return;
 counter.dataset.started='true';
 const value=document.getElementById('visit-counter-value'),unit=document.getElementById('visit-counter-unit'),label=document.getElementById('visit-counter-label'),note=document.getElementById('visit-counter-note');
 // Public, fixed project identifier: shared by file://, localhost and hosted copies.
 // Keep this key unchanged across releases. Never include names or private data.
 const provider='countapi.mileshilliard.com',counterKey='kenti_01a0ae9da1d572f0ba2443adfb8202d3_visits';
 const endpoint=`https://${provider}/api/v1/hit/${counterKey}`,CACHE_KEY='kenti-visit-counter-cache-v2';
 let requested=false,cache=null;
 try{
  const saved=JSON.parse(localStorage.getItem(CACHE_KEY)||'null');
  if(saved?.version===1&&saved.provider===provider&&saved.counterKey===counterKey&&Number.isSafeInteger(saved.value)&&saved.value>=0&&Number.isFinite(saved.timestamp)&&saved.timestamp>0&&saved.timestamp<=Date.now()+60000)cache=saved;
 }catch{}
 function show(state,amount,reason=''){
  const numeric=typeof amount==='number';counter.dataset.state=state;
  value.textContent=numeric?new Intl.NumberFormat('zh-CN').format(amount):amount;
  unit.hidden=!numeric;unit.textContent='次访问';if(label)label.textContent=numeric?'第':'访问统计';
  if(note){note.hidden=!numeric||state==='ready';note.textContent='上次统计';}
  counter.title=numeric&&state!=='ready'?`${reason}；显示上次成功统计：${new Date(cache.timestamp).toLocaleString('zh-CN')}。本次访问尚未确认计数。`:'全站共享访问次数，由 Count API 提供；打开或刷新计数，切题不计数。';
 }
 function fallback(offline=false){if(cache)show('cached',cache.value,offline?'当前离线':'统计服务暂时不可用');else show(offline?'offline':'unavailable',offline?'离线':'暂不可用');}
 function parseCount(data){
  if(data?.key!==undefined&&data.key!==counterKey)throw Error('Unexpected counter');
  if(!(typeof data?.value==='number'||typeof data?.value==='string'&&/^\d+$/.test(data.value)))throw Error('Invalid count');
  const count=Number(data.value);if(!Number.isSafeInteger(count)||count<0)throw Error('Invalid count');return count;
 }
 async function recordVisit(){
  if(requested)return;
  if(navigator.onLine===false){fallback(true);window.addEventListener('online',recordVisit,{once:true});return;}
  requested=true;
  if(cache)show('refreshing',cache.value,'正在更新统计');else show('loading','加载中…');
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),10000);
  try{
   const response=await fetch(endpoint,{mode:'cors',credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer',signal:controller.signal});
   if(!response.ok)throw Error('Counter unavailable');
   const count=parseCount(await response.json());cache={version:1,provider,counterKey,value:count,timestamp:Date.now()};
   try{localStorage.setItem(CACHE_KEY,JSON.stringify(cache));}catch{}
   show('ready',count);
  }catch{
   // The increment may already have reached the server. Do not retry or add locally.
   fallback();
  }finally{clearTimeout(timeout);}
 }
 void recordVisit();
})();
