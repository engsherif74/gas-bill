import {all, put, del, get, putMany} from '../core/db.js';
import {money} from '../core/utils.js';
import {pack, unpack} from '../core/crypto.js';
import {st, esc, toast, refresh} from './browse.js';
import {ldate, keyOf as key, personalSettle} from './ledger.js';

/* ====== نافذة اختيار ====== */
export const choose = (title, opts, cancel = true) => new Promise(res => {
  const d = document.createElement('dialog');
  d.innerHTML = `<div>${title}</div>` +
    opts.map((o, i) => `<button class="btn ${i ? 'ghost' : ''}" type="button" value="${i}">${o}</button>`).join('') +
    (cancel ? '<button class="btn ghost" type="button" value="-1">إلغاء</button>' : '');
  d.addEventListener('click', e => {
    if (e.target.tagName === 'BUTTON'){
      const v = +e.target.value;
      d.close(); d.remove();
      res(v);
    }
  });
  d.addEventListener('cancel', e => { if (!cancel) e.preventDefault(); });
  document.body.append(d);
  d.showModal();
});

/* ====== مشاركة الملف ====== */
export async function sendFile(file){
  if (navigator.canShare && navigator.canShare({files:[file]})){
    try{ await navigator.share({files:[file], title:file.name}); return 'shared'; }catch{}
  }
  const l = document.createElement('a');
  l.href = URL.createObjectURL(file);
  l.download = file.name;
  document.body.appendChild(l);
  l.click();
  l.remove();
  return 'downloaded';
}

/* ====== أدوات ====== */
const num = s => +String(s || '').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
const rid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

/* ====== مربع نصي رقمين + انتقال تلقائي ====== */
const num2Input = (id, nextId, placeholder = '') =>
  `<input id="${id}" class="num2" type="text" inputmode="numeric" maxlength="2" pattern="[0-9]*" placeholder="${placeholder}" ${nextId ? `data-next="${nextId}"` : ''}>`;

/* ====== ربط الانتقال التلقائي (مصحح) ====== */
function wireAutoNext(scope){
  scope.querySelectorAll('[data-next]').forEach(inp => {
    inp.addEventListener('input', () => {
      const v = String(inp.value || '').replace(/\D/g, '').slice(0, 2);
      if (inp.value !== v) inp.value = v;
      if (v.length === 2){
        const next = scope.querySelector('#' + inp.dataset.next);
        if (next){
          if (next.tagName === 'INPUT'){ next.focus(); next.select?.(); }
        }
      }
    });
  });
}

/* ====== آخر حذف ====== */
let lastDel = null;

/* ====== البطاقات الشخصية ====== */
export async function personalCards(el, entries, again){
  const D = (await all('personalDealings')).sort((a,b) => a.date < b.date ? 1 : -1);
  const P = (await all('personalPayments')).sort((a,b) => a.payDate < b.payDate ? 1 : -1);

  const sum = (a,f) => a.reduce((s,x) => s + f(x), 0);
  const L = d => d.dir === 'له' ? d.amount : 0;
  const R = d => d.dir === 'عليه' ? d.amount : 0;
  const net = {};
  D.forEach(d => { net[d.name] = (net[d.name]||0) + L(d) - R(d); });

  /* ===== صفوف التعاملات ===== */
  const rowD = d => `<div class="p-row">
    <div class="p-line1">${esc(d.name)}</div>
    <div class="p-line2">قطاع ${d.sector || '—'} · عمارة ${d.bld || '—'} · شقة ${d.apt || '—'}</div>
    <div class="p-line3">
      <span class="${d.dir === 'له' ? 'p-green' : 'p-red'}">${d.dir}</span>
      <span class="p-amount">${money(d.amount)}</span>
      <small class="mute">${d.date}</small>
      <span class="p-acts">
        <button class="lnk" data-ed="${d.id}" type="button">تعديل</button>
        <button class="lnk" data-dd="${d.id}" type="button">حذف</button>
      </span>
    </div>
  </div>`;

  /* ===== صفوف السداد الشخصي ===== */
  const rowP = p => `<div class="p-row">
    <div class="p-line1">${esc(p.name)}</div>
    <div class="p-line2">قطاع ${p.sector || '—'} · عمارة ${p.bld || '—'} · شقة ${p.apt || '—'}</div>
    <div class="p-line3">
      <span class="p-blue">سداد شخصي</span>
      <span class="p-amount">${money(p.amount)}</span>
      <small class="mute">${p.payDate}</small>
      <span class="p-acts">
        <button class="lnk" data-dp="${p.id}" type="button">حذف</button>
      </span>
    </div>
  </div>`;

  /* ===== HTML الرئيسي ===== */
  el.insertAdjacentHTML('beforeend', `
    <div class="card">
      <h2>التعاملات الشخصية</h2>
      <div class="actions">
        <button class="btn sm" id="addD" type="button">إضافة تعامل</button>
        ${lastDel ? '<button class="btn ghost sm" id="undoD" type="button">تراجع عن آخر حذف</button>' : ''}
      </div>
      <div class="p-list">${D.map(rowD).join('') || '<p class="mute">لا يوجد.</p>'}</div>
      ${Object.keys(net).length ? '<p class="mute">الصافي: ' + Object.entries(net).map(([n,v]) => `${esc(n)} ${money(v)}`).join(' · ') + '</p>' : ''}
    </div>

    <div class="card">
      <h2>السداد الشخصي</h2>
      <div class="actions">
        <button class="btn sm" id="addP" type="button">سداد شخصي</button>
      </div>
      <div class="p-list">${P.map(rowP).join('') || '<p class="mute">لا يوجد.</p>'}</div>
      <p class="mute">السداد الشخصي يعني سداد كامل المديونية. يخرج العميل من صفحة التحصيل ويظهر هنا.</p>
    </div>

    <div class="card warn">
      <b>هذه الجداول محفوظة على هاتفك فقط. حمّلها مرة أسبوعياً حتى لا تفقدها.</b>
      <div class="actions">
        <button class="btn" id="bk" type="button">تحميل نسخة احتياطية</button>
        <button class="btn ghost" id="rst" type="button">استرجاع نسخة</button>
        <input type="file" id="rstIn" hidden>
      </div>
    </div>
  `);

  const $ = s => el.querySelector(s);
  const on = (s,f) => el.querySelectorAll(s).forEach(f);

  /* ===== إضافة تعامل ===== */
  $('#addD').onclick = async () => {
    const dlg = document.createElement('dialog');
    dlg.innerHTML = `
      <h3>إضافة تعامل شخصي</h3>
      <div class="stack">
        <div class="pick" style="grid-template-columns:1fr 1fr 1fr 1fr">
          <label class="field"><span>القطاع</span>${num2Input('dSec', 'dBlk', '—')}</label>
          <label class="field"><span>البلوك</span>${num2Input('dBlk', 'dBld', '—')}</label>
          <label class="field"><span>العمارة</span>${num2Input('dBld', 'dApt', '—')}</label>
          <label class="field"><span>الشقة</span>${num2Input('dApt', 'dName', '—')}</label>
        </div>
        <label class="field"><span>اسم العميل (يُستدعى تلقائياً)</span><input id="dName" type="text" placeholder="—"></label>
        <label class="field"><span>النوع</span>
          <select id="dDir">
            <option value="له">له عندي</option>
            <option value="عليه">عليه لي</option>
          </select>
        </label>
        <label class="field"><span>المبلغ</span><input id="dAmount" type="number" min="1" inputmode="numeric" placeholder="0"></label>
        <label class="field"><span>ملاحظة (اختياري)</span><input id="dNote" type="text"></label>
      </div>
      <div class="actions">
        <button class="btn" id="dOk" type="button">إضافة</button>
        <button class="btn ghost" id="dCancel" type="button">إلغاء</button>
      </div>
    `;
    document.body.append(dlg);
    dlg.showModal();
    wireAutoNext(dlg);

    const dSec = dlg.querySelector('#dSec');
    const dBlk = dlg.querySelector('#dBlk');
    const dBld = dlg.querySelector('#dBld');
    const dApt = dlg.querySelector('#dApt');
    const dName = dlg.querySelector('#dName');

    const lookupName = () => {
      const sec = String(dSec.value || '').trim();
      const blk = String(dBlk.value || '').trim();
      const bld = String(dBld.value || '').trim();
      const apt = String(dApt.value || '').trim();
      if (!sec || !blk || !bld || !apt) return;
      let found = null;
      for (const s of st.S){
        if (String(s.sector) === sec && String(s.blk) === blk && String(s.bld) === bld && String(s.apt) === apt){
          found = s; break;
        }
      }
      if (found) dName.value = found.name || 'بدون اسم';
      else {
        dName.value = '';
        dName.placeholder = 'العميل غير موجود — أدخل الاسم يدوياً';
      }
    };
    [dSec, dBlk, dBld, dApt].forEach(i => i.addEventListener('input', lookupName));

    dlg.querySelector('#dCancel').onclick = () => { dlg.close(); dlg.remove(); };
    dlg.querySelector('#dOk').onclick = async () => {
      const sec = String(dSec.value || '').trim();
      const blk = String(dBlk.value || '').trim();
      const bld = String(dBld.value || '').trim();
      const apt = String(dApt.value || '').trim();
      const name = String(dName.value || '').trim();
      const dir = dlg.querySelector('#dDir').value;
      const a = num(dlg.querySelector('#dAmount').value);
      const note = String(dlg.querySelector('#dNote').value || '').trim();

      if (!sec || !blk || !bld || !apt){ alert('أدخل القطاع والبلوك والعمارة والشقة'); return; }
      if (!name){ alert('أدخل اسم العميل'); return; }
      if (!(a > 0)){ alert('أدخل مبلغاً صحيحاً'); return; }

      const id = rid();
      await put('personalDealings', id, {
        id, name, sector: sec, blk, bld, apt,
        dir, amount: a, date: ldate(new Date()), note
      });
      dlg.close(); dlg.remove();
      toast('تمت الإضافة');
      again();
    };
  };

  /* ===== تعديل تعامل ===== */
  on('[data-ed]', b => b.onclick = async () => {
    const d = D.find(x => x.id === b.dataset.ed);
    if (!d) return;
    const a = num(prompt('المبلغ الجديد', d.amount));
    if (a > 0){
      await put('personalDealings', d.id, {...d, amount: a});
      again();
    }
  });

  /* ===== حذف تعامل ===== */
  on('[data-dd]', b => b.onclick = async () => {
    if (confirm('تأكيد حذف التعامل؟')){
      lastDel = D.find(x => x.id === b.dataset.dd);
      await del('personalDealings', lastDel.id);
      again();
    }
  });

  if ($('#undoD')) $('#undoD').onclick = async () => {
    if (lastDel){
      await put('personalDealings', lastDel.id, lastDel);
      lastDel = null;
      again();
    }
  };

  /* ===== حذف سداد شخصي ===== */
  on('[data-dp]', b => b.onclick = async () => {
    if (confirm('حذف السداد الشخصي من الجدول؟ (لا يؤثر على الأرشيف)')){
      await del('personalPayments', b.dataset.dp);
      again();
    }
  });

  /* ===== إضافة سداد شخصي ===== */
  $('#addP').onclick = async () => {
    const dlg = document.createElement('dialog');
    dlg.innerHTML = `
      <h3>سداد شخصي (كامل المديونية)</h3>
      <p class="mute">يُسدد كامل المديونية للعميل ويخرجه من صفحة التحصيل.</p>
      <div class="stack">
        <div class="pick" style="grid-template-columns:1fr 1fr 1fr 1fr">
          <label class="field"><span>القطاع</span>${num2Input('pSec', 'pBlk', '—')}</label>
          <label class="field"><span>البلوك</span>${num2Input('pBlk', 'pBld', '—')}</label>
          <label class="field"><span>العمارة</span>${num2Input('pBld', 'pApt', '—')}</label>
          <label class="field"><span>الشقة</span>${num2Input('pApt', '', '—')}</label>
        </div>
        <label class="field"><span>اسم العميل (يُستدعى تلقائياً)</span><input id="pName" type="text" placeholder="—"></label>
        <label class="field"><span>القيمة (تُؤخذ تلقائياً من مديونيته)</span><input id="pAmount" type="number" readonly></label>
      </div>
      <div class="actions">
        <button class="btn" id="pOk" type="button">تأكيد السداد</button>
        <button class="btn ghost" id="pCancel" type="button">إلغاء</button>
      </div>
    `;
    document.body.append(dlg);
    dlg.showModal();
    wireAutoNext(dlg);

    const pSec = dlg.querySelector('#pSec');
    const pBlk = dlg.querySelector('#pBlk');
    const pBld = dlg.querySelector('#pBld');
    const pApt = dlg.querySelector('#pApt');
    const pName = dlg.querySelector('#pName');
    const pAmount = dlg.querySelector('#pAmount');
    let foundClient = null;

    const lookup = () => {
      const sec = String(pSec.value || '').trim();
      const blk = String(pBlk.value || '').trim();
      const bld = String(pBld.value || '').trim();
      const apt = String(pApt.value || '').trim();
      if (!sec || !blk || !bld || !apt){ foundClient = null; pName.value = ''; pAmount.value = ''; return; }
      foundClient = st.S.find(s =>
        String(s.sector) === sec && String(s.blk) === blk &&
        String(s.bld) === bld && String(s.apt) === apt
      ) || null;
      if (foundClient){
        pName.value = foundClient.name || 'بدون اسم';
        pAmount.value = foundClient.value || 0;
      } else {
        pName.value = '';
        pAmount.value = '';
        pName.placeholder = 'العميل غير موجود';
      }
    };
    [pSec, pBlk, pBld, pApt].forEach(i => i.addEventListener('input', lookup));

    dlg.querySelector('#pCancel').onclick = () => { dlg.close(); dlg.remove(); };
    dlg.querySelector('#pOk').onclick = async () => {
      if (!foundClient){ alert('العميل غير موجود في السجلات'); return; }
      const val = foundClient.value || 0;
      if (val <= 0){ alert('العميل ليس عليه مديونية'); return; }
      if (!confirm(`سداد شخصي كامل لـ ${foundClient.name || 'بدون اسم'} بمبلغ ${money(val)} جنيه؟`)) return;

      await personalSettle(st.no, foundClient, st.adv);

      const id = rid();
      await put('personalPayments', id, {
        id,
        name: foundClient.name || 'بدون اسم',
        sector: foundClient.sector,
        blk: foundClient.blk,
        bld: foundClient.bld,
        apt: foundClient.apt,
        amount: val,
        payDate: ldate(new Date()),
        settleDate: ldate(new Date()),
        src: key(foundClient)
      });

      await refresh();
      dlg.close(); dlg.remove();
      toast(`تم السداد الشخصي: ${money(val)} جنيه`);
      again();
    };
  };

  /* ===== نسخة احتياطية ===== */
  $('#bk').onclick = async () => {
    const a = await get('meta','auth');
    const name = `جداول شخصية ${ldate(new Date())}.bin`;
    const blob = await pack({v:1, dealings:D, payments:P}, a.userKey);
    const r = await sendFile(new File([blob], name));
    toast(r === 'shared' ? 'تمت المشاركة: ' + name : `تم التحميل باسم «${name}»`);
  };

  $('#rst').onclick = () => $('#rstIn').click();
  $('#rstIn').onchange = async e => {
    try{
      const a = await get('meta','auth');
      const x = await unpack(new Uint8Array(await e.target.files[0].arrayBuffer()), a.userKey);
      if (x.dealings && x.dealings.length) await putMany('personalDealings', x.dealings.map(d => [d.id, d]));
      if (x.payments && x.payments.length) await putMany('personalPayments', x.payments.map(p => [p.id, p]));
      toast('تم الاسترجاع');
      again();
    }catch{
      toast('تعذر فتح النسخة');
    }
  };
}