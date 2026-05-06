'use client';
import { useEffect, useState } from 'react';
import { format, startOfWeek, startOfMonth, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { ShoppingBag, RefreshCw } from 'lucide-react';

interface VentaItem { nombre_producto: string; cantidad: number; precio_unitario: number; costo_unitario: number; }
interface Venta { id: number; fecha: string; total: number; total_costo: number; cliente: string; items: VentaItem[]; tipo_pago: string; cobrado: number; }
interface Gasto { id: number; fecha: string; monto: number; categoria: string; }

interface ClienteTop { nombre: string; total: number; visitas: number; }
interface DashData {
  hoy:    { ventas: number; costo: number; ganancia: number; margen: number };
  semana: { ventas: number; costo: number; ganancia: number; margen: number };
  mes:    { ventas: number; costo: number; ganancia: number; margen: number; gastos: number; ganancia_neta: number; margen_neto: number };
  tendencia:       { fecha: string; ventas: number; costo: number }[];
  top_productos:   { nombre_producto: string; unidades: number; revenue: number; costo: number }[];
  gastos_cat:      { categoria: string; total: number }[];
  top_clientes_sem: ClienteTop[];
  top_clientes_mes: ClienteTop[];
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
  const [, m, d] = dateStr.split('-').map(Number);
  return `${d}/${m}`;
}

function cal(ventas: number, costo: number) {
  return {
    ventas, costo,
    ganancia: ventas - costo,
    margen: ventas > 0 ? Math.round(((ventas - costo) / ventas) * 100) : 0,
  };
}

function calcularDashboard(ventasTodas: Venta[], gastos: Gasto[]): DashData {
  const hoy       = format(new Date(), 'yyyy-MM-dd');
  const inicioSem = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const inicioMes = format(startOfMonth(new Date()), 'yyyy-MM-dd');

  // Excluir pedidos pendientes de entrega de las métricas de ingresos
  const ventas = ventasTodas.filter(v => !(v.tipo_pago === 'entregar' && !v.cobrado));

  const sum = (arr: Venta[], desde: string, hasta: string) => {
    const filtradas = arr.filter(v => v.fecha >= desde && v.fecha <= hasta);
    return {
      v: filtradas.reduce((s, v) => s + Number(v.total), 0),
      c: filtradas.reduce((s, v) => s + Number(v.total_costo), 0),
    };
  };

  const h = sum(ventas, hoy, hoy);
  const s = sum(ventas, inicioSem, hoy);
  const m = sum(ventas, inicioMes, hoy);
  const gastosM = gastos.reduce((s, g) => s + Number(g.monto), 0);
  const mesCalc = cal(m.v, m.c);

  // Tendencia: agrupar por fecha
  const tendMap: Record<string, { ventas: number; costo: number }> = {};
  for (const v of ventas) {
    if (!tendMap[v.fecha]) tendMap[v.fecha] = { ventas: 0, costo: 0 };
    tendMap[v.fecha].ventas += Number(v.total);
    tendMap[v.fecha].costo  += Number(v.total_costo);
  }
  const tendencia = Object.entries(tendMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([fecha, d]) => ({ fecha, ...d }));

  // Top productos del mes
  const prodMap: Record<string, { unidades: number; revenue: number; costo: number }> = {};
  for (const v of ventas.filter(v => v.fecha >= inicioMes && v.fecha <= hoy)) {
    for (const it of (v.items ?? [])) {
      if (!prodMap[it.nombre_producto]) prodMap[it.nombre_producto] = { unidades: 0, revenue: 0, costo: 0 };
      prodMap[it.nombre_producto].unidades += Number(it.cantidad);
      prodMap[it.nombre_producto].revenue  += Number(it.cantidad) * Number(it.precio_unitario);
      prodMap[it.nombre_producto].costo    += Number(it.cantidad) * Number(it.costo_unitario);
    }
  }
  const top_productos = Object.entries(prodMap)
    .map(([nombre_producto, d]) => ({ nombre_producto, ...d }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  // Gastos por categoría del mes
  const catMap: Record<string, number> = {};
  for (const g of gastos) {
    const cat = g.categoria || 'Otros';
    catMap[cat] = (catMap[cat] ?? 0) + Number(g.monto);
  }
  const gastos_cat = Object.entries(catMap)
    .map(([categoria, total]) => ({ categoria, total }))
    .sort((a, b) => b.total - a.total);

  // Mejores clientes (solo ventas con nombre de cliente)
  const topClientes = (ventasFiltradas: Venta[]): ClienteTop[] => {
    const mapa: Record<string, { total: number; visitas: number }> = {};
    for (const v of ventasFiltradas) {
      const nombre = (v.cliente || '').trim();
      if (!nombre) continue;
      if (!mapa[nombre]) mapa[nombre] = { total: 0, visitas: 0 };
      mapa[nombre].total   += Number(v.total);
      mapa[nombre].visitas += 1;
    }
    return Object.entries(mapa)
      .map(([nombre, d]) => ({ nombre, ...d }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  };

  return {
    hoy:    cal(h.v, h.c),
    semana: cal(s.v, s.c),
    mes: {
      ...mesCalc,
      gastos:        gastosM,
      ganancia_neta: mesCalc.ganancia - gastosM,
      margen_neto:   mesCalc.ventas > 0
        ? Math.round(((mesCalc.ganancia - gastosM) / mesCalc.ventas) * 100)
        : 0,
    },
    tendencia,
    top_productos,
    gastos_cat,
    top_clientes_sem: topClientes(ventas.filter(v => v.fecha >= inicioSem && v.fecha <= hoy)),
    top_clientes_mes: topClientes(ventas.filter(v => v.fecha >= inicioMes && v.fecha <= hoy)),
  };
}

export default function DashboardTab({ active }: { active: boolean }) {
  const [data, setData]             = useState<DashData | null>(null);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState('');

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    else         setRefreshing(true);
    try {
      const hoy       = format(new Date(), 'yyyy-MM-dd');
      const inicioMes = format(startOfMonth(new Date()), 'yyyy-MM-dd');
      const hace30    = format(subDays(new Date(), 29), 'yyyy-MM-dd');
      const ts        = Date.now();

      const [rV, rG] = await Promise.all([
        fetch(`/api/ventas?desde=${hace30}&hasta=${hoy}&t=${ts}`, { cache: 'no-store' }).then(r => r.json()),
        fetch(`/api/gastos?desde=${inicioMes}&hasta=${hoy}&t=${ts}`, { cache: 'no-store' }).then(r => r.json()),
      ]);

      setData(calcularDashboard(rV as Venta[], rG as Gasto[]));
      setLastUpdate(format(new Date(), 'HH:mm:ss'));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { if (active) load(true); }, [active]);

  useEffect(() => {
    load();
    const intervalo = setInterval(() => load(true), 30_000);
    const onFocus = () => { if (document.visibilityState === 'visible') load(true); };
    document.addEventListener('visibilitychange', onFocus);
    const onActualizar = () => load(true);
    window.addEventListener('datos-actualizados', onActualizar);
    return () => {
      clearInterval(intervalo);
      document.removeEventListener('visibilitychange', onFocus);
      window.removeEventListener('datos-actualizados', onActualizar);
    };
  }, []);

  if (loading) return <div className="flex items-center justify-center h-60 text-gray-400">Cargando...</div>;
  if (!data)   return <div className="text-red-500">Error al cargar datos</div>;

  const { hoy, semana, mes, tendencia, top_productos, gastos_cat } = data;
  const hoyStr = format(new Date(), "EEEE d 'de' MMMM", { locale: es });

  return (
    <div className="space-y-6 pb-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800 capitalize">{hoyStr}</h1>
          <p className="text-sm text-gray-400">Resumen del negocio</p>
        </div>
        <button
          onClick={() => load()}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-orange-500 transition-colors pt-1"
        >
          <RefreshCw size={13} className={refreshing ? 'animate-spin text-orange-400' : ''} />
          {refreshing
            ? <span className="text-orange-400">Actualizando...</span>
            : lastUpdate && <span>Actualizado {lastUpdate}</span>}
        </button>
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
                <YAxis tickFormatter={v => v >= 1000 ? `$${(v/1000).toFixed(1)}k` : `$${v}`} tick={{ fontSize: 11, fill: '#9ca3af' }} width={48} />
                <Tooltip
                  formatter={(v: number) => $(v)}
                  labelFormatter={formatFecha}
                  contentStyle={{ borderRadius: 12, border: '1px solid #f3f4f6', fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="ventas" name="Ventas" stroke="#f97316" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="costo"  name="Costo"  stroke="#6b7280" strokeWidth={2} dot={false} />
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

      {/* Mejores clientes */}
      {(data.top_clientes_sem.length > 0 || data.top_clientes_mes.length > 0) && (
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Mejores clientes</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Semana */}
            {data.top_clientes_sem.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-4 pt-3 pb-2">Esta semana</p>
                {data.top_clientes_sem.map((c, i) => (
                  <div key={i} className={`flex items-center px-4 py-2.5 gap-3 ${i < data.top_clientes_sem.length - 1 ? 'border-b border-gray-50' : ''}`}>
                    <span className="text-sm font-bold text-gray-300 w-5">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{c.nombre}</p>
                      <p className="text-xs text-gray-400">{c.visitas} {c.visitas === 1 ? 'visita' : 'visitas'}</p>
                    </div>
                    <span className="text-sm font-semibold text-orange-500">{$(c.total)}</span>
                  </div>
                ))}
              </div>
            )}
            {/* Mes */}
            {data.top_clientes_mes.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-4 pt-3 pb-2">Este mes</p>
                {data.top_clientes_mes.map((c, i) => (
                  <div key={i} className={`flex items-center px-4 py-2.5 gap-3 ${i < data.top_clientes_mes.length - 1 ? 'border-b border-gray-50' : ''}`}>
                    <span className="text-sm font-bold text-gray-300 w-5">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{c.nombre}</p>
                      <p className="text-xs text-gray-400">{c.visitas} {c.visitas === 1 ? 'visita' : 'visitas'}</p>
                    </div>
                    <span className="text-sm font-semibold text-orange-500">{$(c.total)}</span>
                  </div>
                ))}
              </div>
            )}
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
