import {all,get,put} from '../core/db.js';
import {money} from '../core/utils.js';
import {list,pay,addAdvance,undo,canUndo,ldate,keyOf as key} from './ledger.js';
import {totals} from './payment.js';
import {openPage} from './buttons.js';
import {getManual,saveManual} from './names.js';
import {choose} from './personal.js';

export const esc = s => String(s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

export const st = {
  S:[], by: new Map(), paid: new Set(), adv: new Map(), sel: new Set(),
  sector:'', blk:'', bld:null, open:null, pager:false, all:false,
  cycle:'', who:'', no:'0'
};

const srt = (a,b)=>Number(a)-Number(b);
const back = v => { document.getElementById('back').hidden = !v; };
const num = s => +String(s||'').replace(/[٠-٩]/g, d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d));
const due = s => Math.max(0, s.value - (st.adv.get(key(s))||0));
const tot = a => totals(a, due);

export async function refresh(){
  const mn = await getManual();
  st.S = await all('subscribers');
  st.S.forEach(s=>{ const n = mn[key(s)]; if (n) s.name = n; });
  st.by = new Map(st.S.map(s=>[key(s), s]));
  const e = await list();
  st.paid = new Set(e.filter(x=>x.type==='pay').map(x=>x.key));
  st.adv = new Map((await all('advance')).map(v=>[v.key, v.balance]));
}

export const work = ()=> st.S.filter(s=>(st.all||s.inRoute) && !st.paid.has(key(s)));

export const toast = t => {
  const e = document.getElementById('toast');
  e.textContent = t; e.className = 'show';
  setTimeout(()=>{ e.className = ''; }, 2600);
};

export function receipt(e){
  const s = st.by.get(e.key) || {};
  const w = window.open('', '_blank', 'width=400,height=600');
  if (!w) return;
  w.document.write(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>إيصال</title>
  <style>body{font-family:Tahoma,sans-serif;padding:1rem;color:#0c2233}.r{max-width:340px;margin:auto;border:2px dashed #0c2233;border-radius:12px;padding:1rem}h1{font-size:1.1rem;text-align:center}.row{display:flex;justify-content:space-between;padding:.35rem 0;border-bottom:1px solid #d3dde4}.big{font-size:1.4rem;font-weight:800;text-align:center;margin:.9rem 0 .2rem}.foot{text-align:center;color:#5b6f7d;font-size:.8rem;margin-top:.6rem}</style></head><body>
  <div class="r"><h1>إيصال سداد غاز</h1>
  <div class="row"><b>العميل</b><span>${esc(s.name||'بدون اسم')}</span></div>
  <div class="row"><b>العنوان</b><span>قطاع ${s.sector||'—'} · بلوك ${s.blk||'—'} · عمارة ${s.bld||'—'} · شقة ${s.apt||'—'}</span></div>
  <div class="row"><b>التاريخ</b><span>${new Date(e.time).toLocaleString('ar-EG')}</span></div>
  <div class="row"><b>النوع</b><span>${e.type==='advance'?'سداد مقدم':'سداد'}</span></div>
  <div class="big">${Number(e.amount||0).toLocaleString('en-US')} جنيه</div>
  <div class="foot">المحصّل: ${esc(st.who||'')} · إصدار ${esc(st.cycle||'')}</div>
  </div><script>setTimeout(()=>window.print(),300)<\/script></body></html>`);
  w.document.close();
}

/* ====== قائمة ⋮ للشقة داخل العمارة ====== */
function aptsView(a){
  const ch = a.filter(s=>st.sel.has(key(s)));
  const ct = tot(ch), allTot = tot(a);
  const cards = a.map(s=>{
    const k = key(s), b = st.adv.get(k)||0, selected = st.sel.has(k);
    const nameHtml = s.name
      ? esc(s.name)
      : '<em class="empty-name">بدون اسم</em>';
    const advHtml = b ? `<div class="apt-adv">مقدم ${money(b)}</div>` : '';
    return `<div class="apt-card ${selected?'on':''}" data-card="${k}">
      <label class="apt-chk">
        <input type="checkbox" data-k="${k}" ${selected?'checked':''}>
      </label>
      <div class="apt-apt">${s.apt}</div>
      <div class="apt-body">
        <div class="apt-name">${nameHtml}</div>
        <div class="apt-meta">${s.count} فاتورة${advHtml}</div>
      </div>
      <button class="apt-val" data-p="${k}">${money(due(s))}</button>
      <div class="apt-menu-wrap">
        <button class="apt-dots" data-m="${k}">⋮</button>
        <div class="apt-pop" data-pop="${k}" hidden>
          <button data-act="read" data-id="${k}">قراءة عداد</button>
          <div class="apt-pop-info">الفواتير: ${s.count}</div>
          ${!s.name ? `<button data-act="name" data-id="${k}">تعديل الاسم</button>` : ''}
        </div>
      </div>
    </div>`;
  }).join('');
  const html = `<div class="bh"><h2>عمارة ${st.bld}</h2><label class="chk"><input type="checkbox" id="all" ${ch.length===a.length&&a.length?'checked':''}> تحديد الكل</label></div>
    <div class="apt-list">${cards}</div>`;
  return {html, ch, ct, allTot};
}

const bar = v => `<div class="bar">
  <div><small>إجمالي العمارة</small><b>${money(v.allTot.value)}</b></div>
  <div><small>المطلوب للمحدد</small><b>${money(v.ct.value)}</b></div>
  <div><small>المتبقي بعد السداد</small><b>${money(v.allTot.value - v.ct.value)}</b></div>
  <button class="btn" id="pay" ${v.ch.length?'':'disabled'}>سداد المحدد</button>
</div>`;

function bind(el, a, v, again){
  // checkbox
  el.querySelectorAll('[data-k]').forEach(c=>c.onchange = ()=>{ c.checked?st.sel.add(c.dataset.k):st.sel.delete(c.dataset.k); again(); });
  const allCb = el.querySelector('#all');
  if (allCb) allCb.onchange = e => { a.forEach(s=>e.target.checked?st.sel.add(key(s)):st.sel.delete(key(s))); again(); };

  // القائمة المنسدلة ⋮
  el.querySelectorAll('[data-m]').forEach(btn=>{
    btn.onclick = ev=>{
      ev.stopPropagation();
      el.querySelectorAll('[data-pop]').forEach(p=>p.hidden = true);
      const pop = el.querySelector(`[data-pop="${btn.dataset.m}"]`);
      if (pop) pop.hidden = !pop.hidden;
    };
  });
  document.addEventListener('click', ()=>{ el.querySelectorAll('[data-pop]').forEach(p=>p.hidden = true); });

  // إجراءات القائمة
  el.querySelectorAll('[data-act]').forEach(b=>{
    b.onclick = async ev=>{
      ev.stopPropagation();
      const k = b.dataset.id, s = st.by.get(k);
      const act = b.dataset.act;
      if (act === 'read'){
        const q = new URLSearchParams({n:s.name||'', s:s.sector, b:s.blk, d:s.bld, a:s.apt, v:s.value, r:st.adv.get(k)||0, q:due(s), c:s.count, m:st.cycle, u:st.who, k}).toString();
        openPage('reading.html', q);
        el.querySelectorAll('[data-pop]').forEach(p=>p.hidden = true);
      }
      if (act === 'name'){
        const n = prompt('اسم العميل', s?.name || '');
        if (n && n.trim()){
          await saveManual(k, n.trim());
          await refresh();
          el.querySelectorAll('[data-pop]').forEach(p=>p.hidden = true);
          again();
        }
      }
    };
  });

  // السداد بالضغط على القيمة فقط
  el.querySelectorAll('[data-p]').forEach(btn=>btn.onclick = async ev=>{
    ev.stopPropagation();
    const k = btn.dataset.p, s = st.by.get(k), amt = due(s);
    if (!amt){ toast('لا يوجد مبلغ مستحق'); return; }
    if (!confirm(`تأكيد سداد شقة ${s.apt} — ${s.name||'بدون اسم'} بمبلغ ${money(amt)} جنيه؟`)) return;
    await pay(st.no, [s], st.adv);
    await put('lastPosition','last',{sector:st.sector, blk:st.blk, bld:st.bld});
    st.sel.delete(k);
    await refresh();
    toast(`تم سداد شقة ${s.apt} (${money(amt)} جنيه)`);
    again();
  });

  const p = el.querySelector('#pay');
  if (p) p.onclick = async ()=>{
    if (!v.ch.length) return;
    const amt = v.ct.value;
    if (!confirm(`تأكيد سداد ${v.ch.length} شقة بمبلغ ${money(amt)} جنيه؟`)) return;
    await pay(st.no, v.ch, st.adv);
    await put('lastPosition','last',{sector:st.sector, blk:st.blk, bld:st.bld});
    st.sel.clear();
    await refresh();
    toast(`تم سداد ${v.ch.length} شقة (${money(amt)} جنيه)`);
    again();
  };
}

export async function renderHome(el){
  const y = scrollY; back(false);
  if (!st.pager) st.bld = null;
  const w = work();
  if (!st.S.length) return el.innerHTML = '<div class="card empty">لا توجد بيانات. اضغط «تحديث الملف» من تبويب «ما تم تحصيله».</div>';
  const secs = [...new Set(w.map(s=>s.sector))].sort(srt);
  if (!secs.length) return el.innerHTML = '<div class="card empty">لا يوجد عملاء غير مسددين.</div>';
  if (!secs.includes(st.sector)) st.sector = secs[0];
  const blks = [...new Set(w.filter(s=>s.sector===st.sector).map(s=>s.blk))].sort(srt);
  if (!blks.includes(st.blk)) st.blk = blks[0];
  const rows = w.filter(s=>s.sector===st.sector && s.blk===st.blk);
  const g = {}; rows.forEach(s=>(g[s.bld]=g[s.bld]||[]).push(s));
  const t = tot(rows);
  const last = await get('lastPosition','last');
  const hasLast = last && w.some(s=>s.sector===last.sector && s.blk===last.blk && s.bld===last.bld);
  const opt = (a,v)=>a.map(x=>`<option ${x===v?'selected':''}>${x}</option>`).join('');
  let ov = null;
  let html = `<div class="pick"><label class="field"><span>القطاع</span><select id="sSec">${opt(secs,st.sector)}</select></label><label class="field"><span>البلوك</span><select id="sBlk">${opt(blks,st.blk)}</select></label></div>
    <div class="tools"><button class="btn ghost sm" id="pg">${st.pager?'إيقاف عرض الصفحات':'عرض كصفحات'}</button>
    ${hasLast?`<button class="btn sm" id="rs">استكمال (${last.sector}-${last.blk}-${last.bld})</button>`:''}
    </div><p class="sum">${t.n} شقة · ${t.count} فاتورة · <b>${money(t.value)}</b> جنيه</p><div class="blist">`;
  Object.keys(g).sort(srt).forEach(b=>{
    const x = tot(g[b]), o = st.pager && st.open === b;
    const cells = `<b>عمارة ${b}</b><span>${x.n} شقة</span><span>${x.count} فاتورة</span><strong>${money(x.value)}</strong>`;
    if (st.pager){
      html += `<div class="brow prow ${o?'open':''}" data-b="${b}" role="button" tabindex="0">${cells}</div>`;
    } else {
      html += `<button class="brow" data-b="${b}">${cells}</button>`;
    }
    if (o){
      st.bld = b;
      const aa = g[b].sort((p,q)=>srt(p.apt,q.apt));
      ov = {a:aa, v:aptsView(aa)};
      html += `<div class="card apts">${ov.v.html}</div>`;
    }
  });
  el.innerHTML = html + '</div>' + (ov ? bar(ov.v) : '');
  el.querySelector('#sSec').onchange = e=>{ st.sector = e.target.value; st.open = null; renderHome(el); };
  el.querySelector('#sBlk').onchange = e=>{ st.blk = e.target.value; st.open = null; renderHome(el); };
  el.querySelector('#pg').onclick = ()=>{ st.pager = !st.pager; st.open = null; st.sel.clear(); renderHome(el); };
  const rs = el.querySelector('#rs');
  if (rs) rs.onclick = ()=>{
    st.sector = last.sector; st.blk = last.blk; st.sel.clear();
    if (st.pager){ st.open = last.bld; renderHome(el); }
    else { st.bld = last.bld; history.pushState({v:'bld'}, ''); renderBuilding(el); }
  };
  el.querySelectorAll('[data-b]').forEach(b=>b.onclick = ()=>{
    st.sel.clear();
    if (st.pager){ st.open = st.open===b.dataset.b?null:b.dataset.b; renderHome(el); }
    else { st.bld = b.dataset.b; history.pushState({v:'bld'}, ''); renderBuilding(el); }
  });
  if (ov) bind(el, ov.a, ov.v, ()=>renderHome(el));
  scrollTo(0, y);
}

export function renderBuilding(el){
  back(true);
  const a = work().filter(s=>s.sector===st.sector && s.blk===st.blk && s.bld===st.bld).sort((p,q)=>srt(p.apt,q.apt));
  if (!a.length) return history.back();
  const v = aptsView(a);
  el.innerHTML = `<div class="card">${v.html}</div>${bar(v)}`;
  bind(el, a, v, ()=>renderBuilding(el));
}

/* ====== صفحة ما تم تحصيله: بطاقات + قائمة ⋮ ====== */
export async function renderLedger(el, reload, exp){
  back(false); await refresh();
  const e = await list();
  const td = e.filter(x=>ldate(x.time)===ldate(new Date()));
  const sum = td.reduce((s,x)=>s+x.amount, 0);
  el.innerHTML = `<div class="card"><h2>اليوم: ${td.length} عملية · ${money(sum)} جنيه</h2></div>
  <div class="ledger-list">` +
    (e.map(x=>{
      const s = st.by.get(x.key) || {};
      return `<div class="led-row">
        <div class="led-main">
          <span class="led-apt">${s.apt || '?'}</span>
          <div class="led-info">
            <div class="led-name">${esc(s.name || 'بدون اسم')}${x.type==='advance'?' <em class="tag">مقدم</em>':''}</div>
            <div class="led-meta">قطاع ${s.sector||''} · بلوك ${s.blk||''} · عمارة ${s.bld||''} · ${new Date(x.time).toLocaleString('ar-EG',{dateStyle:'short',timeStyle:'short'})}</div>
          </div>
          <div class="led-amount">${money(x.amount)}</div>
          <div class="led-menu-wrap">
            <button class="menu-dots" data-m="${x.id}">⋮</button>
            <div class="menu-pop" data-pop="${x.id}" hidden>
              ${canUndo(x)?`<button data-act="undo" data-id="${x.id}">تراجع</button>`:''}
              <button data-act="print" data-id="${x.id}">طباعة فاتورة</button>
              <button data-act="advance" data-id="${x.id}">سداد مقدم</button>
            </div>
          </div>
        </div>
      </div>`;
    }).join('') || '<p class="mute">لا توجد تحصيلات.</p>') +
  `</div>
  <div class="card"><div class="actions"><button class="btn" id="ex">إرسال الأرشيف</button><button class="btn ghost" id="rl">تحديث الملف</button></div></div>`;

  // قائمة ⋮
  el.querySelectorAll('[data-m]').forEach(btn=>{
    btn.onclick = ev=>{
      ev.stopPropagation();
      el.querySelectorAll('[data-pop]').forEach(p=>p.hidden = true);
      const pop = el.querySelector(`[data-pop="${btn.dataset.m}"]`);
      if (pop) pop.hidden = !pop.hidden;
    };
  });
  document.addEventListener('click', ()=>{ el.querySelectorAll('[data-pop]').forEach(p=>p.hidden = true); });

  // إجراءات القائمة
  el.querySelectorAll('[data-act]').forEach(b=>{
    b.onclick = async ev=>{
      ev.stopPropagation();
      const id = b.dataset.id;
      const entry = e.find(x=>x.id === id);
      if (!entry) return;
      const act = b.dataset.act;
      if (act === 'undo'){
        if (confirm('التراجع عن هذه العملية؟')){
          await undo(entry);
          renderLedger(el, reload, exp);
        }
      }
      if (act === 'print'){
        const s = st.by.get(entry.key) || {};
        const q = new URLSearchParams({n:s.name||'', s:s.sector||'', b:s.blk||'', d:s.bld||'', a:s.apt||'', v:s.value||0, r:st.adv.get(entry.key)||0, q:entry.due||s.value||0, c:s.count||0, m:st.cycle, u:st.who, k:entry.key}).toString();
        openPage('print.html', q);
      }
      if (act === 'advance'){
        const s = st.by.get(entry.key);
        if (!s) return;
        const x = num(prompt('مبلغ السداد المقدم'));
        if (x > 0){ await addAdvance(st.no, s, x); await refresh(); toast(`سُجّل مقدم ${money(x)} جنيه`); renderLedger(el, reload, exp); }
      }
    };
  });

  el.querySelector('#rl').onclick = reload;
  el.querySelector('#ex').onclick = exp;
}