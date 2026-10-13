import {deriveKey,newMaster,wrapMaster,pack,unpack} from '../core/crypto.js';
import {pad2,latin,clean,month} from '../core/normalize.js';
import {readPdf,readXls,fixText,setMap,fieldOf,LABELS} from './importer.js';
import {validate} from './validate.js';
import {buildTree,flatten,inRoute,summarize,diffSummary,b64,unb64} from './packager.js';
const $=id=>document.getElementById(id);
const ls=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d;}catch{return d;}};
const sv=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
let cats=ls('cats',[]),cols=ls('collectors',[]),data=ls('data',[]),ver=ls('ver',{full:0,keys:0,route:0,settings:0}),files=[],batch=[],draft=[];
const li=(lv,t)=>`<li class="${lv==='ok'?'ok':'bad'}${lv==='warn'?' warn':''}"><b>${lv==='ok'?'✓':lv==='warn'?'!':'✕'}</b><span>${t}</span></li>`;
const catSel=()=>$('cat').value;
function drawCats(){
  $('catList').innerHTML=cats.map((c,i)=>`<li class="ok"><b>${c.id}</b><span>${c.name} — محافظة ${c.gov} ومنطقة ${c.area}</span><button class="btn ghost" data-del="${i}">حذف</button></li>`).join('')||'<li><span class="mute">أضف أول فئة.</span></li>';
  $('cat').innerHTML=cats.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
  $('catList').querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{cats.splice(+b.dataset.del,1);sv('cats',cats);drawCats();});
}
$('addCat').onclick=()=>{const n=$('cName').value.trim(),g=pad2($('cGov').value),a=pad2($('cArea').value);if(!n||!g||!a)return;cats.push({id:String(Math.max(0,...cats.map(c=>+c.id))+1),name:n,gov:g,area:a});sv('cats',cats);drawCats();};
function norm(r,cat){
  const o={cat:cat.id,sector:pad2(r.sector),blk:pad2(r.blk),bld:pad2(r.bld),apt:pad2(r.apt),count:+latin(r.count)||0,value:+latin(r.value)||0,month:month(r.month||''),name:fixText(clean(r.name),$('fix').value),serial:r.serial,from:r.from?month(r.from):''};
  return o;
}
async function load(){
  const cat=cats.find(c=>c.id===catSel());if(!cat){$('res').innerHTML=li('err','أضف فئة واخترها أولاً');return;}
  $('res').innerHTML=li('warn','جارٍ القراءة…');batch=[];const hs=new Set();
  for(const f of files){try{const r=await (f.name.toLowerCase().endsWith('.pdf')?readPdf(f):readXls(f));r.headers.forEach(h=>hs.add(h));
    const gv=r.recs.find(x=>x.gov&&pad2(x.gov)!==cat.gov);
    batch.push({file:f.name,recs:r.recs.map(x=>({...norm(x,cat),_raw:x})),totals:r.totals,tsec:r.tsec,govBad:!!gv});}catch(e){batch.push({file:f.name,recs:[],err:e.message});}}
  const msgs=validate(batch);batch.forEach(b=>{if(b.err)msgs.unshift({lv:'err',t:`${b.file}: ${b.err}`});if(b.govBad)msgs.push({lv:'warn',t:`${b.file}: المحافظة في الملف تخالف الفئة`});});
  $('res').innerHTML=msgs.map(m=>li(m.lv,m.t)).join('');
  const unk=[...hs].filter(h=>!fieldOf(h));
  $('map').innerHTML=unk.length?`<p class="mute">أعمدة غير معروفة (نموذج جديد): اربطها بحقل ثم أعد القراءة</p>`+unk.map(h=>`<label class="field"><span>${h}</span><select data-h="${h}">${Object.entries(LABELS).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></label>`).join('')+'<button class="btn ghost" id="remap">حفظ النموذج وإعادة القراءة</button>':'';
  if(unk.length)$('remap').onclick=()=>{document.querySelectorAll('[data-h]').forEach(s=>setMap(s.dataset.h,s.value));load();};
  const rows=batch.flatMap(b=>b.recs).slice(0,8);
  $('prev').innerHTML='<tr><th>قطاع</th><th>بلوك</th><th>عمارة</th><th>شقة</th><th>الاسم</th><th>عدد</th><th>قيمة</th><th>شهر</th></tr>'+rows.map(r=>`<tr><td>${r.sector}</td><td>${r.blk}</td><td>${r.bld}</td><td>${r.apt}</td><td>${r.name||'—'}</td><td>${r.count}</td><td>${r.value}</td><td>${r.month}</td></tr>`).join('');
  const bad=msgs.some(m=>m.lv==='err');$('add').disabled=batch.length===0;$('add').dataset.bad=bad;$('addNote').textContent=bad?'فيه أخطاء: أكّد المتابعة بنفسك قبل الإضافة':'';
}
$('pdfIn').onchange=e=>{files=[...e.target.files];load();e.target.value='';};
$('xlsIn').onchange=e=>{files=[...e.target.files];load();e.target.value='';};
$('fix').onchange=()=>{if(files.length)load();};
$('add').onclick=()=>{if($('add').dataset.bad==='true'&&!confirm('فيه أخطاء في التحقق. هل تؤكد إضافة البيانات؟'))return;
  const m=new Map(data.map(r=>[[r.cat,r.sector,r.blk,r.bld,r.apt].join('|'),r]));
  batch.flatMap(b=>b.recs).forEach(r=>{const{_raw,...x}=r;m.set([x.cat,x.sector,x.blk,x.bld,x.apt].join('|'),x);});
  data=[...m.values()];sv('data',data);batch=[];files=[];$('res').innerHTML=li('ok','أُضيفت البيانات');$('prev').innerHTML='';$('add').disabled=true;drawData();};
function drawData(){const s=summarize(data),b={};Object.entries(s).forEach(([k,v])=>{const[c,sec]=k.split('|');const e=b[c+'|'+sec]??={n:0,value:0};e.n+=v.n;e.value+=v.value;});
  $('data').innerHTML=data.length?`<li class="ok"><b>✓</b><span>${data.length} عميل، شهر ${data[0].month}</span></li>`+Object.entries(b).map(([k,v])=>`<li class="ok"><b>${k.split('|')[1]}</b><span>قطاع ${k.split('|')[1]}: ${v.n} عميل، قيمة ${v.value}</span></li>`).join(''):'<li><span class="mute">لا بيانات بعد.</span></li>';}
const weak=p=>p.length<10||/^\d+$/.test(p)||new Set(p).size<5;
const gen=()=>{const a='abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789',r=crypto.getRandomValues(new Uint8Array(14));return[...r].map(x=>a[x%a.length]).join('');};
$('genPw').onclick=()=>{$('kPw').value=gen();};
const ins=[...document.querySelectorAll('.rt input')];ins.forEach((el,i)=>el.oninput=()=>{el.value=el.value.replace(/\D/g,'').slice(0,2);if(el.value.length===2&&ins[i+1])ins[i+1].focus();});
$('addRt').onclick=()=>{const v=ins.map(i=>pad2(i.value));if(v.some(x=>!x))return;draft.push({sector:v[0],from:v.slice(1,4),to:v.slice(4,7),issuance:+$('rtIss').value||0,target:+$('rtTgt').value||0});$('rtIss').value=$('rtTgt').value='';ins.forEach(i=>i.value='');ins[0].focus();$('rtDraft').textContent=draft.map(r=>`قطاع ${r.sector}: ${r.from.join('-')} ← ${r.to.join('-')}`).join(' | ');};
$('addCol').onclick=()=>{const n=$('kName').value.trim(),no=latin($('kNo').value.trim()),pw=$('kPw').value.trim();
  if(!n||!no||!pw||!draft.length)return alert('أكمل الاسم والرقم وكلمة السر وخط سير واحداً على الأقل');
  if(weak(pw))return alert('كلمة السر ضعيفة (10 خانات على الأقل وغير مكررة). استخدم زر التوليد.');
  if(cols.some(c=>c.no===no))return alert('رقم الأداء مكرر');
  cols.push({name:n,no,pw,routes:draft});draft=[];$('rtDraft').textContent='';['kName','kNo','kPw'].forEach(i=>$(i).value='');sv('collectors',cols);drawCols();};
function drawCols(){$('colList').innerHTML=cols.map((c,i)=>`<li class="ok"><label><input type="checkbox" data-sel="${i}" checked></label><span>${c.name} (${c.no}) — ${c.routes.map(r=>`قطاع ${r.sector}: ${r.from.join('-')}←${r.to.join('-')}`).join(' | ')}</span><button class="btn ghost" data-rm="${i}">حذف</button></li>`).join('')||'<li><span class="mute">أضف محصّلاً.</span></li>';
  $('colList').querySelectorAll('[data-rm]').forEach(b=>b.onclick=()=>{cols.splice(+b.dataset.rm,1);sv('collectors',cols);drawCols();});}
const save=(blob,name)=>{const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();};
$('build').onclick=async()=>{
  const log=$('pkg');log.innerHTML=li('warn','جارٍ التجهيز…');
  if(!data.length)return log.innerHTML=li('err','لا بيانات');
  const cyc=[...new Set(data.map(r=>r.month))];if(cyc.length!==1)return log.innerHTML=li('err','شهر الإصدار غير موحد: '+cyc.join('، '));
  let raw=ls('master',null),master;
  if(!raw||$('rot').checked){master=await newMaster();raw=b64(new Uint8Array(await crypto.subtle.exportKey('raw',master)));sv('master',raw);$('rot').checked=false;}
  master=await crypto.subtle.importKey('raw',unb64(raw),'AES-GCM',true,['encrypt','decrypt']);
  const z=new JSZip(),sel=[...document.querySelectorAll('[data-sel]:checked')].map(c=>cols[+c.dataset.sel]);
  const full={schemaVersion:1,type:'full',cycle:cyc[0],created:new Date().toISOString(),categories:{}};
  for(const c of cats){const rs=data.filter(r=>r.cat===c.id);if(rs.length)full.categories[c.id]={gov:c.gov,area:c.area,...buildTree(rs)};}
  const fb=await pack(full,master);z.file('data/full.bin',fb);
  const env={};for(const c of cols)env[c.no]=b64(await wrapMaster(master,await deriveKey(c.pw,c.no)));
  z.file('data/keys.bin',JSON.stringify({schemaVersion:1,envelopes:env,names:Object.fromEntries(cols.map(c=>[c.no,c.name]))}));
  for(const c of sel){const rs=data.filter(r=>c.routes.some(rt=>inRoute(r,rt)));
    z.file(`data/route_${c.name}_${c.no}.bin`,await pack({schemaVersion:1,type:'route',cycle:cyc[0],...(()=>{const o={};for(const cat of cats){const t=buildTree(rs.filter(r=>r.cat===cat.id));if(rs.some(r=>r.cat===cat.id))o[cat.id]=t;}return{categories:o};})()},master));
    z.file(`data/settings_${c.name}_${c.no}.bin`,await pack({schemaVersion:1,type:'settings',routes:c.routes,issuance:null,target:null,buttons:[]},await deriveKey(c.pw,c.no)));}
  ver.full++;ver.keys++;ver.route++;ver.settings++;sv('ver',ver);
  z.file('version.json',JSON.stringify({schema:1,app:1,...ver,lastUpdate:new Date().toISOString().slice(0,10)}));
  const back=await unpack(fb,master),flat=Object.entries(back.categories).flatMap(([k,t])=>flatten(t,k)),d=diffSummary(summarize(data),summarize(flat));
  log.innerHTML=li(d.length?'err':'ok',d.length?'فروق بعد إعادة الفتح:':'الملف المغلّف بعد فكه يطابق المصدر تماماً')+d.map(x=>li('err',x)).join('')+li('ok',`تم تجهيز ${sel.length} محصّل — حجم الملف الكامل ${(fb.length/1024).toFixed(1)} ك.ب`);
  save(await z.generateAsync({type:'blob'}),`publish-${cyc[0]}-v${ver.full}.zip`);};
$('clear').onclick=()=>{if(confirm('مسح كل بيانات العملاء من هذه الصفحة؟')){data=[];sv('data',data);drawData();}};
drawCats();drawCols();drawData();
