import {clean,latin,colName} from '../core/normalize.js';
export const LABELS={serial:'م',name:'اسم العميل',sub:'فرعي',apt:'شقة',bld:'عمارة',blk:'بلوك',sector:'قطاع',daily:'يومية',area:'منطقة',gov:'محافظة',from:'من',month:'شهر الإصدار',count:'العدد',value:'القيمة',address:'العنوان',meter:'رقم العداد',skip:'تجاهل'};
const BASE={'م':'serial','اسم العميل':'name','فرعي':'sub','شقة':'apt','عمارة':'bld','بلوك':'blk','قطاع':'sector','يومية':'daily','منطقة':'area','محافظة':'gov','من':'from','شهر الإصدار':'month','العدد':'count','القيمة':'value','العنوان':'address','رقم العداد':'meter'};
let UMAP=JSON.parse(localStorage.getItem('hdrMap')||'{}');
export const setMap=(h,f)=>{UMAP[h]=f;localStorage.setItem('hdrMap',JSON.stringify(UMAP));};
export const fieldOf=h=>UMAP[h]||BASE[h]||null;
const rev=s=>[...s].reverse().join('');
export const fixText=(s,m)=>m==='letters'?s.split(' ').map(rev).join(' '):m==='words'?s.split(' ').reverse().join(' '):m==='all'?rev(s):s;
const toRec=o=>{const r={};for(const h in o){const f=fieldOf(h);if(f&&f!=='skip')r[f]=o[h];}return r;};
let wk;const worker=()=>wk||(wk=fetch('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js').then(r=>r.text()).then(t=>{pdfjsLib.GlobalWorkerOptions.workerSrc=URL.createObjectURL(new Blob([t],{type:'text/javascript'}));}));
export async function readPdf(file){
  await worker();
  const pdf=await pdfjsLib.getDocument({data:await file.arrayBuffer()}).promise;
  let cols=null,recs=[],totals=null,tsec=null,headers=[];
  for(let p=1;p<=pdf.numPages;p++){
    const tc=await (await pdf.getPage(p)).getTextContent();
    const its=tc.items.filter(i=>i.str.trim()).map(i=>({s:i.str,x:i.transform[4],y:i.transform[5],w:i.width,h:Math.abs(i.height)||10})).sort((a,b)=>b.y-a.y);
    const rows=[];for(const it of its){const r=rows[rows.length-1];if(r&&Math.abs(r.y-it.y)<=it.h*.6)r.its.push(it);else rows.push({y:it.y,its:[it]});}
    const pr=rows.map(r=>{r.its.sort((a,b)=>a.x-b.x);const cs=[];for(const it of r.its){const c=cs[cs.length-1];if(c&&it.x-c.x2<it.h*.6){c.t+=' '+it.s;c.x2=it.x+it.w;}else cs.push({t:it.s,x1:it.x,x2:it.x+it.w});}return cs.map(c=>({t:clean(c.t),cx:(c.x1+c.x2)/2}));});
    const hi=pr.findIndex(cs=>cs.some(c=>c.t==='بلوك'));
    if(tsec==null&&hi>0){const m=latin(pr.slice(0,hi).flat().map(c=>c.t).join(' ')).match(/قطاع\s*(?:رقم)?\s*(\d{1,3})/);if(m)tsec=m[1].padStart(2,'0');}
    let start=0;
    if(hi>=0){cols=pr[hi].filter(c=>c.t).map(c=>({h:colName(c.t),cx:c.cx}));headers=cols.map(c=>c.h);start=hi+1;}else if(!cols)continue;
    for(const cs of pr.slice(start)){
      if(cs.some(c=>c.t.includes('الإج'))){const n=cs.filter(c=>/^\d+$/.test(latin(c.t))).sort((a,b)=>a.cx-b.cx).map(c=>+latin(c.t));if(n.length>=3)totals={value:n[0],count:n[1],customers:n[2]};continue;}
      const o={};for(const c of cs){let b=cols[0];for(const k of cols)if(Math.abs(k.cx-c.cx)<Math.abs(b.cx-c.cx))b=k;o[b.h]=o[b.h]?o[b.h]+' '+c.t:c.t;}
      recs.push(o);
    }
  }
  return {recs:recs.map(toRec),totals,tsec,headers};
}
export async function readXls(file){
  const wb=XLSX.read(await file.arrayBuffer(),{type:'array'});let recs=[],headers=[];
  for(const sn of wb.SheetNames){
    const rows=XLSX.utils.sheet_to_json(wb.Sheets[sn],{header:1,raw:false,defval:''});
    const hi=rows.findIndex(r=>r.some(c=>clean(c)==='بلوك'));if(hi<0)continue;
    const hd=rows[hi].map(c=>colName(c));headers=hd;
    for(const r of rows.slice(hi+1)){const o={};hd.forEach((h,i)=>{if(h)o[h]=clean(r[i]);});recs.push(toRec(o));}
  }
  return {recs,totals:null,tsec:null,headers};
}
