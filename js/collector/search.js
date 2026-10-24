import {st, esc, toast} from './browse.js';
import {keyOf as key, pay, partialPay, list} from './ledger.js';
import {money} from '../core/utils.js';
import {openPage} from './buttons.js';
import {saveManual} from './names.js';
import {all, get} from '../core/db.js';

let q = '';
let stLocal = { S: [], adv: new Map(), paid: new Set(), by: new Map() };

const due = s => Math.max(0, (s.value || 0) - (stLocal.adv.get(key(s)) || 0));

async function loadData(){
  const subs = await all('subscribers');
  const advs = await all('advance');
  const ledger = await list();
  const fullPaid = new Set(ledger.filter(x => x.type === 'pay' && !x.partial && !x.personal).map(x => x.key));
  const stillDue = new Set(subs.filter(s => (s.value||0) > 0 || (s.count||0) > 0).map(s => key(s)));
  const paid = new Set([...fullPaid].filter(k => !stillDue.has(k)));
  stLocal.S = subs;
  stLocal.by = new Map(subs.map(s => [key(s), s]));
  stLocal.adv = new Map(advs.map(v => [v.key, v.balance]));
  stLocal.paid = paid;
  st.S = subs; st.by = stLocal.by; st.adv = stLocal.adv; st.paid = paid;
}

export async function renderSearch(el) {
  document.getElementById('back').hidden = true;
  await loadData();

  el.innerHTML = `
    <div class="card">
      <input id="q" class="srch" placeholder="اكتب اسم العميل…" value="${esc(q)}" autocomplete="off" style="color:var(--ink);background:var(--s1);width:100%;padding:.8rem;border:1.5px solid var(--line);border-radius:12px;font-size:1rem">
    </div>
    <div id="sr" class="blist" style="margin-top:.8rem"></div>
  `;

  const sr = el.querySelector('#sr');

  const draw = () => {
    const query = q.trim();
    if (query.length < 1){ sr.innerHTML = ''; return; }
    
    // بحث عادي: الأسماء التي تحتوي على النص (تطابق جزئي)
    const matches = stLocal.S.filter(s => 
      !stLocal.paid.has(key(s)) && 
      String(s.name || '').includes(query)
    );
    
    if (!matches.length){ 
      sr.innerHTML = '<div class="card empty">لا نتائج.</div>'; 
      return; 
    }
    
    // إزالة التكرار: إذا كان الاسم موجوداً في أكثر من شقة في نفس العمارة، يظهر مرة واحدة
    const seen = new Set();
    const uniq = [];
    for (const s of matches){
      const grpKey = `${s.sector}|${s.blk}|${s.bld}`;
      const name = String(s.name || '').trim();
      if (!name || seen.has(grpKey + '|' + name)) continue;
      seen.add(grpKey + '|' + name);
      uniq.push(s);
      if (uniq.length >= 50) break;
    }
    
    sr.innerHTML = uniq.map(s => {
      const k = key(s);
      const b = stLocal.adv.get(k) || 0;
      return `<div class="card" style="margin-bottom:.6rem;cursor:pointer" data-open="${k}">
        <div class="apt-top">
          <div class="apt-name">${esc(s.name || 'بدون اسم')}</div>
          <div class="apt-val">${money(due(s))}</div>
        </div>
        <div class="apt-bottom">
          <div class="apt-apt">${s.apt}</div>
          <div class="apt-meta">عمارة ${s.bld} · قطاع ${s.sector} · بلوك ${s.blk}${b ? ' · مقدم ' + money(b) : ''}</div>
        </div>
      </div>`;
    }).join('');
    
    // عند الضغط على الاسم → فتح العمارة كاملة
    sr.querySelectorAll('[data-open]').forEach(card => {
      card.onclick = () => openBuilding(card.dataset.open);
    });
  };

  // فتح العمارة كاملة داخل صفحة البحث
  const openBuilding = (k) => {
    const s = stLocal.by.get(k);
    if (!s) return;
    
    const bldRows = stLocal.S.filter(x => 
      !stLocal.paid.has(key(x)) && 
      x.sector === s.sector && x.blk === s.blk && x.bld === s.bld
    ).sort((p1, p2) => Number(p1.apt) - Number(p2.apt));
    
    const allTot = bldRows.reduce((t, x) => ({ 
      n: t.n + 1, 
      count: t.count + (x.count||0), 
      value: t.value + due(x) 
    }), {n:0, count:0, value:0});
    
    const cards = bldRows.map(x => {
      const k2 = key(x);
      const b = stLocal.adv.get(k2) || 0;
      const selected = st.sel.has(k2);
      const partial = (x.count || 0) > 1;
      return `<div class="apt-card ${selected?'on':''}" data-card="${k2}">
        <div class="apt-top">
          <div class="apt-name" data-nm="${k2}">${esc(x.name || 'بدون اسم')}</div>
          <button class="apt-val" data-p="${k2}" type="button">${money(due(x))}</button>
        </div>
        <div class="apt-bottom">
          <label class="apt-chk"><input type="checkbox" data-k="${k2}" ${selected?'checked':''}></label>
          <div class="apt-apt">${x.apt}</div>
          <div class="apt-meta">${x.count} فاتورة${b ? ' · مقدم ' + money(b) : ''}</div>
          <div class="apt-menu-wrap">
            <button class="apt-dots" data-m="${k2}" type="button">⋮</button>
            <div class="apt-pop" data-pop="${k2}" hidden>
              <button data-act="read" data-id="${k2}" type="button">قراءة عداد</button>
              ${partial ? `<button data-act="partial" data-id="${k2}" type="button">سداد جزئي</button>` : ''}
              ${!x.name ? `<button data-act="name" data-id="${k2}" type="button">تعديل الاسم</button>` : ''}
            </div>
          </div>
        </div>
      </div>`;
    }).join('');
    
    sr.innerHTML = `
      <div class="card" style="margin-bottom:.6rem">
        <button class="btn ghost sm" id="backToSearch">→ رجوع للبحث</button>
      </div>
      <div class="card">
        <div class="bh" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.6rem">
          <h2 style="margin:0;font-size:1rem">عمارة ${s.bld} <span style="color:var(--br);font-weight:700">— ${money(allTot.value)} ج</span></h2>
          <label class="chk" style="display:flex;gap:.4rem;align-items:center;font-weight:700">
            <input type="checkbox" id="all" ${bldRows.every(x=>st.sel.has(key(x)))?'checked':''}> تحديد الكل
          </label>
        </div>
        <div class="apt-list">${cards}</div>
        <div class="bar-inline" id="barInline"></div>
      </div>
    `;
    
    sr.querySelector('#backToSearch').onclick = () => draw();
    
    // زر تحديد الكل
    sr.querySelector('#all').onchange = (e) => {
      bldRows.forEach(x => {
        const k2 = key(x);
        if (e.target.checked) st.sel.add(k2);
        else st.sel.delete(k2);
      });
      updateBar();
      sr.querySelectorAll('[data-k]').forEach(c => c.checked = e.target.checked);
    };
    
    // checkboxes
    sr.querySelectorAll('[data-k]').forEach(c => {
      c.onchange = () => {
        c.checked ? st.sel.add(c.dataset.k) : st.sel.delete(c.dataset.k);
        updateBar();
      };
    });
    
    // الاسم = تحديد
    sr.querySelectorAll('[data-nm]').forEach(nm => {
      nm.onclick = () => {
        const k2 = nm.dataset.nm;
        if (st.sel.has(k2)) st.sel.delete(k2); else st.sel.add(k2);
        const cb = sr.querySelector(`[data-k="${k2}"]`);
        if (cb) cb.checked = st.sel.has(k2);
        updateBar();
      };
    });
    
    // قائمة ⋮
    sr.querySelectorAll('[data-m]').forEach(btn => {
      btn.onclick = ev => {
        ev.stopPropagation();
        sr.querySelectorAll('[data-pop]').forEach(p => p.hidden = true);
        const pop = sr.querySelector(`[data-pop="${btn.dataset.m}"]`);
        if (pop) pop.hidden = !pop.hidden;
      };
    });
    document.addEventListener('click', () => { sr.querySelectorAll('[data-pop]').forEach(p => p.hidden = true); });
    
    // إجراءات
    sr.querySelectorAll('[data-act]').forEach(b => {
      b.onclick = async ev => {
        ev.stopPropagation();
        const k2 = b.dataset.id, sub = stLocal.by.get(k2);
        const act = b.dataset.act;
        if (act === 'read'){
          const qs = new URLSearchParams({
            n: sub.name || '', s: sub.sector, b: sub.blk, d: sub.bld, a: sub.apt,
            v: sub.value, r: stLocal.adv.get(k2) || 0, q: due(sub), c: sub.count, m: st.cycle, u: st.who, k: k2
          }).toString();
          openPage('reading.html', qs);
          sr.querySelectorAll('[data-pop]').forEach(p => p.hidden = true);
        }
        if (act === 'name'){
          const n = prompt('اسم العميل', sub?.name || '');
          if (n && n.trim()){
            await saveManual(k2, n.trim());
            await loadData();
            openBuilding(k);
          }
        }
        if (act === 'partial'){
          const maxCount = sub.count || 1;
          const count = +(prompt(`عدد الفواتير (الحد الأقصى ${maxCount})`) || 0);
          if (!(count > 0) || count > maxCount) { toast('عدد غير صحيح'); return; }
          const amount = +(prompt(`القيمة المسددة (الحد الأقصى ${money(sub.value)})`) || 0);
          if (!(amount > 0) || amount > sub.value) { toast('قيمة غير صحيحة'); return; }
          if (count === maxCount || amount === sub.value){
            if (!confirm('هذا سداد كلي. موافق؟')) return;
            await pay(st.no, [sub], st.adv);
          } else {
            await partialPay(st.no, sub, {count, amount}, st.adv);
          }
          await loadData();
          openBuilding(k);
          toast('تم السداد');
        }
      };
    });
    
    // السداد الفردي
    sr.querySelectorAll('[data-p]').forEach(btn => {
      btn.onclick = async ev => {
        ev.stopPropagation();
        const k2 = btn.dataset.p, sub = stLocal.by.get(k2), amt = due(sub);
        if (!amt){ toast('لا يوجد مبلغ مستحق'); return; }
        if (!confirm(`تأكيد سداد شقة ${sub.apt} — ${sub.name || 'بدون اسم'} بمبلغ ${money(amt)}؟`)) return;
        await pay(st.no, [sub], st.adv);
        await loadData();
        openBuilding(k);
        toast(`تم سداد شقة ${sub.apt}`);
      };
    });
    
    const updateBar = () => {
      const barEl = sr.querySelector('#barInline');
      if (!barEl) return;
      const selRows = bldRows.filter(x => st.sel.has(key(x)));
      const selCount = selRows.length;
      const selInvoices = selRows.reduce((t, x) => t + (x.count||0), 0);
      const selValue = selRows.reduce((t, x) => t + due(x), 0);
      const remaining = allTot.value - selValue;
      const has = selCount > 0;
      
      barEl.innerHTML = `<div class="bar-grid">
        <div><small>إجمالي العمارة</small><b>${money(allTot.value)}</b></div>
        <div class="sel"><small>المحدد (${selCount} شقة · ${selInvoices} فاتورة)</small><b>${has ? money(selValue) : '—'}</b></div>
        <div class="rem"><small>المتبقي بعد السداد</small><b>${money(remaining)}</b></div>
        <button class="btn" id="paySel" ${has?'':'disabled'} type="button">
          ${has ? `سداد (${money(selValue)})` : 'سداد'}
        </button>
      </div>`;
      
      const payBtn = barEl.querySelector('#paySel');
      if (payBtn) payBtn.onclick = async () => {
        if (!selRows.length) return;
        if (!confirm(`تأكيد سداد ${selRows.length} شقة بمبلغ ${money(selValue)} جنيه؟`)) return;
        await pay(st.no, selRows, st.adv);
        st.sel.clear();
        await loadData();
        openBuilding(k);
        toast(`تم سداد ${selRows.length} شقة`);
      };
    };
    
    updateBar();
  };

  // البحث العادي: يحدث عند الكتابة
  const qEl = el.querySelector('#q');
  let timer = null;
  qEl.addEventListener('input', (e) => {
    q = e.target.value;
    clearTimeout(timer);
    timer = setTimeout(draw, 150);
  });
  
  draw();
}
