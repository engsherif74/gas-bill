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
      <div class="apt-top">
        <div class="apt-name" data-nm="${k}">${nameHtml}</div>
        <button class="apt-val" data-p="${k}" type="button">${money(due(s))}</button>
      </div>
      <div class="apt-bottom">
        <label class="apt-chk"><input type="checkbox" data-k="${k}" ${selected?'checked':''}></label>
        <div class="apt-apt">${s.apt}</div>
        <div class="apt-meta">${s.count} فاتورة${advHtml}</div>
        <div class="apt-menu-wrap">
          <button class="apt-dots" data-m="${k}" type="button" aria-label="خيارات">⋮</button>
          <div class="apt-pop" data-pop="${k}" hidden>
            <button data-act="read" data-id="${k}" type="button">قراءة عداد</button>
            ${partial ? `<button data-act="partial" data-id="${k}" type="button">سداد جزئي</button>` : ''}
            ${!s.name ? `<button data-act="name" data-id="${k}" type="button">تعديل الاسم</button>` : ''}
          </div>
        </div>
      </div>
    </div>`;
  }).join('');

  const html = `<div class="bh" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.6rem">
    <h2 style="margin:0;font-size:1rem">عمارة ${st.bld} <span style="color:var(--br);font-weight:700">— ${money(allTot.value)} ج</span></h2>
    <label class="chk" style="display:flex;gap:.4rem;align-items:center;font-weight:700"><input type="checkbox" id="all" ${ch.length===a.length&&a.length?'checked':''}> تحديد الكل</label>
  </div>
  <div class="apt-list">${cards}</div>`;
  return {html, ch, ct, allTot};
}

const bar = v => {
  const cnt = v.ch.length;
  const inv = v.ch.reduce((t,s) => t + (s.count||0), 0);
  const has = cnt > 0;
  return `<div class="bar">
    <div class="bar-grid">
      <div><small>إجمالي العمارة</small><b>${money(v.allTot.value)}</b></div>
      <div class="sel"><small>المحدد (${cnt} شقة · ${inv} فاتورة)</small><b>${has ? money(v.ct.value) : '—'}</b></div>
      <div class="rem"><small>المتبقي بعد السداد</small><b>${money(v.allTot.value - v.ct.value)}</b></div>
      <button class="btn" id="pay" ${has?'':'disabled'} type="button">
        ${has ? `سداد (${money(v.ct.value)})` : 'سداد'}
      </button>
    </div>
  </div>`;
};

function partialDialog(s){
  return new Promise(resolve => {
    const d = document.createElement('dialog');
    d.className = 'partial-dialog';
    const maxCount = s.count || 1;
    d.innerHTML = `
      <h3>سداد جزئي — شقة ${s.apt}</h3>
      <p class="mute">المديونية الحالية: ${s.count} فاتورة بقيمة ${money(s.value)} جنيه</p>
      <div class="stack">
        <label class="field"><span>عدد الفواتير المسددة</span><input id="pCount" type="number" inputmode="numeric" placeholder="أدخل العدد"></label>
        <label class="field"><span>القيمة المسددة</span><input id="pAmount" type="number" inputmode="numeric" placeholder="أدخل القيمة"></label>
      </div>
      <div id="pError" style="color:var(--bad);font-weight:700;text-align:center;font-size:0.85rem;min-height:20px"></div>
      <div class="actions">
        <button class="btn" id="pOk" type="button">تأكيد السداد</button>
        <button class="btn ghost" id="pCancel" type="button">إلغاء</button>
      </div>
    `;
    document.body.append(d);
    d.showModal();
    d.querySelector('#pCancel').onclick = () => { d.close(); d.remove(); resolve(null); };
    d.querySelector('#pOk').onclick = async () => {
      const errEl = d.querySelector('#pError');
      const count = +d.querySelector('#pCount').value;
      const amount = +d.querySelector('#pAmount').value;

      if (!(count > 0) || !(amount > 0)){ errEl.textContent = 'أدخل قيماً صحيحة'; return; }
      if (count > maxCount){ errEl.textContent = `عدد الفواتير أكبر من المديونية (${maxCount})`; return; }
      if (amount > s.value){ errEl.textContent = `القيمة أكبر من المديونية (${money(s.value)})`; return; }
      if (count === maxCount || amount === s.value){
        if (!confirm('هذا سداد كلي. هل تريد الموافقة على السداد الكلي؟')) return;
        d.close(); d.remove();
        resolve({count: s.count, amount: s.value, full: true});
        return;
      }
      d.close(); d.remove();
      resolve({count, amount, full: false});
    };
  });
}

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
          if (res.full){
            await pay(st.no, [s], st.adv);
            await refresh();
            toast(`تم سداد شقة ${s.apt} بالكامل`);
          } else {
            await partialPay(st.no, s, res, st.adv);
            await refresh();
            toast(`تم سداد جزئي: ${res.count} فاتورة`);
          }
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
      toast(`تم سداد شقة ${s.apt}`);
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
    toast(`تم سداد ${v.ch.length} شقة`);
    again();
  };
}

export async function renderHome(el){
  const y = scrollY; back(false);
  const w = work();
  if (!st.S.length){
    el.innerHTML = '<div class="empty">لا توجد بيانات بعد. اضغط «تحديث الملف».</div>';
    return;
  }
  const secs = [...new Set(w.map(s => s.sector))].sort(srt);
  if (!secs.length){
    el.innerHTML = '<div class="empty">لا يوجد عملاء غير مسددين.</div>';
    return;
  }
  if (!secs.includes(st.sector)) st.sector = secs[0];
  const blks = [...new Set(w.filter(s => s.sector===st.sector).map(s => s.blk))].sort(srt);
  if (!blks.includes(st.blk)) st.blk = blks[0];
  const rows = w.filter(s => s.sector===st.sector && s.blk===st.blk);
  const g = {};
  rows.forEach(s => (g[s.bld] = g[s.bld] || []).push(s));
  const t = tot(rows);

  let ov = null;
  const optSec = secs.map(x => `<option ${x===st.sector?'selected':''} value="${x}">قطاع ${x}</option>`).join('');
  const optBlk = blks.map(x => `<option ${x===st.blk?'selected':''} value="${x}">بلوك ${x}</option>`).join('');

  let html = `
  <div class="pick">
    <label class="field"><span>القطاع</span><select id="secIn" class="num2" style="width:100%;height:44px;font-weight:800;text-align:center">${optSec}</select></label>
    <label class="field"><span>البلوك</span><select id="blkIn" class="num2" style="width:100%;height:44px;font-weight:800;text-align:center">${optBlk}</select></label>
    <label class="field"><span>العمارة</span><input id="bldIn" class="num2" type="text" inputmode="numeric" maxlength="2" value="${st.open||''}" data-next=""></label>
  </div>
  <p class="sum">${t.n} شقة · ${t.count} فاتورة · <b>${money(t.value)}</b> جنيه</p>
  <div class="blist">`;

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
  el.innerHTML = html + '</div>' + (ov ? bar(ov.v) : '');

  const secIn = el.querySelector('#secIn');
  const blkIn = el.querySelector('#blkIn');
  const bldIn = el.querySelector('#bldIn');

  secIn.addEventListener('change', () => { st.sector = secIn.value; st.open = null; renderHome(el); });
  blkIn.addEventListener('change', () => { st.blk = blkIn.value; st.open = null; renderHome(el); });
  
  // ✅ الانتقال التلقائي (مع إبقاء لوحة المفاتيح مفتوحة)
  bldIn.addEventListener('input', () => {
    const v = String(bldIn.value || '').replace(/\D/g, '').slice(0, 2);
    if (bldIn.value !== v) bldIn.value = v;
    if (v.length === 2){
      if (g[v]){
        st.open = v;
        st.bld = v;
        setTimeout(() => {
          renderHome(el);
          // ✅ نقل الصفحة إلى الشقق مباشرة
          const bv = document.getElementById('buildingView');
          if (bv) {
            bv.scrollIntoView({behavior:'smooth', block:'start'});
          } else {
            window.scrollTo({top:0, behavior:'smooth'});
          }
          // إعادة التركيز على حقل العمارة لإبقاء لوحة المفاتيح مفتوحة
          const newBld = document.getElementById('bldIn');
          if (newBld) newBld.focus();
        }, 150);
      } else {
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
      if (st.open) window.scrollTo({top:0, behavior:'smooth'});
    };
  });

  if (ov) bind(el, ov.a, ov.v, () => renderHome(el));

  // KPIs
  const totalDebt = st.S.reduce((sum, s) => sum + (s.value || 0), 0);
  const paidToday = st.S.reduce((sum, s) => sum + (st.paid.has(key(s)) ? (s.value || 0) : 0), 0);
  const pct = totalDebt ? Math.round(100 * paidToday / totalDebt) : 0;
  const elKRem = document.getElementById('kRem');
  if (elKRem) elKRem.textContent = money(totalDebt - paidToday);
  const elKToday = document.getElementById('kToday');
  if (elKToday) elKToday.textContent = money(paidToday);
  const elKPct = document.getElementById('kPct');
  if (elKPct) elKPct.textContent = pct + '%';
  const elKBar = document.getElementById('kBar');
  if (elKBar) elKBar.style.width = pct + '%';

  scrollTo(0, y);
}

export function renderBuilding(el){
  back(true);
  const a = work().filter(s => s.sector===st.sector && s.blk===st.blk && s.bld===st.bld).sort((p,q) => srt(p.apt, q.apt));
  if (!a.length) return history.back();
  const v = aptsView(a);
  el.innerHTML = `<div class="card">${v.html}</div>${bar(v)}`;
  bind(el, a, v, () => renderBuilding(el));
}

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
      const canU = canUndo(x);
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
              ${canU?`<button data-act="undo" data-id="${x.id}" type="button">تراجع</button>`:''}
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