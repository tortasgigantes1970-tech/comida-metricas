'use client';
import { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import DashboardTab from '@/components/tabs/DashboardTab';
import VentasTab    from '@/components/tabs/VentasTab';
import ProductosTab from '@/components/tabs/ProductosTab';
import GastosTab    from '@/components/tabs/GastosTab';

export type TabId = 'dashboard' | 'ventas' | 'productos' | 'gastos';

export default function Home() {
  const [tab, setTab] = useState<TabId>('dashboard');

  const content = {
    dashboard: <DashboardTab />,
    ventas:    <VentasTab    />,
    productos: <ProductosTab />,
    gastos:    <GastosTab    />,
  }[tab];

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar active={tab} onChange={setTab} />
      {/* Desktop: margen izquierdo por el sidebar. Mobile: margen inferior por el bottom nav */}
      <main className="md:ml-52 px-4 py-6 md:px-8 pb-28 md:pb-8">
        {content}
      </main>
    </div>
  );
}
