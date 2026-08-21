import './globals.css';
import Link from 'next/link';
import ToastProvider from './components/ToastProvider';

export const metadata = {
  title: 'TripFlag',
  description: 'Truck Trip Flagging System',
  manifest: '/manifest.json',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#ffffff',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/Logo.png" />
        <link rel="apple-touch-icon" href="/Logo.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="TripFlag" />
      </head>
      <body>
        <ToastProvider />
        <nav className="top-nav">
          <div className="top-nav-content">
            <span className="top-nav-title">Dashboard</span>
            <div className="top-nav-profile">
              <span>Admin</span>
              <div className="avatar">A</div>
            </div>
          </div>
        </nav>
        <div className="app-container" style={{ display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 70px)' }}>
          <div className="page-content" style={{ flex: '1 0 auto' }}>
            {children}
          </div>
          <footer style={{
            marginTop: '40px',
            paddingTop: '20px',
            borderTop: '1px solid rgba(226, 228, 234, 0.6)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.8rem',
            color: 'var(--text-muted)',
            flexShrink: 0
          }}>
            <div style={{ fontWeight: 500 }}>TripFlag v1.0.1</div>
            <div>&copy; {new Date().getFullYear()} Plascom Enterprise Pvt Ltd. All rights reserved.</div>
          </footer>
        </div>
        <nav className="main-nav">
          <div className="nav-brand">
            <img src="/Logo.png" alt="TripFlag" className="nav-logo" />
            <span>TripFlag</span>
          </div>
          <Link href="/rules" className="nav-item" id="nav-rules">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            Rules
          </Link>
          <Link href="/upload" className="nav-item" id="nav-upload">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Upload
          </Link>
          <Link href="/history" className="nav-item" id="nav-history">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            History
          </Link>
          <div style={{ marginTop: 'auto' }}>
            <a href="https://github.com/Flexicom-Industries-Pvt-Ltd/Plascom-TripFlag/releases/latest/download/TripFlag.Setup.1.0.1.exe" className="nav-item" style={{ marginBottom: '1rem', background: '#f8fafc', color: '#0f172a', fontWeight: '600' }} title="Download Desktop App" id="desktop-download-btn">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Desktop App
            </a>
            <div style={{ textAlign: 'center', fontSize: '0.75rem', color: '#94a3b8', paddingBottom: '1rem' }}>
              TripFlag v1.0.1
            </div>
          </div>
        </nav>
        <PWAInstall />
      </body>
    </html>
  );
}

import Script from 'next/script';

function PWAInstall() {
  return (
    <Script id="pwa-install" strategy="afterInteractive" dangerouslySetInnerHTML={{
      __html: `
        (function() {
          // Register service worker
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', function() {
              navigator.serviceWorker.register('/sw.js');
            });
          }

          // PWA Install Prompt
          let deferredPrompt = null;
          window.addEventListener('beforeinstallprompt', function(e) {
            e.preventDefault();
            // Only show install prompt on mobile/tablet screens
            if (window.innerWidth <= 768) {
              deferredPrompt = e;
              showInstallBanner();
            }
          });

          function showInstallBanner() {
            if (document.getElementById('pwa-install-banner')) return;
            
            const banner = document.createElement('div');
            banner.id = 'pwa-install-banner';
            banner.style.cssText = 'position:fixed;bottom:70px;left:12px;right:12px;background:#fff;border:1.5px solid #e2e4ea;border-radius:16px;padding:16px;display:flex;align-items:center;gap:14px;box-shadow:0 8px 30px rgba(0,0,0,0.12);z-index:300;animation:slideUp 0.3s ease';
            
            banner.innerHTML = '<img src="/Logo.png" alt="TripFlag" style="width:48px;height:48px;border-radius:10px;object-fit:contain">'
              + '<div style="flex:1"><div style="font-weight:700;font-size:0.95rem;color:#1a1a2e">Install TripFlag</div><div style="font-size:0.8rem;color:#64668a;margin-top:2px">Add to home screen for quick access</div></div>'
              + '<button id="pwa-install-btn" style="background:#6366f1;color:#fff;border:none;padding:10px 20px;border-radius:10px;font-weight:700;font-size:0.85rem;cursor:pointer;font-family:inherit">Install</button>'
              + '<button id="pwa-dismiss-btn" style="background:none;border:none;color:#9c9eb8;font-size:1.2rem;cursor:pointer;padding:4px 8px">✕</button>';
            
            document.body.appendChild(banner);

            document.getElementById('pwa-install-btn').addEventListener('click', function() {
              if (deferredPrompt) {
                deferredPrompt.prompt();
                deferredPrompt.userChoice.then(function() {
                  deferredPrompt = null;
                  banner.remove();
                });
              }
            });

            document.getElementById('pwa-dismiss-btn').addEventListener('click', function() {
              banner.remove();
            });
          }
        })();
      `
    }} />
  );
}
