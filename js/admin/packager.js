import {pad2} from '../core/normalize.js';
import {cmpNum} from '../core/utils.js';
export function buildTree(recs){
  const sectors={},names={};
  for(const r of recs){const s=r.sector,b=r.blk,d=r.bld,a=r.apt;((sectors[s]??={})[b]??={})[d]??={};sectors[s][b][d][a]=[r.count,r.value];if(r.name)names[s+b+d+a]=r.name;}
  return {sectors,names};
}
export const flatten=(tree,cat)=>{const o=[];for(const s in tree.sectors)for(const b in tree.sectors[s])for(const d in tree.sectors[s][b])for(const a in tree.sectors[s][b][d]){const[c,v]=tree.sectors[s][b][d][a];o.push({cat,sector:s,blk:b,bld:d,apt:a,count:c,value:v});}return o;};
export const inRoute=(r,rt)=>r.sector===rt.sector&&cmpNum([r.blk,r.bld,r.apt],rt.from)>=0&&cmpNum([r.blk,r.bld,r.apt],rt.to)<=0;
export function summarize(recs){const m={};for(const r of recs){const k=`${r.cat}|${r.sector}|${r.blk}`;const e=m[k]??={n:0,count:0,value:0};e.n++;e.count+=r.count;e.value+=r.value;}return m;}
export function diffSummary(a,b){const d=[];for(const k of new Set([...Object.keys(a),...Object.keys(b)])){const x=a[k]||{n:0,count:0,value:0},y=b[k]||{n:0,count:0,value:0};if(x.n!==y.n||x.count!==y.count||x.value!==y.value)d.push(`${k}: المصدر ${x.n} عميل/${x.value} ← الملف ${y.n}/${y.value}`);}return d;}
export const b64=u=>btoa(String.fromCharCode(...u));
export const unb64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
