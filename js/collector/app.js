import {deriveKey,newMaster,wrapMaster,unwrapMaster,pack,unpack} from '../core/crypto.js';
import {put,get,del} from '../core/db.js';
import {latin,pad2,month,colName,searchKey,subscriberId} from '../core/normalize.js';
import {kb} from '../core/utils.js';
const $=id=>document.getElementById(id);
const out=$('results');
const row=(ok,t,d='')=>{out.insertAdjacentHTML('beforeend',`<li class="${ok?'ok':'bad'}"><b>${ok?'✓':'✕'}</b><span>${t}</span><small>${d}</small></li>`);return ok;};
async function selfTest(no,pw){
  out.innerHTML='';
  const sample={schemaVersion:1,type:'full',cycle:'202610',sectors:{'04':{'01':{'02':{'03':[3,18,'حمدى عبد الحميد']}}}}};
  for(let i=0;i<300;i++)sample.sectors['04']['01']['02'][String(i+4).padStart(3,'0')]=[1,17+i%9,'محي الدين خيري عصر'];
  const raw=new TextEncoder().encode(JSON.stringify(sample));
  try{
    const master=await newMaster(),userKey=await deriveKey(pw,no),env=await wrapMaster(master,userKey);
    const file=await pack(sample,master);
    row(true,'ضغط وتشفير الملف التجريبي',`قبل: ${kb(raw.length)} ← بعد: ${kb(file.length)}`);
    const m2=await unwrapMaster(env,await deriveKey(pw,no));
    row(JSON.stringify(await unpack(file,m2))===JSON.stringify(sample),'فتح الملف بكلمة السر الصحيحة');
    let rejected=false;try{await unwrapMaster(env,await deriveKey(pw+'x',no));}catch{rejected=true;}
    row(rejected,'رفض كلمة السر الخاطئة');
    let tampered=false;const bad=file.slice();bad[40]^=1;try{await unpack(bad,m2);}catch{tampered=true;}
    row(tampered,'رفض ملف تم العبث به');
  }catch(e){row(false,'التشفير والضغط',e.message);}
  row(latin('٢٠٢٦١٠')==='202610'&&pad2('٦')==='06','الأرقام العربية والصفر البادئ','٢٠٢٦١٠ ← 202610 ، ٦ ← 06');
  row(month('10 2026')==='202610'&&month('2026-10')==='202610','توحيد شهر الإصدار','10 2026 ← 202610');
  row(colName('فيمة')==='القيمة'&&colName('الي')==='شهر الإصدار','أسماء الأعمدة البديلة','فيمة ← القيمة ، الي ← شهر الإصدار');
  row(searchKey('أحمد محي الدين ة')===searchKey('احمد محي الدين ه'),'توحيد حروف البحث');
  row(subscriberId({gov:'20',area:'06'},'04','01','02','03')==='2006040401020300','الرقم الفريد من 16 رقماً','2006040401020300');
  try{await put('meta','selftest',{t:1});const v=await get('meta','selftest');await del('meta','selftest');row(v&&v.t===1,'قاعدة بيانات الجهاز');}catch(e){row(false,'قاعدة بيانات الجهاز',e.message);}
  row(!!navigator.serviceWorker?.controller,'العمل بدون إنترنت','أعد تحميل الصفحة مرة بعد أول زيارة ليظهر ✓');
}
$('run').onclick=async()=>{const b=$('run');b.disabled=true;b.textContent='جارٍ الفحص…';await selfTest($('no').value.trim()||'0',$('pw').value||'test');b.disabled=false;b.textContent='أعد الفحص';};
const net=()=>{$('net').textContent=navigator.onLine?'متصل':'بدون إنترنت';$('net').dataset.on=navigator.onLine;};
addEventListener('online',net);addEventListener('offline',net);net();
if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js');
let ip;addEventListener('beforeinstallprompt',e=>{e.preventDefault();ip=e;$('install').hidden=false;});
$('install').onclick=async()=>{if(!ip)return;ip.prompt();await ip.userChoice;$('install').hidden=true;};
