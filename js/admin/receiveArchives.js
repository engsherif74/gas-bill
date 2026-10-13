// الشيفرة مدمجة داخل admin.html (استلام الأرشيفات، الأزرار، استبعاد المسدد)

let rec=ls('received',{ids:[],paid:{},senders:{}}),btns=ls('buttons',[]);
function drawRec(){$('rcList').innerHTML=Object.entries(rec.senders).map(([no,s])=>`<li class="ok"><b>${no}</b><span>${s.name}: ${s.n} عملية · ${s.total} جنيه · آخر استلام ${s.last}${s.os?` · سداد من مصدر آخر ${s.os}`:''}${s.oor?` · خارج النطاق ${s.oor}`:''}</span></li>`).join('')||'<li><span class="mute">لا أرشيفات مستلمة.</span></li>';}
$('arcIn').onchange=async e=>{
  const raw=ls('master',null);if(!raw){alert('جهّز الملفات مرة أولاً لإنشاء المفتاح الأساسي');return;}
  const master=await crypto.subtle.importKey('raw',unb64(raw),'AES-GCM',true,['encrypt','decrypt']),ids=new Set(rec.ids),msg=[];
  for(const f of e.target.files){try{const a=await unpack(new Uint8Array(await f.arrayBuffer()),master),fresh=a.entries.filter(x=>!ids.has(x.id));
    fresh.forEach(x=>{ids.add(x.id);if(x.type==='pay')rec.paid[a.cycle+'|'+x.key]=1;});
    data.forEach(r=>{const n=a.names[[r.cat,r.sector,r.blk,r.bld,r.apt].join('|')];if(n&&!r.name)r.name=n;});
    const s=rec.senders[a.no]??={name:a.name,n:0,total:0};s.n+=fresh.length;s.total+=fresh.reduce((t,x)=>t+x.amount,0);s.os=(a.otherSource||[]).length;s.oor=fresh.filter(x=>x.out).length;s.last=a.created.slice(0,10);
    msg.push(li('ok',`${f.name}: ${fresh.length} عملية جديدة من ${a.entries.length}`));}catch(err){msg.push(li('err',`${f.name}: تعذر الفتح`));}}
  rec.ids=[...ids];sv('received',rec);sv('data',data);$('rcMsg').innerHTML=msg.join('');drawRec();e.target.value='';};
function drawBtn(){$('bList').innerHTML=btns.map((b,i)=>`<li class="ok"><b>${b.order}</b><span>${b.name} ← ${b.file} (${b.page} / ${b.slot})</span><button class="btn ghost" data-bd="${i}">حذف</button></li>`).join('')||'<li><span class="mute">لا أزرار.</span></li>';$('bList').querySelectorAll('[data-bd]').forEach(x=>x.onclick=()=>{btns.splice(+x.dataset.bd,1);sv('buttons',btns);drawBtn();});}
$('bAdd').onclick=()=>{const name=$('bName').value.trim(),file=$('bFile').value.trim();if(!name||!(/^https:\/\//.test(file)||/^[\w.-]+\.html?$/.test(file)))return alert('اسم الزر مطلوب، والملف اسم صفحة بحروف إنجليزية (مثل readings.html) أو رابط https');btns.push({name,file,page:$('bPage').value,slot:$('bSlot').value,order:+$('bOrd').value||1});sv('buttons',btns);['bName','bFile'].forEach(i=>$(i).value='');drawBtn();};
const hb=$('build').onclick;$('build').onclick=async()=>{const bak=data;if($('exclPaid').checked)data=data.filter(r=>!rec.paid[r.month+'|'+[r.cat,r.sector,r.blk,r.bld,r.apt].join('|')]);try{await hb();}finally{data=bak;}};
drawRec();drawBtn();
