/* Arithmetic-only parser. Never evaluates JavaScript or word problems. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./calculation.js'):root.QuizCalculation);if(typeof module==='object'&&module.exports)module.exports=api;else root.QuizMathReview=api;})(typeof globalThis!=='undefined'?globalThis:this,function(C){
 'use strict';
 const gcd=(a,b)=>b?gcd(b,a%b):(a<0n?-a:a);
 function reduce(n,d){if(!d)throw Error('zero');if(d<0n){n=-n;d=-d;}const g=gcd(n,d);return {n:n/g,d:d/g};}
 function format(v){
  if(v.d===1n)return String(v.n);
  let d=v.d,two=0,five=0;while(d%2n===0n){d/=2n;two++;}while(d%5n===0n){d/=5n;five++;}
  const places=Math.max(two,five);
  if(d===1n&&places<=10){const negative=v.n<0n,n=(negative?-v.n:v.n)*10n**BigInt(places)/v.d,s=n.toString().padStart(places+1,'0');return (negative?'-':'')+s.slice(0,-places)+'.'+s.slice(-places);}
  return v.n+'/'+v.d;
 }
 function evaluate(stem){
  if(typeof stem!=='string'||stem.length>300)return null;
  // A bare slash beside ×/÷ can mean either a fraction operand or sequential division. Leave ambiguous notation for review.
  if(stem.includes('/')&&/[×÷*]/.test(stem))return null;
  const expr=stem.normalize('NFKC').replace(/^(?:请计算|计算|口算练习|口算|复合计算|混合运算|综合算式)[:：]\s*/,'').replace(/\s*=\s*[?？□_]*\s*$/,'').replace(/[−–]/g,'-').replace(/[×xX]/g,'*').replace(/÷/g,'/').replace(/\s+/g,'');
  if(!/^[\d.+*/()\-]+$/.test(expr))return null;
  const tokens=expr.match(/\d+(?:\.\d+)?|\.\d+|[()+*/\-]/g);
  if(!tokens||tokens.join('')!==expr||tokens.length>90||tokens.some(t=>t.length>14))return null;
  let i=0;const steps=[];
  function atom(){
   if(tokens[i]==='+'||tokens[i]==='-'){const sign=tokens[i++],a=atom();return {n:sign==='-'?-a.n:a.n,d:a.d};}
   if(tokens[i]==='('){i++;const a=sum();if(tokens[i++]!==')')throw Error('paren');return a;}
   const v=C.parse(tokens[i++]);if(!v)throw Error('number');return reduce(v.numerator,v.denominator);
  }
  function op(a,sign,b){let v;if(sign==='+')v=reduce(a.n*b.d+b.n*a.d,a.d*b.d);else if(sign==='-')v=reduce(a.n*b.d-b.n*a.d,a.d*b.d);else if(sign==='*')v=reduce(a.n*b.n,a.d*b.d);else v=reduce(a.n*b.d,a.d*b.n);steps.push(`${format(a)} ${({'*':'×','/':'÷','-':'−'})[sign]||sign} ${format(b)} = ${format(v)}`);return v;}
  function product(){let a=atom();while(['*','/'].includes(tokens[i])){const sign=tokens[i++];a=op(a,sign,atom());}return a;}
  function sum(){let a=product();while(['+','-'].includes(tokens[i])){const sign=tokens[i++];a=op(a,sign,product());}return a;}
  try{const a=sum();if(i!==tokens.length||!steps.length)return null;return {answer:format(a),explanation:(steps.length>1?'按括号优先、先乘除后加减，同级从左到右计算。\n':'')+steps.map((s,i)=>`${steps.length>1?i+1+'. ':''}${s}`).join('\n')};}catch{return null;}
 }
 function audit(questions,warnings=[]){
  questions.forEach((q,i)=>{
   if(q.type!=='calculation'||q.kind==='application'||!q.answer.length)return;
   const r=evaluate(q.stem);if(!r)return;
   if(!C.equals(r.answer,q.answer[0])){warnings.push(`第 ${i+1} 题经本机验算，原答案 ${q.answer[0]} 已修正为 ${r.answer}，请核对。`);q.answer=[r.answer];q.explanation=r.explanation;}
   else if(!q.explanation||!q.explanation.includes('\n')&&r.explanation.includes('\n'))q.explanation=r.explanation;
  });return questions;
 }
 return {evaluate,audit};
});
