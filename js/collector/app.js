import {get, put, putMany, del} from '../core/db.js';
import {isOn, verify, disable, enable, supported} from './lock.js';
import {loadFiles} from './fileLoader.js';
import {st, refresh, renderHome, renderLedger, toast, esc, clearFilter} from './browse.js';
import {renderArchive, renderDetails} from './details.js';
import {renderSearch} from './search.js';
import {reconcile} from './reconcile.js';
import {choose} from './personal.js';
import {renderMenu} from './buttons.js';
import {check} from './updateCheck.js';
import {exportArchive} from './export.js';

const $ = id => document.getElementById(id);
const view = $('view');
let tab = 'home';

const R = {
  home: () => renderHome(view),
  ledger: () => renderLedger(view, reload, doExport),
  search: () => renderSearch(view),
  archive: () => renderArchive(view),
  details: () => renderDetails(view, () => show('home'))
};

function show(t){
  tab = t;
  st.bld = null; st.all = false;
  $('back').hidden = true;
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.t === t));
  try { R[t](); } catch(e){ console.error('show(' + t + ')', e); toast('خطأ: ' + e.message); }
}

async function doExport(){
  try{
    const a = await get('meta', 'auth');
    const r = await exportArchive(a);
    toast(r.n ? `جُهّز ${r.n} عملية` : 'لا جديد');
  }catch(e){ toast(e.message); }
}

async function reload(){
  try{
    const a = await get('meta', 'auth');
    const f = await get('meta', 'file');
    toast('جارٍ تحديث الملف…');
    await loadFiles(a, () => {}, async n => {
      const r = await reconcile(st.S, n.pairs, f?.cycle, n.full.cycle);
      await put('previousFile', 'prev', {cycle: f?.cycle, subs: st.S});
      if (r.other.length){
        await choose(`سيتحول ${r.other.length} عميل إلى مسدد. هل تتابع؟`, ['موافق'], false);
        await putMany('otherSource', r.other.map(o => [o.id, o]));
      }
    });
    await refresh();
    toast('تم تحديث الملف');
    const f2 = await get('meta', 'file');
    st.cycle = f2.cycle;
    renderMenu();
    $('who').textContent = `${a.name} · إصدار ${f2.cycle}`;
    show(tab);
  }catch(e){ toast('خطأ: ' + e.message); console.error(e); }
}

let unlocked = false, hiddenAt = 0, booted = false;
const LOCK_MS = 60 * 60 * 1000;

function showLocked(){
  $('app').hidden = true;
  $('tabs').hidden = true;
  $('locked').setAttribute('data-show', '1');
  tryUnlock();
}

function hideLocked(){
  $('locked').removeAttribute('data-show');
}

async function tryUnlock(){
  $('lmsg').textContent = '';
  try{
    await verify();
    unlocked = true;
    hideLocked();
    await boot();
  }catch(e){
    $('lmsg').textContent = 'لم يتم التحقق. اضغط «فتح» وحاول مرة أخرى.';
    console.warn(e);
  }
}

async function boot(){
  try{
    const a = await get('meta', 'auth');
    const f = await get('meta', 'file');
    if (!a || !f){ location.replace('login.html'); return; }
    if (!unlocked && await isOn()){ showLocked(); return; }
    booted = true;
    st.no = a.no; st.cycle = f.cycle; st.who = a.name;
    $('who').textContent = `${a.name} · إصدار ${f.cycle}`;
    hideLocked();
    $('diag').removeAttribute('data-show');
    if ($('menuBtn')) $('menuBtn').hidden = false;
    $('app').hidden = false;
    $('tabs').hidden = false;
    const ft = document.getElementById('footer');
    if (ft) ft.hidden = false;
    try { renderMenu(); } catch(e){ console.warn('menu', e); }
    try { await refresh(); } catch(e){ console.warn('refresh', e); }
    try { show('home'); } catch(e){ console.warn('show', e); }
    try { check(); } catch(e){ console.warn('check', e); }
  }catch(e){
    console.error('boot', e);
    $('who').textContent = 'خطأ: ' + e.message;
  }
}

$('unlockBtn').onclick = tryUnlock;
$('relogin').onclick = async () => {
  if (!confirm('ستدخل بالاسم وكلمة السر من جديد. بياناتك تبقى محفوظة. متابعة؟')) return;
  try{ await disable(); }catch(e){}
  try{ await del('meta', 'auth'); }catch(e){}
  unlocked = false; booted = false;
  location.replace('login.html');
};

document.addEventListener('visibilitychange', async () => {
  if (document.hidden){ hiddenAt = Date.now(); }
  else if (hiddenAt && Date.now() - hiddenAt > LOCK_MS){
    try{
      if (await isOn()){ unlocked = false; booted = false; hiddenAt = 0; boot(); }
    }catch(e){}
  }
});

document.querySelectorAll('#tabs button').forEach(b => b.onclick = () => {
  st.sel.clear(); st.open = null;
  show(b.dataset.t);
});

// ربط الأزرار من القائمة المنسدلة
window.addEventListener('openTab', e => {
  const t = e.detail && e.detail.tab;
  if (!t) return;
  st.sel.clear(); st.open = null;
  show(t);
});

$('back').onclick = () => history.back();
addEventListener('popstate', () => {
  if (st.sel.size && !confirm('لديك تحديد غير محفوظ، هل تخرج؟')){
    history.pushState({v: 'bld'}, ''); return;
  }
  st.sel.clear(); show(tab);
});

const net = () => {
  $('net').textContent = navigator.onLine ? 'متصل' : 'بدون إنترنت';
  $('net').dataset.on = navigator.onLine;
};
addEventListener('online', net);
addEventListener('offline', net);
net();

if ('serviceWorker' in navigator){
  navigator.serviceWorker.register('sw.js').then(r => {
    r.addEventListener('updatefound', () => {
      const w = r.installing;
      if (w) w.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) w.postMessage({type: 'SKIP_WAITING'});
      });
    });
  }).catch(console.warn);
  navigator.serviceWorker.addEventListener('message', e => {
    if (e.data && e.data.type === 'RELOAD') location.reload();
  });
}

$('menuBtn').onclick = e => { e.stopPropagation(); $('menu').hidden = !$('menu').hidden; };
document.addEventListener('click', () => { $('menu').hidden = true; });

console.log('[app] started');
boot();