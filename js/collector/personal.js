import {all,put,del,get,putMany} from '../core/db.js';
import {money} from '../core/utils.js';
import {pack,unpack} from '../core/crypto.js';
import {st,esc,toast,refresh} from './browse.js';
import {ldate,keyOf as key,personalSettle} from './ledger.js';

export const choose=(title,opts,cancel=true)=>new Promise(res=>{
  const d=document.createElement('dialog');
  d.innerHTML=`<div>${title}</div>`+opts.map((o,i)=>`<button class="btn ${i?'ghost':''}" value="${i}">${o}</button>`).join('')+(cancel?'<button class="btn ghost" value="-1">إلغاء</button>':'');
  d.addEventListener('click',e=>{if(e.target.tagName==='BUTTON'){const v=+e.target.value;d.close();d.remove();res(v);}});
  d.addEventListener('cancel',e=>{if(!cancel)e.preventDefault();});
  document.body.append(d);d.showModal();
});

export async function sendFile(file){
  if(navigator.canShare&&navigator.canShare({files:[file]})){try{await navigator.share({files:[file],title:file.name});return 'shared';}catch{}}
  const l=document.createElement('a');l.href=URL.createObjectURL(file);l.download=file.name;l.click();return 'downloaded';
}
const num=s=>+String(s||'').replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d)),rid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,5);

let lastDel=null;

export async function personalCards(el,entries,again){
  const D=(await all('personalDealings')).sort((a,b)=>a.date<b.date?1:-1);
  const P=(await all('personalPayments')).sort((a,b)=>a.payDate<b.payDate?1:-1);
  const sum=(a,f)=>a.reduce((s,x)=>s+f(x),0),L=d=>d.dir==='له'?d.amount:0,R=d=>d.dir==='عليه'?d.amount:0,net={};
  D.forEach(d=>{net[d.name]=(net[d.name]||0)+L(d)-R(d);});

  const rowD = d=>`<div class="p-row">
    <div class="p-line1">${esc(d.name)}</div>
    <div class="p-line2">قطاع ${d.sector||''} · عمارة ${d.bld||''} · شقة ${d.apt||''}</div>
    <div class="p-line3"><span class="${d.dir==='له'?'p-green':'p-red'}">${d.dir}</span> <b>${money(d.amount)}</b>
      <span class="p-acts"><button class="lnk" data-ed="${d.id}">تعديل</button><button class="lnk" data-dd="${d.id}">حذف</button></span></div>
  </div>`;
  const rowP = p=>`<div class="p-row">
    <div class="p-line1">${esc(p.name)}</div>
    <div class="p-line2">قطاع ${p.sector||''} · عمارة ${p.bld||''} · شقة ${p.apt||''}</div>
    <div class="p-line3"><span class="p-blue">سداد شخصي</span> <b>${money(p.amount)}</b>
      <small>${p.payDate}</small>
      <span class="p-acts"><button class="lnk" data-dp="${p.id}">حذف</button></span></div>
  </div>`;

  el.insertAdjacentHTML('beforeend',`<div class="card"><h2>التعاملات الشخصية</h2>
    <div class="actions"><button class="btn sm" id="addD">إضافة</button>${lastDel?'<button class="btn ghost sm" id="undoD">تراجع</button>':''}</div>
    <div class="p-list">${D.map(rowD).join('')||'<p class="mute">لا يوجد.</p>'}</div>
    ${Object.keys(net).length?'<p class="mute">الصافي: '+Object.entries(net).map(([n,v])=>`${esc(n)} ${money(v)}`).join(' · ')+'</p>':''}
  </div>
  <div class="card"><h2>السداد الشخصي</h2>
    <div class="p-list">${P.map(rowP).join('')||'<p class="mute">لا يوجد.</p>'}</div>
  </div>
  <div class="card warn"><b>هذه الجداول محفوظة على هاتفك فقط. حمّلها مرة أسبوعياً.</b>
    <div class="actions"><button class="btn" id="bk">تحميل نسخة</button><button class="btn ghost" id="rst">استرجاع</button><input type="file" id="rstIn" hidden></div>
  </div>`);

  const $=s=>el.querySelector(s),on=(s,f)=>el.querySelectorAll(s).forEach(f);

  // إضافة تعامل: يطلب (قطاع، بلوك، عمارة، شقة) ثم يستدعي الاسم
  $('#addD').onclick = async ()=>{
    const sec = prompt('القطاع'); if (!sec) return;
    const blk = prompt('البلوك'); if (!blk) return;
    const bld = prompt('العمارة'); if (!bld) return;
    const apt = prompt('الشقة'); if (!apt) return;
    const k = [null, sec, blk, bld, apt].join('|'); // cat غير معروف، نبحث في st.S
    let found = null;
    for (const s of st.S){
      if (String(s.sector)===sec && String(s.blk)===blk && String(s.bld)===bld && String(s.apt)===apt){ found = s; break; }
    }
    let name;
    if (found) name = found.name || 'بدون اسم';
    else {
      if (!confirm('العميل غير موجود في السجلات. إضافة باسم يدوي؟')) return;
      name = prompt('اسم العميل'); if (!name) return;
    }
    const c = await choose('النوع',['له عندي','عليه لي']); if (c<0) return;
    const a = num(prompt('المبلغ')); if (!(a>0)) return;
    const id = rid();
    await put('personalDealings', id, {id, name, sector:sec, blk, bld, apt, dir:c?'عليه':'له', amount:a, date:ldate(new Date()), note:prompt('ملاحظة (اختياري)')||''});
    again();
  };
  on('[data-ed]',b=>b.onclick=async()=>{const d=D.find(x=>x.id===b.dataset.ed),a=num(prompt('المبلغ الجديد',d.amount));if(a>0){await put('personalDealings',d.id,{...d,amount:a});again();}});
  on('[data-dd]',b=>b.onclick=async()=>{if(confirm('حذف؟')){lastDel=D.find(x=>x.id===b.dataset.dd);await del('personalDealings',lastDel.id);again();}});
  if($('#undoD'))$('#undoD').onclick=async()=>{await put('personalDealings',lastDel.id,lastDel);lastDel=null;again();};
  on('[data-dp]',b=>b.onclick=async()=>{if(confirm('حذف من الجدول؟')){await del('personalPayments',b.dataset.dp);again();}});

  // إضافة سداد شخصي: يطلب التفاصيل، يستدعي الاسم، ثم يسدد كامل المديونية
  const addSettle = async ()=>{
    const sec = prompt('القطاع'); if (!sec) return;
    const blk = prompt('البلوك'); if (!blk) return;
    const bld = prompt('العمارة'); if (!bld) return;
    const apt = prompt('الشقة'); if (!apt) return;
    let found = null;
    for (const s of st.S){
      if (String(s.sector)===sec && String(s.blk)===blk && String(s.bld)===bld && String(s.apt)===apt){ found = s; break; }
    }
    if (!found){ alert('العميل غير موجود في السجلات'); return; }
    const val = found.value || 0;
    if (val <= 0){ alert('العميل ليس عليه مديونية'); return; }
    if (!confirm(`سداد شخصي كامل لـ ${found.name||'بدون اسم'} بمبلغ ${money(val)} جنيه؟`)) return;
    await personalSettle(st.no, found, st.adv);
    const id = rid();
    await put('personalPayments', id, {id, name: found.name||'بدون اسم', sector:sec, blk, bld, apt, amount: val, payDate: ldate(new Date()), settleDate: ldate(new Date()), src: key(found)});
    await refresh();
    toast(`تم السداد الشخصي: ${money(val)} جنيه`);
    again();
  };
  // زر إضافة سداد شخصي
  const pCard = el.querySelectorAll('.card')[1];
  if (pCard){
    const btn = document.createElement('div');
    btn.className = 'actions';
    btn.innerHTML = `<button class="btn sm" id="addP">سداد شخصي</button>`;
    pCard.insertBefore(btn, pCard.firstChild.nextSibling);
    btn.querySelector('#addP').onclick = addSettle;
  }

  $('#bk').onclick=async()=>{const a=await get('meta','auth'),name=`جداول ${ldate(new Date())}.bin`,r=await sendFile(new File([await pack({v:1,dealings:D,payments:P},a.userKey)],name));toast(r==='shared'?'تمت المشاركة':`تم التحميل «${name}»`);};
  $('#rst').onclick=()=>$('#rstIn').click();
  $('#rstIn').onchange=async e=>{try{const a=await get('meta','auth'),x=await unpack(new Uint8Array(await e.target.files[0].arrayBuffer()),a.userKey);await putMany('personalDealings',x.dealings.map(d=>[d.id,d]));await putMany('personalPayments',x.payments.map(p=>[p.id,p]));toast('تم الاسترجاع');again();}catch{toast('تعذر فتح النسخة');}};
}