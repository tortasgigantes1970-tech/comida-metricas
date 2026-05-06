'use client';
import { useEffect, useState, useRef } from 'react';
import { Trash2, Calculator, Search, Package, Check, Clock } from 'lucide-react';
type TipoPago = 'cobrado' | 'entregar' | 'fiado';
import { format } from 'date-fns';

interface Producto { id: number; nombre: string; precio_venta: number; costo_produccion: number; categoria: string; }
interface Item { producto: Producto; cantidad: number; }

const $ = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 }).format(n);

export default function CotizadorTab() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [items, setItems]         = useState<Item[]>([]);
  const [loading, setLoading]     = useState(true);

  // Buscador
  const [busqueda, setBusqueda] = useState('');
  const [showSugg, setShowSugg] = useState(false);
  const busquedaRef             = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/productos')
      .then(r => r.json())
      .then((data: (Producto & { activo: number })[]) => {
        setProductos(data.filter(p => p.activo));
        setLoading(false);
      });
  }, []);

  // Cerrar sugerencias al hacer clic afuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (busquedaRef.current && !busquedaRef.current.contains(e.target as Node)) {
        setShowSugg(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const sugerencias = busqueda.trim().length === 0
    ? productos
    : productos.filter(p => p.nombre.toLowerCase().includes(busqueda.toLowerCase()));

  const agregar = (p: Producto) => {
    const idx = items.findIndex(i => i.producto.id === p.id);
    if (idx >= 0) {
      setItems(prev => prev.map((it, i) => i === idx ? { ...it, cantidad: it.cantidad + 1 } : it));
    } else {
      setItems(prev => [...prev, { producto: p, cantidad: 1 }]);
    }
    setBusqueda('');
    setShowSugg(false);
  };

  const [guardando,  setGuardando]  = useState(false);
  const [guardado,   setGuardado]   = useState(false);
  const [tipoPago,   setTipoPago]   = useState<TipoPago>('entregar');
  const [fechaCobro, setFechaCobro] = useState('');
  const [cliente,    setCliente]    = useState('');

  const setCant = (idx: number, val: number) =>
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, cantidad: Math.max(1, val) } : it));
  const remover = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));
  const limpiar = () => { setItems([]); setBusqueda(''); setShowSugg(false); setGuardado(false); setTipoPago('entregar'); setFechaCobro(''); setCliente(''); };

  const registrarVenta = async () => {
    if (items.length === 0 || guardando) return;
    setGuardando(true);
    try {
      const fecha = format(new Date(), 'yyyy-MM-dd');
      const payload = {
        fecha,
        notas: 'Desde cotizador',
        tipo_pago: tipoPago,
        fecha_cobro: tipoPago === 'fiado' ? (fechaCobro || null) : null,
        cliente: cliente || '',
        items: items.map(it => ({
          producto_id:     it.producto.id,
          nombre_producto: it.producto.nombre,
          cantidad:        it.cantidad,
          precio_unitario: it.producto.precio_venta,
          costo_unitario:  it.producto.costo_produccion,
        })),
      };
      await fetch('/api/ventas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      window.dispatchEvent(new CustomEvent('datos-actualizados'));
      setGuardado(true);
      // No auto-limpiamos: el usuario decide cuándo empezar un nuevo pedido
    } finally { setGuardando(false); }
  };

  const mensajeCotizacion = () => [
    cliente ? `¡Hola ${cliente}! 👋` : '¡Hola! 👋',
    '',
    'Te comparto la cotización:',
    '',
    ...items.map(it => `• ${it.cantidad}× ${it.producto.nombre}  ${$(it.cantidad * it.producto.precio_venta)}`),
    '',
    `*Total: ${$(total)}*`,
  ].join('\n');

  const mensajeConfirmacion = () => [
    cliente ? `¡Hola ${cliente}! 👋` : '¡Hola! 👋',
    '',
    'Tu pedido está confirmado ✅',
    '',
    ...items.map(it => `• ${it.cantidad}× ${it.producto.nombre}`),
    '',
    `*Total: ${$(total)}*`,
    '',
    'Te avisamos cuando esté listo 🍽️',
  ].join('\n');

  const abrirWA = (texto: string) =>
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');

  const total    = items.reduce((s, it) => s + it.cantidad * it.producto.precio_venta,    0);
  const costo    = items.reduce((s, it) => s + it.cantidad * it.producto.costo_produccion, 0);
  const ganancia = total - costo;
  const margen   = total > 0 ? Math.round((ganancia / total) * 100) : 0;

  if (loading) return <div className="flex items-center justify-center h-60 text-gray-400">Cargando...</div>;

  return (
    <div className="space-y-5 pb-24 md:pb-6 max-w-xl">
      <div>
        <h1 className="text-xl font-bold text-gray-800">Cotizador</h1>
        <p className="text-sm text-gray-400">Calcula precios al instante</p>
      </div>

      {/* Buscador */}
      <div className="relative" ref={busquedaRef}>
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={busqueda}
            onChange={e => { setBusqueda(e.target.value); setShowSugg(true); }}
            onFocus={() => setShowSugg(true)}
            placeholder="Buscar producto..."
            className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 bg-white"
          />
        </div>
        {showSugg && sugerencias.length > 0 && (
          <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
            {sugerencias.map(p => (
              <button
                key={p.id}
                type="button"
                onMouseDown={() => agregar(p)}
                className="w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-orange-50 transition-colors text-left"
              >
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

      {/* Lista de ítems */}
      {items.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Calculator size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">Agrega productos para cotizar</p>
          <p className="text-sm">Selecciona arriba y ajusta las cantidades</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {items.map((it, i) => (
              <div key={it.producto.id} className={`flex items-center gap-3 px-4 py-3 ${i < items.length - 1 ? 'border-b border-gray-50' : ''}`}>
                {/* Nombre */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{it.producto.nombre}</p>
                  <p className="text-xs text-gray-400">{$(it.producto.precio_venta)} c/u</p>
                </div>

                {/* Contador */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => it.cantidad === 1 ? remover(i) : setCant(i, it.cantidad - 1)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 font-bold text-base"
                  >−</button>
                  <input
                    type="number" min="1"
                    value={it.cantidad}
                    onChange={e => setCant(i, Number(e.target.value))}
                    className="w-11 text-center border border-gray-200 rounded-lg py-1 text-sm font-medium"
                  />
                  <button
                    onClick={() => setCant(i, it.cantidad + 1)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 font-bold text-base"
                  >+</button>
                </div>

                {/* Subtotal */}
                <p className="text-sm font-semibold text-gray-800 w-16 text-right">
                  {$(it.cantidad * it.producto.precio_venta)}
                </p>

                {/* Eliminar */}
                <button onClick={() => remover(i)} className="text-gray-300 hover:text-red-400 transition-colors ml-1">
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>

          {/* Resumen */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50 flex justify-between items-center">
              <span className="text-sm text-gray-500">Subtotal por producto</span>
            </div>
            {items.map(it => (
              <div key={it.producto.id} className="px-4 py-2 flex justify-between">
                <span className="text-xs text-gray-500">{it.producto.nombre} × {it.cantidad}</span>
                <span className="text-xs font-medium text-gray-700">{$(it.cantidad * it.producto.precio_venta)}</span>
              </div>
            ))}

            <div className="px-4 py-3 border-t border-gray-100 mt-1 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-base font-bold text-gray-800">Total a cobrar</span>
                <span className="text-2xl font-bold text-orange-500">{$(total)}</span>
              </div>
              <div className="flex justify-between text-xs text-gray-400">
                <span>Ganancia estimada</span>
                <span className="text-emerald-500 font-medium">{$(ganancia)} ({margen}%)</span>
              </div>
            </div>
          </div>

          {/* Cliente (siempre visible) */}
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Cliente (opcional)</label>
            <input type="text" value={cliente} onChange={e => setCliente(e.target.value)}
              placeholder="Ej. Juan García"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-300" />
          </div>

          {/* Selector de forma de pago */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3 space-y-3">
            <p className="text-xs font-medium text-gray-500">Forma de pago</p>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                onClick={() => setTipoPago('entregar')}
                className={`py-2.5 px-1 rounded-xl text-xs font-semibold text-center transition-colors ${
                  tipoPago === 'entregar'
                    ? 'bg-orange-500 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                📦 Al entregar
              </button>
              <button
                onClick={() => { setTipoPago('cobrado'); setFechaCobro(''); }}
                className={`py-2.5 px-1 rounded-xl text-xs font-semibold text-center transition-colors ${
                  tipoPago === 'cobrado'
                    ? 'bg-emerald-500 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                ✅ Ya pagó
              </button>
              <button
                onClick={() => setTipoPago('fiado')}
                className={`py-2.5 px-1 rounded-xl text-xs font-semibold text-center transition-colors ${
                  tipoPago === 'fiado'
                    ? 'bg-amber-500 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                <Clock size={11} className="inline mr-0.5" />Fiado
              </button>
            </div>

            {tipoPago === 'entregar' && (
              <p className="text-xs text-gray-400 text-center">Se guardará como pedido pendiente de entrega</p>
            )}
            {tipoPago === 'fiado' && (
              <div>
                <label className="text-xs font-medium text-amber-700 block mb-1">Fecha acordada de cobro (opcional)</label>
                <input type="date" value={fechaCobro} onChange={e => setFechaCobro(e.target.value)}
                  className="w-full border border-amber-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-300" />
              </div>
            )}
          </div>

          {/* Botones */}
          {guardado ? (
            /* ── Estado post-registro ── */
            <div className="space-y-3">
              <div className={`rounded-2xl p-4 text-center border ${
                tipoPago === 'cobrado' ? 'bg-emerald-50 border-emerald-200'
                : tipoPago === 'fiado' ? 'bg-amber-50 border-amber-200'
                : 'bg-orange-50 border-orange-200'
              }`}>
                <p className={`font-semibold text-sm ${
                  tipoPago === 'cobrado' ? 'text-emerald-700'
                  : tipoPago === 'fiado' ? 'text-amber-700'
                  : 'text-orange-700'
                }`}>
                  <Check size={15} className="inline mr-1" />
                  {tipoPago === 'entregar' ? '¡Pedido registrado!' : tipoPago === 'fiado' ? '¡Fiado registrado!' : '¡Venta registrada!'}
                </p>
              </div>
              <div className="flex gap-3">
                {tipoPago === 'entregar' && (
                  <button
                    onClick={() => abrirWA(mensajeConfirmacion())}
                    className="flex-1 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    📲 Confirmar por WhatsApp
                  </button>
                )}
                <button
                  onClick={limpiar}
                  className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-500 hover:bg-gray-50 transition-colors"
                >
                  + Nuevo pedido
                </button>
              </div>
            </div>
          ) : (
            /* ── Estado normal ── */
            <div className="space-y-2">
              <button
                onClick={() => abrirWA(mensajeCotizacion())}
                className="w-full py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 flex items-center justify-center gap-2 transition-colors"
              >
                🧾 Compartir cotización por WhatsApp
              </button>
              <div className="flex gap-3">
                <button onClick={limpiar} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-500 hover:bg-gray-50 transition-colors">
                  Limpiar
                </button>
                <button
                  onClick={registrarVenta}
                  disabled={guardando}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${
                    tipoPago === 'cobrado' ? 'bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white'
                    : tipoPago === 'fiado' ? 'bg-amber-500  hover:bg-amber-600  disabled:opacity-60 text-white'
                    :                        'bg-orange-500  hover:bg-orange-600  disabled:opacity-60 text-white'
                  }`}
                >
                  {guardando          ? 'Registrando...'
                    : tipoPago === 'cobrado' ? <><Check  size={16}/> Registrar venta</>
                    : tipoPago === 'fiado'   ? <><Clock  size={16}/> Registrar fiado</>
                    :                          <><Package size={16}/> Registrar pedido</>}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
