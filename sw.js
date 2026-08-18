// PaddleOCR 모델(수십 MB)과 onnxruntime-web wasm을 한 번 받으면 이 브라우저에 계속 저장해 두고 재사용한다.
// 이 파일들은 Web Worker 안에서 fetch되는데, 워커 모드에서는 커스텀 fetch 함수를 못 넘겨주기 때문에
// (라이브러리가 명시적으로 막아둠) 앱 코드로는 캐싱을 못 하고, 이렇게 네트워크 계층에서 가로채는
// 서비스워커로 처리한다. 페이지를 새로고침해도, 다른 영상을 열어도 이 캐시는 그대로 남아 있다.

const CACHE_NAME = 'paddleocr-assets-v1'
// 이 호스트로 가는 요청만 캐시 대상으로 삼는다 (모델 파일 + onnxruntime wasm/js).
const CACHEABLE_HOSTS = ['bcebos.com', 'cdn.jsdelivr.net']

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

function isCacheable(url) {
  try {
    const host = new URL(url).hostname
    return CACHEABLE_HOSTS.some((h) => host.endsWith(h))
  } catch {
    return false
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET' || !isCacheable(request.url)) return

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME)
    const cached = await cache.match(request)
    if (cached) return cached
    try {
      const response = await fetch(request)
      // 응답이 정상이면(불완전/에러 응답은 캐시하지 않음) 다음번을 위해 저장해 둔다.
      if (response && response.ok) cache.put(request, response.clone())
      return response
    } catch (err) {
      // 네트워크 실패 시, 혹시 예전에 받아둔 게 있으면 그거라도 준다.
      const fallback = await cache.match(request)
      if (fallback) return fallback
      throw err
    }
  })())
})
