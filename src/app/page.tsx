'use client';
import { useState } from 'react';
import Sidebar      from '@/components/Sidebar';
import DashboardTab from '@/components/tabs/DashboardTab';
import VentasTab    from '@/components/tabs/VentasTab';
import ProductosTab from '@/components/tabs/ProductosTab';
import GastosTab    from '@/components/tabs/GastosTab';
import CotizadorTab from '@/components/tabs/CotizadorTab';

export type TabId = 'dashboard' | 'ventas' | 'productos' | 'gastos' | 'cotizador';

export default function Home() {
  const [tab, setTab] = useState<TabId>('dashboard');

  // Todos los tabs quedan montados — solo se muestran/ocultan con CSS.
  // Esto garantiza que los listeners de eventos persisten y los datos
  // se sincronizan correctamente entre pestañas.
  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar active={tab} onChange={setTab} />
      <main className="md:ml-52 px-4 py-6 md:px-8 pb-28 md:pb-8">
        <div className={tab === 'dashboard'  ? '' : 'hidden'}><DashboardTab active={tab === 'dashboard'}  /></div>
        <div className={tab === 'ventas'     ? '' : 'hidden'}><VentasTab    /></div>
        <div className={tab === 'productos'  ? '' : 'hidden'}><ProductosTab /></div>
        <div className={tab === 'gastos'     ? '' : 'hidden'}><GastosTab    /></div>
        <div className={tab === 'cotizador'  ? '' : 'hidden'}><CotizadorTab /></div>
      </main>
    </div>
  );
}
