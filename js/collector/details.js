import {get, all} from '../core/db.js';
import {personalCards} from './personal.js';
import {money} from '../core/utils.js';
import {list, ldate, keyOf as key} from './ledger.js';
import {st, esc, work, refresh, setFilter, clearFilter, toast} from './browse.js';
import {monthsFor} from './monthly.js';

const grp = (a,f)=>a.reduce((m,x)=>{ (m[f(x)]=m[f(x)]||[]).push(x); return m; }, {});
const sum = a=>a.reduce((s,x)=>s+x.amount, 0);
const tbl = (h,r)=>`<div class="wrap"><table><tr>${h.map(x=>`<th>${x}</th>`).join('')}</tr>${r.map(c=>'<tr>'+c.map(x=>`<td>${x}</td>`).join('')+'</tr>').join('')}</table></div>`;
const who = e=>{ const s = st.by.get(e.key)||{}; return `${esc(s.name||'بدون اسم')} (${s.sector||''}-${s.blk||''}-${s.bld||''}-${s.apt||''})`; };
const kind = e=>e.type==='advance'?'مقدم':(e.personal?'شخصي':(e.partial?'جزئي':'سداد'));

/* ============================================================
   صفحة الأرشيف
   ============================================================ */
export async function renderArchive(el){
  await refresh();
  const e = await list();
  const days = grp(e, x=>ldate(x.time));
  const mons = grp(e, x=>ldate(x.time).slice(0,7));

  const d = Object.keys(days).sort().reverse().map(k=>`
    <details>
      <summary>${k} · ${days[k].length} عملية · <b>${money(sum(days[k]))}</b></summary>
      ${tbl(['المشترك','النوع','المبلغ',''],
        days[k].map(x=>[
          who(x),
          kind(x),
          money(x.amount),
          x.type==='pay'?`<button class="lnk" data-pd="${x.id}" type="button">تفاصيل</button>`:''
        ]))}
    </details>
  `).join('') || '<p class="mute">لا يوجد.</p>';

  const m = Object.keys(mons).sort().reverse().map(k=>{
    const dd = grp(mons[k], x=>ldate(x.time));
    return `<details>
      <summary>${k} · ${Object.keys(dd).length} يوم · <b>${money(sum(mons[k]))}</b></summary>
      ${tbl(['اليوم','العمليات','المجموع'],
        Object.keys(dd).sort().map(x=>[x, dd[x].length, money(sum(dd[x]))]))}
    </details>`;
  }).join('') || '<p class="mute">لا يوجد.</p>';

  el.innerHTML = `
    <div class="card"><h2>الأرشيف اليومي</h2>${d}</div>
    <div class="card"><h2>الأرشيف الشهري</h2>${m}</div>
  `;

  await personalCards(el, e, ()=>renderArchive(el));
}

/* ============================================================
   أرشيف الشهور
   ============================================================ */
export async function renderMonthlyArchive(el){
  await refresh();
  const allSubs = st.S.filter(s=>(s.value || 0) > 0 && (s.count || 0) > 1);
  const rows = [];
  for (const s of allSubs.slice(0, 200)){
    const inv = await monthsFor(s);
    if (inv && inv.length){
      rows.push([
        esc(s.name || 'بدون اسم'),
        s.sector + '-' + s.blk + '-' + s.bld + '-' + s.apt,
        money(s.value),
        s.count,
        inv.map(i=>`${i.month || '?'}: ${money(i.amount)}`).join(' · ')
      ]);
    } else {
      rows.push([
        esc(s.name || 'بدون اسم'),
        s.sector + '-' + s.blk + '-' + s.bld + '-' + s.apt,
        money(s.value),
        s.count,
        '<em class="mute">لا شهور مسجلة</em>'
      ]);
    }
  }
  el.innerHTML = `<div class="card">
    <h2>أرشيف الشهور — العملاء ذوو المديونيات المتعددة</h2>
    <p class="mute">هذه القائمة تعرض العملاء الذين لديهم أكثر من فاتورة، مع محاولة استخراج الشهور من السجلات القديمة.</p>
    ${rows.length ? tbl(['العميل','العنوان','القيمة','العدد','الشهور المتاحة'], rows) : '<p class="mute">لا يوجد.</p>'}
    <div class="actions" style="margin-top:1rem">
      <button class="btn ghost" id="backDetails" type="button">رجوع للتفاصيل</button>
    </div>
  </div>`;
  el.querySelector('#backDetails').onclick = ()=>renderDetails(el, ()=>{ history.back(); });
}

/* ============================================================
   صفحة التفاصيل
   ============================================================ */
export async function renderDetails(el, goHome){
  await refresh();
  const f = await get('meta','file');
  const rt = (f && f.routes) || [];
  const e = await list();
  const mon = ldate(new Date()).slice(0,7);
  const cur = e.filter(x=>ldate(x.time).slice(0,7)===mon);
  const secs = [...new Set(rt.map(r=>r.sector))].sort();
  const sec = k=>k.split('|')[1];

  /* ===== 1) خط السير ===== */
  let routesHtml = '<div class="routes-block">';
  if (!rt.length){
    routesHtml += '<p class="mute">لا يوجد خط سير.</p>';
  } else {
    secs.forEach(s=>{
      const rs = rt.filter(r=>r.sector===s);
      const debt = st.S.filter(x=>x.inRoute && x.sector===s).reduce((t,x)=>t+x.value, 0);
      const iss = rs.reduce((t,r)=>t+(r.issuance||0), 0);
      routesHtml += `<div class="route-sec">
        <div class="route-title">القطاع ${s}</div>`;
      rs.forEach(r=>{
        routesHtml += `<div class="route-row"><span class="route-lbl">من</span><span>بلوك ${r.from[0]} · عمارة ${r.from[1]} · شقة ${r.from[2]}</span></div>
        <div class="route-row"><span class="route-lbl">إلى</span><span>بلوك ${r.to[0]} · عمارة ${r.to[1]} · شقة ${r.to[2]}</span></div>`;
      });
      routesHtml += `<div class="route-bal"><span>رصيد القطاع</span><b>${money(Math.max(0, debt - iss))} ج</b></div></div>`;
    });
  }
  routesHtml += '</div>';

  /* ===== 2) الجداول العلوية والسفلية ===== */
  const topRows = secs.map(s=>{
    const debt = st.S.filter(x=>x.inRoute && x.sector===s).reduce((t,x)=>t+x.value, 0);
    const iss = rt.filter(r=>r.sector===s).reduce((t,r)=>t+(r.issuance||0), 0);
    const tg = rt.filter(r=>r.sector===s).reduce((t,r)=>t+(r.target||0), 0);
    return [s, money(debt), iss?money(iss):'—', tg?money(tg):'—'];
  });

  const bottomRows = secs.map(s=>{
    const debt = st.S.filter(x=>x.inRoute && x.sector===s).reduce((t,x)=>t+x.value, 0);
    const iss = rt.filter(r=>r.sector===s).reduce((t,r)=>t+(r.issuance||0), 0);
    const tg = rt.filter(r=>r.sector===s).reduce((t,r)=>t+(r.target||0), 0);
    const c = sum(cur.filter(x=>sec(x.key)===s));
    return [
      money(c),
      iss?money(Math.max(0, iss-c)):'—',
      tg?money(Math.max(0, tg-c)):'—',
      money(Math.max(0, debt-c))
    ];
  });

  /* ===== 3) بناء بيانات "المتبقي في الموقع" ===== */
  // g[sector] = { blks: { [blk]: { value, blds: { [bld]: { value, apts: [{apt,value,name}] } } } } }
  const g = {};
  work().forEach(s=>{
    const sec2 = s.sector, b = s.blk, d = s.bld, apt = s.apt, v = s.value || 0;
    g[sec2] = g[sec2] || { total: 0, blks: {} };
    g[sec2].total += v;
    g[sec2].blks[b] = g[sec2].blks[b] || { value: 0, blds: {} };
    g[sec2].blks[b].value += v;
    g[sec2].blks[b].blds[d] = g[sec2].blks[b].blds[d] || { value: 0, apts: [] };
    g[sec2].blks[b].blds[d].value += v;
    g[sec2].blks[b].blds[d].apts.push({ apt, value: v, name: s.name || '' });
  });

  /* ===== 4) الجداول المفقودة (oor + os) ===== */
  const oor = e.filter(x=>x.out && x.type==='pay');
  const os = await all('otherSource');

  /* ===== 5) بناء HTML الرئيسي ===== */
  el.innerHTML = `
    ${routesHtml}

    <div class="card">
      <h2>الملخص — الجزء العلوي</h2>
      ${tbl(['القطاع','المديونية','الإصدار','المستهدف'], topRows)}
    </div>

    <div class="card">
      <h2>الملخص — الجزء السفلي</h2>
      ${tbl(['ما تم تحصيله','المتبقي من الإصدار','المتبقي من المستهدف','المتبقي من المديونية'], bottomRows)}
    </div>

    <div class="card" id="siteCard">
      <h2>المتبقي في الموقع</h2>
      <div class="site-header">
        <select id="siteLevel">
          <option value="sector">القطاعات</option>
          <option value="blk">البلوكات</option>
          <option value="bld">العمارات</option>
          <option value="apt">الشقق</option>
        </select>
        <div class="sort-btns">
          <button class="btn ghost sm" id="sortAsc" type="button">تصاعدي ↑</button>
          <button class="btn ghost sm" id="sortDesc" type="button">تنازلي ↓</button>
        </div>
      </div>
      <div class="site-body" id="siteBody"></div>
    </div>

    <div class="card">
      <h2>تمييز الشقق والبلوكات والعمارات</h2>
      <p class="mute">حدد قيمة لكل مستوى. سيتم تلوين العناصر التي تساوي أو تتجاوز القيمة في صفحة التحصيل.</p>
      <div class="hl-panel">
        <div class="hl-row apt">
          <label>الشقق المميزة ≥</label>
          <input id="hlApt" class="num2" type="text" inputmode="numeric" placeholder="0" value="${(st.filter && st.filter.kind==='apt') ? st.filter.value : ''}">
          <button class="btn sm" data-hl="apt" type="button">تطبيق</button>
          <button class="btn ghost sm" data-hlc="apt" type="button">خروج</button>
        </div>
        <div class="hl-row bld">
          <label>العمارات المميزة ≥</label>
          <input id="hlBld" class="num2" type="text" inputmode="numeric" placeholder="0" value="${(st.filter && st.filter.kind==='bld') ? st.filter.value : ''}">
          <button class="btn sm" data-hl="bld" type="button">تطبيق</button>
          <button class="btn ghost sm" data-hlc="bld" type="button">خروج</button>
        </div>
        <div class="hl-row blk">
          <label>البلوكات المميزة ≥</label>
          <input id="hlBlk" class="num2" type="text" inputmode="numeric" placeholder="0" value="${(st.filter && st.filter.kind==='blk') ? st.filter.value : ''}">
          <button class="btn sm" data-hl="blk" type="button">تطبيق</button>
          <button class="btn ghost sm" data-hlc="blk" type="button">خروج</button>
        </div>
      </div>
    </div>

    <div class="card">
      <h2>تسديدات خارج النطاق</h2>
      ${oor.length
        ? tbl(['العميل','المبلغ','التاريخ'], oor.map(x=>[who(x), money(x.amount), ldate(x.time)]))
        : '<p class="mute">لا يوجد.</p>'}
    </div>

    <div class="card">
      <h2>سداد من مصدر آخر</h2>
      ${os.length
        ? tbl(['العميل','المبلغ','التاريخ','كامل؟'], os.map(x=>[esc(x.name||'بدون اسم'), money(x.amount), x.date, x.full?'نعم':'جزئي']))
        : '<p class="mute">لا يوجد.</p>'}
    </div>

    <div class="card">
      <div class="actions">
        <button class="btn ghost" id="monthlyArc" type="button">أرشيف الشهور</button>
      </div>
    </div>
  `;

  /* ===== 6) رسم "المتبقي في الموقع" ===== */
  let siteLevel = 'sector';
  let sortDir = 'asc';
  let openSec = null;
  let openBlk = null;
  let openBld = null;

  const cmpNum = (v, op, x)=>{
    if (op === 'gte') return v >= x;
    if (op === 'lte') return v <= x;
    return v === x;
  };

  function drawSite(){
    const body = el.querySelector('#siteBody');
    let html = '';

    if (siteLevel === 'sector'){
      // عرض القطاعات
      const secList = Object.keys(g).sort((a,b)=>Number(a)-Number(b));
      secList.forEach(sec=>{
        const val = g[sec].total;
        const isOpen = openSec === sec;
        const hi = st.filter && st.filter.kind === 'sector' && st.filter.matches.has('sector:' + sec);
        html += `<div class="site-sec">
          <div class="site-sec-title" data-open-sec="${sec}">
            <span>القطاع ${sec} ${hi?'🎯':''}</span>
            <span class="total">${money(val)}</span>
          </div>`;
        if (isOpen){
          html += '<div class="site-sec-body">';
          const blks = Object.keys(g[sec].blks).sort((a,b)=>Number(a)-Number(b));
          blks.forEach(blk=>{
            const bv = g[sec].blks[blk].value;
            html += `<div class="site-row">
              <span class="lbl">بلوك ${blk}</span>
              <span class="val">${money(bv)}</span>
              <button class="open" data-open-blk="${sec}|${blk}" type="button">فتح</button>
            </div>`;
          });
          html += '</div>';
        }
        html += '</div>';
      });
    }

    else if (siteLevel === 'blk'){
      // عرض البلوكات لكل قطاع منفصل
      const secList = Object.keys(g).sort((a,b)=>Number(a)-Number(b));
      secList.forEach(sec=>{
        const blks = Object.keys(g[sec].blks);
        if (!blks.length) return;
        html += `<div class="site-sec">
          <div class="site-sec-title"><span>القطاع ${sec}</span><span class="total">${money(g[sec].total)}</span></div>
          <div class="site-sec-body">`;
        const arr = blks.map(b=>({ b, v: g[sec].blks[b].value }));
        arr.sort((x,y)=> sortDir==='asc' ? x.v - y.v : y.v - x.v);
        arr.forEach(({b, v})=>{
          const isOpen = openBlk === sec + '|' + b;
          const hi = st.filter && st.filter.kind === 'blk' && st.filter.matches.has('blk:' + sec + '|' + b);
          html += `<div class="site-row ${hi?'hi-blk':''}">
            <span class="lbl">بلوك ${b} ${hi?'🎯':''}</span>
            <span class="val">${money(v)}</span>
            <button class="open" data-open-blk="${sec}|${b}" type="button">فتح</button>
          </div>`;
        });
        html += '</div></div>';
      });
    }

    else if (siteLevel === 'bld'){
      // عرض العمارات داخل كل بلوك (مفتوح فقط)
      if (!openBlk){
        // عرض البلوكات أولاً للاختيار
        const secList = Object.keys(g).sort((a,b)=>Number(a)-Number(b));
        secList.forEach(sec=>{
          const blks = Object.keys(g[sec].blks);
          if (!blks.length) return;
          html += `<div class="site-sec">
            <div class="site-sec-title"><span>القطاع ${sec}</span><span class="total">${money(g[sec].total)}</span></div>
            <div class="site-sec-body">`;
          blks.forEach(b=>{
            html += `<div class="site-row">
              <span class="lbl">بلوك ${b}</span>
              <span class="val">${money(g[sec].blks[b].value)}</span>
              <button class="open" data-open-blk="${sec}|${b}" type="button">فتح</button>
            </div>`;
          });
          html += '</div></div>';
        });
      } else {
        // عرض عمارات البلوك المفتوح فقط
        const [sec, blk] = openBlk.split('|');
        if (g[sec] && g[sec].blks[blk]){
          const blds = g[sec].blks[blk].blds;
          const arr = Object.keys(blds).map(b=>({ b, v: blds[b].value }));
          arr.sort((x,y)=> sortDir==='asc' ? x.v - y.v : y.v - x.v);
          html += `<div class="site-sec">
            <div class="site-sec-title" data-close-blk="1">
              <span>◀ رجوع — قطاع ${sec} · بلوك ${blk}</span>
              <span class="total">${money(g[sec].blks[blk].value)}</span>
            </div>
            <div class="site-sec-body">`;
          arr.forEach(({b, v})=>{
            const hi = st.filter && st.filter.kind === 'bld' && st.filter.matches.has('bld:' + sec + '|' + blk + '|' + b);
            html += `<div class="site-row ${hi?'hi-bld':''}">
              <span class="lbl">عمارة ${b} ${hi?'🎯':''}</span>
              <span class="val">${money(v)}</span>
              <button class="open" data-open-bld="${sec}|${blk}|${b}" type="button">فتح</button>
            </div>`;
          });
          html += '</div></div>';
        }
      }
    }

    else if (siteLevel === 'apt'){
      // عرض الشقق داخل العمارة المفتوحة فقط
      if (!openBld){
        html = '<p class="mute">اختر عمارة من المستوى السابق لعرض شققها.</p>';
      } else {
        const [sec, blk, bld] = openBld.split('|');
        if (g[sec] && g[sec].blks[blk] && g[sec].blks[blk].blds[bld]){
          const apts = g[sec].blks[blk].blds[bld].apts.slice();
          apts.sort((x,y)=> sortDir==='asc' ? x.value - y.value : y.value - x.value);
          html += `<div class="site-sec">
            <div class="site-sec-title" data-close-bld="1">
              <span>◀ رجوع — قطاع ${sec} · بلوك ${blk} · عمارة ${bld}</span>
              <span class="total">${money(g[sec].blks[blk].blds[bld].value)}</span>
            </div>
            <div class="site-sec-body">`;
          apts.forEach(a=>{
            html += `<div class="site-row">
              <span class="lbl">شقة ${a.apt}${a.name ? ' · ' + esc(a.name) : ''}</span>
              <span class="val">${money(a.value)}</span>
              <span></span>
            </div>`;
          });
          html += '</div></div>';
        }
      }
    }

    body.innerHTML = html || '<p class="mute">لا يوجد متبقٍ.</p>';

    // ربط أحداث
    body.querySelectorAll('[data-open-sec]').forEach(x=>{
      x.onclick = ()=>{ openSec = openSec===x.dataset.openSec ? null : x.dataset.openSec; drawSite(); };
    });
    body.querySelectorAll('[data-open-blk]').forEach(x=>{
      x.onclick = ()=>{
        const p = x.dataset.openBlk;
        openBlk = openBlk===p ? null : p;
        if (siteLevel === 'blk') siteLevel = 'bld';
        drawSite();
      };
    });
    body.querySelectorAll('[data-close-blk]').forEach(x=>{
      x.onclick = ()=>{ openBlk = null; drawSite(); };
    });
    body.querySelectorAll('[data-open-bld]').forEach(x=>{
      x.onclick = ()=>{ openBld = openBld===x.dataset.openBld ? null : x.dataset.openBld; siteLevel = 'apt'; drawSite(); };
    });
    body.querySelectorAll('[data-close-bld]').forEach(x=>{
      x.onclick = ()=>{ openBld = null; siteLevel = 'bld'; drawSite(); };
    });
  }

  el.querySelector('#siteLevel').onchange = e=>{ siteLevel = e.target.value; openSec = null; openBlk = null; openBld = null; drawSite(); };
  el.querySelector('#sortAsc').onclick = ()=>{ sortDir = 'asc'; drawSite(); };
  el.querySelector('#sortDesc').onclick = ()=>{ sortDir = 'desc'; drawSite(); };

  drawSite();

  /* ===== 7) تطبيق التمييز ===== */
  const applyHl = (kind)=>{
    const input = el.querySelector(kind==='apt' ? '#hlApt' : kind==='bld' ? '#hlBld' : '#hlBlk');
    const val = +String(input.value || '0').replace(/[٠-٩]/g, d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d));
    if (!(val > 0)){ toast('أدخل قيمة صحيحة'); return; }
    const matches = new Set();
    if (kind === 'apt'){
      work().forEach(s=>{ if ((s.value||0) >= val) matches.add('apt:' + key(s)); });
    } else if (kind === 'bld'){
      const grpB = {};
      work().forEach(s=>{
        const k = s.sector + '|' + s.blk + '|' + s.bld;
        grpB[k] = (grpB[k]||0) + (s.value||0);
      });
      Object.keys(grpB).forEach(k=>{ if (grpB[k] >= val) matches.add('bld:' + k); });
    } else if (kind === 'blk'){
      const grpB = {};
      work().forEach(s=>{
        const k = s.sector + '|' + s.blk;
        grpB[k] = (grpB[k]||0) + (s.value||0);
      });
      Object.keys(grpB).forEach(k=>{ if (grpB[k] >= val) matches.add('blk:' + k); });
    }
    setFilter({ kind, op:'gte', value: val, matches });
    toast('تم التطبيق — انتقل لصفحة التحصيل لرؤية التمييز');
    goHome();
  };

  el.querySelectorAll('[data-hl]').forEach(b=>{
    b.onclick = ()=>applyHl(b.dataset.hl);
  });
  el.querySelectorAll('[data-hlc]').forEach(b=>{
    b.onclick = ()=>{
      const kind = b.dataset.hlc;
      const input = el.querySelector(kind==='apt' ? '#hlApt' : kind==='bld' ? '#hlBld' : '#hlBlk');
      if (input) input.value = '';
      if (st.filter && st.filter.kind === kind) clearFilter();
      toast('تم إلغاء تمييز هذا المستوى');
    };
  });

  el.querySelector('#monthlyArc').onclick = ()=>renderMonthlyArchive(el);
}