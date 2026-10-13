import {get} from '../core/db.js';
const ok=f=>/^https:\/\//.test(f)||/^[\w.-]+\.html?$/.test(f),url=f=>/^https:/.test(f)?f:'pages/'+f;
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
export async function renderSlots(page){
  const f=await get('meta','file'),b=(f?.buttons||[]).filter(x=>x.page===page&&ok(x.file));
  for(const s of ['top','bottom']){
    const el=document.getElementById('slot-'+s);
    el.innerHTML=b.filter(x=>x.slot===s).sort((p,q)=>p.order-q.order).map(x=>`<button class="btn ghost sm" data-f="${esc(x.file)}">${esc(x.name)}</button>`).join('');
    el.querySelectorAll('[data-f]').forEach(btn=>btn.onclick=()=>{
      const d=document.createElement('dialog'),u=url(btn.dataset.f);d.className='viewer';
      d.innerHTML=`<iframe src="${esc(u)}"></iframe><div class="actions"><a class="btn ghost sm" href="${esc(u)}" target="_blank" rel="noopener">فتح في نافذة جديدة</a><button class="btn sm" id="cl">إغلاق</button></div>`;
      d.querySelector('#cl').onclick=()=>{d.close();d.remove();};document.body.append(d);d.showModal();});
  }
}
