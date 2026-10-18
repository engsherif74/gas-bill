import {get,put,putMany,del} from '../core/db.js';
import {isOn,verify,disable,enable,supported} from './lock.js';
import {login} from './unlock.js';
import {loadFiles} from './fileLoader.js';
import {st,refresh,renderHome,renderLedger,toast,esc} from './browse.js';
import {renderArchive,renderDetails} from './details.js';
import {renderSearch} from './search.js';
import {reconcile} from './reconcile.js';
import {choose} from './personal.js';
import {renderMenu} from './buttons.js';
import {check} from './updateCheck.js';
import {exportArchive} from './export.js';

const $ = function(id){ return document.getElementById(id); };
const view = $('view');
let tab = 'home';

const R = {
  home: function(){ return renderHome(view); },
  ledger: function(){ return renderLedger(view, reload, doExport); },
  search: function(){ return renderSearch(view); },
  archive: function(){ return renderArchive(view); },
  details: function(){ return renderDetails(view, function(){ return show('home'); }); }
};

function show(t){
  tab = t;
  st.bld = null; st.all = false;
  $('back').hidden = true;
  document.querySelectorAll('#tabs button').forEach(function(b){ b.classList.toggle('on', b.dataset.t === t); });
  try { R[t](); } catch(e){ console.error(e); toast('خطأ: ' + e.message); }
}

async function doExport(){
  try{
    const a = await get('meta','auth');
    const r = await exportArchive(a);
    toast(r.n ? 'جُهّز ' + r.n + ' عملية' : 'لا جديد');
  }catch(e){ toast(e.message); }
}

async function reload(){
  try{
    const a = await get('meta','auth');
    const f = await get('meta','file');
    toast('جارٍ تحديث الملف…');
    await loadFiles(a, function(){}, async function(n){
      const r = await reconcile(st.S, n.pairs, f ? f.cycle : null, n.full.cycle);
      await put('previousFile','prev', {cycle: f ? f.cycle : null, subs: st.S});
      if (r.other.length){
        await choose('سيتحول ' + r.other.length + ' عميل إلى مسدد. هل تتابع؟', ['موافق'], false);
        await putMany('otherSource', r.other.map(function(o){ return [o.id, o]; }));
      }
    });
    await refresh();
    $('upd').hidden = true;
    toast('تم تحديث الملف');
    const f2 = await get('meta','file');
    st.cycle = f2.cycle;
    renderMenu();
    $('who').textContent = a.name + ' · إصدار ' + f2.cycle;
    show(tab);
  }catch(e){ toast('خطأ: ' + e.message); console.error(e); }
}

let unlocked = false, hiddenAt = 0, booted = false;

function showLogin(){
  ['app','locked','tabs','diag'].forEach(function(i){ if($(i)) $(i).hidden = true; });
  $('login').hidden = false;
  $('who').textContent = 'تسجيل الدخول';
  if ($('menuBtn')) $('menuBtn').hidden = true;
  $('no').value = localStorage.getItem('lastNo') || '';
}

function showLocked(){
  ['login','app','tabs','diag'].forEach(function(i){ if($(i)) $(i).hidden = true; });
  $('locked').hidden = false;
  tryUnlock();
}

async function tryUnlock(){
  $('lmsg').textContent = '';
  try{
    await verify();
    unlocked = true;
    $('locked').hidden = true;
    await boot();
  }catch(e){
    $('lmsg').textContent = 'لم يتم التحقق. اضغط «فتح» وحاول مرة أخرى.';
    console.warn(e);
  }
}

async function tryEnableLock(){
  try{
    if (await isOn()) return;
    if (!(await supported())) return;
    setTimeout(async function(){
      try{
        if (confirm('تفعيل فتح التطبيق ببصمة أو نقش؟')){
          await enable();
          alert('تم التفعيل.');
        }
      }catch(e){ console.warn(e); }
    }, 800);
  }catch(e){ console.warn(e); }
}

async function boot(){
  if (booted) return;
  try{
    const a = await get('meta','auth');
    const f = await get('meta','file');
    console.log('[boot] auth=', !!a, 'file=', !!f);
    if (!a || !f){ showLogin(); return; }
    if (!unlocked && await isOn()){ showLocked(); return; }
    booted = true;
    st.no = a.no; st.cycle = f.cycle; st.who = a.name;
    $('who').textContent = a.name + ' · إصدار ' + f.cycle;
    $('login').hidden = true; $('locked').hidden = true; $('diag').hidden = true;
    if ($('menuBtn')) $('menuBtn').hidden = false;
    $('app').hidden = false; $('tabs').hidden = false;
    try { renderMenu(); } catch(e){ console.warn('menu', e); }
    try { await refresh(); } catch(e){ console.warn('refresh', e); }
    try { show('home'); } catch(e){ console.warn('show', e); }
    try { check(function(){ $('upd').hidden = false; }); } catch(e){ console.warn('check', e); }
  }catch(e){
    console.error('boot', e);
    $('who').textContent = 'خطأ: ' + e.message;
    showLogin();
  }
}

$('go').onclick = async function(){
  const b = $('go'), m = $('msg');
  b.disabled = true; m.textContent = 'جارٍ التحقق…';
  try{
    const a = await login($('name').value.trim(), $('no').value, $('pw').value);
    localStorage.setItem('lastNo', a.no);
    const n = await loadFiles(a, function(t){ m.textContent = t; });
    m.textContent = 'تم تحميل ' + n + ' عميل';
    booted = false; unlocked = true;
    tryEnableLock();
    await boot();
  }catch(e){
    m.textContent = '✕ ' + e.message;
    console.error(e);
  }
  b.disabled = false;
};

$('updBtn').onclick = reload;
$('unlockBtn').onclick = tryUnlock;

$('relogin').onclick = async function(){
  if (!confirm('ستدخل بالاسم وكلمة السر من جديد. بياناتك تبقى محفوظة. متابعة؟')) return;
  try{ await disable(); }catch(e){}
  try{ await del('meta','auth'); }catch(e){}
  unlocked = false; booted = false;
  $('locked').hidden = true;
  boot();
};

document.addEventListener('visibilitychange', async function(){
  if (document.hidden) hiddenAt = Date.now();
  else if (hiddenAt && Date.now() - hiddenAt > 60000){
    try{
      if (await isOn()){ unlocked = false; booted = false; hiddenAt = 0; boot(); }
    }catch(e){}
  }
});

document.querySelectorAll('#tabs button').forEach(function(b){
  b.onclick = function(){ st.sel.clear(); st.open = null; show(b.dataset.t); };
});
$('back').onclick = function(){ history.back(); };
addEventListener('popstate', function(){
  if (st.sel.size && !confirm('لديك تحديد غير محفوظ، هل تخرج؟')){
    history.pushState({v:'bld'}, ''); return;
  }
  st.sel.clear(); show(tab);
});

function net(){
  $('net').textContent = navigator.onLine ? 'متصل' : 'بدون إنترنت';
  $('net').dataset.on = navigator.onLine;
}
addEventListener('online', net); addEventListener('offline', net); net();

if ('serviceWorker' in navigator){
  navigator.serviceWorker.register('sw.js').then(function(r){
    r.addEventListener('updatefound', function(){
      const w = r.installing;
      if (w) w.addEventListener('statechange', function(){
        if (w.state === 'installed' && navigator.serviceWorker.controller) w.postMessage({type:'SKIP_WAITING'});
      });
    });
  }).catch(console.warn);
  navigator.serviceWorker.addEventListener('message', function(e){
    if (e.data && e.data.type === 'RELOAD') location.reload();
  });
}

$('menuBtn').onclick = function(e){ e.stopPropagation(); $('menu').hidden = !$('menu').hidden; };
document.addEventListener('click', function(){ $('menu').hidden = true; });

console.log('[app] started');
boot();