import {st, esc, refresh, renderBuilding} from './browse.js';
import {keyOf as key} from './ledger.js';
import {searchKey} from '../core/normalize.js';
import {money} from '../core/utils.js';

let q = '', scope = 'route', mode = 'name';

const fz = s => searchKey(s).replace(/[خج]/g, 'ح').replace(/ذ/g, 'د');

export async function renderSearch(el) {
  document.getElementById('back').hidden = true;
  await refresh();

  el.innerHTML = `
    <div class="card">
      <div class="tools" style="margin-bottom:1rem">
        <button class="btn ${mode === 'name' ? 'primary' : 'ghost'} sm" id="modeName">بحث بالاسم</button>
        <button class="btn ${mode === 'number' ? 'primary' : 'ghost'} sm" id="modeNumber">بحث برقم المشترك</button>
      </div>
      <div id="searchName" ${mode !== 'name' ? 'hidden' : ''}>
        <input id="q" class="srch" placeholder="اكتب اسم العميل…" value="${esc(q)}" autocomplete="off" style="color:var(--ink);background:var(--s1)">
        <div class="tools" style="margin-top:.5rem">
          <label class="chk"><input type="radio" name="sc" value="route" ${scope === 'route' ? 'checked' : ''}> خط سيري فقط</label>
          <label class="chk"><input type="radio" name="sc" value="all" ${scope === 'all' ? 'checked' : ''}> الملف كاملاً</label>
        </div>
      </div>
      <div id="searchNumber" ${mode !== 'number' ? 'hidden' : ''}>
        <div class="pick">
          <label class="field"><span>القطاع</span><input id="numSec" class="num2" type="text" inputmode="numeric" maxlength="2" placeholder="—"></label>
          <label class="field"><span>البلوك</span><input id="numBlk" class="num2" type="text" inputmode="numeric" maxlength="2" placeholder="—"></label>
          <label class="field"><span>العمارة</span><input id="numBld" class="num2" type="text" inputmode="numeric" maxlength="2" placeholder="—"></label>
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
      if (!sec || !blk || !bld) { sr.innerHTML = ''; return; }
      const rows = st.S.filter(s => s.sector === sec && s.blk === blk && s.bld === bld);
      if (!rows.length) { sr.innerHTML = '<div class="card empty">لا يوجد عملاء بهذا العنوان.</div>'; return; }
      sr.innerHTML = `<div class="card"><h2>عملاء العمارة ${bld}</h2><div class="apt-list">` +
        rows.map(s => `<div class="apt-card" data-open="${key(s)}">
          <div class="apt-top"><div class="apt-name">${esc(s.name || 'بدون اسم')}</div><div class="apt-val">${money(s.value || 0)}</div></div>
          <div class="apt-bottom"><div class="apt-apt">${s.apt}</div><div class="apt-meta">${s.count} فاتورة</div></div>
        </div>`).join('') + '</div></div>';
      sr.querySelectorAll('[data-open]').forEach(b => {
        b.onclick = () => {
          const s = st.by.get(b.dataset.open);
          if (s) {
            st.sector = s.sector; st.blk = s.blk; st.open = s.bld; st.bld = s.bld;
            st.sel.clear();
            history.pushState({v: 'bld'}, '');
            document.querySelectorAll('#tabs button').forEach(btn => btn.classList.remove('on'));
            const ev = new CustomEvent('openTab', {detail: {tab: 'home'}});
            window.dispatchEvent(ev);
            setTimeout(() => window.scrollTo({top: 0, behavior: 'smooth'}), 50);
          }
        };
      });
      return;
    }

    const ws = fz(q).split(' ').filter(Boolean);
    if (!ws.length) { sr.innerHTML = ''; return; }
    const m = st.S.filter(s => !st.paid.has(key(s)) && (scope === 'all' || s.inRoute) && ws.every(w => fz(s.name || '').includes(w)));
    const g = {};
    m.forEach(s => (g[`${s.sector}|${s.blk}|${s.bld}`] ??= []).push(s));
    sr.innerHTML = Object.entries(g).slice(0, 40).map(([k, a]) => {
      const [x, b, d] = k.split('|');
      return `<button class="brow srow" data-g="${k}"><b>قطاع ${x} · بلوك ${b} · عمارة ${d}</b><span>${a.slice(0, 3).map(s => esc(s.name)).join('، ')}${a.length > 3 ? ` +${a.length - 3}` : ''}</span><span>${a[0].inRoute ? '' : '<em class="tag">خارج خط سيري</em>'}</span><strong>${money(a.reduce((t, s) => t + s.value, 0))}</strong></button>`;
    }).join('') || '<div class="card empty">لا نتائج.</div>';
    sr.querySelectorAll('[data-g]').forEach(b => {
      b.onclick = () => {
        const [x, bl, d] = b.dataset.g.split('|');
        st.sector = x; st.blk = bl; st.bld = d; st.open = d; st.all = scope === 'all';
        st.sel.clear();
        history.pushState({v: 'bld'}, '');
        const ev = new CustomEvent('openTab', {detail: {tab: 'home'}});
        window.dispatchEvent(ev);
        setTimeout(() => window.scrollTo({top: 0, behavior: 'smooth'}), 50);
      };
    });
  };

  el.querySelector('#modeName').onclick = () => { mode = 'name'; renderSearch(el); };
  el.querySelector('#modeNumber').onclick = () => { mode = 'number'; renderSearch(el); };

  if (mode === 'name') {
    el.querySelector('#q').oninput = e => { q = e.target.value; draw(); };
    el.querySelectorAll('[name=sc]').forEach(r => r.onchange = () => { scope = r.value; draw(); });
  } else {
    ['numSec', 'numBlk', 'numBld'].forEach(id => {
      el.querySelector('#' + id).oninput = () => draw();
    });
  }

  draw();
}