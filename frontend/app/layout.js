import './globals.css';

export const metadata = {
  title: 'Cuadra Yape',
  description: 'Registro de Yapes y efectivo para tu negocio.',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon-192.png', apple: '/icon-192.png' },
};

export const viewport = { themeColor: '#ffffff' };

export default function RootLayout({ children }) {
  return <html lang="es-PE"><body>{children}</body></html>;
}
