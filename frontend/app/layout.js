import './globals.css';

export const metadata = {
  title: 'Cuadra Dinero',
  description: 'Registro de Yapes y efectivo para tu negocio.',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/logo-cuadra-dinero.jpg', apple: '/logo-cuadra-dinero.jpg' },
};

export const viewport = { themeColor: '#07132e' };

export default function RootLayout({ children }) {
  return <html lang="es-PE"><body>{children}</body></html>;
}
