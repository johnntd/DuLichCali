self.PORTAL_SW_CONFIG = {
  cacheVersion: 'driver-v1-20260606a',
  scope: '/driver/',
  startUrl: '/driver/dashboard.html',
  shellUrls: [
    '/driver/dashboard.html',
    '/driver/login.html',
    '/driver/manifest.webmanifest',
    '/assets/icons/driver-192.png',
    '/assets/icons/driver-512.png',
    '/portal-kit/portal-kit.css',
    '/portal-kit/portal-pwa.js',
    '/portal-kit/portal-auth.js',
    '/portal-kit/portal-notify.js',
    '/portal-kit/portal-shell.js'
  ]
};
importScripts('/portal-kit/portal-sw-core.js?v=20260606a');
