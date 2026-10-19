(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./bank-editor.js'):root.QuizBank);if(typeof module==='object'&&module.exports)module.exports=api;else root.QuizAIBankCache=api;})(typeof globalThis!=='undefined'?globalThis:this,function(Bank){
 'use strict';const KEY='kenti-ai-bank-cache-v1',MAX=350000;
 const key=o=>JSON.stringify([String(o.description||'').trim(),o.count===''||o.count==null?'':o.count,o.type||'mixed',o.difficulty||'medium',o.model||'']);
 function clean(bank){if(!Array.isArray(bank?.questions)||!bank.questions.length||bank.questions.length>Bank.LIMIT)throw Error();return {title:String(bank.title||'复用题库').slice(0,100),source:'cached-bank',questions:bank.questions.map((q,i)=>Bank.normalizeQuestion(q,i)),warnings:['复用了已生成的题目，本次不调用 AI；题目与上次相同。']};}
 function create(storage){let rows=[];try{const raw=JSON.parse(storage?.getItem(KEY)||'null');if(Array.isArray(raw))rows=raw.slice(-5).map(r=>({key:String(r.key).slice(0,13000),bank:clean(r.bank)}));}catch{}
  return {get:o=>{const r=rows.find(r=>r.key===key(o));return r?JSON.parse(JSON.stringify(r.bank)):null;},
   remember(o,bank){try{const entry={key:key(o),bank:clean(bank)};if(JSON.stringify(entry).length>MAX)return false;rows=[...rows.filter(r=>r.key!==entry.key),entry].slice(-5);while(JSON.stringify(rows).length>MAX)rows.shift();if(!storage)return false;storage.setItem(KEY,JSON.stringify(rows));return true;}catch{return false;}},
   clear(){rows=[];try{storage?.removeItem(KEY);}catch{}}
  };
 }
 return {KEY,create};
});
