import {all, get, put} from '../core/db.js';
import {money} from '../core/utils.js';
import {list, pay, addAdvance, undo, canUndo, ldate, keyOf as key, partialPay} from './ledger.js';
import {totals} from './payment.js';
import {openPage} from './buttons.js';
import {getManual, saveManual} from './names.js';
import {choose} from './personal.js';
import {monthOptions} from './monthly.js';

export const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

export const st = {
  S: [], by: new Map(), paid: new Set(), adv: new Map(), sel: new Set(),
  sector: '', blk: '', bld: null, apt: null, open: null,
  pager: true, all: false, cycle: '', who: '', no: '0',
  filter: null, filterSel: new Set()
};

const srt = (a,b) => Number(a)-Number(b);
const back = v => { const b = document.getElementById('back'); if (b) b.hidden = !v; };
const num = s => +String(s||'').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
const due = s => Math.max(0, s.value - (st.adv.get(key(s))||0));
const tot = a => totals(a, due);

export async function refresh(){
  const mn = await getManual();
  st.S = await all('subscribers');
  st.S.forEach(s => { const n = mn[key(s)]; if (n) s.name = n; });
  st.by = new Map(st.S.map(s => [key(s), s]));
  const e = await list();
  const fullPaid = new Set(e.filter(x => x.type === 'pay' && !x.partial && !x.personal).map(x => x.key));
  const stillDue = new Set(st.S.filter(s => (s.value||0) > 0 || (s.count||0) > 0).map(s => key(s)));
  st.paid = new Set([...fullPaid].filter(k => !stillDue.has(k)));
  st.adv = new Map((await all('advance')).map(v => [v.key, v.balance]));
}

export const work = () => st.S.filter(s => (st.all || s.inRoute) && !st.paid.has(key(s)));

export const toast = t => {
  const e = document.getElementById('toast');
  if (!e) return;
  e.textContent = t;
  e.className = 'show';
  clearTimeout(e._t);
  e._t = setTimeout(() => { e.className = ''; }, 2600);
};

export function setFilter(f){ st.filter = f; }
export function clearFilter(){ st.filter = null; }
export function inFilter(kind, k){
  if (!st.filter) return false;
  return st.filter.matches.has(kind + ':' + k);
}

export function receipt(e){
  const s = st.by.get(e.key) || {};
  const w = window.open('', '_blank', 'width=400,height=600');
  if (!w) return;
  w.document.write(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>إيصال</title>
  <style>body{font-family:Tahoma,sans-serif;padding:1rem;color:#0f2438}.r{max-width:340px;margin:auto;border:2px dashed #0f2438;border-radius:12px;padding:1rem}h1{font-size:1.1rem;text-align:center}.row{display:flex;justify-content:space-between;padding:.35rem 0;border-bottom:1px solid #d6e0e8}.big{font-size:1.4rem;font-weight:800;text-align:center;margin:.9rem 0 .2rem}.foot{text-align:center;color:#6b7f8f;font-size:.8rem;margin-top:.6rem}</style></head><body>
  <div class="r"><h1>إيصال سداد غاز</h1>
  <div class="row"><b>العميل</b><span>${esc(s.name||'بدون اسم')}</span></div>
  <div class="row"><b>العنوان</b><span>قطاع ${s.sector||'—'} · بلوك ${s.blk||'—'} · عمارة ${s.bld||'—'} · شقة ${s.apt||'—'}</span></div>
  <div class="row"><b>التاريخ</b><span>${new Date(e.time).toLocaleString('ar-EG')}</span></div>
  <div class="row"><b>النوع</b><span>${e.type==='advance'?'سداد مقدم':'سداد'}</span></div>
  <div class="big">${Number(e.amount||0).toLocaleString('en-US')} جنيه</div>
  <div class="foot">المحصل: ${esc(st.who||'')} · إصدار ${esc(st.cycle||'')}</div>
  </div><script>setTimeout(()=>window.print(),300)<\/script></body></html>`);
  w.document.close();
}

/* ===== بطاقات الشقق ===== */
function aptsView(a){
  const ch = a.filter(s => st.sel.has(key(s)));
  const ct = tot(ch);
  const allTot = tot(a);
  const cards = a.map(s => {
    const k = key(s);
    const b = st.adv.get(k) || 0;
    const selected = st.sel.has(k);
    const nameHtml = s.name ? esc(s.name) : '<em class="empty-name">بدون اسم</em>';
    const advHtml = b ? `<span class="apt-adv">· مقدم ${money(b)}</span>` : '';
    const partial = (s.count || 0) > 1;
    let hiClass = '';
    if (st.filter){
      if (st.filter.kind === 'apt' && st.filter.matches.has('apt:' + k)) hiClass = 'hi-apt';
      else if (st.filter.kind === 'bld' && st.filter.matches.has('bld:' + s.sector + '|' + s.blk + '|' + s.bld)) hiClass = 'hi-bld';
    }
    return `<div class="apt-card ${selected?'on':''} ${hiClass}" data-card="${k}">
      <label class="apt-chk"><input type="checkbox" data-k="${k}" ${selected?'checked':''}></label>
      <div class="apt-apt">${s.apt}</div>
      <div class="apt-body">
        <div class="apt-name" data-nm="${k}">${nameHtml}</div>
        <div class="apt-meta">${s.count} فاتورة${advHtml}</div>
      </div>
      <button class="apt-val" data-p="${k}" type="button">${money(due(s))}</button>
      <div class="apt-menu-wrap">
        <button class="apt-dots" data-m="${k}" type="button" aria-label="خيارات">⋮</button>
        <div class="apt-pop" data-pop="${k}" hidden>
          <button data-act="read" data-id="${k}" type="button">قراءة عداد</button>
          ${partial ? `<button data-act="partial" data-id="${k}" type="button">سداد جزئي</button>` : ''}
          <div class="apt-pop-info">الفواتير: ${s.count} · القيمة: ${money(s.value)}</div>
          ${!s.name ? `<button data-act="name" data-id="${k}" type="button">تعديل الاسم</button>` : ''}
        </div>
      </div>
    </div>`;
  }).join('');
  const html = `<div class="bh">
    <h2>عمارة ${st.bld} <span class="bld-total">— ${money(allTot.value)} ج</span></h2>
    <label class="chk"><input type="checkbox" id="all" ${ch.length===a.length&&a.length?'checked':''}> تحديد الكل</label>
  </div>
  <div class="apt-list">${cards}</div>`;
  return {html, ch, ct, allTot};
}

/* ===== الكارت السفلي ===== */
const bar = v => {
  const cnt = v.ch.length;
  const inv = v.ch.reduce((t,s) => t + (s.count||0), 0);
  const has = cnt > 0;
  return `<div class="bar">
    <div class="bar-row">
      ${has
        ? `<span><b>${cnt}</b> شقة · <b>${inv}</b> فاتورة</span>`
        : `<span class="mute">لم تحدد شيئاً</span>`}
      <button class="btn" id="pay" ${has?'':'disabled'} type="button">
        ${has ? `سداد (${money(v.ct.value)} ج)` : 'سداد'}
      </button>
    </div>
  </div>`;
};

/* ===== السداد الجزئي ===== */
function partialDialog(s){
  return new Promise(resolve => {
    const d = document.createElement('dialog');
    d.className = 'partial-dialog';
    const maxCount = s.count || 1;
    const unitValue = maxCount > 0 ? Math.round((s.value / maxCount) * 100) / 100 : s.value;
    const mOpts = monthOptions(s);
    let options = '';
    if (mOpts && mOpts.length > 1){
      mOpts.forEach(opt => {
        options += `<button class="partial-opt" type="button" data-cnt="${opt.count}" data-amt="${opt.amount}">
          عدد ${opt.count} — ${money(opt.amount)} جنيه
          <small>${opt.label}</small>
        </button>`;
      });
    }
    d.innerHTML = `
      <h3>سداد جزئي — شقة ${s.apt}</h3>
      <p class="mute">المديونية الحالية: ${s.count} فاتورة بقيمة ${money(s.value)} جنيه</p>
      ${options ? `<div class="partial-options">${options}</div>` : `
      <div class="stack">
        <label class="field"><span>عدد الفواتير المسددة</span><input id="pCount" type="number" min="1" max="${maxCount}" value="1"></label>
        <label class="field"><span>القيمة المسددة</span><input id="pAmount" type="number" min="1" value="${unitValue}"></label>
      </div>
      `}
      <div class="actions">
        <button class="btn" id="pOk" type="button">تأكيد السداد</button>
        <button class="btn ghost" id="pCancel" type="button">إلغاء</button>
      </div>
    `;
    document.body.append(d);
    d.showModal();
    d.querySelector('#pCancel').onclick = () => { d.close(); d.remove(); resolve(null); };
    d.querySelector('#pOk').onclick = () => {
      let count, amount;
      if (options){
        const sel = d.querySelector('.partial-opt.selected');
        if (!sel){ alert('اختر إحدى القيم'); return; }
        count = +sel.dataset.cnt;
        amount = +sel.dataset.amt;
      } else {
        count = +d.querySelector('#pCount').value;
        amount = +d.querySelector('#pAmount').value;
      }
      if (!(count > 0) || !(amount > 0)){ alert('أدخل قيماً صحيحة'); return; }
      if (count > maxCount){ alert('عدد الفواتير أكبر من المديونية'); return; }
      if (amount > s.value){ alert('القيمة أكبر من المديونية'); return; }
      d.close(); d.remove();
      resolve({count, amount});
    };
    d.querySelectorAll('.partial-opt').forEach(b => {
      b.onclick = () => {
        d.querySelectorAll('.partial-opt').forEach(x => x.classList.remove('selected'));
        b.classList.add('selected');
      };
    });
  });
}

/* ===== ربط الأحداث ===== */
function bind(el, a, v, again){
  el.querySelectorAll('[data-k]').forEach(c => {
    c.onchange = () => { c.checked ? st.sel.add(c.dataset.k) : st.sel.delete(c.dataset.k); again(); };
  });
  const allCb = el.querySelector('#all');
  if (allCb) allCb.onchange = e => {
    a.forEach(s => e.target.checked ? st.sel.add(key(s)) : st.sel.delete(key(s)));
    again();
  };
  el.querySelectorAll('[data-nm]').forEach(nm => {
    nm.onclick = ev => {
      ev.stopPropagation();
      const k = nm.dataset.nm;
      if (st.sel.has(k)) st.sel.delete(k); else st.sel.add(k);
      again();
    };
  });
  el.querySelectorAll('[data-m]').forEach(btn => {
    btn.onclick = ev => {
      ev.stopPropagation();
      el.querySelectorAll('[data-pop]').forEach(p => p.hidden = true);
      const pop = el.querySelector(`[data-pop="${btn.dataset.m}"]`);
      if (pop) pop.hidden = !pop.hidden;
    };
  });
  document.addEventListener('click', () => { el.querySelectorAll('[data-pop]').forEach(p => p.hidden = true); });

  el.querySelectorAll('[data-act]').forEach(b => {
    b.onclick = async ev => {
      ev.stopPropagation();
      const k = b.dataset.id, s = st.by.get(k);
      const act = b.dataset.act;
      if (act === 'read'){
        const q = new URLSearchParams({
          n: s.name||'', s: s.sector, b: s.blk, d: s.bld, a: s.apt,
          v: s.value, r: st.adv.get(k)||0, q: due(s), c: s.count, m: st.cycle, u: st.who, k
        }).toString();
        openPage('reading.html', q);
        el.querySelectorAll('[data-pop]').forEach(p => p.hidden = true);
      }
      if (act === 'name'){
        const n = prompt('اسم العميل', s?.name || '');
        if (n && n.trim()){
          await saveManual(k, n.trim());
          await refresh();
          el.querySelectorAll('[data-pop]').forEach(p => p.hidden = true);
          again();
        }
      }
      if (act === 'partial'){
        const res = await partialDialog(s);
        if (res){
          await partialPay(st.no, s, res, st.adv);
          await refresh();
          toast(`تم سداد جزئي: ${res.count} فاتورة (${money(res.amount)} جنيه)`);
          el.querySelectorAll('[data-pop]').forEach(p => p.hidden = true);
          again();
        }
      }
    };
  });

  el.querySelectorAll('[data-p]').forEach(btn => {
    btn.onclick = async ev => {
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
    };
  });

  const p = el.querySelector('#pay');
  if (p) p.onclick = async () => {
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

/* ===== الصفحة الرئيسية ===== */
export async function renderHome(el){
  const y = scrollY; back(false);
  const w = work();
  if (!st.S.length){
    el.innerHTML = '<div class="empty">لا توجد بيانات بعد. اضغط «تحديث الملف» من تبويب «ما تم تحصيله».</div>';
    return;
  }
  const secs = [...new Set(w.map(s => s.sector))].sort(srt);
  if (!secs.length){
    el.innerHTML = '<div class="empty">لا يوجد عملاء غير مسددين في خط سيرك. ما شاء الله.</div>';
    return;
  }
  if (!secs.includes(st.sector)) st.sector = secs[0];
  const blks = [...new Set(w.filter(s => s.sector===st.sector).map(s => s.blk))].sort(srt);
  if (!blks.includes(st.blk)) st.blk = blks[0];
  const rows = w.filter(s => s.sector===st.sector && s.blk===st.blk);
  const g = {};
  rows.forEach(s => (g[s.bld] = g[s.bld] || []).push(s));
  const t = tot(rows);
  const opt = (a,v) => a.map(x => `<option ${x===v?'selected':''}>${x}</option>`).join('');

  let ov = null;

  /* ===== شريط الأدوات: 3 أوضاع ===== */
  let html = `<div class="pick">
    <label class="field"><span>القطاع</span><select id="sSec">${opt(secs,st.sector)}</select></label>
    <label class="field"><span>البلوك</span><select id="sBlk">${opt(blks,st.blk)}</select></label>
    <label class="field"><span>العمارة</span>
      <input id="bldIn" class="num2" type="text" inputmode="numeric" maxlength="2" placeholder="—" value="${st.open||''}">
    </label>
  </div>
  <div class="view-mode">
    <button class="btn ghost sm" id="modeList" type="button">عرض القائمة</button>
    <button class="btn ghost sm" id="modeOpen" type="button">فتح العمارة</button>
  </div>
  <p class="sum">${t.n} شقة · ${t.count} فاتورة · <b>${money(t.value)}</b> جنيه</p>
  <div class="blist">`;

  /* ===== إذا كان وضع "فتح العمارة" مفعّل ===== */
  if (st.open && g[st.open]){
    st.bld = st.open;
    const aa = g[st.open].sort((p,q) => srt(p.apt, q.apt));
    ov = {a: aa, v: aptsView(aa)};
    html += `<div class="card apts">${ov.v.html}</div>`;
  } else {
    Object.keys(g).sort(srt).forEach(b => {
      const x = tot(g[b]);
      const o = st.open === b;
      let hiClass = '';
      if (st.filter){
        if (st.filter.kind === 'blk' && st.filter.matches.has('blk:' + st.sector + '|' + st.blk)) hiClass = 'hi';
        if (st.filter.kind === 'bld' && st.filter.matches.has('bld:' + st.sector + '|' + st.blk + '|' + b)) hiClass = 'hi';
        if (st.filter.kind === 'apt'){
          const hasMatch = g[b].some(s => st.filter.matches.has('apt:' + key(s)));
          if (hasMatch) hiClass = 'hi';
        }
      }
      const cells = `<b>عمارة ${b}</b><span>${x.n} شقة</span><span>${x.count} فاتورة</span><strong>${money(x.value)}</strong>`;
      html += `<div class="brow prow ${o?'open':''} ${hiClass}" data-b="${b}" role="button" tabindex="0">${cells}</div>`;
      if (o){
        st.bld = b;
        const aa = g[b].sort((p,q) => srt(p.apt, q.apt));
        ov = {a: aa, v: aptsView(aa)};
        html += `<div class="card apts">${ov.v.html}</div>`;
      }
    });
  }

  el.innerHTML = html + '</div>' + (ov ? bar(ov.v) : '');

  /* ===== ربط الأحداث ===== */
  el.querySelector('#sSec').onchange = e => { st.sector = e.target.value; st.open = null; renderHome(el); };
  el.querySelector('#sBlk').onchange = e => { st.blk = e.target.value; st.open = null; renderHome(el); };

  const bldIn = el.querySelector('#bldIn');

  // وضع "فتح العمارة"
  el.querySelector('#modeOpen').onclick = () => {
    const v = String(bldIn.value || '').trim();
    if (!v){ toast('أدخل رقم العمارة أولاً'); return; }
    if (g[v]){ st.open = v; st.bld = v; renderHome(el); }
    else {
      const inPaid = st.S.some(s => s.sector===st.sector && s.blk===st.blk && s.bld===v && st.paid.has(key(s)));
      if (inPaid) toast('العمارة مسددة بالكامل');
      else toast('لا توجد في السجلات');
    }
  };

  // وضع "عرض القائمة"
  el.querySelector('#modeList').onclick = () => {
    st.open = null;
    bldIn.value = '';
    renderHome(el);
  };

  bldIn.addEventListener('input', () => {
    if (bldIn.value.length === 2){
      const v = bldIn.value;
      if (g[v]){ st.open = v; st.bld = v; renderHome(el); }
      else {
        const inPaid = st.S.some(s => s.sector===st.sector && s.blk===st.blk && s.bld===v && st.paid.has(key(s)));
        if (inPaid) toast('العمارة مسددة بالكامل');
        else toast('لا توجد في السجلات');
      }
    }
  });

  el.querySelectorAll('[data-b]').forEach(b => {
    b.onclick = () => {
      st.sel.clear();
      st.open = st.open === b.dataset.b ? null : b.dataset.b;
      st.bld = st.open;
      renderHome(el);
    };
  });

  if (ov) bind(el, ov.a, ov.v, () => renderHome(el));
  scrollTo(0, y);
}

/* ===== صفحة العمارة ===== */
export function renderBuilding(el){
  back(true);
  const a = work().filter(s => s.sector===st.sector && s.blk===st.blk && s.bld===st.bld).sort((p,q) => srt(p.apt, q.apt));
  if (!a.length) return history.back();
  const v = aptsView(a);
  el.innerHTML = `<div class="card">${v.html}</div>${bar(v)}`;
  bind(el, a, v, () => renderBuilding(el));
}

/* ===== صفحة ما تم تحصيله ===== */
export async function renderLedger(el, reload, exp){
  back(false);
  await refresh();
  const e = await list();
  const td = e.filter(x => ldate(x.time) === ldate(new Date()));
  const sum = td.reduce((s,x) => s + x.amount, 0);
  const tagFor = x => {
    const arr = [];
    if (x.personal) arr.push('<span class="tag personal">شخصي</span>');
    if (x.partial) arr.push('<span class="tag partial">جزئي</span>');
    if (x.type === 'advance') arr.push('<span class="tag advance">مقدم</span>');
    if (x.out) arr.push('<span class="tag out">خارج خط سيري</span>');
    if (x.other) arr.push('<span class="tag other">من مصدر آخر</span>');
    return arr.join('');
  };
  el.innerHTML = `<div class="card"><h2>اليوم: ${td.length} عملية · ${money(sum)} جنيه</h2></div>
  <div class="ledger-list">` +
    (e.map(x => {
      const s = st.by.get(x.key) || {};
      const tags = tagFor(x);
      return `<div class="led-row">
        <div class="led-main">
          <span class="led-apt">${s.apt || '?'}</span>
          <div class="led-info">
            <div class="led-name">${esc(s.name || 'بدون اسم')}</div>
            <div class="led-meta">قطاع ${s.sector||''} · بلوك ${s.blk||''} · عمارة ${s.bld||''} · ${new Date(x.time).toLocaleString('ar-EG',{dateStyle:'short',timeStyle:'short'})}</div>
          </div>
          <div class="led-right">
            <div class="led-tags">${tags}</div>
            <div class="led-amount">${money(x.amount)}</div>
          </div>
          <div class="led-menu-wrap">
            <button class="menu-dots" data-m="${x.id}" type="button" aria-label="خيارات">⋮</button>
            <div class="menu-pop" data-pop="${x.id}" hidden>
              ${canUndo(x)?`<button data-act="undo" data-id="${x.id}" type="button">تراجع</button>`:''}
              <button data-act="print" data-id="${x.id}" type="button">طباعة فاتورة</button>
              ${(s.value||0) === 0 ? `<button data-act="advance" data-id="${x.id}" type="button">سداد مقدم</button>` : ''}
            </div>
          </div>
        </div>
      </div>`;
    }).join('') || '<p class="mute">لا توجد تحصيلات بعد.</p>') +
  `</div>
  <div class="card">
    <div class="actions">
      <button class="btn" id="ex" type="button">إرسال الأرشيف</button>
      <button class="btn ghost" id="rl" type="button">تحديث الملف</button>
    </div>
  </div>`;
  el.querySelectorAll('[data-m]').forEach(btn => {
    btn.onclick = ev => {
      ev.stopPropagation();
      el.querySelectorAll('[data-pop]').forEach(p => p.hidden = true);
      const pop = el.querySelector(`[data-pop="${btn.dataset.m}"]`);
      if (pop) pop.hidden = !pop.hidden;
    };
  });
  document.addEventListener('click', () => { el.querySelectorAll('[data-pop]').forEach(p => p.hidden = true); });
  el.querySelectorAll('[data-act]').forEach(b => {
    b.onclick = async ev => {
      ev.stopPropagation();
      const id = b.dataset.id;
      const entry = e.find(x => x.id === id);
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
        const q = new URLSearchParams({
          n: s.name||'', s: s.sector||'', b: s.blk||'', d: s.bld||'', a: s.apt||'',
          v: s.value||0, r: st.adv.get(entry.key)||0, q: entry.due||s.value||0,
          c: s.count||0, m: st.cycle, u: st.who, k: entry.key
        }).toString();
        openPage('print.html', q);
      }
      if (act === 'advance'){
        const s = st.by.get(entry.key);
        if (!s) return;
        if ((s.value||0) > 0){ toast('لا يمكن السداد المقدم لعميل ما زال عليه مديونية'); return; }
        const x = num(prompt('مبلغ السداد المقدم'));
        if (x > 0){
          await addAdvance(st.no, s, x);
          await refresh();
          toast(`سُجّل مقدم ${money(x)} جنيه`);
          renderLedger(el, reload, exp);
        }
      }
    };
  });
  el.querySelector('#rl').onclick = reload;
  el.querySelector('#ex').onclick = exp;
}