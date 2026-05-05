import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Métricas — Negocio de Comida',
    short_name: 'Métricas',
    description: 'Dashboard de ventas, costos y productos',
    start_url: '/',
    display: 'standalone',
    background_color: '#f9fafb',
    theme_color: '#f97316',
    orientation: 'portrait-primary',
    icons: [
      {
        src: '/icon?<generated>',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icon?<generated>',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  };
}
