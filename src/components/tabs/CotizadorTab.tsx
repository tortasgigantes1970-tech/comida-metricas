'use client';
import { useEffect, useState } from 'react';
import { Plus, Trash2, Calculator } from 'lucide-react';

interface Producto { id: number; nombre: string; precio_venta: number; costo_produccion: number; categoria: string; }
interface Item { producto: Producto; cantidad: number; }

const $ = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 }).format(n);

export default function CotizadorTab() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [items, setItems]         = useState<Item[]>([]);
  const [prodSel, setProdSel]     = useState('');
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    fetch('/api/productos')
      .then(r => r.json())
      .then((data: (Producto & { activo: number })[]) => {
        setProductos(data.filter(p => p.activo));
        setLoading(false);
      });
  }, []);

  const agregar = () => {
    if (!prodSel) return;
    const p = productos.find(x => x.id === Number(prodSel));
    if (!p) return;
    const idx = items.findIndex(i => i.producto.id === p.id);
    if (idx >= 0) {
      setItems(prev => prev.map((it, i) => i === idx ? { ...it, cantidad: it.cantidad + 1 } : it));
    } else {
      setItems(prev => [...prev, { producto: p, cantidad: 1 }]);
    }
    setProdSel('');
  };

  const setCant   = (idx: number, val: number) =>
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, cantidad: Math.max(1, val) } : it));
  const remover   = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));
  const limpiar   = () => { setItems([]); setProdSel(''); };

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

      {/* Selector */}
      <div className="flex gap-2">
        <select
          value={prodSel}
          onChange={e => setProdSel(e.target.value)}
          className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 bg-white"
        >
          <option value="">Selecciona un producto...</option>
          {Array.from(new Set(productos.map(p => p.categoria || 'Sin categoría'))).map(cat => (
            <optgroup key={cat} label={cat}>
              {productos.filter(p => (p.categoria || 'Sin categoría') === cat).map(p => (
                <option key={p.id} value={p.id}>
                  {p.nombre} — {$(p.precio_venta)}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <button
          onClick={agregar}
          disabled={!prodSel}
          className="bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white px-4 rounded-xl transition-colors"
        >
          <Plus size={18} />
        </button>
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

          {/* Botón limpiar */}
          <button
            onClick={limpiar}
            className="w-full py-2.5 border border-gray-200 rounded-xl text-sm text-gray-500 hover:bg-gray-50 transition-colors"
          >
            Limpiar cotización
          </button>
        </>
      )}
    </div>
  );
}
