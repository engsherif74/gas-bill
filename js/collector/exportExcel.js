import {money} from '../core/utils.js';
import {keyOf as key} from './ledger.js';
import {st, work, esc} from './browse.js';
import {sendFile} from './personal.js';

/* ============================================================
   تصدير Excel (CSV) — العملاء غير المسددين
   - مرتبين حسب: بلوك → عمارة → شقة
   - أعمدة: القيمة، العدد، اسم العميل، البلوك، العمارة، الشقة
   - القطاعات: المستخدم يختار
   ============================================================ */

const srt = (a,b) => Number(a)-Number(b);

/* ===== بناء CSV مع دعم العربية ===== */
function buildCSV(rows){
  const esc = v => {
    const s = String(v ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')){
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  };
  const header = ['القيمة','العدد','اسم العميل','البلوك','العمارة','الشقة'];
  const lines = [header.map(esc).join(',')];
  rows.forEach(r => {
    lines.push([
      r.value, r.count, r.name, r.blk, r.bld, r.apt
    ].map(esc).join(','));
  });
  return '\uFEFF' + lines.join('\r\n');
}

/* ===== جمع البيانات للتصدير ===== */
function collectRows(selectedSectors){
  const w = work().filter(s => selectedSectors.has(String(s.sector)));
  const rows = w.map(s => ({
    value: s.value || 0,
    count: s.count || 0,
    name: s.name || 'بدون اسم',
    blk: s.blk,
    bld: s.bld,
    apt: s.apt,
    sector: s.sector,
    key: key(s)
  }));
  // ترتيب: بلوك → عمارة → شقة
  rows.sort((a,b) => {
    const c1 = srt(a.blk, b.blk);
    if (c1) return c1;
    const c2 = srt(a.bld, b.bld);
    if (c2) return c2;
    return srt(a.apt, b.apt);
  });
  return rows;
}

/* ===== نافذة التصدير ===== */
export function openExportDialog(){
  const w = work();
  if (!w.length){
    alert('لا يوجد عملاء غير مسددين للتصدير.');
    return;
  }

  // القطاعات المتاحة
  const sectors = [...new Set(w.map(s => String(s.sector)))].sort(srt);
  const defaultSel = new Set(sectors);

  const dlg = document.createElement('dialog');
  dlg.className = 'export-dialog';
  dlg.innerHTML = `
    <h3>تصدير Excel — العملاء غير المسددين</h3>
    <p class="mute">اختر القطاعات، ثم صدّر الملف. الترتيب: بلوك → عمارة → شقة.</p>

    <div class="export-sectors">
      <div class="export-sectors-head">
        <b>القطاعات:</b>
        <button class="btn ghost sm" id="selAll" type="button">تحديد الكل</button>
        <button class="btn ghost sm" id="selNone" type="button">إلغاء الكل</button>
      </div>
      <div class="export-sectors-body">
        ${sectors.map(sec => `
          <label class="chk export-chk">
            <input type="checkbox" data-sec="${esc(sec)}" checked>
            القطاع ${esc(sec)}
          </label>
        `).join('')}
      </div>
    </div>

    <div class="export-preview" id="expPreview"></div>

    <div class="actions">
      <button class="btn" id="expShare" type="button">مشاركة عبر واتساب</button>
      <button class="btn ghost" id="expDownload" type="button">تحميل مباشر</button>
      <button class="btn ghost" id="expCancel" type="button">إلغاء</button>
    </div>
  `;
  document.body.append(dlg);
  dlg.showModal();

  const preview = dlg.querySelector('#expPreview');
  const checks = dlg.querySelectorAll('[data-sec]');

  const updatePreview = () => {
    const sel = new Set();
    checks.forEach(c => { if (c.checked) sel.add(c.dataset.sec); });
    const rows = collectRows(sel);
    const totalVal = rows.reduce((t,r) => t + r.value, 0);
    const totalCnt = rows.reduce((t,r) => t + r.count, 0);
    preview.innerHTML = `
      <div class="export-stats">
        <span><b>${rows.length}</b> عميل</span>
        <span><b>${totalCnt}</b> فاتورة</span>
        <span><b>${money(totalVal)}</b> جنيه</span>
      </div>
    `;
  };
  updatePreview();

  checks.forEach(c => c.onchange = updatePreview);

  dlg.querySelector('#selAll').onclick = () => {
    checks.forEach(c => c.checked = true);
    updatePreview();
  };
  dlg.querySelector('#selNone').onclick = () => {
    checks.forEach(c => c.checked = false);
    updatePreview();
  };

  const getSel = () => {
    const sel = new Set();
    checks.forEach(c => { if (c.checked) sel.add(c.dataset.sec); });
    return sel;
  };

  const doExport = async (mode) => {
    const sel = getSel();
    if (!sel.size){ alert('اختر قطاعاً واحداً على الأقل'); return; }
    const rows = collectRows(sel);
    if (!rows.length){ alert('لا يوجد عملاء في القطاعات المختارة'); return; }
    const csv = buildCSV(rows);
    const date = new Date().toLocaleDateString('en-CA');
    const name = `غير_مسددين_${date}.csv`;
    const blob = new Blob([csv], {type: 'text/csv;charset=utf-8'});
    const file = new File([blob], name, {type: 'text/csv'});

    try{
      if (mode === 'share' && navigator.canShare && navigator.canShare({files:[file]})){
        await navigator.share({files:[file], title: name});
      } else {
        await sendFile(file);
      }
      dlg.close(); dlg.remove();
    }catch(e){
      console.warn(e);
    }
  };

  dlg.querySelector('#expShare').onclick = () => doExport('share');
  dlg.querySelector('#expDownload').onclick = () => doExport('download');
  dlg.querySelector('#expCancel').onclick = () => { dlg.close(); dlg.remove(); };
}