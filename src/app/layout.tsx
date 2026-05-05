import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Métricas — Negocio de Comida',
  description: 'Dashboard de ventas, costos y productos',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
