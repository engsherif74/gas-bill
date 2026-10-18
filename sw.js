import {get} from '../core/db.js';

export async function monthsFor(s){
  if (s.invoices && Array.isArray(s.invoices) && s.invoices.length) return s.invoices;
  const legacy = await get('legacyMonths', s.sector + '|' + s.blk + '|' + s.bld + '|' + s.apt);
  if (legacy && Array.isArray(legacy) && legacy.length) return legacy;
  return null;
}

export function monthOptions(s){
  const inv = s.invoices;
  if (!inv || !Array.isArray(inv) || inv.length < 2) return null;
  const sorted = [...inv].sort((a,b)=> (a.month||'') < (b.month||'') ? -1 : 1);
  const opts = [];
  let cumCount = 0, cumAmount = 0;
  sorted.forEach((inv, i)=>{
    cumCount += inv.count || 1;
    cumAmount += inv.amount || 0;
    opts.push({ count: cumCount, amount: cumAmount, label: inv.month || ('فاتورة ' + (i+1)) });
  });
  const maxCount = s.count || cumCount;
  const maxAmount = s.value || cumAmount;
  return opts.filter(o => o.count <= maxCount && o.amount <= maxAmount);
}