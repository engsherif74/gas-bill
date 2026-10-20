import {st, esc, refresh, toast} from './browse.js';
import {keyOf as key, pay, ldate} from './ledger.js';
import {money} from '../core/utils.js';
import {openPage} from './buttons.js';
import {all, put} from '../core/db.js';
import {list} from './ledger.js';
import {totals} from './payment.js';

let q = '', scope = 'all', mode = 'name';

const fz = s => String(s || '').normalize('NFKC')
  .replace(/[\u064B-\u065F\u0640]/g, '')
  .replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')
  .replace(/[خج]/g, 'ح').replace(/ذ/g, 'د')
  .replace(/\s+/g, ' ').trim();

const due = s => Math.max(0, s.value - (st.adv.get(key(s)) || 0));

export async function renderSearch(el) {
  document.getElementById('back').hidden = true;
  await refresh();

  el.innerHTML = `
    <div class="card">
      <div class="tools" style="margin-bottom:1rem">
        <button class="btn ${mode === 'name' ? '' : 'ghost'} sm" id="modeName">بحث بالاسم</button>
        <button class="btn ${mode === 'number' ? '' : 'ghost'} sm" id="modeNumber">بحث برقم المشترك</button>
      </div>
      <div id="searchName" ${mode !== 'name' ? 'hidden' : ''}>
        <input id="q" class="srch" placeholder="اكتب اسم العميل…" value="${esc(q)}" autocomplete="off" style="color:var(--ink);background:var(--s1);width:100%;padding:.8rem;border:1.5px solid var(--line);border-radius:12px;font-size:1rem">
        <div class="tools" style="margin-top:.5rem">
          <label class="chk"><input type="radio" name="sc" value="route" ${scope === 'route' ? 'checked' : ''}> خط سيري فقط</label>
          <label class="chk"><input type="radio" name="sc" value="all" ${scope === 'all' ? 'checked' : ''}> الملف كاملاً</label>
        </div>
      </div>
      <div id="searchNumber" ${mode !== 'number' ? 'hidden' : ''}>
        <div class="pick">
          <label class="field"><span>القطاع</span><input id="numSec" class="num2" type="text" inputmode="numeric" maxlength="2" placeholder="—" data-next="numBlk"></label>
          <label class="field"><span>البلوك</span><input id="numBlk" class="num2" type="text" inputmode="numeric" maxlength="2" placeholder="—" data-next="numBld"></label>
          <label class="field"><span>العمارة</span><input id="numBld" class="num2" type="text" inputmode="numeric" maxlength="2" placeholder="—" data-next="numApt"></label>
          <label class="field"><span>الشقة</span><input id="numApt" class="num2" type="text" inputmode="numeric" maxlength="2" placeholder="—" data-next=""></label>
        </div>
        <div class="actions" style="margin-top:.5rem">
          <button class="btn sm" id="numGo">بحث</button>
        </div>
      </div>
    </div>
    <div id="sr" class="blist"></div>
  `;

  const draw = () => {
    const sr = el.querySelector('#sr');
    if (mode === 'number') {
      const sec = el.querySelector('#numSec').value.trim();
      const blk = el.querySelector('#numBlk').value.trim();
      const bld = el.querySelector('#numBld').value.trim();
      const apt = el.querySelector('#numApt').value.trim();
      if (!sec || !blk || !bld) { sr.innerHTML = ''; return; }
      const rows = st.S.filter(s => s.sector === sec && s.blk === blk && s.bld === bld && (!apt || s.apt === apt));
      if (!rows.length) { sr.innerHTML = '<div class="card empty">لا يوجد عملاء بهذا العنوان.</div>'; return; }
      sr.innerHTML = `<div class="card"><h2>عملاء العمارة ${bld}${apt ? ' · شقة ' + apt : ''}</h2>
        <div class="apt-list">` + rows.map(s => aptCard(s, true)).join('') + '</div></div>';
      bindActions(sr, rows);
      return;
    }

    const ws = fz(q).split(' ').filter(Boolean);
    if (!ws.length) { sr.innerHTML = ''; return; }
    const m = st.S.filter(s => !st.paid.has(key(s)) && (scope === 'all' || s.inRoute) && ws.every(w => fz(s.name || '').includes(w)));
    if (!m.length) { sr.innerHTML = '<div class="card empty">لا نتائج.</div>'; return; }
    
    const g = {};
    m.forEach(s => (g[`${s.sector}|${s.blk}|${s.bld}`] ??= []).push(s));
    sr.innerHTML = '<div class="card"><h2>نتائج البحث (' + m.length + ' عميل)</h2>' +
      Object.entries(g).map(([k, a]) => {
        const [x, b, d] = k.split('|');
        return `<div style="margin-bottom:1rem"><div class="bh" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.4rem">
          <b style="color:var(--br)">عمارة ${d} · قطاع ${x} · بلوك ${b}</b>
          <span class="mute">${a.length} شقة</span>
        </div><div class="apt-list">` + a.map(s => aptCard(s, false)).join('') + '</div></div>';
      }).join('') + '</div>';
    bindActions(sr, m);
  };

  const aptCard = (s, showAddr) => {
    const k = key(s);
    const b = st.adv.get(k) || 0;
    const nameHtml = s.name ? esc(s.name) : '<em class="empty-name">بدون اسم</em>';
    const partial = (s.count || 0) > 1;
    return `<div class="apt-card" data-card="${k}">
      <div class="apt-top">
        <div class="apt-name">${nameHtml}</div>
        <button class="apt-val" data-p="${k}" type="button">${money(due(s))}</button>
      </div>
      <div class="apt-bottom">
        <div class="apt-apt">${s.apt}</div>
        <div class="apt-meta">${s.count} فاتورة${showAddr ? ' · عمارة ' + s.bld : ''}${b ? ' · مقدم ' + money(b) : ''}</div>
        <div class="apt-menu-wrap">
          <button class="apt-dots" data-m="${k}" type="button">⋮</button>
          <div class="apt-pop" data-pop="${k}" hidden>
            <button data-act="read" data-id="${k}" type="button">قراءة عداد</button>
            ${partial ? `<button data-act="partial" data-id="${k}" type="button">سداد جزئي</button>` : ''}
            ${!s.name ? `<button data-act="name" data-id="${k}" type="button">تعديل الاسم</button>` : ''}
          </div>
        </div>
      </div>
    </div>`;
  };

  const bindActions = (container, rows) => {
    container.querySelectorAll('[data-m]').forEach(btn => {
      btn.onclick = ev => {
        ev.stopPropagation();
        container.querySelectorAll('[data-pop]').forEach(p => p.hidden = true);
        const pop = container.querySelector(`[data-pop="${btn.dataset.m}"]`);
        if (pop) pop.hidden = !pop.hidden;
      };
    });
    document.addEventListener('click', () => { container.querySelectorAll('[data-pop]').forEach(p => p.hidden = true); });
    
    container.querySelectorAll('[data-act]').forEach(b => {
      b.onclick = async ev => {
        ev.stopPropagation();
        const k = b.dataset.id, s = st.by.get(k);
        const act = b.dataset.act;
        if (act === 'read') {
          const qs = new URLSearchParams({
            n: s.name || '', s: s.sector, b: s.blk, d: s.bld, a: s.apt,
            v: s.value, r: st.adv.get(k) || 0, q: due(s), c: s.count, m: st.cycle, u: st.who, k
          }).toString();
          openPage('reading.html', qs);
          container.querySelectorAll('[data-pop]').forEach(p => p.hidden = true);
        }
        if (act === 'name') {
          const n = prompt('اسم العميل', s?.name || '');
          if (n && n.trim()) {
            await import('./names.js').then(m => m.saveManual(k, n.trim()));
            await refresh();
            container.querySelectorAll('[data-pop]').forEach(p => p.hidden = true);
            draw();
          }
        }
        if (act === 'partial') {
          const { partialPay } = await import('./ledger.js');
          const maxCount = s.count || 1;
          const count = +(prompt(`عدد الفواتير (الحد الأقصى ${maxCount})`) || 0);
          if (!(count > 0) || count > maxCount) { toast('عدد غير صحيح'); return; }
          const amount = +(prompt(`القيمة المسددة (الحد الأقصى ${money(s.value)})`) || 0);
          if (!(amount > 0) || amount > s.value) { toast('قيمة غير صحيحة'); return; }
          if (count === maxCount || amount === s.value) {
            if (!confirm('هذا سداد كلي. موافق؟')) return;
            const { pay } = await import('./ledger.js');
            await pay(st.no, [s], st.adv);
          } else {
            await partialPay(st.no, s, { count, amount }, st.adv);
          }
          await refresh();
          toast('تم السداد');
          draw();
        }
      };
    });
    
    container.querySelectorAll('[data-p]').forEach(btn => {
      btn.onclick = async ev => {
        ev.stopPropagation();
        const k = btn.dataset.p, s = st.by.get(k), amt = due(s);
        if (!amt) { toast('لا يوجد مبلغ مستحق'); return; }
        if (!confirm(`تأكيد سداد شقة ${s.apt} — ${s.name || 'بدون اسم'} بمبلغ ${money(amt)}؟`)) return;
        const { pay } = await import('./ledger.js');
        await pay(st.no, [s], st.adv);
        await refresh();
        toast(`تم سداد شقة ${s.apt}`);
        draw();
      };
    });
  };

  el.querySelector('#modeName').onclick = () => { mode = 'name'; renderSearch(el); };
  el.querySelector('#modeNumber').onclick = () => { mode = 'number'; renderSearch(el); };

  if (mode === 'name') {
    el.querySelector('#q').oninput = e => { q = e.target.value; draw(); };
    el.querySelectorAll('[name=sc]').forEach(r => r.onchange = () => { scope = r.value; draw(); });
  } else {
    ['numSec', 'numBlk', 'numBld', 'numApt'].forEach(id => {
      const inp = el.querySelector('#' + id);
      inp.addEventListener('input', () => {
        const v = String(inp.value || '').replace(/\D/g, '').slice(0, 2);
        if (inp.value !== v) inp.value = v;
        if (v.length === 2 && inp.dataset.next) {
          const n = el.querySelector('#' + inp.dataset.next);
          if (n) n.focus();
        }
      });
    });
    el.querySelector('#numGo').onclick = draw;
  }

  draw();
}