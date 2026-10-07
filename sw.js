/* Service worker — estratégia "rede primeiro" para o HTML.
   Isso evita o problema clássico de o GitHub Pages continuar servindo
   uma versão antiga do index.html depois de uma atualização. */

const VERSAO = "horacio-v1.1.0";
const ESTATICOS = ["./manifest.json", "./icon.svg"];

self.addEventListener("install", function (ev) {
  self.skipWaiting();
  ev.waitUntil(
    caches.open(VERSAO).then(function (c) {
      return c.addAll(ESTATICOS).catch(function () {});
    })
  );
});

self.addEventListener("activate", function (ev) {
  ev.waitUntil(
    caches.keys().then(function (chaves) {
      return Promise.all(chaves.map(function (k) {
        if (k !== VERSAO) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("message", function (ev) {
  if (ev.data === "skipWaiting") self.skipWaiting();
});

self.addEventListener("fetch", function (ev) {
  const req = ev.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // Firebase, CDNs: direto na rede

  const ehPagina = req.mode === "navigate" ||
                   (req.headers.get("accept") || "").indexOf("text/html") >= 0 ||
                   url.pathname.endsWith(".html");

  if (ehPagina) {
    /* rede primeiro, cache só como reserva para offline */
    ev.respondWith(
      fetch(req).then(function (res) {
        const copia = res.clone();
        caches.open(VERSAO).then(function (c) { c.put(req, copia); });
        return res;
      }).catch(function () {
        return caches.match(req).then(function (r) { return r || caches.match("./index.html"); });
      })
    );
    return;
  }

  /* demais arquivos do app: cache primeiro, atualizando em segundo plano */
  ev.respondWith(
    caches.match(req).then(function (cacheado) {
      const rede = fetch(req).then(function (res) {
        const copia = res.clone();
        caches.open(VERSAO).then(function (c) { c.put(req, copia); });
        return res;
      }).catch(function () { return cacheado; });
      return cacheado || rede;
    })
  );
});
