import {get,all} from '../core/db.js';
import {personalCards} from './personal.js';
import {money} from '../core/utils.js';
import {list,ldate} from './ledger.js';
import {st,esc,work,refresh} from './browse.js';

const grp = function(a, f){ return a.reduce(function(m, x){ (m[f(x)] = m[f(x)] || []).push(x); return m; }, {}); };
const sum = function(a){ return a.reduce(function(s, x){ return s + x.amount; }, 0); };
const tbl = function(h, r){
  return '<div class="wrap"><table><tr>' + h.map(function(x){ return '<th>' + x + '</th>'; }).join('') + '</tr>' +
    r.map(function(c){ return '<tr>' + c.map(function(x){ return '<td>' + x + '</td>'; }).join('') + '</tr>'; }).join('') +
    '</table></div>';
};
const who = function(e){
  const s = st.by.get(e.key) || {};
  return esc(s.name || 'بدون اسم') + ' (' + (s.sector||'') + '-' + (s.blk||'') + '-' + (s.bld||'') + '-' + (s.apt||'') + ')';
};
const kind = function(e){ return e.type === 'advance' ? 'مقدم' : 'سداد'; };

export async function renderArchive(el){
  await refresh();
  const e = await list();
  const days = grp(e, function(x){ return ldate(x.time); });
  const mons = grp(e, function(x){ return ldate(x.time).slice(0, 7); });
  const d = Object.keys(days).sort().reverse().map(function(k){
    return '<details><summary>' + k + ' · ' + days[k].length + ' عملية · <b>' + money(sum(days[k])) + '</b></summary>' +
      tbl(['المشترك','النوع','المبلغ',''], days[k].map(function(x){
        return [who(x), kind(x), money(x.amount), x.type === 'pay' ? '<button class="lnk" data-pd="' + x.id + '">تفاصيل</button>' : ''];
      })) + '</details>';
  }).join('') || '<p class="mute">لا يوجد.</p>';
  const m = Object.keys(mons).sort().reverse().map(function(k){
    const dd = grp(mons[k], function(x){ return ldate(x.time); });
    return '<details><summary>' + k + ' · ' + Object.keys(dd).length + ' يوم · <b>' + money(sum(mons[k])) + '</b></summary>' +
      tbl(['اليوم','العمليات','المجموع'], Object.keys(dd).sort().map(function(x){ return [x, dd[x].length, money(sum(dd[x]))]; })) + '</details>';
  }).join('') || '<p class="mute">لا يوجد.</p>';
  el.innerHTML = '<div class="card"><h2>الأرشيف اليومي</h2>' + d + '</div><div class="card"><h2>الأرشيف الشهري</h2>' + m + '</div>';
  await personalCards(el, e, function(){ return renderArchive(el); });
}

export async function renderDetails(el, goHome){
  await refresh();
  const f = await get('meta','file');
  const rt = (f && f.routes) || [];
  const e = await list();
  const mon = ldate(new Date()).slice(0, 7);
  const cur = e.filter(function(x){ return ldate(x.time).slice(0, 7) === mon; });
  const secs = [...new Set(rt.map(function(r){ return r.sector; }))].sort();
  const sec = function(k){ return k.split('|')[1]; };
  const rows = secs.map(function(s){
    const debt = st.S.filter(function(x){ return x.inRoute && x.sector === s; }).reduce(function(t, x){ return t + x.value; }, 0);
    const iss = rt.filter(function(r){ return r.sector === s; }).reduce(function(t, r){ return t + (r.issuance || 0); }, 0);
    const tg = rt.filter(function(r){ return r.sector === s; }).reduce(function(t, r){ return t + (r.target || 0); }, 0);
    const c = sum(cur.filter(function(x){ return sec(x.key) === s; }));
    return [s, money(debt), iss ? money(iss) : '—', money(c), iss ? money(iss - c) : '—', iss ? (c / iss * 100).toFixed(1) + '%' : '—', tg ? money(tg - c) : '—', money(debt - c)];
  });
  const g = {}; work().forEach(function(s){ ((g[s.sector] = g[s.sector] || {})[s.blk] = g[s.sector][s.blk] || 0); g[s.sector][s.blk] += s.value; });
  const site = Object.keys(g).sort().flatMap(function(s){
    return Object.keys(g[s]).sort(function(a, b){ return a - b; }).map(function(b){
      return [s, b, money(g[s][b]), '<button class="btn ghost sm" data-go="' + s + '|' + b + '">فتح</button>'];
    });
  });
  const ad = e.filter(function(x){ return x.type === 'advance'; });
  const oor = e.filter(function(x){ return x.out && x.type === 'pay'; });
  const os = await all('otherSource');
  el.innerHTML = '<div class="card"><h2>التفاصيل</h2>' +
    '<details open><summary>المديونية</summary>' + (rows.length ? tbl(['القطاع','إجمالي المديونية','الإصدار','ما تم تحصيله','المتبقي من الإصدار','النسبة','المتبقي من المستهدف','المتبقي من المديونية'], rows) : '<p class="mute">لا يوجد خط سير.</p>') + '</details>' +
    '<details><summary>المتبقي في الموقع</summary>' + (site.length ? tbl(['القطاع','البلوك','القيمة',''], site) : '<p class="mute">لا متبقي.</p>') + '</details>' +
    '<details><summary>تسديدات خارج النطاق</summary>' + (oor.length ? tbl(['العميل','المبلغ','التاريخ'], oor.map(function(x){ return [who(x), money(x.amount), ldate(x.time)]; })) : '<p class="mute">لا يوجد.</p>') + '</details>' +
    '<details><summary>سداد من مصدر آخر</summary>' + (os.length ? tbl(['العميل','المبلغ','التاريخ','كامل؟'], os.map(function(x){ return [esc(x.name || 'بدون اسم'), money(x.amount), x.date, x.full ? 'نعم' : 'جزئي']; })) : '<p class="mute">لا يوجد.</p>') + '</details>' +
    '<details><summary>سجل السداد المقدم</summary>' + (ad.length ? tbl(['العميل','المبلغ','الرصيد الحالي','التاريخ'], ad.map(function(x){ return [who(x), money(x.amount), money(st.adv.get(x.key) || 0), ldate(x.time)]; })) : '<p class="mute">لا يوجد.</p>') + '</details>' +
    '<p class="mute">السجل اليومي والشهري في تبويب «الأرشيف».</p></div>';
  el.querySelectorAll('[data-go]').forEach(function(b){
    b.onclick = function(){
      const p = b.dataset.go.split('|');
      st.sector = p[0]; st.blk = p[1]; st.open = null;
      goHome();
    };
  });
}