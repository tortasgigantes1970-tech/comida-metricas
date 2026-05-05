'use client';
import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, ShoppingBag, Minus } from 'lucide-react';

interface DashData {
  hoy:    { ventas: number; costo: number; ganancia: number; margen: number };
  semana: { ventas: number; costo: number; ganancia: number; margen: number };
  mes:    { ventas: number; costo: number; ganancia: number; margen: number; gastos: number; ganancia_neta: number; margen_neto: number };
  tendencia:     { fecha: string; ventas: number; costo: number }[];
  top_productos: { nombre_producto: string; unidades: number; revenue: number; costo: number }[];
  gastos_cat:    { categoria: string; total: number }[];
}

const $ = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);

function StatCard({ label, value, sub, color = 'gray' }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color === 'green' ? 'text-emerald-600' : color === 'red' ? 'text-red-500' : color === 'orange' ? 'text-orange-500' : 'text-gray-800'}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function formatFecha(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return `${d}/${m}`;
}

export default function DashboardTab() {
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/dashboard');
      setData(await r.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) return <div className="flex items-center justify-center h-60 text-gray-400">Cargando...</div>;
  if (!data)   return <div className="text-red-500">Error al cargar datos</div>;

  const { hoy, semana, mes, tendencia, top_productos, gastos_cat } = data;
  const hoyStr = format(new Date(), "EEEE d 'de' MMMM", { locale: es });

  return (
    <div className="space-y-6 pb-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-800 capitalize">{hoyStr}</h1>
        <p className="text-sm text-gray-400">Resumen del negocio</p>
      </div>

      {/* Hoy */}
      <section>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Hoy</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Ventas"   value={$(hoy.ventas)}   color="orange" />
          <StatCard label="Costo"    value={$(hoy.costo)}    />
          <StatCard label="Ganancia" value={$(hoy.ganancia)} color={hoy.ganancia >= 0 ? 'green' : 'red'} />
          <StatCard label="Margen"   value={`${hoy.margen}%`} sub="ganancia bruta" color={hoy.margen >= 50 ? 'green' : hoy.margen >= 30 ? 'orange' : 'red'} />
        </div>
      </section>

      {/* Esta semana */}
      <section>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Esta semana</h2>
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Ventas"   value={$(semana.ventas)}   color="orange" />
          <StatCard label="Costo"    value={$(semana.costo)}    />
          <StatCard label="Ganancia" value={$(semana.ganancia)} color={semana.ganancia >= 0 ? 'green' : 'red'} />
        </div>
      </section>

      {/* Este mes */}
      <section>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Este mes</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatCard label="Ventas"       value={$(mes.ventas)}        color="orange" />
          <StatCard label="Costo ventas" value={$(mes.costo)}         />
          <StatCard label="Gan. bruta"   value={$(mes.ganancia)}      color="green"  sub={`${mes.margen}% margen`} />
          <StatCard label="Gastos oper." value={$(mes.gastos)}        color="red"    />
          <StatCard label="Gan. neta"    value={$(mes.ganancia_neta)} color={mes.ganancia_neta >= 0 ? 'green' : 'red'} sub={`${mes.margen_neto}% margen neto`} />
        </div>
      </section>

      {/* Tendencia */}
      {tendencia.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Últimos 30 días</h2>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={tendencia} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="fecha" tickFormatter={formatFecha} tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <YAxis tickFormatter={v => `$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: '#9ca3af' }} width={42} />
                <Tooltip
                  formatter={(v: number) => $(v)}
                  labelFormatter={formatFecha}
                  contentStyle={{ borderRadius: 12, border: '1px solid #f3f4f6', fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="ventas"   name="Ventas"   stroke="#f97316" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="costo"    name="Costo"    stroke="#6b7280" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* Top productos */}
      {top_productos.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Más vendidos (mes)</h2>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {top_productos.map((p, i) => {
              const margen = p.revenue > 0 ? Math.round(((p.revenue - p.costo) / p.revenue) * 100) : 0;
              return (
                <div key={i} className={`flex items-center px-4 py-3 gap-3 ${i < top_productos.length - 1 ? 'border-b border-gray-50' : ''}`}>
                  <span className="text-sm font-bold text-gray-300 w-5">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{p.nombre_producto}</p>
                    <p className="text-xs text-gray-400">{p.unidades} uds · {margen}% margen</p>
                  </div>
                  <span className="text-sm font-semibold text-orange-500">{$(p.revenue)}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Gastos por categoría */}
      {gastos_cat.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Gastos del mes por categoría</h2>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {gastos_cat.map((g, i) => (
              <div key={i} className={`flex items-center justify-between px-4 py-3 ${i < gastos_cat.length - 1 ? 'border-b border-gray-50' : ''}`}>
                <span className="text-sm text-gray-700">{g.categoria}</span>
                <span className="text-sm font-semibold text-gray-800">{$(g.total)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {tendencia.length === 0 && top_productos.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <ShoppingBag size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">Sin datos todavía</p>
          <p className="text-sm">Registra tu primera venta para ver métricas</p>
        </div>
      )}
    </div>
  );
}
