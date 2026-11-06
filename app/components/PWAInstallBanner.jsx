'use client';

import { useState, useEffect } from 'react';

export default function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [visible, setVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSTip, setShowIOSTip] = useState(false);

  useEffect(() => {
    // 1. Registro de Service Worker para PWA
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('PWA SW error:', err);
      });
    }

    // 2. Comprobar si ya está instalada o en modo standalone
    const isInstalled = () => {
      if (typeof window === 'undefined') return false;
      return (
        window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone === true ||
        document.referrer.includes('android-app://') ||
        localStorage.getItem('respira_app_installed') === 'true'
      );
    };

    if (isInstalled()) return;

    // Detectar iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(isIOSDevice);

    // 3. Capturar evento de instalación nativa
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      if (sessionStorage.getItem('respira_pwa_dismissed') !== 'true') {
        setVisible(true);
      }
    };

    // 4. Desaparece en el instante exacto que se instala
    const handleAppInstalled = () => {
      setVisible(false);
      localStorage.setItem('respira_app_installed', 'true');
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Mostrar de forma discreta tras 1.2s
    const timer = setTimeout(() => {
      if (!isInstalled() && sessionStorage.getItem('respira_pwa_dismissed') !== 'true') {
        setVisible(true);
      }
    }, 1200);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
      clearTimeout(timer);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice && choice.outcome === 'accepted') {
        setVisible(false);
        localStorage.setItem('respira_app_installed', 'true');
      }
      setDeferredPrompt(null);
    } else if (isIOS) {
      setShowIOSTip(prev => !prev);
    } else {
      setVisible(false);
      alert('Pulsa en el icono de instalación (⊕) en la barra de navegación para crear el acceso directo de la app.');
    }
  };

  const handleDismiss = () => {
    setVisible(false);
    sessionStorage.setItem('respira_pwa_dismissed', 'true');
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 sm:left-auto sm:right-5 sm:translate-x-0 z-[99999] transition-all duration-300 pointer-events-auto">
      <div className="bg-stone-900/95 backdrop-blur-md text-white pl-3 pr-2.5 py-1.5 rounded-full shadow-2xl border border-white/15 flex items-center gap-2.5">
        <img
          src="/logo-icono.png"
          alt="Respira"
          className="w-6 h-6 rounded-full object-cover border border-white/20 shrink-0"
        />
        <div className="flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold text-stone-200">
          <span>App Reservas</span>
        </div>
        <button
          onClick={handleInstallClick}
          className="px-2.5 py-1 bg-gradient-to-r from-emerald-600 to-[#6b8a5a] hover:from-emerald-500 hover:to-[#7ca069] active:scale-95 text-white text-[11px] font-bold rounded-full shadow transition-all cursor-pointer shrink-0 flex items-center gap-1"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          <span>Instalar</span>
        </button>
        <button
          onClick={handleDismiss}
          className="text-stone-400 hover:text-white p-0.5 rounded-full transition-colors cursor-pointer shrink-0"
          title="Cerrar"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {showIOSTip && (
        <div className="mt-1.5 text-[11px] text-amber-200 bg-stone-900/95 backdrop-blur-md border border-amber-600/40 rounded-xl p-2 shadow-xl leading-snug max-w-xs text-center">
          En Safari: pulsa <strong>Compartir</strong> y selecciona <strong>"Añadir a pantalla de inicio"</strong>.
        </div>
      )}
    </div>
  );
}
