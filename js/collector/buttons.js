import {get} from '../core/db.js';
import {isOn, enable, disable, verify} from './lock.js';

const ok = f => /^https:\/\//.test(f) || /^[\w.-]+\.html?$/.test(f);
const url = f => /^https:/.test(f) ? f : 'pages/' + f;
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/* ===== فتح صفحة داخل iframe ===== */
export function openPage(file, params){
  const u = url(file) + (params ? '?' + params : '');
  const d = document.createElement('dialog');
  d.className = 'viewer';
  d.innerHTML = `<iframe src="${esc(u)}" loading="lazy"></iframe>
    <div class="actions">
      <a class="btn ghost sm" href="${esc(u)}" target="_blank" rel="noopener">فتح في نافذة جديدة</a>
      <button class="btn sm" id="cl" type="button">إغلاق</button>
    </div>`;
  d.querySelector('#cl').onclick = () => { d.close(); d.remove(); };
  document.body.append(d);
  d.showModal();
}

/* ===== بناء القائمة المنسدلة ===== */
export async function renderMenu(){
  const f = await get('meta','file');
  const btns = ((f && f.buttons) || [])
    .filter(x => ok(x.file))
    .sort((p, q) => p.order - q.order);

  const m = document.getElementById('menu');
  if (!m) return;

  const lockOn = await isOn();

  let html = '';

  // زر القفل
  html += `<button type="button" data-lock="1">
    ${lockOn ? '🔓 إلغاء قفل التطبيق' : '🔒 قفل التطبيق ببصمة أو نقش أو كلمة الجهاز'}
  </button>`;

  html += '<hr>';

  // الواجهات الإضافية
  btns.forEach(x => {
    html += `<button type="button" data-f="${esc(x.file)}">${esc(x.name)}</button>`;
  });

  // أزرار ثابتة
  html += '<hr>';
  html += '<button type="button" data-archive="1">📊 الأرشيف</button>';
  html += '<button type="button" data-details="1">📋 التفاصيل</button>';

  m.innerHTML = html;

  // زر القفل
  m.querySelector('[data-lock]').onclick = async () => {
    m.hidden = true;
    try{
      if (lockOn){
        await verify();
        await disable();
        alert('أُلغي قفل التطبيق.');
      } else {
        await enable();
        alert('تم تفعيل القفل. سيطلب التطبيق بصمتك عند كل فتح.');
      }
    }catch(e){
      alert(e.message || 'تعذر تنفيذ العملية');
    }
    renderMenu();
  };

  // الواجهات الإضافية
  m.querySelectorAll('[data-f]').forEach(btn => {
    btn.onclick = () => { m.hidden = true; openPage(btn.dataset.f); };
  });

  // الأرشيف والتفاصيل
  m.querySelector('[data-archive]').onclick = () => {
    m.hidden = true;
    document.querySelectorAll('#tabs button').forEach(b => b.classList.remove('on'));
    const ev = new CustomEvent('openTab', {detail:{tab:'archive'}});
    window.dispatchEvent(ev);
  };

  m.querySelector('[data-details]').onclick = () => {
    m.hidden = true;
    document.querySelectorAll('#tabs button').forEach(b => b.classList.remove('on'));
    const ev = new CustomEvent('openTab', {detail:{tab:'details'}});
    window.dispatchEvent(ev);
  };
}