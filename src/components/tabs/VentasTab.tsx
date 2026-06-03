'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { Plus, ChevronDown, ChevronUp, Trash2, ShoppingCart, Search, Pencil, AlertCircle, CheckCircle2, Clock, Package, Truck, MessageCircle } from 'lucide-react';
import ClienteInput from '@/components/ClienteInput';
import GestionarClientesModal from '@/components/GestionarClientesModal';
import { format, endOfMonth, isBefore, isToday, startOfDay, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import Modal from '@/components/Modal';

interface Producto { id: number; nombre: string; precio_venta: number; costo_produccion: number; }
interface VentaItem { nombre_producto: string; cantidad: number; precio_unitario: number; costo_unitario: number; }
interface Venta {
  id: number; fecha: string; total: number; total_costo: number; ganancia: number;
  notas: string; items: VentaItem[];
  fiado: number; fecha_cobro: string | null; cobrado: number; cliente: string;
  tipo_pago: string; created_at: string; entregado: number;
}
interface FormItem { producto_id: number | null; nombre_producto: string; cantidad: number; precio_unitario: number; costo_unitario: number; }
interface GrupoFiado { key: string; cliente: string; fiados: Venta[]; total: number; }

// 0 = vencido (más urgente), 1 = hoy, 2 = por cobrar
type NivelUrgencia = 0 | 1 | 2;

const $ = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 }).format(n);

const hoyStr = () => format(new Date(), 'yyyy-MM-dd');

function formatFechaCobro(fecha: string) {
  try { return format(parseISO(fecha), "d 'de' MMMM", { locale: es }); }
  catch { return fecha; }
}

function formatHora(createdAt: string) {
  try {
    const iso = createdAt.replace(' ', 'T') + 'Z';
    return format(parseISO(iso), 'h:mm a');
  } catch { return ''; }
}

function abrirWhatsApp(texto: string) {
  window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');
}

function mensajeAgradecimiento(v: { cliente: string }) {
  return [
    v.cliente ? `${v.cliente}, Tortas Gigantes agradece su preferencia.` : 'Tortas Gigantes agradece su preferencia.',
    '',
    'Esperamos verle pronto!',
  ].join('\n');
}

function mensajeFiadoGrupo(grupo: GrupoFiado): string {
  const saludo = grupo.cliente ? `Hola ${grupo.cliente}!` : 'Hola!';
  const lineas: string[] = [saludo, ''];
  const fmtFecha = (f: string) => { try { return format(parseISO(f), "d 'de' MMMM", { locale: es }); } catch { return f; } };

  if (grupo.fiados.length === 1) {
    const v = grupo.fiados[0];
    lineas.push(`Le compartimos el detalle de su compra del ${fmtFecha(v.fecha)}:`, '');
    v.items.forEach(it => lineas.push(`• ${it.cantidad}x ${it.nombre_producto}  $${(it.cantidad * it.precio_unitario).toFixed(2)}`));
    lineas.push('', `Total pendiente: $${grupo.total.toFixed(2)}`);
  } else {
    lineas.push('Le compartimos el detalle de sus compras pendientes:', '');
    grupo.fiados.forEach((v, i) => {
      lineas.push(`Compra ${i + 1} — ${fmtFecha(v.fecha)}:`);
      v.items.forEach(it => lineas.push(`  • ${it.cantidad}x ${it.nombre_producto}  $${(it.cantidad * it.precio_unitario).toFixed(2)}`));
      lineas.push(`  Subtotal: $${v.total.toFixed(2)}`, '');
    });
    lineas.push(`Total pendiente: $${grupo.total.toFixed(2)}`);
  }
  return lineas.join('\n');
}

function agruparPorCliente(fiados: Venta[]): GrupoFiado[] {
  const map = new Map<string, Venta[]>();
  for (const v of fiados) {
    const key = v.cliente?.trim() ? v.cliente.trim() : `__anon__${v.id}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(v);
  }
  return Array.from(map.entries()).map(([key, vs]) => ({
    key,
    cliente: key.startsWith('__anon__') ? '' : key,
    fiados: vs,
    total: vs.reduce((s, v) => s + v.total, 0),
  }));
}

function urgenciaGrupo(grupo: GrupoFiado, hoyDate: Date): NivelUrgencia {
  if (grupo.fiados.some(v => v.fecha_cobro && isBefore(parseISO(v.fecha_cobro), hoyDate))) return 0;
  if (grupo.fiados.some(v => v.fecha_cobro && isToday(parseISO(v.fecha_cobro)))) return 1;
  return 2;
}

function urgenciaFiado(v: Venta, hoyDate: Date): NivelUrgencia {
  if (!v.fecha_cobro) return 2;
  const d = parseISO(v.fecha_cobro);
  if (isBefore(d, hoyDate)) return 0;
  if (isToday(d)) return 1;
  return 2;
}

const URGENCIA_STYLES: Record<NivelUrgencia, { border: string; bg: string; text: string; sub: string; badge: string }> = {
  0: { border: 'border-l-red-400',   bg: 'bg-red-50/40',   text: 'text-red-800',   sub: 'text-red-400',   badge: '🔴' },
  1: { border: 'border-l-amber-400', bg: 'bg-amber-50/40', text: 'text-amber-800', sub: 'text-amber-500', badge: '🟡' },
  2: { border: 'border-l-gray-300',  bg: '',               text: 'text-gray-700',  sub: 'text-gray-400',  badge: '⚪' },
};

export default function VentasTab() {
  const [ventas, setVentas]         = useState<Venta[]>([]);
  const [pedidos, setPedidos]       = useState<Venta[]>([]);
  const [fiadosPend, setFiadosPend] = useState<Venta[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading]     = useState(true);

  const [ultimoCobrado, setUltimoCobrado]         = useState<Venta | null>(null);
  const [showFiadosPanel, setShowFiadosPanel]     = useState(false);
  const [expandedGrupos, setExpandedGrupos]       = useState<Set<string>>(new Set());
  const [showGestClientes, setShowGestClientes]   = useState(false);
  const [modal, setModal]         = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [expanded, setExpanded]   = useState<number | null>(null);
  const [mes, setMes]             = useState(format(new Date(), 'yyyy-MM'));

  const [fecha, setFecha]           = useState(hoyStr());
  const [notas, setNotas]           = useState('');
  const [items, setItems]           = useState<FormItem[]>([]);
  const [saving, setSaving]         = useState(false);
  const [esFiado, setEsFiado]       = useState(false);
  const [fechaCobro, setFechaCobro] = useState('');
  const [cliente, setCliente]       = useState('');

  const [busqueda, setBusqueda] = useState('');
  const [showSugg, setShowSugg] = useState(false);
  const busquedaRef             = useRef<HTMLDivElement>(null);

  const sugerencias = busqueda.trim().length === 0
    ? productos
    : productos.filter(p => p.nombre.toLowerCase().includes(busqueda.toLowerCase()));

  const load = useCallback(async () => {
    setLoading(true);
    const desde = `${mes}-01`;
    const hasta = format(endOfMonth(new Date(`${mes}-01T12:00:00`)), 'yyyy-MM-dd');
    const [rV, rP, rPedidos, rFiados] = await Promise.all([
      fetch(`/api/ventas?desde=${desde}&hasta=${hasta}`).then(r => r.json()),
      fetch('/api/productos').then(r => r.json()),
      fetch('/api/ventas?pendientes=1').then(r => r.json()),
      fetch('/api/ventas?fiados_pendientes=1').then(r => r.json()),
    ]);
    setVentas(rV as Venta[]);
    setProductos((rP as (Producto & { activo: number })[]).filter(p => p.activo));
    setPedidos(rPedidos as Venta[]);
    setFiadosPend(rFiados as Venta[]);
    setLoading(false);
  }, [mes]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const handler = () => load();
    window.addEventListener('datos-actualizados', handler);
    return () => window.removeEventListener('datos-actualizados', handler);
  }, [load]);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (busquedaRef.current && !busquedaRef.current.contains(e.target as Node)) setShowSugg(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggleGrupo = (key: string) =>
    setExpandedGrupos(prev => { const s = new Set(prev); s.has(key) ? s.delete(key) : s.add(key); return s; });

  const openModal = () => {
    setEditingId(null); setFecha(hoyStr()); setNotas(''); setItems([]);
    setEsFiado(false); setFechaCobro(''); setCliente('');
    setBusqueda(''); setShowSugg(false); setModal(true);
  };

  const openEdit = (v: Venta) => {
    setEditingId(v.id); setFecha(v.fecha); setNotas(v.notas ?? '');
    setEsFiado(!!v.fiado); setFechaCobro(v.fecha_cobro ?? ''); setCliente(v.cliente ?? '');
    setItems(v.items.map(it => ({
      producto_id: null, nombre_producto: it.nombre_producto,
      cantidad: it.cantidad, precio_unitario: it.precio_unitario, costo_unitario: it.costo_unitario,
    })));
    setBusqueda(''); setShowSugg(false); setModal(true);
  };

  const addItem = (p: Producto) => {
    const idx = items.findIndex(i => i.producto_id === p.id);
    if (idx >= 0) setItems(prev => prev.map((it, i) => i === idx ? { ...it, cantidad: it.cantidad + 1 } : it));
    else setItems(prev => [...prev, { producto_id: p.id, nombre_producto: p.nombre, cantidad: 1, precio_unitario: p.precio_venta, costo_unitario: p.costo_produccion }]);
    setBusqueda(''); setShowSugg(false);
  };

  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));
  const setCant    = (idx: number, val: number) => setItems(prev => prev.map((it, i) => i === idx ? { ...it, cantidad: Math.max(1, val) } : it));
  const setPrice   = (idx: number, val: number) => setItems(prev => prev.map((it, i) => i === idx ? { ...it, precio_unitario: val } : it));

  const totalForm = items.reduce((s, i) => s + i.cantidad * i.precio_unitario, 0);
  const costoForm = items.reduce((s, i) => s + i.cantidad * i.costo_unitario,  0);

  const save = async () => {
    if (items.length === 0) return;
    setSaving(true);
    try {
      const body = { fecha, items, notas, fiado: esFiado, fecha_cobro: esFiado ? fechaCobro : null, cliente, tipo_pago: esFiado ? 'fiado' : 'cobrado' };
      if (editingId !== null) {
        await fetch(`/api/ventas/${editingId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      } else {
        await fetch('/api/ventas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      }
      setModal(false);
      window.dispatchEvent(new CustomEvent('datos-actualizados'));
      await load();
    } finally { setSaving(false); }
  };

  const marcarCobrado = async (id: number) => {
    const pedido = pedidos.find(p => p.id === id) ?? ventas.find(v => v.id === id) ?? null;
    await fetch(`/api/ventas/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cobrado: true }) });
    window.dispatchEvent(new CustomEvent('datos-actualizados'));
    if (pedido) setUltimoCobrado(pedido);
    await load();
  };

  const marcarCobradoTodos = async (vs: Venta[]) => {
    const nombreCliente = vs[0]?.cliente || 'este cliente';
    const total = vs.reduce((s, v) => s + v.total, 0);
    if (!confirm(`¿Marcar ${vs.length} compra${vs.length > 1 ? 's' : ''} de ${nombreCliente} como cobradas?\nTotal: $${total.toFixed(2)}`)) return;
    await Promise.all(vs.map(v =>
      fetch(`/api/ventas/${v.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cobrado: true }) })
    ));
    window.dispatchEvent(new CustomEvent('datos-actualizados'));
    setUltimoCobrado(vs[vs.length - 1]);
    await load();
  };

  const marcarEntregado = async (id: number) => {
    await fetch(`/api/ventas/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entregado: true }) });
    window.dispatchEvent(new CustomEvent('datos-actualizados'));
    await load();
  };

  const del = async (id: number) => {
    if (!confirm('¿Eliminar esta venta?')) return;
    await fetch(`/api/ventas/${id}`, { method: 'DELETE' });
    await load();
  };

  // ── Fiados (cargados independientemente del mes seleccionado) ────────────
  const fiadosPendientes     = fiadosPend;
  const hoyDate              = startOfDay(new Date());
  const totalFiadosPendientes = fiadosPendientes.reduce((s, v) => s + v.total, 0);

  const gruposFiados = agruparPorCliente(fiadosPendientes)
    .sort((a, b) => urgenciaGrupo(a, hoyDate) - urgenciaGrupo(b, hoyDate));

  const countVencidos = fiadosPendientes.filter(v => v.fecha_cobro && isBefore(parseISO(v.fecha_cobro), hoyDate)).length;
  const countHoy      = fiadosPendientes.filter(v => v.fecha_cobro && isToday(parseISO(v.fecha_cobro))).length;

  // ── Pedidos ───────────────────────────────────────────────────────────────
  const pedidosPendEntrega = pedidos.filter(p => !p.entregado);
  const pedidosEntregados  = pedidos.filter(p => !!p.entregado && !p.cobrado);

  // ── Lista del período ─────────────────────────────────────────────────────
  const ventasMostrar   = ventas.filter(v => v.tipo_pago !== 'entregar' || (!!v.entregado && !!v.cobrado));
  const totalPeriodo    = ventasMostrar.reduce((s, v) => s + v.total, 0);
  const gananciaPeriodo = ventasMostrar.reduce((s, v) => s + v.ganancia, 0);

  if (loading) return <div className="flex items-center justify-center h-60 text-gray-400">Cargando...</div>;

  return (
    <div className="space-y-4 pb-24 md:pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Ventas</h1>
          <div className="flex items-center gap-3">
            <p className="text-sm text-gray-400">{ventasMostrar.length} registros</p>
            <button onClick={() => setShowGestClientes(true)}
              className="text-xs text-orange-400 hover:text-orange-600 underline underline-offset-2 transition-colors">
              Gestionar clientes
            </button>
          </div>
        </div>
        <button onClick={openModal} className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors">
          <Plus size={16} /> Nueva venta
        </button>
      </div>

      {/* ── Pedidos activos ─────────────────────────────────────────────────── */}
      {(pedidosPendEntrega.length > 0 || pedidosEntregados.length > 0) && (
        <div className="rounded-2xl border border-orange-200 bg-orange-50 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-orange-100">
            <Package size={15} className="text-orange-500 shrink-0" />
            <p className="text-sm font-semibold text-orange-700 flex-1">Pedidos activos</p>
            <span className="bg-orange-500 text-white text-xs font-bold rounded-full px-2 py-0.5">
              {pedidosPendEntrega.length + pedidosEntregados.length}
            </span>
          </div>

          {pedidosPendEntrega.length > 0 && (
            <>
              <div className="px-4 py-1.5 bg-orange-100/60">
                <p className="text-xs font-semibold text-orange-600 uppercase tracking-wide">Pendientes de entregar</p>
              </div>
              <div className="divide-y divide-orange-100">
                {pedidosPendEntrega.map(p => (
                  <div key={p.id} className="px-4 py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {p.cliente ? <span className="text-sm font-medium text-gray-800">{p.cliente}</span>
                          : <span className="text-sm text-gray-400 italic">Sin nombre</span>}
                        <span className="text-xs text-gray-400">{formatHora(p.created_at)}</span>
                        {!!p.cobrado && <span className="text-xs px-1.5 py-0.5 rounded-full font-medium bg-emerald-100 text-emerald-600">Pagado</span>}
                      </div>
                      <p className="text-xs text-gray-500 truncate mt-0.5">
                        {p.items.map(it => `${it.cantidad}× ${it.nombre_producto}`).join(', ')}
                      </p>
                    </div>
                    <div className="flex flex-col items-end shrink-0 gap-1">
                      <p className="text-sm font-bold text-orange-500">{$(p.total)}</p>
                      <button onClick={() => marcarEntregado(p.id)}
                        className="flex items-center gap-1 text-xs font-semibold text-orange-600 hover:text-orange-700 bg-white border border-orange-200 rounded-lg px-2 py-1 transition-colors">
                        <Truck size={11} /> Entregado
                      </button>
                      {!p.cobrado && (
                        <button onClick={() => marcarCobrado(p.id)}
                          className="flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700 bg-white border border-emerald-200 rounded-lg px-2 py-1 transition-colors">
                          <CheckCircle2 size={11} /> Cobrado
                        </button>
                      )}
                      <button onClick={() => openEdit(p)}
                        className="flex items-center gap-1 text-xs font-semibold text-blue-500 hover:text-blue-600 bg-white border border-blue-200 rounded-lg px-2 py-1 transition-colors">
                        <Pencil size={11} /> Editar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {pedidosEntregados.length > 0 && (
            <>
              <div className={`px-4 py-1.5 bg-orange-100/60 ${pedidosPendEntrega.length > 0 ? 'border-t border-orange-200' : ''}`}>
                <p className="text-xs font-semibold text-orange-600 uppercase tracking-wide">Entregados — pendientes de pago</p>
              </div>
              <div className="divide-y divide-orange-100">
                {pedidosEntregados.map(p => (
                  <div key={p.id} className="px-4 py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {p.cliente ? <span className="text-sm font-medium text-gray-800">{p.cliente}</span>
                          : <span className="text-sm text-gray-400 italic">Sin nombre</span>}
                        <span className="text-xs text-gray-400">{formatHora(p.created_at)}</span>
                      </div>
                      <p className="text-xs text-gray-500 truncate mt-0.5">
                        {p.items.map(it => `${it.cantidad}× ${it.nombre_producto}`).join(', ')}
                      </p>
                    </div>
                    <div className="flex flex-col items-end shrink-0 gap-1">
                      <p className="text-sm font-bold text-orange-500">{$(p.total)}</p>
                      <button onClick={() => marcarCobrado(p.id)}
                        className="flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700 bg-white border border-emerald-200 rounded-lg px-2 py-1 transition-colors">
                        <CheckCircle2 size={11} /> Cobrado
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Fiados pendientes — bloque único ────────────────────────────────── */}
      {fiadosPendientes.length > 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
          {/* Cabecera del bloque */}
          <button
            className="w-full px-4 py-3 flex items-center gap-3 text-left border-b border-gray-100"
            onClick={() => setShowFiadosPanel(s => !s)}
          >
            <AlertCircle size={16} className={countVencidos > 0 ? 'text-red-400 shrink-0' : 'text-amber-400 shrink-0'} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800">Fiados pendientes</p>
              <div className="flex items-center gap-2 flex-wrap mt-0.5">
                {countVencidos > 0 && (
                  <span className="text-xs text-red-500 font-medium">🔴 {countVencidos} vencido{countVencidos > 1 ? 's' : ''}</span>
                )}
                {countHoy > 0 && (
                  <span className="text-xs text-amber-500 font-medium">🟡 {countHoy} hoy</span>
                )}
                <span className="text-xs text-gray-400">{$(totalFiadosPendientes)} total</span>
              </div>
            </div>
            <span className="text-xs text-gray-400 shrink-0">{showFiadosPanel ? 'Ocultar ▲' : 'Ver ▼'}</span>
          </button>

          {/* Lista de clientes */}
          {showFiadosPanel && (
            <div className="divide-y divide-gray-100">
              {gruposFiados.map(grupo => {
                const nivel     = urgenciaGrupo(grupo, hoyDate);
                const st        = URGENCIA_STYLES[nivel];
                const isMulti   = grupo.fiados.length > 1;
                const isOpen    = expandedGrupos.has(grupo.key);

                // Resumen de badges para card colapsada de cliente multi-compra
                const vCount = grupo.fiados.filter(v => urgenciaFiado(v, hoyDate) === 0).length;
                const hCount = grupo.fiados.filter(v => urgenciaFiado(v, hoyDate) === 1).length;
                const pCount = grupo.fiados.filter(v => urgenciaFiado(v, hoyDate) === 2).length;

                return (
                  <div key={grupo.key} className={`border-l-4 ${st.border} ${st.bg}`}>
                    {/* Fila del cliente */}
                    <div className="px-4 py-3 flex items-start gap-3">
                      <div
                        className={`flex-1 min-w-0 ${isMulti ? 'cursor-pointer' : ''}`}
                        onClick={() => isMulti && toggleGrupo(grupo.key)}
                      >
                        <p className={`text-sm font-semibold ${st.text}`}>
                          {grupo.cliente || 'Sin nombre'}
                          {isMulti && <span className={`ml-2 text-xs font-normal ${st.sub}`}>{grupo.fiados.length} compras</span>}
                        </p>
                        {isMulti ? (
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            {vCount > 0 && <span className="text-xs text-red-400">🔴 {vCount} vencido{vCount > 1 ? 's' : ''}</span>}
                            {hCount > 0 && <span className="text-xs text-amber-500">🟡 {hCount} hoy</span>}
                            {pCount > 0 && <span className={`text-xs ${st.sub}`}>⚪ {pCount} por cobrar</span>}
                          </div>
                        ) : (
                          <>
                            <p className={`text-xs truncate ${st.sub}`}>
                              {grupo.fiados[0].items.map(it => `${it.cantidad}× ${it.nombre_producto}`).join(', ')}
                            </p>
                            <p className={`text-xs ${st.sub} opacity-80`}>
                              Pedido: {format(parseISO(grupo.fiados[0].fecha), "d 'de' MMMM", { locale: es })}
                              {grupo.fiados[0].fecha_cobro
                                ? ` · ${nivel === 0 ? `Venció el ${formatFechaCobro(grupo.fiados[0].fecha_cobro)}` : nivel === 1 ? 'Hoy' : `Cobrar el ${formatFechaCobro(grupo.fiados[0].fecha_cobro)}`}`
                                : ''}
                            </p>
                          </>
                        )}
                      </div>

                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <p className={`text-sm font-bold ${st.text}`}>{$(grupo.total)}</p>
                        {isMulti ? (
                          <>
                            <button onClick={() => marcarCobradoTodos(grupo.fiados)}
                              className="flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700 bg-white border border-emerald-200 rounded-lg px-2 py-1 transition-colors">
                              <CheckCircle2 size={11} /> Cobrar todo
                            </button>
                            <button onClick={() => abrirWhatsApp(mensajeFiadoGrupo(grupo))}
                              className="flex items-center gap-1 text-xs font-semibold text-green-600 hover:text-green-700 bg-white border border-green-200 rounded-lg px-2 py-1 transition-colors">
                              <MessageCircle size={11} /> Enviar orden
                            </button>
                            <button onClick={() => toggleGrupo(grupo.key)}
                              className={`text-xs ${st.sub} hover:underline`}>
                              {isOpen ? 'Ocultar ▲' : 'Ver detalle ▼'}
                            </button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => marcarCobrado(grupo.fiados[0].id)}
                              className="flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700 bg-white border border-emerald-200 rounded-lg px-2 py-1 transition-colors">
                              <CheckCircle2 size={11} /> Cobrado
                            </button>
                            <button onClick={() => abrirWhatsApp(mensajeFiadoGrupo(grupo))}
                              className="flex items-center gap-1 text-xs font-semibold text-green-600 hover:text-green-700 bg-white border border-green-200 rounded-lg px-2 py-1 transition-colors">
                              <MessageCircle size={11} /> Enviar orden
                            </button>
                            <button onClick={() => openEdit(grupo.fiados[0])}
                              className="flex items-center gap-1 text-xs font-semibold text-blue-500 hover:text-blue-600 bg-white border border-blue-200 rounded-lg px-2 py-1 transition-colors">
                              <Pencil size={11} /> Editar
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Detalle expandido: compras individuales */}
                    {isMulti && isOpen && (
                      <div className="border-t border-gray-100 divide-y divide-gray-100">
                        {grupo.fiados.map(v => {
                          const urg = urgenciaFiado(v, hoyDate);
                          const ust = URGENCIA_STYLES[urg];
                          return (
                            <div key={v.id} className="pl-8 pr-4 py-2.5 flex items-start gap-3 bg-white/60">
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-gray-600 truncate">
                                  {v.items.map(it => `${it.cantidad}× ${it.nombre_producto}`).join(', ')}
                                </p>
                                <p className="text-xs text-gray-400">
                                  {format(parseISO(v.fecha), "d 'de' MMMM", { locale: es })}
                                  {v.fecha_cobro && (
                                    <span className={`ml-1.5 font-medium ${ust.sub}`}>
                                      {ust.badge} {urg === 0 ? `Venció el ${formatFechaCobro(v.fecha_cobro)}` : urg === 1 ? 'Hoy' : `Cobrar el ${formatFechaCobro(v.fecha_cobro)}`}
                                    </span>
                                  )}
                                </p>
                              </div>
                              <div className="flex flex-col items-end gap-1 shrink-0">
                                <p className="text-xs font-semibold text-gray-700">{$(v.total)}</p>
                                <button onClick={() => marcarCobrado(v.id)}
                                  className="flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700 bg-white border border-emerald-200 rounded-lg px-2 py-1 transition-colors">
                                  <CheckCircle2 size={11} /> Cobrar
                                </button>
                                <button onClick={() => openEdit(v)}
                                  className="flex items-center gap-1 text-xs font-semibold text-blue-500 hover:text-blue-600 bg-white border border-blue-200 rounded-lg px-2 py-1 transition-colors">
                                  <Pencil size={11} /> Editar
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Filtro mes */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-500">Mes:</label>
        <input type="month" value={mes} onChange={e => setMes(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
      </div>

      {/* Resumen período */}
      {ventasMostrar.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-orange-50 rounded-2xl p-3 text-center">
            <p className="text-xs text-orange-400 font-medium">Ventas del período</p>
            <p className="text-lg font-bold text-orange-600">{$(totalPeriodo)}</p>
          </div>
          <div className="bg-emerald-50 rounded-2xl p-3 text-center">
            <p className="text-xs text-emerald-400 font-medium">Ganancia bruta</p>
            <p className="text-lg font-bold text-emerald-600">{$(gananciaPeriodo)}</p>
          </div>
        </div>
      )}

      {/* Lista de ventas */}
      {ventasMostrar.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <ShoppingCart size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">Sin ventas en este período</p>
          <p className="text-sm">Registra tu primera venta</p>
        </div>
      ) : (
        <div className="space-y-2">
          {ventasMostrar.map(v => {
            const esVencido = !!v.fiado && !v.cobrado && !!v.fecha_cobro && isBefore(parseISO(v.fecha_cobro), hoyDate);
            return (
              <div key={v.id} className={`bg-white rounded-2xl shadow-sm border overflow-hidden ${esVencido ? 'border-red-300' : v.fiado && !v.cobrado ? 'border-amber-300' : 'border-gray-100'}`}>
                <div className="flex items-center gap-3 px-4 py-3 cursor-pointer" onClick={() => setExpanded(expanded === v.id ? null : v.id)}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-gray-800">{v.fecha}</p>
                      {!!v.fiado && !v.cobrado && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${esVencido ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
                          {esVencido ? '⚠ Vencido' : '⏳ Por cobrar'}
                        </span>
                      )}
                      {!!v.fiado && !!v.cobrado && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-100 text-emerald-600">✓ Cobrado</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400">
                      {v.items.length} ítem{v.items.length !== 1 ? 's' : ''}
                      {v.cliente ? ` · ${v.cliente}` : ''}
                      {!!v.fiado && v.fecha_cobro && !v.cobrado ? ` · Cobrar el ${formatFechaCobro(v.fecha_cobro)}` : ''}
                      {v.notas ? ` · ${v.notas}` : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-orange-500">{$(v.total)}</p>
                    <p className="text-xs text-emerald-500">+{$(v.ganancia)}</p>
                  </div>
                  {expanded === v.id ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                </div>

                {expanded === v.id && (
                  <div className="border-t border-gray-50 px-4 py-3 space-y-1.5">
                    {v.items.map((it, i) => (
                      <div key={i} className="flex justify-between text-xs">
                        <span className="text-gray-600">{it.nombre_producto} × {it.cantidad}</span>
                        <span className="text-gray-700 font-medium">{$(it.cantidad * it.precio_unitario)}</span>
                      </div>
                    ))}
                    <div className="border-t border-gray-100 pt-2 mt-2 flex justify-between text-xs">
                      <span className="text-gray-500">Costo total</span>
                      <span className="text-gray-600">{$(v.total_costo)}</span>
                    </div>
                    {!!v.fiado && !v.cobrado && (
                      <div className={`rounded-xl px-3 py-2.5 mt-1 flex items-center justify-between gap-3 ${esVencido ? 'bg-red-50' : 'bg-amber-50'}`}>
                        <div className="min-w-0">
                          <p className={`text-xs font-semibold ${esVencido ? 'text-red-700' : 'text-amber-700'}`}>
                            {esVencido ? '⚠ Pago vencido' : '⏳ Pendiente de cobro'}
                            {v.cliente ? ` — ${v.cliente}` : ''}
                          </p>
                          {v.fecha_cobro && (
                            <p className={`text-xs ${esVencido ? 'text-red-500' : 'text-amber-500'}`}>
                              Fecha acordada: {formatFechaCobro(v.fecha_cobro)}
                            </p>
                          )}
                        </div>
                        <button onClick={() => marcarCobrado(v.id)}
                          className="shrink-0 flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">
                          <CheckCircle2 size={13} /> Marcar cobrado
                        </button>
                      </div>
                    )}
                    <div className="flex justify-between items-center pt-1">
                      <button onClick={() => openEdit(v)} className="text-xs text-blue-400 hover:text-blue-600 flex items-center gap-1">
                        <Pencil size={13} /> Editar
                      </button>
                      <button onClick={() => del(v.id)} className="text-xs text-red-400 hover:text-red-600 flex items-center gap-1">
                        <Trash2 size={13} /> Eliminar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal gestionar clientes */}
      <GestionarClientesModal
        open={showGestClientes}
        onClose={() => setShowGestClientes(false)}
        onGuardado={() => { load(); window.dispatchEvent(new CustomEvent('datos-actualizados')); }}
      />

      {/* Toast: agradecimiento post-cobro */}
      {ultimoCobrado && (
        <div className="fixed bottom-24 left-4 right-4 md:left-auto md:right-6 md:w-80 bg-emerald-600 text-white rounded-2xl p-4 shadow-xl z-50 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">✅ ¡Cobrado!</p>
            {ultimoCobrado.cliente && <p className="text-xs text-emerald-200 truncate">{ultimoCobrado.cliente}</p>}
          </div>
          <button
            onClick={() => { abrirWhatsApp(mensajeAgradecimiento(ultimoCobrado)); setUltimoCobrado(null); }}
            className="shrink-0 bg-white text-emerald-700 font-semibold text-xs px-3 py-2 rounded-xl hover:bg-emerald-50 transition-colors">
            📲 Agradecer
          </button>
          <button onClick={() => setUltimoCobrado(null)} className="shrink-0 text-emerald-200 hover:text-white text-lg leading-none">×</button>
        </div>
      )}

      {/* Modal nueva / editar venta */}
      {modal && (
        <Modal title={editingId !== null ? 'Editar venta' : 'Nueva venta'} onClose={() => setModal(false)} maxWidth="max-w-xl">
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Fecha</label>
              <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Agregar producto</label>
              <div className="relative" ref={busquedaRef}>
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input type="text" value={busqueda}
                    onChange={e => { setBusqueda(e.target.value); setShowSugg(true); }}
                    onFocus={() => setShowSugg(true)}
                    placeholder="Buscar producto..."
                    className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 bg-white" />
                </div>
                {showSugg && sugerencias.length > 0 && (
                  <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-56 overflow-y-auto">
                    {sugerencias.map(p => (
                      <button key={p.id} type="button" onMouseDown={() => addItem(p)}
                        className="w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-orange-50 transition-colors text-left">
                        <span className="text-gray-800 font-medium truncate pr-2">{p.nombre}</span>
                        <span className="text-orange-500 font-semibold shrink-0">{$(p.precio_venta)}</span>
                      </button>
                    ))}
                  </div>
                )}
                {showSugg && busqueda.trim().length > 0 && sugerencias.length === 0 && (
                  <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-3 text-sm text-gray-400">
                    Sin resultados para &quot;{busqueda}&quot;
                  </div>
                )}
              </div>
            </div>

            {items.length > 0 && (
              <div className="bg-gray-50 rounded-xl overflow-hidden">
                {items.map((it, i) => (
                  <div key={i} className={`flex items-center gap-2 px-3 py-2.5 ${i < items.length - 1 ? 'border-b border-gray-100' : ''}`}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{it.nombre_producto}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setCant(i, it.cantidad - 1)} className="w-7 h-7 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-100 text-sm font-bold">−</button>
                      <input type="number" min="1" value={it.cantidad} onChange={e => setCant(i, Number(e.target.value))}
                        className="w-10 text-center border border-gray-200 rounded-lg py-1 text-sm" />
                      <button onClick={() => setCant(i, it.cantidad + 1)} className="w-7 h-7 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-100 text-sm font-bold">+</button>
                    </div>
                    <input type="number" min="0" step="0.5" value={it.precio_unitario} onChange={e => setPrice(i, Number(e.target.value))}
                      className="w-20 border border-gray-200 rounded-lg px-2 py-1 text-sm text-right" />
                    <button onClick={() => removeItem(i)} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={14} /></button>
                  </div>
                ))}
                <div className="px-3 py-2.5 border-t border-gray-200 bg-white space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Total venta</span>
                    <span className="font-bold text-orange-500">{$(totalForm)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">Ganancia estimada</span>
                    <span className="text-emerald-500 font-medium">{$(totalForm - costoForm)}</span>
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Cliente (opcional)</label>
              <ClienteInput value={cliente} onChange={setCliente} placeholder="Buscar o nuevo cliente..." />
            </div>

            <div className={`rounded-xl border p-3 space-y-3 transition-colors ${esFiado ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200'}`}>
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <div className="relative">
                  <input type="checkbox" className="sr-only" checked={esFiado} onChange={e => { setEsFiado(e.target.checked); if (!e.target.checked) setFechaCobro(''); }} />
                  <div className={`w-10 h-6 rounded-full transition-colors ${esFiado ? 'bg-amber-400' : 'bg-gray-300'}`} />
                  <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${esFiado ? 'translate-x-4' : ''}`} />
                </div>
                <div>
                  <p className={`text-sm font-medium ${esFiado ? 'text-amber-700' : 'text-gray-700'}`}>
                    <Clock size={13} className="inline mr-1" />Venta fiada (pago pendiente)
                  </p>
                  {!esFiado && <p className="text-xs text-gray-400">Activa si el pago se hará después</p>}
                </div>
              </label>
              {esFiado && (
                <div>
                  <label className="text-xs font-medium text-amber-700 block mb-1">Fecha acordada de cobro (opcional)</label>
                  <input type="date" value={fechaCobro} onChange={e => setFechaCobro(e.target.value)}
                    className="w-full border border-amber-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-300" />
                </div>
              )}
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Notas (opcional)</label>
              <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                value={notas} onChange={e => setNotas(e.target.value)} placeholder="Ej. Venta de la mañana" />
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setModal(false)} className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50">
                Cancelar
              </button>
              <button onClick={save} disabled={saving || items.length === 0}
                className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-medium transition-colors">
                {saving ? 'Guardando...' : editingId !== null ? 'Guardar cambios' : 'Registrar venta'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
