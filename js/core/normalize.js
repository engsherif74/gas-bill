import {CFG} from './config.js';

const IN = '٠١٢٣٤٥٦٧٨٩';

// تحويل الأرقام العربية إلى إنجليزية
export const latin = s => String(s ?? '').replace(/[٠-٩]/g, d => IN.indexOf(d));

// تنظيف النصوص من المسافات والأحرف الخفية
export const clean = s => String(s ?? '')
  .normalize('NFKC')
  .replace(/[\u202A-\u202E\u200E\u200F\uFEFF\u00A0\r\n]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

// إضافة صفر بادئ إذا كان الرقم أقل من رقمين
export const pad2 = v => {
  const t = latin(clean(v));
  return /^\d+$/.test(t) ? t.padStart(2, '0') : t;
};

// استدعاء اسم العمود (مع مرادفاته)
export const colName = h => {
  const c = clean(h);
  return CFG.alias[c] || c;
};

// مفتاح البحث (توحيد الحروف العربية)
export const searchKey = s => clean(s)
  .replace(/[\u064B-\u065F\u0640]/g, '')
  .replace(/[أإآ]/g, 'ا')
  .replace(/ى/g, 'ي')
  .replace(/ة/g, 'ه');

// تحويل الشهر إلى صيغة YYYYMM
export const month = v => {
  const t = latin(clean(v));
  let m = t.match(/^(\d{4})\D?(\d{1,2})$/);
  if (m) return m[1] + m[2].padStart(2, '0');
  m = t.match(/^(\d{1,2})\D+(\d{4})$/);
  return m ? m[2] + m[1].padStart(2, '0') : t;
};

// رقم المشترك الفريد
export const subscriberId = (cat, sec, blk, bld, apt, sub = '00') =>
  [cat.gov, cat.area, sec, sec, blk, bld, apt, sub].map(pad2).join('');