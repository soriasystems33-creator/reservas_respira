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

    // Si no está instalada ni descartada, mostrar con animación suave
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
      setShowIOSTip(true);
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
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:bottom-6 md:w-[410px] z-[99999] transition-all duration-300 animate-slide-up">
      <div className="relative bg-gradient-to-br from-[#1b2b1a] via-[#152215] to-[#0f170e] text-white p-3.5 sm:p-4 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.6)] border border-[#6b8a5a]/50 backdrop-blur-xl flex flex-col gap-2.5">
        <div className="flex items-center gap-3">
          <img
            src="/logo-icono.png"
            alt="Respira"
            className="w-12 h-12 rounded-xl object-cover shadow-md border border-white/10 flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 leading-tight">
              <span className="font-bold text-sm text-stone-100 truncate">Estética Respira</span>
              <span className="bg-[#6b8a5a]/30 text-emerald-300 text-[10px] font-extrabold px-1.5 py-0.5 rounded border border-[#6b8a5a]/50 uppercase tracking-wider">
                App
              </span>
            </div>
            <p className="text-xs text-stone-300/90 leading-snug mt-0.5">
              Instala la app directa en tu dispositivo para pedir citas al instante.
            </p>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={handleInstallClick}
              className="flex items-center gap-1.5 px-3.5 py-2.5 bg-gradient-to-r from-emerald-600 to-[#6b8a5a] hover:from-emerald-500 hover:to-[#7ca069] active:scale-95 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-950/40 transition-all cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>Instalar</span>
            </button>
            <button
              onClick={handleDismiss}
              className="text-stone-400 hover:text-white p-1.5 rounded-lg transition-colors cursor-pointer"
              title="Cerrar"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {showIOSTip && (
          <div className="text-[11px] text-amber-200 bg-amber-950/60 border border-amber-600/30 rounded-lg p-2 leading-relaxed">
            En Safari: pulsa el botón <strong>Compartir</strong> (icono de cuadrado con flecha hacia arriba) y selecciona <strong>"Añadir a pantalla de inicio"</strong>.
          </div>
        )}
      </div>
    </div>
  );
}
