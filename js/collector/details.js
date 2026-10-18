import {get,all} from '../core/db.js';
import {personalCards} from './personal.js';
import {money} from '../core/utils.js';
import {list,ldate,keyOf as key} from './ledger.js';
import {st,esc,work,refresh,setFilter,clearFilter,toast} from './browse.js';
import {monthsFor} from './monthly.js';

const grp = (a,f)=>a.reduce((m,x)=>{ (m[f(x)]=m[f(x)]||[]).push(x); return m; }, {});
const sum = a=>a.reduce((s,x)=>s+x.amount, 0);
const tbl = (h,r)=>`<div class="wrap"><table><tr>${h.map(x=>`<th>${x}</th>`).join('')}</tr>${r.map(c=>'<tr>'+c.map(x=>`<td>${x}</td>`).join('')+'</tr>').join('')}</table></div>`;
const who = e=>{ const s = st.by.get(e.key)||{}; return `${esc(s.name||'بدون اسم')} (${s.sector||''}-${s.blk||''}-${s.bld||''}-${s.apt||''})`; };
const kind = e=>e.type==='advance'?'مقدم':(e.personal?'شخصي':(e.partial?'جزئي':'سداد'));

export async function renderArchive(el){
  await refresh();
  const e = await list();
  const days = grp(e, x=>ldate(x.time));
  const mons = grp(e, x=>ldate(x.time).slice(0,7));
  const d = Object.keys(days).sort().reverse().map(k=>`<details><summary>${k} · ${days[k].length} عملية · <b>${money(sum(days[k]))}</b></summary>${tbl(['المشترك','النوع','المبلغ',''], days[k].map(x=>[who(x),kind(x),money(x.amount),x.type==='pay'?`<button class="lnk" data-pd="${x.id}">تفاصيل</button>`:'']))}</details>`).join('')||'<p class="mute">لا يوجد.</p>';
  const m = Object.keys(mons).sort().reverse().map(k=>{ const dd = grp(mons[k], x=>ldate(x.time)); return `<details><summary>${k} · ${Object.keys(dd).length} يوم · <b>${money(sum(mons[k]))}</b></summary>${tbl(['اليوم','العمليات','المجموع'], Object.keys(dd).sort().map(x=>[x,dd[x].length,money(sum(dd[x]))]))}</details>`; }).join('')||'<p class="mute">لا يوجد.</p>';
  el.innerHTML = `${d}${m}`;
  await personalCards(el, e, ()=>renderArchive(el));
}

export async function renderMonthlyArchive(el){
  await refresh();
  const allSubs = st.S.filter(s=>(s.value || 0) > 0 && (s.count || 0) > 1);
  const rows = [];
  for (const s of allSubs.slice(0, 200)){
    const inv = await monthsFor(s);
    if (inv && inv.length){
      rows.push([esc(s.name || 'بدون اسم'), s.sector + '-' + s.blk + '-' + s.bld + '-' + s.apt, money(s.value), s.count, inv.map(i=>`${i.month || '?'}: ${money(i.amount)}`).join(' · ')]);
    } else {
      rows.push([esc(s.name || 'بدون اسم'), s.sector + '-' + s.blk + '-' + s.bld + '-' + s.apt, money(s.value), s.count, '<em class="mute">لا شهور مسجلة</em>']);
    }
  }
  el.innerHTML = `<div class="wrap"><h2>أرشيف الشهور</h2>
    ${rows.length ? tbl(['العميل','العنوان','القيمة','العدد','الشهور'], rows) : '<p class="mute">لا يوجد.</p>'}
    <div class="actions" style="margin-top:1rem"><button class="btn ghost" id="backDetails">رجوع</button></div>
  </div>`;
  el.querySelector('#backDetails').onclick = ()=>renderDetails(el, ()=>show('home'));
}

/* ====== صفحة التفاصيل ====== */
export async function renderDetails(el, goHome){
  await refresh();
  const f = await get('meta','file');
  const rt = (f && f.routes) || [];
  const e = await list();
  const mon = ldate(new Date()).slice(0,7);
  const cur = e.filter(x=>ldate(x.time).slice(0,7)===mon);
  const secs = [...new Set(rt.map(r=>r.sector))].sort();
  const sec = k=>k.split('|')[1];

  /* ====== أعلى الصفحة: خط السير ====== */
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
      routesHtml += `<div class="route-bal">رصيد القطاع: <b>${money(Math.max(0, debt - iss))}</b> جنيه</div></div>`;
    });
  }
  routesHtml += '</div>';

  /* ====== الجدول العلوي: القطاع / المديونية / الإصدار / المستهدف ====== */
  const top = secs.map(s=>{
    const debt = st.S.filter(x=>x.inRoute && x.sector===s).reduce((t,x)=>t+x.value, 0);
    const iss = rt.filter(r=>r.sector===s).reduce((t,r)=>t+(r.issuance||0), 0);
    const tg = rt.filter(r=>r.sector===s).reduce((t,r)=>t+(r.target||0), 0);
    return [s, money(debt), iss?money(iss):'—', tg?money(tg):'—'];
  });
  /* ====== الجدول السفلي: تحصيل / متبقٍ إصدار / متبقٍ مستهدف / متبقٍ مديونية ====== */
  const bottom = secs.map(s=>{
    const debt = st.S.filter(x=>x.inRoute && x.sector===s).reduce((t,x)=>t+x.value, 0);
    const iss = rt.filter(r=>r.sector===s).reduce((t,r)=>t+(r.issuance||0), 0);
    const tg = rt.filter(r=>r.sector===s).reduce((t,r)=>t+(r.target||0), 0);
    const c = sum(cur.filter(x=>sec(x.key)===s));
    return [money(c), iss?money(Math.max(0, iss-c)):'—', tg?money(Math.max(0, tg-c)):'—', money(Math.max(0, debt-c))];
  });

  /* ====== المتبقي في الموقع مع الفلترة والترتيب ====== */
  const g = {}; // sector → blk → { value, blds: { bld: { value, apts: [] } } }
  work().forEach(s=>{
    const sec = s.sector, b = s.blk, d = s.bld, apt = s.apt;
    g[sec] = g[sec] || {};
    g[sec][b] = g[sec][b] || { value: 0, blds: {} };
    g[sec][b].value += s.value || 0;
    g[sec][b].blds[d] = g[sec][b].blds[d] || { value: 0, apts: [] };
    g[sec][b].blds[d].value += s.value || 0;
    g[sec][b].blds[d].apts.push({ apt, value: s.value || 0, name: s.name || '' });
  });

  el.innerHTML = `${routesHtml}
  <div class="card"><h2>الملخص</h2>
    ${tbl(['القطاع','المديونية','الإصدار','المستهدف'], top)}
    ${tbl(['ما تم تحصيله','المتبقي من الإصدار','المتبقي من المستهدف','المتبقي من المديونية'], bottom)}
  </div>
  <div class="card" id="siteCard"><h2>المتبقي في الموقع</h2>
    <div class="filters">
      <select id="fKind">
        <option value="sector">القطاع</option>
        <option value="blk">البلوك</option>
        <option value="bld">العمارة</option>
        <option value="apt">الشقة</option>
      </select>
      <select id="fOp">
        <option value="gte">أكبر من أو يساوي</option>
        <option value="lte">أصغر من أو يساوي</option>
        <option value="eq">يساوي</option>
      </select>
      <input id="fVal" type="number" min="0" placeholder="القيمة">
      <button class="btn sm" id="fApply">تطبيق</button>
      <button class="btn ghost sm" id="fClear">خروج من الفلترة</button>
    </div>
    <div id="siteBody"></div>
  </div>`;

  // رسم المتبقي في الموقع
  const drawSite = ()=>{
    const body = el.querySelector('#siteBody');
    const order = (st._sortDir === 'desc') ? -1 : 1;
    let html = '';
    Object.keys(g).sort((a,b)=>Number(a)-Number(b)).forEach(sec=>{
      const blks = Object.keys(g[sec]);
      // فلترة البلوكات
      const f = st.filter;
      let visibleBlks = blks.slice();
      if (f){
        visibleBlks = visibleBlks.filter(b=>{
          const sum = g[sec][b].value;
          if (f.kind === 'blk') return cmpNum(sum, f.op, f.value);
          if (f.kind === 'bld'){
            // إذا كان أي بلد في البلوك يحقق الشرط
            return Object.keys(g[sec][b].blds).some(d=>cmpNum(g[sec][b].blds[d].value, f.op, f.value));
          }
          if (f.kind === 'apt'){
            return Object.keys(g[sec][b].blds).some(d=>g[sec][b].blds[d].apts.some(a=>cmpNum(a.value, f.op, f.value)));
          }
          if (f.kind === 'sector') return cmpNum(g[sec]._value || 0, f.op, f.value);
          return true;
        });
      }
      // ترتيب
      visibleBlks.sort((a,b)=>{
        if (order > 0) return g[sec][a].value - g[sec][b].value;
        return g[sec][b].value - g[sec][a].value;
      });
      if (!visibleBlks.length) return;
      html += `<div class="site-sec"><h3>القطاع ${sec}</h3>`;
      visibleBlks.forEach(b=>{
        html += `<div class="site-blk"><b>بلوك ${b}</b> — ${money(g[sec][b].value)}</div>`;
        Object.keys(g[sec][b].blds).sort((a,b)=>Number(a)-Number(b)).forEach(d=>{
          const bld = g[sec][b].blds[d];
          const okBld = !f || f.kind !== 'bld' || cmpNum(bld.value, f.op, f.value);
          if (!okBld && f && f.kind === 'bld') return;
          html += `<div class="site-bld">عمارة ${d} — ${money(bld.value)}</div>`;
          bld.apts.sort((a,b)=>a.value - b.value).forEach(a=>{
            const okApt = !f || f.kind !== 'apt' || cmpNum(a.value, f.op, f.value);
            if (!okApt && f && f.kind === 'apt') return;
            html += `<div class="site-apt">شقة ${a.apt} — ${money(a.value)}${a.name?' · '+esc(a.name):''}</div>`;
          });
        });
      });
      html += '</div>';
    });
    body.innerHTML = html || '<p class="mute">لا متبقي.</p>';
  };

  const cmpNum = (v, op, x)=>{
    if (op === 'gte') return v >= x;
    if (op === 'lte') return v <= x;
    return v === x;
  };

  // ترتيب افتراضي
  st._sortDir = st._sortDir || 'asc';
  const sortBtn = document.createElement('div');
  sortBtn.className = 'actions';
  sortBtn.style.marginTop = '.6rem';
  sortBtn.innerHTML = `<button class="btn ghost sm" id="sortAsc">ترتيب تصاعدي</button><button class="btn ghost sm" id="sortDesc">ترتيب تنازلي</button>`;
  el.querySelector('#siteCard').appendChild(sortBtn);
  el.querySelector('#sortAsc').onclick = ()=>{ st._sortDir = 'asc'; drawSite(); };
  el.querySelector('#sortDesc').onclick = ()=>{ st._sortDir = 'desc'; drawSite(); };

  el.querySelector('#fApply').onclick = ()=>{
    const kind = el.querySelector('#fKind').value;
    const op = el.querySelector('#fOp').value;
    const val = +el.querySelector('#fVal').value;
    if (!val){ toast('أدخل قيمة'); return; }
    // بناء matches
    const matches = new Set();
    if (kind === 'apt'){
      work().forEach(s=>{ if (cmpNum(s.value, op, val)) matches.add('apt:' + key(s)); });
    } else if (kind === 'bld'){
      const grpB = {};
      work().forEach(s=>{ const k = s.sector+'|'+s.blk+'|'+s.bld; grpB[k] = (grpB[k]||0) + (s.value||0); });
      Object.keys(grpB).forEach(k=>{ if (cmpNum(grpB[k], op, val)) matches.add('bld:' + k); });
    } else if (kind === 'blk'){
      const grpB = {};
      work().forEach(s=>{ const k = s.sector+'|'+s.blk; grpB[k] = (grpB[k]||0) + (s.value||0); });
      Object.keys(grpB).forEach(k=>{ if (cmpNum(grpB[k], op, val)) matches.add('blk:' + k); });
    } else if (kind === 'sector'){
      const grpS = {};
      work().forEach(s=>{ grpS[s.sector] = (grpS[s.sector]||0) + (s.value||0); });
      Object.keys(grpS).forEach(k=>{ if (cmpNum(grpS[k], op, val)) matches.add('sector:' + k); });
    }
    setFilter({kind, op, value: val, matches});
    toast('تم تطبيق الفلترة');
    drawSite();
    // العودة إلى صفحة التحصيل لإظهار التمييز
    goHome();
  };
  el.querySelector('#fClear').onclick = ()=>{ clearFilter(); toast('تم إلغاء الفلترة'); drawSite(); };

  drawSite();
  // زر أرشيف الشهور
  const arcBtn = document.createElement('div');
  arcBtn.className = 'actions';
  arcBtn.style.marginTop = '1rem';
  arcBtn.innerHTML = `<button class="btn ghost" id="monthlyArc">أرشيف الشهور</button>`;
  el.querySelector('#siteCard').appendChild(arcBtn);
  el.querySelector('#monthlyArc').onclick = ()=>renderMonthlyArchive(el);
}