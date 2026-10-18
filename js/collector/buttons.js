import {get} from '../core/db.js';
import {isOn,enable,disable,verify} from './lock.js';

const ok = function(f){ return /^https:\/\//.test(f) || /^[\w.-]+\.html?$/.test(f); };
const url = function(f){ return /^https:/.test(f) ? f : 'pages/' + f; };
const esc = function(s){ return String(s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); };

export function openPage(file, params){
  const u = url(file) + (params ? '?' + params : '');
  const d = document.createElement('dialog');
  d.className = 'viewer';
  d.innerHTML = '<iframe src="' + esc(u) + '"></iframe><div class="actions"><a class="btn ghost sm" href="' + esc(u) + '" target="_blank" rel="noopener">فتح في نافذة جديدة</a><button class="btn sm" id="cl">إغلاق</button></div>';
  d.querySelector('#cl').onclick = function(){ d.close(); d.remove(); };
  document.body.append(d);
  d.showModal();
}

export async function renderMenu(){
  const f = await get('meta','file');
  const b = ((f && f.buttons) || []).filter(function(x){ return ok(x.file); }).sort(function(p, q){ return p.order - q.order; });
  const m = document.getElementById('menu');
  const on = await isOn();
  m.innerHTML = '<button data-lock="1">' + (on ? '🔓 إلغاء قفل التطبيق' : '🔒 قفل التطبيق ببصمة أو نقش أو كلمة الجهاز') + '</button>' +
    b.map(function(x){ return '<button data-f="' + esc(x.file) + '">' + esc(x.name) + '</button>'; }).join('');
  m.querySelector('[data-lock]').onclick = async function(){
    m.hidden = true;
    try{
      if (on){ await verify(); await disable(); alert('أُلغي قفل التطبيق.'); }
      else { await enable(); alert('تم تفعيل القفل.'); }
    }catch(e){ alert(e.message || 'تعذر تنفيذ العملية'); }
    renderMenu();
  };
  m.querySelectorAll('[data-f]').forEach(function(btn){
    btn.onclick = function(){ m.hidden = true; openPage(btn.dataset.f); };
  });
}