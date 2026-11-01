import { Plus_Jakarta_Sans, Nunito } from 'next/font/google';
import './globals.css';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-cormorant',
  display: 'swap',
});

const nunito = Nunito({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-nunito',
  display: 'swap',
});

export const metadata = {
  title: 'Estética Respira | Reserva tu cita online',
  description: 'Reserva tu cita online en Estética Respira. Centro de transformación y belleza en Artà.',
  icons: {
    icon: '/logo-icono.png',
    shortcut: '/logo-icono.png',
    apple: '/logo-icono.png',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className={`${jakarta.variable} ${nunito.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
