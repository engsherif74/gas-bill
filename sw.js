const CACHE = 'collect-v26';
const SHELL = [
  './','index.html','login.html','manifest.json',
  'css/base.css','css/components.css','css/collector.css',
  'js/core/config.js','js/core/compress.js','js/core/crypto.js','js/core/db.js','js/core/normalize.js','js/core/utils.js',
  'js/collector/app.js','js/collector/unlock.js','js/collector/fileLoader.js','js/collector/browse.js',
  'js/collector/payment.js','js/collector/ledger.js','js/collector/lock.js','js/collector/monthly.js',
  'js/collector/exportExcel.js','js/collector/snapshots.js',
  'pages/print.html','pages/reading.html',
  'js/collector/search.js','js/collector/personal.js','js/collector/export.js','js/collector/reconcile.js',
  'js/collector/updateCheck.js','js/collector/buttons.js','js/collector/details.js','js/collector/names.js',
  'icons/icon-192.png','icons/icon-512.png'
];

self.addEventListener('install', function(e){
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function(c){ return c.addAll(SHELL); }).catch(function(){}));
});

self.addEventListener('activate', function(e){
  e.waitUntil((async function(){
    var keys = await caches.keys();
    await Promise.all(keys.filter(function(k){ return k !== CACHE; }).map(function(k){ return caches.delete(k); }));
    await self.clients.claim();
    var cs = await self.clients.matchAll({type: 'window'});
    cs.forEach(function(c){ c.postMessage({type: 'RELOAD'}); });
  })());
});

self.addEventListener('message', function(e){
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', function(e){
  var u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  if (u.pathname.indexOf('/data/') >= 0 || u.pathname.endsWith('version.json')){
    e.respondWith(fetch(e.request, {cache: 'no-store'}));
    return;
  }
  e.respondWith((async function(){
    var cached = await caches.match(e.request);
    if (cached) return cached;
    try{
      var r = await fetch(e.request);
      var c = r.clone();
      caches.open(CACHE).then(function(x){ return x.put(e.request, c); });
      return r;
    }catch(err){
      return caches.match('index.html');
    }
  })());
});