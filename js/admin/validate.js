import {pad2,latin} from '../core/normalize.js';
const mdiff=(a,b)=>(+b.slice(0,4)-+a.slice(0,4))*12+(+b.slice(4)-+a.slice(4))+1;
export function validate(batch){
  const out=[],add=(lv,t)=>out.push({lv,t});
  const all=batch.flatMap(b=>b.recs.map(r=>({...r,_f:b.file})));
  for(const b of batch){
    const n=b.recs.length,ser=Math.max(0,...b.recs.map(r=>+latin(r.serial||0)));
    if(b.totals){
      add(n===b.totals.customers&&(!ser||ser===n)?'ok':'err',`${b.file}: السطور ${n} / آخر تسلسل ${ser||'-'} / المطبوع ${b.totals.customers}`);
      const c=b.recs.reduce((s,r)=>s+(+latin(r.count)||0),0),v=b.recs.reduce((s,r)=>s+(+latin(r.value)||0),0);
      add(c===b.totals.count&&v===b.totals.value?'ok':'err',`${b.file}: العدد ${c} (المطبوع ${b.totals.count}) والقيمة ${v} (المطبوع ${b.totals.value})`);
    }else add('warn',`${b.file}: لا يوجد صف إجمالي للمطابقة (${n} سطر)`);
    if(b.tsec){const bad=b.recs.filter(r=>pad2(r.sector)!==b.tsec).length;add(bad?'err':'ok',`${b.file}: القطاع في العنوان ${b.tsec}${bad?` ويخالف ${bad} سطر`:''}`);}
  }
  const empty=all.filter(r=>!(r.name||'').trim());
  if(empty.length){const by={};empty.forEach(r=>{const k=`${r._f} قطاع ${pad2(r.sector)} بلوك ${pad2(r.blk)}`;by[k]=(by[k]||0)+1;});
    add(empty.length===all.length?'warn':'err',`أسماء فارغة: ${empty.length} (${Object.entries(by).slice(0,4).map(e=>e.join(': ')).join('، ')})`);}else add('ok','كل الأسماء موجودة');
  const seen=new Set();let dup=0;for(const r of all){const k=[r.sector,r.blk,r.bld,r.apt].map(pad2).join('-');if(seen.has(k))dup++;seen.add(k);}
  add(dup?'err':'ok',dup?`تكرار في مفتاح العميل: ${dup}`:'لا تكرار في (القطاع+البلوك+العمارة+الشقة)');
  const ms=new Set(all.map(r=>(r.month||'').trim()));add(ms.size===1?'ok':'err',`شهر الإصدار: ${[...ms].join('، ')||'—'}`);
  const withFrom=all.filter(r=>r.from&&r.month);if(withFrom.length){const bad=withFrom.filter(r=>mdiff(r.from,r.month)!==+latin(r.count)).length;add(bad?'warn':'ok',bad?`${bad} سطر عدده لا يطابق الأشهر من «من» إلى «الي»`:'العدد = عدد الأشهر');}
  return out;
}
