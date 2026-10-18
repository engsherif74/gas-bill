import {get} from '../core/db.js';

/* 
  monthsFor(s) → مصفوفة الشهور المتاحة للعميل
  تعتمد على:
  1. إن وُجد s.invoices → تُستخدم مباشرة
  2. إن وُجد سجل قديم في legacyMonths → يُستخدم لاستخراج الشهور
  3. وإلا → لا شيء
*/
export async function monthsFor(s){
  if (s.invoices && Array.isArray(s.invoices) && s.invoices.length) return s.invoices;
  
  const legacy = await get('legacyMonths', s.sector + '|' + s.blk + '|' + s.bld + '|' + s.apt);
  if (legacy && Array.isArray(legacy) && legacy.length) return legacy;
  
  return null;
}

/* 
  monthOptions(s) → خيارات السداد الجزئي بناءً على الشهور
  المنطق:
  - إذا كانت الشهور المتاحة:
    - نرتب تصاعدياً
    - كل خيار = تجميع الشهور من الأقدم إلى الشهر i
    - القيمة = تراكمي الشهر i - تراكمي الشهر السابق (أي: الفرق)
  - مثال:
    شهر 2: 200 (عدد 1)
    شهر 3: 500 (عدد 2)
    → فاتورة 2 = 200 (عدد 1)
    → فاتورة 3 = 300 (عدد 1) [500 - 200]
    → الخيارات:
      - عدد 1 — 200 (شهر 2)
      - عدد 2 — 500 (شهر 2 + 3)
  - إذا لم تكن الشهور متاحة → null (يستخدم الإدخال اليدوي)
*/
export function monthOptions(s){
  const inv = s.invoices;
  if (!inv || !Array.isArray(inv) || inv.length < 2) return null;
  
  const sorted = [...inv].sort((a,b)=> (a.month||'') < (b.month||'') ? -1 : 1);
  const opts = [];
  let cumCount = 0;
  let cumAmount = 0;
  
  sorted.forEach((inv, i)=>{
    const cnt = inv.count || 1;
    const amt = inv.amount || 0;
    cumCount += cnt;
    cumAmount += amt;
    opts.push({
      count: cumCount,
      amount: cumAmount,
      label: inv.month || ('فاتورة ' + (i+1))
    });
  });
  
  const maxCount = s.count || cumCount;
  const maxAmount = s.value || cumAmount;
  
  return opts.filter(o => o.count <= maxCount && o.amount <= maxAmount);
}