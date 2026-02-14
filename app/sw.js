// ============================================
// Service Worker - 오프라인 지원 및 캐시 관리
// ============================================
// PWA가 오프라인에서도 동작하도록 리소스를 캐시합니다.
// 앱 업데이트 시 CACHE_VERSION을 올리면 자동으로 새 캐시가 적용됩니다.
// ============================================

const CACHE_VERSION = 'workout-tracker-v1';

// 캐시할 파일 목록 (앱 실행에 필요한 모든 파일)
const CACHE_FILES = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/app.js',
  '/js/db.js',
  '/js/excel.js',
  '/js/workout.js',
  '/js/history.js',
  '/lib/xlsx.full.min.js',
  '/lib/chart.min.js',
  '/manifest.json'
];

// ---- install 이벤트: 앱 처음 설치 시 리소스를 캐시 ----
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => {
        console.log('[SW] 리소스 캐시 중...');
        return cache.addAll(CACHE_FILES);
      })
      .then(() => {
        // 새 Service Worker가 바로 활성화되도록 함
        return self.skipWaiting();
      })
  );
});

// ---- activate 이벤트: 이전 버전 캐시 삭제 ----
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // 현재 버전이 아닌 캐시는 삭제
          if (cacheName !== CACHE_VERSION) {
            console.log('[SW] 이전 캐시 삭제:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // 모든 클라이언트에 즉시 적용
      return self.clients.claim();
    })
  );
});

// ---- fetch 이벤트: 네트워크 우선, 실패 시 캐시 사용 ----
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // 네트워크 응답을 캐시에 복사 후 반환
        const responseClone = response.clone();
        caches.open(CACHE_VERSION).then((cache) => {
          cache.put(event.request, responseClone);
        });
        return response;
      })
      .catch(() => {
        // 네트워크 실패 시 캐시에서 반환 (오프라인 지원)
        return caches.match(event.request);
      })
  );
});
