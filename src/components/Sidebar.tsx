'use client';
import { LayoutDashboard, ShoppingCart, Package, Receipt, Calculator } from 'lucide-react';
import { TabId } from '@/app/page';

const NAV = [
  { id: 'dashboard'  as TabId, label: 'Dashboard',   icon: LayoutDashboard },
  { id: 'ventas'     as TabId, label: 'Ventas',       icon: ShoppingCart    },
  { id: 'productos'  as TabId, label: 'Productos',    icon: Package         },
  { id: 'gastos'     as TabId, label: 'Gastos',       icon: Receipt         },
  { id: 'cotizador'  as TabId, label: 'Cotizador',    icon: Calculator      },
];

interface Props {
  active: TabId;
  onChange: (t: TabId) => void;
}

export default function Sidebar({ active, onChange }: Props) {
  return (
    <>
      {/* ── Desktop sidebar ── */}
      <aside className="hidden md:flex flex-col fixed left-0 top-0 h-full w-52 bg-white border-r border-gray-100 z-40">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🍽️</span>
            <div>
              <p className="font-bold text-gray-800 text-sm leading-tight">Métricas</p>
              <p className="text-xs text-gray-400 leading-tight">Negocio de comida</p>
            </div>
          </div>
        </div>
        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => onChange(id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                active === id
                  ? 'bg-orange-50 text-orange-600'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
              }`}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </nav>
      </aside>

      {/* ── Mobile bottom nav ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-40 flex">
        {NAV.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onChange(id)}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-xs font-medium transition-colors ${
              active === id ? 'text-orange-500' : 'text-gray-400'
            }`}
          >
            <Icon size={20} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </>
  );
}
