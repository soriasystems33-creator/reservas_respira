import './globals.css';
import PWAInstallBanner from './components/PWAInstallBanner';

export const metadata = {
  title: 'Estética Respira | Reserva tu cita online',
  description: 'Reserva tu cita online en Estética Respira. Centro de transformación y belleza en Artà.',
  manifest: '/manifest.json',
  icons: {
    icon: '/logo-icono.png',
    shortcut: '/logo-icono.png',
    apple: '/logo-icono.png',
  },
};

export const viewport = {
  themeColor: '#2A3B28',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#2A3B28" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Estética Respira" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased">
        {children}
        <PWAInstallBanner />
      </body>
    </html>
  );
}
