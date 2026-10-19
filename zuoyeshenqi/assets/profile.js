(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else {let storage;try{storage=root.localStorage;}catch{}root.QuizProfile=api.create(storage);}
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const KEY='kenti-profile-v1';
 function normalize(value){
  if(typeof value!=='string')return '';
  return Array.from(value.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g,' ').replace(/\s+/g,' ').trim()).slice(0,20).join('');
 }
 function create(storage){
  let username='';try{username=normalize(JSON.parse(storage?.getItem(KEY)||'null')?.username);}catch{}
  return {
   getName:()=>username,
   address:message=>username?`${username}，${message}`:message,
   setName(value){username=normalize(value);try{if(!storage)return false;storage.setItem(KEY,JSON.stringify({username}));return true;}catch{return false;}}
  };
 }
 return {KEY,normalize,create};
});
