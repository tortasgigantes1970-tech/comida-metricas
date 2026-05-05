'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { Plus, ChevronDown, ChevronUp, Trash2, ShoppingCart, Search, Pencil, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { format, endOfMonth, isPast, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import Modal from '@/components/Modal';

interface Producto { id: number; nombre: string; precio_venta: number; costo_produccion: number; }
interface VentaItem { nombre_producto: string; cantidad: number; precio_unitario: number; costo_unitario: number; }
interface Venta {
  id: number; fecha: string; total: number; total_costo: number; ganancia: number;
  notas: string; items: VentaItem[];
  fiado: number; fecha_cobro: string | null; cobrado: number; cliente: string;
}

interface FormItem { producto_id: number | null; nombre_producto: string; cantidad: number; precio_unitario: number; costo_unitario: number; }

const $ = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 }).format(n);

const hoyStr = () => format(new Date(), 'yyyy-MM-dd');

function formatFechaCobro(fecha: string) {
  try { return format(parseISO(fecha), "d 'de' MMMM", { locale: es }); }
  catch { return fecha; }
}

export default function VentasTab() {
  const [ventas, setVentas]       = useState<Venta[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading]     = useState(true);
  const [modal, setModal]         = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [expanded, setExpanded]   = useState<number | null>(null);

  const [mes, setMes] = useState(format(new Date(), 'yyyy-MM'));

  // Form nueva/editar venta
  const [fecha, setFecha]       = useState(hoyStr());
  const [notas, setNotas]       = useState('');
  const [items, setItems]       = useState<FormItem[]>([]);
  const [saving, setSaving]     = useState(false);
  const [esFiado, setEsFiado]       = useState(false);
  const [fechaCobro, setFechaCobro] = useState('');
  const [cliente, setCliente]       = useState('');

  // Buscador
  const [busqueda, setBusqueda]   = useState('');
  const [showSugg, setShowSugg]   = useState(false);
  const busquedaRef               = useRef<HTMLDivElement>(null);

  const sugerencias = busqueda.trim().length === 0
    ? productos
    : productos.filter(p => p.nombre.toLowerCase().includes(busqueda.toLowerCase()));

  const load = useCallback(async () => {
    setLoading(true);
    const desde = `${mes}-01`;
    const hasta = format(endOfMonth(new Date(`${mes}-01T12:00:00`)), 'yyyy-MM-dd');
    const [rV, rP] = await Promise.all([
      fetch(`/api/ventas?desde=${desde}&hasta=${hasta}`).then(r => r.json()),
      fetch('/api/productos').then(r => r.json()),
    ]);
    setVentas(rV as Venta[]);
    setProductos((rP as (Producto & { activo: number })[]).filter(p => p.activo));
    setLoading(false);
  }, [mes]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const handler = () => load();
    window.addEventListener('datos-actualizados', handler);
    return () => window.removeEventListener('datos-actualizados', handler);
  }, [load]);

  // Cerrar sugerencias al hacer clic afuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (busquedaRef.current && !busquedaRef.current.contains(e.target as Node)) setShowSugg(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

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
    if (idx >= 0) {
      setItems(prev => prev.map((it, i) => i === idx ? { ...it, cantidad: it.cantidad + 1 } : it));
    } else {
      setItems(prev => [...prev, { producto_id: p.id, nombre_producto: p.nombre, cantidad: 1, precio_unitario: p.precio_venta, costo_unitario: p.costo_produccion }]);
    }
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
      const body = { fecha, items, notas, fiado: esFiado, fecha_cobro: esFiado ? fechaCobro : null, cliente };
      if (editingId !== null) {
        await fetch(`/api/ventas/${editingId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      } else {
        await fetch('/api/ventas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      }
      setModal(false);
      await load();
      window.dispatchEvent(new CustomEvent('datos-actualizados'));
    } finally { setSaving(false); }
  };

  const marcarCobrado = async (id: number) => {
    await fetch(`/api/ventas/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cobrado: true }) });
    await load();
    window.dispatchEvent(new CustomEvent('datos-actualizados'));
  };

  const del = async (id: number) => {
    if (!confirm('¿Eliminar esta venta?')) return;
    await fetch(`/api/ventas/${id}`, { method: 'DELETE' });
    await load();
  };

  const totalPeriodo    = ventas.reduce((s, v) => s + v.total, 0);
  const gananciaPeriodo = ventas.reduce((s, v) => s + v.ganancia, 0);

  // Fiados pendientes
  const fiadosPendientes = ventas.filter(v => v.fiado && !v.cobrado);
  const totalFiado       = fiadosPendientes.reduce((s, v) => s + v.total, 0);
  const fiadosVencidos   = fiadosPendientes.filter(v => v.fecha_cobro && isPast(parseISO(v.fecha_cobro)));

  if (loading) return <div className="flex items-center justify-center h-60 text-gray-400">Cargando...</div>;

  return (
    <div className="space-y-4 pb-24 md:pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Ventas</h1>
          <p className="text-sm text-gray-400">{ventas.length} registros</p>
        </div>
        <button onClick={openModal} className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors">
          <Plus size={16} /> Nueva venta
        </button>
      </div>

      {/* Alerta fiados pendientes */}
      {fiadosPendientes.length > 0 && (
        <div className={`rounded-2xl p-4 border ${fiadosVencidos.length > 0 ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
          <div className="flex items-start gap-3">
            <AlertCircle size={18} className={fiadosVencidos.length > 0 ? 'text-red-500 mt-0.5 shrink-0' : 'text-amber-500 mt-0.5 shrink-0'} />
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${fiadosVencidos.length > 0 ? 'text-red-700' : 'text-amber-700'}`}>
                {fiadosVencidos.length > 0
                  ? `${fiadosVencidos.length} fiado${fiadosVencidos.length > 1 ? 's' : ''} vencido${fiadosVencidos.length > 1 ? 's' : ''}`
                  : `${fiadosPendientes.length} fiado${fiadosPendientes.length > 1 ? 's' : ''} por cobrar`}
              </p>
              <p className={`text-xs mt-0.5 ${fiadosVencidos.length > 0 ? 'text-red-500' : 'text-amber-500'}`}>
                Total pendiente: {$(totalFiado)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Filtro mes */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-500">Mes:</label>
        <input type="month" value={mes} onChange={e => setMes(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
      </div>

      {/* Resumen período */}
      {ventas.length > 0 && (
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

      {/* Lista */}
      {ventas.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <ShoppingCart size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">Sin ventas en este período</p>
          <p className="text-sm">Registra tu primera venta</p>
        </div>
      ) : (
        <div className="space-y-2">
          {ventas.map(v => {
            const esVencido = v.fiado && !v.cobrado && !!v.fecha_cobro && isPast(parseISO(v.fecha_cobro));
            return (
              <div key={v.id} className={`bg-white rounded-2xl shadow-sm border overflow-hidden ${esVencido ? 'border-red-300' : v.fiado && !v.cobrado ? 'border-amber-300' : 'border-gray-100'}`}>
                <div className="flex items-center gap-3 px-4 py-3 cursor-pointer" onClick={() => setExpanded(expanded === v.id ? null : v.id)}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-gray-800">{v.fecha}</p>
                      {v.fiado && !v.cobrado && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${esVencido ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
                          {esVencido ? '⚠ Vencido' : '⏳ Por cobrar'}
                        </span>
                      )}
                      {v.fiado && !!v.cobrado && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-100 text-emerald-600">✓ Cobrado</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400">
                      {v.items.length} ítem{v.items.length !== 1 ? 's' : ''}
                      {v.cliente ? ` · ${v.cliente}` : ''}
                      {v.fiado && v.fecha_cobro && !v.cobrado ? ` · Cobrar el ${formatFechaCobro(v.fecha_cobro)}` : ''}
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

                    {/* Fiado info + botón cobrar */}
                    {v.fiado && !v.cobrado && (
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
                        <button
                          onClick={() => marcarCobrado(v.id)}
                          className="shrink-0 flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                        >
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

      {/* Modal nueva / editar venta */}
      {modal && (
        <Modal title={editingId !== null ? 'Editar venta' : 'Nueva venta'} onClose={() => setModal(false)} maxWidth="max-w-xl">
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Fecha</label>
              <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
            </div>

            {/* Buscador */}
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
                    Sin resultados para "{busqueda}"
                  </div>
                )}
              </div>
            </div>

            {/* Ítems */}
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

            {/* Cliente */}
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Cliente (opcional)</label>
              <input
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                value={cliente} onChange={e => setCliente(e.target.value)}
                placeholder="Ej. Juan García"
              />
            </div>

            {/* Fiado toggle */}
            <div className={`rounded-xl border p-3 space-y-3 transition-colors ${esFiado ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200'}`}>
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <div className="relative">
                  <input type="checkbox" className="sr-only" checked={esFiado} onChange={e => { setEsFiado(e.target.checked); if (!e.target.checked) setFechaCobro(''); }} />
                  <div className={`w-10 h-6 rounded-full transition-colors ${esFiado ? 'bg-amber-400' : 'bg-gray-300'}`} />
                  <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${esFiado ? 'translate-x-4' : ''}`} />
                </div>
                <div>
                  <p className={`text-sm font-medium ${esFiado ? 'text-amber-700' : 'text-gray-700'}`}>
                    <Clock size={13} className="inline mr-1" />
                    Venta fiada (pago pendiente)
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
