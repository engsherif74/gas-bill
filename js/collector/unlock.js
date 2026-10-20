import {deriveKey, unwrapMaster} from '../core/crypto.js';
import {put} from '../core/db.js';
import {latin} from '../core/normalize.js';

const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

export const getBin = async p => {
  const r = await fetch(p, {cache: 'no-store'});
  if (!r.ok) throw new Error('الملف ' + decodeURIComponent(p) + ' غير موجود في مكانه (رمز ' + r.status + '). تأكد من رفعه ومن أن الإنترنت يعمل');
  return new Uint8Array(await r.arrayBuffer());
};

export async function login(no, pw) {
  no = latin(String(no).trim());
  pw = String(pw).trim();

  const keys = JSON.parse(new TextDecoder().decode(await getBin('data/keys.bin')));
  const env = keys.envelopes[no];

  if (!env) {
    // إذا لم يُعثر على الرقم، نطبع المفاتيح المتاحة للمساعدة
    const available = Object.keys(keys.envelopes);
    console.error('الرقم المُدخل:', JSON.stringify(no), '| المفاتيح المتاحة:', available);
    throw new Error('رقم الأداء غير مسجل. المسجل: ' + available.slice(0, 5).join('، '));
  }

  let userName = keys.names?.[no] || 'محصّل';
  if (!keys.names?.[no]) {
    console.warn('لم يتم العثور على اسم المحصل. سيتم استخدام "محصّل" كاسم افتراضي. يرجى التواصل مع الأدمن.');
  }

  const userKey = await deriveKey(pw, no);
  let master;
  try {
    master = await unwrapMaster(unb64(env), userKey);
  } catch {
    throw new Error('كلمة السر غير صحيحة');
  }

  const a = {name: userName, no, userKey, master};
  await put('meta', 'auth', a);
  return a;
}