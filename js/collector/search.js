import {st, esc, toast} from './browse.js';
import {keyOf as key, pay, partialPay, list} from './ledger.js';
import {money} from '../core/utils.js';
import {openPage} from './buttons.js';
import {saveManual} from './names.js';
import {all, get} from '../core/db.js';

let q = '', scope = 'all', mode = 'name';
let stLocal = { S: [], adv: new Map(), paid: new Set(), by: new Map() };

const fz = s => String(s || '').normalize('NFKC')
  .replace(/[\u064B-\u065F\u0640]/g, '')
  .replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')
  .replace(/[خج]/g, 'ح').replace(/ذ/g, 'د')
  .replace(/\s+/g, ' ').trim();

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

  const sr = el.querySelector('#sr');

  const aptCard = (s) => {
    const k = key(s);
    const b = stLocal.adv.get(k) || 0;
    const nameHtml = s.name ? esc(s.name) : '<em class="empty-name">بدون اسم</em>';
    const partial = (s.count || 0) > 1;
    return `<div class="apt-card" data-card="${k}">
      <div class="apt-top">
        <div class="apt-name">${nameHtml}</div>
        <button class="apt-val" data-p="${k}" type="button">${money(due(s))}</button>
      </div>
      <div class="apt-bottom">
        <div class="apt-apt">${s.apt}</div>
        <div class="apt-meta">${s.count} فاتورة${b ? ' · مقدم ' + money(b) : ''}</div>
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

  const drawBuildingGroup = (rows, title) => {
    const key_grp = 'grp-' + Math.random().toString(36).slice(2, 8);
    const cards = rows.map(s => aptCard(s)).join('');
    const allChecked = rows.every(s => st.sel.has(key(s)));
    return `<div class="card" style="margin-bottom:.8rem" data-group="${key_grp}">
      <div class="bh" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.6rem">
        <b style="color:var(--br)">${title}</b>
        <label class="chk" style="display:flex;gap:.4rem;align-items:center;font-weight:700">
          <input type="checkbox" class="group-all" data-group="${key_grp}" ${allChecked ? 'checked' : ''}> تحديد الكل
        </label>
      </div>
      <div class="apt-list" data-group-list="${key_grp}">${cards}</div>
    </div>`;
  };

  const bindResults = () => {
    sr.querySelectorAll('[data-k]').forEach(c => {
      c.onchange = () => {
        c.checked ? st.sel.add(c.dataset.k) : st.sel.delete(c.dataset.k);
        updateGroupChecks();
      };
    });
    sr.querySelectorAll('.group-all').forEach(cb => {
      cb.onchange = () => {
        const grp = cb.dataset.group;
        const list = sr.querySelector(`[data-group-list="${grp}"]`);
        list.querySelectorAll('[data-k]').forEach(c => {
          c.checked = cb.checked;
          cb.checked ? st.sel.add(c.dataset.k) : st.sel.delete(c.dataset.k);
        });
      };
    });
    sr.querySelectorAll('[data-m]').forEach(btn => {
      btn.onclick = ev => {
        ev.stopPropagation();
        sr.querySelectorAll('[data-pop]').forEach(p => p.hidden = true);
        const pop = sr.querySelector(`[data-pop="${btn.dataset.m}"]`);
        if (pop) pop.hidden = !pop.hidden;
      };
    });
    document.addEventListener('click', () => { sr.querySelectorAll('[data-pop]').forEach(p => p.hidden = true); });
    sr.querySelectorAll('[data-act]').forEach(b => {
      b.onclick = async ev => {
        ev.stopPropagation();
        const k = b.dataset.id, s = stLocal.by.get(k);
        const act = b.dataset.act;
        if (act === 'read'){
          const qs = new URLSearchParams({
            n: s.name || '', s: s.sector, b: s.blk, d: s.bld, a: s.apt,
            v: s.value, r: stLocal.adv.get(k) || 0, q: due(s), c: s.count, m: st.cycle, u: st.who, k
          }).toString();
          openPage('reading.html', qs);
          sr.querySelectorAll('[data-pop]').forEach(p => p.hidden = true);
        }
        if (act === 'name'){
          const n = prompt('اسم العميل', s?.name || '');
          if (n && n.trim()){
            await saveManual(k, n.trim());
            await loadData();
            draw();
          }
        }
        if (act === 'partial'){
          const maxCount = s.count || 1;
          const count = +(prompt(`عدد الفواتير (الحد الأقصى ${maxCount})`) || 0);
          if (!(count > 0) || count > maxCount) { toast('عدد غير صحيح'); return; }
          const amount = +(prompt(`القيمة المسددة (الحد الأقصى ${money(s.value)})`) || 0);
          if (!(amount > 0) || amount > s.value) { toast('قيمة غير صحيحة'); return; }
          if (count === maxCount || amount === s.value){
            if (!confirm('هذا سداد كلي. موافق؟')) return;
            await pay(st.no, [s], st.adv);
          } else {
            await partialPay(st.no, s, {count, amount}, st.adv);
          }
          await loadData();
          draw();
          toast('تم السداد');
        }
      };
    });
    sr.querySelectorAll('[data-p]').forEach(btn => {
      btn.onclick = async ev => {
        ev.stopPropagation();
        const k = btn.dataset.p, s = stLocal.by.get(k), amt = due(s);
        if (!amt){ toast('لا يوجد مبلغ مستحق'); return; }
        if (!confirm(`تأكيد سداد شقة ${s.apt} — ${s.name || 'بدون اسم'} بمبلغ ${money(amt)}؟`)) return;
        await pay(st.no, [s], st.adv);
        await loadData();
        draw();
        toast(`تم سداد شقة ${s.apt}`);
      };
    });
    updateGroupChecks();
  };

  const updateGroupChecks = () => {
    sr.querySelectorAll('[data-group-list]').forEach(list => {
      const grp = list.dataset.groupList;
      const cbs = list.querySelectorAll('[data-k]');
      const all = cbs.length > 0 && [...cbs].every(c => c.checked);
      const parent = sr.querySelector(`.group-all[data-group="${grp}"]`);
      if (parent) parent.checked = all;
    });
  };

  const draw = () => {
    if (mode === 'number'){
      const sec = el.querySelector('#numSec').value.trim();
      const blk = el.querySelector('#numBlk').value.trim();
      const bld = el.querySelector('#numBld').value.trim();
      const apt = el.querySelector('#numApt').value.trim();
      if (!sec || !blk || !bld){ sr.innerHTML = ''; return; }
      const rows = stLocal.S.filter(s => !stLocal.paid.has(key(s)) && s.sector === sec && s.blk === blk && s.bld === bld && (!apt || s.apt === apt));
      if (!rows.length){ sr.innerHTML = '<div class="card empty">لا يوجد عملاء بهذا العنوان.</div>'; return; }
      sr.innerHTML = drawBuildingGroup(rows, `عمارة ${bld} · قطاع ${sec} · بلوك ${blk}`);
      bindResults();
      return;
    }

    const ws = fz(q).split(' ').filter(Boolean);
    if (!ws.length){ sr.innerHTML = ''; return; }
    const m = stLocal.S.filter(s => !stLocal.paid.has(key(s)) && (scope === 'all' || s.inRoute) && ws.every(w => fz(s.name || '').includes(w)));
    if (!m.length){ sr.innerHTML = '<div class="card empty">لا نتائج.</div>'; return; }
    
    // إزالة التكرار حسب الاسم
    const seen = new Set();
    const uniq = [];
    for (const s of m){
      const n = String(s.name || '').trim();
      if (!n || seen.has(n)) continue;
      seen.add(n);
      uniq.push(s);
      if (uniq.length >= 50) break;
    }
    
    sr.innerHTML = `<div class="card" style="margin-bottom:.6rem"><b>نتائج البحث (${uniq.length} اسم)</b></div>` +
      uniq.map(s => {
        const k = key(s);
        const b = stLocal.adv.get(k) || 0;
        return `<div class="card" style="margin-bottom:.6rem" data-open="${k}">
          <div class="apt-top">
            <div class="apt-name" style="cursor:pointer">${esc(s.name || 'بدون اسم')}</div>
            <div class="apt-val">${money(due(s))}</div>
          </div>
          <div class="apt-bottom">
            <div class="apt-apt">${s.apt}</div>
            <div class="apt-meta">عمارة ${s.bld} · قطاع ${s.sector} · بلوك ${s.blk}${b ? ' · مقدم ' + money(b) : ''}</div>
          </div>
        </div>`;
      }).join('');
    
    sr.querySelectorAll('[data-open]').forEach(card => {
      card.onclick = () => {
        const k = card.dataset.open;
        const s = stLocal.by.get(k);
        if (s){
          const bldRows = stLocal.S.filter(x => !stLocal.paid.has(key(x)) && x.sector === s.sector && x.blk === s.blk && x.bld === s.bld);
          sr.innerHTML = `<div class="card" style="margin-bottom:.6rem"><button class="btn ghost sm" id="backToSearch">→ رجوع للبحث</button></div>` +
            drawBuildingGroup(bldRows.sort((p1,p2) => Number(p1.apt)-Number(p2.apt)), `عمارة ${s.bld} · قطاع ${s.sector} · بلوك ${s.blk}`);
          sr.querySelector('#backToSearch').onclick = () => draw();
          bindResults();
        }
      };
    });
  };

  el.querySelector('#modeName').onclick = () => { mode = 'name'; renderSearch(el); };
  el.querySelector('#modeNumber').onclick = () => { mode = 'number'; renderSearch(el); };

  if (mode === 'name'){
    const qInput = el.querySelector('#q');
    let drawTimer = null;
    qInput.addEventListener('input', e => {
      q = e.target.value;
      clearTimeout(drawTimer);
      drawTimer = setTimeout(draw, 250);
    });
    el.querySelectorAll('[name=sc]').forEach(r => r.onchange = () => { scope = r.value; draw(); });
  } else {
    ['numSec', 'numBlk', 'numBld', 'numApt'].forEach(id => {
      const inp = el.querySelector('#' + id);
      inp.addEventListener('input', () => {
        const v = String(inp.value || '').replace(/\D/g, '').slice(0, 2);
        if (inp.value !== v) inp.value = v;
        if (v.length === 2 && inp.dataset.next){
          const n = el.querySelector('#' + inp.dataset.next);
          if (n) n.focus();
        }
        clearTimeout(drawTimer);
        drawTimer = setTimeout(draw, 200);
      });
    });
    el.querySelector('#numGo').onclick = draw;
  }

  draw();
}
