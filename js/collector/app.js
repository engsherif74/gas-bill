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

const $=id=>document.getElementById(id),view=$('view');
let tab='home';
const R={home:()=>renderHome(view),ledger:()=>renderLedger(view,reload,doExport),search:()=>renderSearch(view),archive:()=>renderArchive(view),details:()=>renderDetails(view,()=>show('home'))};
const show=t=>{tab=t;st.bld=null;st.all=false;$('back').hidden=true;document.querySelectorAll('#tabs button').forEach(b=>b.classList.toggle('on',b.dataset.t===t));R[t]();};

async function doExport(){try{const a=await get('meta','auth');const r=await exportArchive(a);toast(r.n?`جُهّز ${r.n} عملية: ${r.name}`:'لا جديد للإرسال');}catch(e){toast(e.message);}}

async function reload(){
  try{
    const a=await get('meta','auth'),f=await get('meta','file');
    toast('جارٍ تحديث الملف…');
    await loadFiles(a,()=>{},async n=>{
      const r=await reconcile(st.S,n.pairs,f?.cycle,n.full.cycle);
      await put('previousFile','prev',{cycle:f?.cycle,subs:st.S});
      if(r.other.length){
        await choose(`سيتحول ${r.other.length} عميل إلى مسدد. هل تتابع؟`,['موافق'],false);
        await putMany('otherSource',r.other.map(o=>[o.id,o]));
      }
    });
    await refresh();
    $('upd').hidden=true;
    toast('تم تحديث الملف');
    const f2=await get('meta','file');
    st.cycle=f2.cycle;
    renderMenu();
    $('who').textContent=`${a.name} · إصدار ${f2.cycle}`;
    show(tab);
  }catch(e){toast(e.message);console.error(e);}
}

let unlocked=false,hiddenAt=0;

function showLogin(){
  ['app','locked','tabs'].forEach(i=>{if($(i))$(i).hidden=true;});
  $('login').hidden=false;
  $('who').textContent='تسجيل الدخول';
  if($('menuBtn'))$('menuBtn').hidden=true;
  $('no').value=localStorage.getItem('lastNo')||'';
}

function showLocked(){
  ['login','app','tabs'].forEach(i=>{if($(i))$(i).hidden=true;});
  $('locked').hidden=false;
  tryUnlock();
}

async function tryUnlock(){
  $('lmsg').textContent='';
  try{
    await verify();
    unlocked=true;
    $('locked').hidden=true;
    await boot();
  }catch{
    $('lmsg').textContent='لم يتم التحقق. اضغط «فتح» وحاول مرة أخرى.';
  }
}

async function tryEnableLock(){
  // لا تُعلق التنفيذ: لا تستخدم confirm هنا، فقط فعّل بهدوء إن أمكن
  try{
    if(await isOn())return;
    if(!(await supported()))return;
    // تأجيل السؤال حتى لا يعطل boot
    setTimeout(async()=>{
      try{
        if(confirm('تفعيل فتح التطبيق ببصمة أو نقش أو كلمة مرور الجهاز؟')){
          await enable();
          alert('تم تفعيل القفل.');
        }
      }catch(e){console.warn(e);}
    }, 500);
  }catch(e){console.warn(e);}
}

async function boot(){
  try{
    const a=await get('meta','auth');
    const f=await get('meta','file');
    if(!a||!f){showLogin();return;}
    if(!unlocked&&await isOn()){showLocked();return;}
    st.no=a.no;st.cycle=f.cycle;st.who=a.name;
    $('who').textContent=`${a.name} · إصدار ${f.cycle}`;
    $('login').hidden=true;$('locked').hidden=true;
    if($('menuBtn'))$('menuBtn').hidden=false;
    $('app').hidden=false;$('tabs').hidden=false;
    try{ renderMenu(); }catch(e){console.warn('menu',e);}
    try{ await refresh(); }catch(e){console.warn('refresh',e);}
    try{ show('home'); }catch(e){console.warn('show',e);}
    check(()=>{$('upd').hidden=false;});
  }catch(e){
    console.error('boot',e);
    $('who').textContent='خطأ: '+e.message;
  }
}

$('go').onclick=async()=>{
  const b=$('go'),m=$('msg');b.disabled=true;m.textContent='جارٍ التحقق…';
  try{
    const a=await login($('name').value.trim(),$('no').value,$('pw').value);
    localStorage.setItem('lastNo',a.no);
    const n=await loadFiles(a,t=>m.textContent=t);
    m.textContent=`تم تحميل ${n} عميل`;
    tryEnableLock(); // لا await
    await boot();
  }catch(e){m.textContent='✕ '+e.message;}
  b.disabled=false;
};

$('updBtn').onclick=reload;
$('unlockBtn').onclick=tryUnlock;

$('relogin').onclick=async()=>{
  if(confirm('ستدخل بالاسم وكلمة السر من جديد ويُلغى القفل. بياناتك وتحصيلاتك تبقى محفوظة. متابعة؟')){
    try{await disable();}catch{}
    try{await del('meta','auth');}catch{}
    unlocked=false;
    $('locked').hidden=true;
    boot();
  }
};

document.addEventListener('visibilitychange',async()=>{
  if(document.hidden)hiddenAt=Date.now();
  else if(hiddenAt&&Date.now()-hiddenAt>60000){
    try{ if(await isOn()){unlocked=false;hiddenAt=0;boot();} }catch{}
  }
});

document.querySelectorAll('#tabs button').forEach(b=>b.onclick=()=>{st.sel.clear();st.open=null;show(b.dataset.t);});
$('back').onclick=()=>history.back();
addEventListener('popstate',()=>{if(st.sel.size&&!confirm('لديك تحديد غير محفوظ، هل تخرج؟')){history.pushState({v:'bld'},'');return;}st.sel.clear();show(tab);});

const net=()=>{$('net').textContent=navigator.onLine?'متصل':'بدون إنترنت';$('net').dataset.on=navigator.onLine;};
addEventListener('online',net);addEventListener('offline',net);net();

if('serviceWorker'in navigator){
  navigator.serviceWorker.register('sw.js').then(r=>{
    // إذا وُجد إصدار جديد، حدّثه فوراً
    r.addEventListener('updatefound',()=>{
      const w=r.installing;
      if(w)w.addEventListener('statechange',()=>{
        if(w.state==='installed'&&navigator.serviceWorker.controller){
          w.postMessage({type:'SKIP_WAITING'});
          setTimeout(()=>location.reload(),300);
        }
      });
    });
  }).catch(console.warn);
}

$('menuBtn').onclick=e=>{e.stopPropagation();$('menu').hidden=!$('menu').hidden;};
document.addEventListener('click',()=>{$('menu').hidden=true;});

boot();