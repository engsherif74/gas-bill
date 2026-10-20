<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#0f766e">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="التحصيل">
<link rel="manifest" href="manifest.json">
<link rel="apple-touch-icon" href="icon-192.png">
<title>محصّل الغاز</title>
<link rel="stylesheet" href="css/base.css">
<link rel="stylesheet" href="css/components.css">
<link rel="stylesheet" href="css/collector.css">
</head>
<body>

<header class="top">
  <div class="hrow">
    <div class="logo">
      <svg viewBox="0 0 48 48" width="24" height="24" fill="currentColor"><path d="M24 3c3 9 14 13 14 26a14 14 0 0 1-28 0c0-6 3-9 6-12 0 5 3 7 5 7-2-8 0-15 3-21z"/></svg>
    </div>
    <h1><span id="ttl">محصّل الغاز</span><small id="sub">الشهر الحالي</small></h1>
    <span id="net" class="pill hidden" data-on="false">بدون إنترنت</span>
    <button class="chipb sq" id="theme" aria-label="تغيير المظهر">🌙</button>
    <button class="chipb hidden" id="back" aria-label="رجوع">→</button>
  </div>
</header>

<main id="v1">
  <!-- لوحة المؤشرات -->
  <div class="kpis">
    <div class="kpi main"><div class="l">المتبقي من المديونية</div><div class="n" id="kRem">0</div><div class="bar"><i id="kBar" style="width:0%"></i></div></div>
    <div class="kpi"><div class="l">محصّل اليوم</div><div class="n" id="kToday">0</div></div>
    <div class="kpi"><div class="l">نسبة التحصيل</div><div class="n" id="kPct">0%</div></div>
  </div>

  <!-- البحث السريع -->
  <label class="search">
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.8l-.3-.3A6.5 6.5 0 1 0 9.5 16a6.5 6.5 0 0 0 4.2-1.6l.3.3v.8l5 5 1.5-1.5-5-5zm-6 0a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9z"/></svg>
    <input id="q" type="search" inputmode="search" autocomplete="off" placeholder="ابحث باسم العميل...">
    <button class="lnk hidden" id="qx" aria-label="مسح">✕</button>
  </label>
  <div class="wrap hidden" id="qwrap">
    <div class="card">
      <div class="h2" style="display:flex;justify-content:space-between;margin-bottom:.6rem"><span>نتائج البحث</span><span class="mute" id="qn"></span></div>
      <div class="list" id="qres" style="margin-top:0"></div>
    </div>
  </div>

  <!-- شريط الاختيار -->
  <div class="pick">
    <label class="field"><span>القطاع</span><input id="secIn" class="num2" type="text" inputmode="numeric" maxlength="2" value="" data-next="blkIn"></label>
    <label class="field"><span>البلوك</span><input id="blkIn" class="num2" type="text" inputmode="numeric" maxlength="2" value="" data-next="bldIn"></label>
    <label class="field"><span>العمارة</span><input id="bldIn" class="num2" type="text" inputmode="numeric" maxlength="2" value="" data-next="aptIn"></label>
    <label class="field"><span>الشقة</span><input id="aptIn" class="num2" type="text" inputmode="numeric" maxlength="2" value=""></label>
  </div>

  <p class="sum" id="sumLine"></p>
  <div class="blist" id="blist"></div>
  <div id="buildingView"></div>
  <div id="bottomBar"></div>
</main>

<main id="v2" class="hidden">
  <section id="view"></section>
</main>

<nav class="tabs" id="tabs" hidden>
  <button data-t="home" class="on"><span class="ico-emoji">📋</span>التحصيل</button>
  <button data-t="ledger"><span class="ico-emoji">✅</span>ما تم تحصيله</button>
  <button data-t="search"><span class="ico-emoji">🔍</span>بحث</button>
</nav>

<footer class="app-footer" id="footer" hidden>
  <span>تطوير: <b>شريف نشأت</b></span>
  <span> · </span>
  <span>الإصدار: <b>2.0.0</b></span>
</footer>

<div id="toast" role="status" aria-live="polite"></div>

<script type="module" src="js/collector/app.js"></script>
</body>
</html>