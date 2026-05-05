'use client';
import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Package } from 'lucide-react';
import Modal from '@/components/Modal';

interface Categoria { id: number; nombre: string; }
interface Producto {
  id: number; nombre: string; descripcion: string;
  categoria_id: number | null; categoria: string;
  precio_venta: number; costo_produccion: number;
  margen: number; activo: number;
}

const EMPTY: Omit<Producto, 'id' | 'categoria' | 'margen' | 'activo'> = {
  nombre: '', descripcion: '', categoria_id: null,
  precio_venta: 0, costo_produccion: 0,
};

const $ = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 }).format(n);

export default function ProductosTab() {
  const [productos, setProductos]     = useState<Producto[]>([]);
  const [categorias, setCategorias]   = useState<Categoria[]>([]);
  const [loading, setLoading]         = useState(true);
  const [modal, setModal]             = useState(false);
  const [editing, setEditing]         = useState<Producto | null>(null);
  const [form, setForm]               = useState(EMPTY);
  const [saving, setSaving]           = useState(false);
  const [mostrarInactivos, setMostrarInactivos] = useState(false);

  const load = async () => {
    setLoading(true);
    const [rP, rC] = await Promise.all([
      fetch('/api/productos').then(r => r.json()),
      fetch('/api/categorias-gasto').then(r => r.json()), // reutilizamos fetch, usaremos el de productos
    ]);
    // Categorías de producto están embebidas en la respuesta
    const cats: Categoria[] = Array.from(
      new Map((rP as Producto[]).filter(p => p.categoria_id).map((p: Producto) => [p.categoria_id, { id: p.categoria_id!, nombre: p.categoria }])).values()
    );
    // También cargamos desde la DB directamente
    const rCat = await fetch('/api/categorias-producto').then(r => r.json()).catch(() => []);
    setProductos(rP as Producto[]);
    setCategorias(rCat.length ? rCat : cats);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openNew  = () => { setEditing(null); setForm(EMPTY); setModal(true); };
  const openEdit = (p: Producto) => {
    setEditing(p);
    setForm({ nombre: p.nombre, descripcion: p.descripcion, categoria_id: p.categoria_id, precio_venta: p.precio_venta, costo_produccion: p.costo_produccion });
    setModal(true);
  };

  const save = async () => {
    if (!form.nombre.trim() || !form.precio_venta) return;
    setSaving(true);
    try {
      if (editing) {
        await fetch(`/api/productos/${editing.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
      } else {
        await fetch('/api/productos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
      }
      setModal(false);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const del = async (id: number) => {
    if (!confirm('¿Eliminar este producto? Seguirá apareciendo en ventas anteriores.')) return;
    await fetch(`/api/productos/${id}`, { method: 'DELETE' });
    await load();
  };

  const margenColor = (m: number) =>
    m >= 60 ? 'text-emerald-600 bg-emerald-50' : m >= 40 ? 'text-orange-600 bg-orange-50' : 'text-red-600 bg-red-50';

  const visibles = mostrarInactivos ? productos : productos.filter(p => p.activo);

  if (loading) return <div className="flex items-center justify-center h-60 text-gray-400">Cargando...</div>;

  return (
    <div className="space-y-4 pb-24 md:pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Productos</h1>
          <p className="text-sm text-gray-400">{visibles.length} producto{visibles.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
        >
          <Plus size={16} /> Nuevo
        </button>
      </div>

      {/* Toggle inactivos */}
      {productos.some(p => !p.activo) && (
        <button
          onClick={() => setMostrarInactivos(v => !v)}
          className="text-xs text-gray-400 underline"
        >
          {mostrarInactivos ? 'Ocultar eliminados' : 'Mostrar eliminados'}
        </button>
      )}

      {/* Lista */}
      {visibles.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Package size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">Sin productos</p>
          <p className="text-sm">Agrega tu primer producto</p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Agrupar por categoría */}
          {Array.from(new Set(visibles.map(p => p.categoria || 'Sin categoría'))).map(cat => (
            <div key={cat}>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest px-1 mb-2 mt-4">{cat}</p>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                {visibles.filter(p => (p.categoria || 'Sin categoría') === cat).map((p, i, arr) => (
                  <div key={p.id} className={`flex items-center gap-3 px-4 py-3 ${!p.activo ? 'opacity-40' : ''} ${i < arr.length - 1 ? 'border-b border-gray-50' : ''}`}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800">{p.nombre}</p>
                      {p.descripcion && <p className="text-xs text-gray-400 truncate">{p.descripcion}</p>}
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs text-gray-500">Venta: <span className="font-medium text-gray-700">{$(p.precio_venta)}</span></span>
                        <span className="text-xs text-gray-500">Costo: <span className="font-medium text-gray-700">{$(p.costo_produccion)}</span></span>
                      </div>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${margenColor(p.margen)}`}>
                      {p.margen}%
                    </span>
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(p)} className="p-1.5 text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-colors">
                        <Pencil size={15} />
                      </button>
                      {p.activo ? (
                        <button onClick={() => del(p.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 size={15} />
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <Modal title={editing ? 'Editar producto' : 'Nuevo producto'} onClose={() => setModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Nombre *</label>
              <input
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                value={form.nombre}
                onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                placeholder="Ej. Taco de canasta"
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Descripción</label>
              <input
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                value={form.descripcion}
                onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                placeholder="Opcional"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Categoría</label>
              <select
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 bg-white"
                value={form.categoria_id ?? ''}
                onChange={e => setForm(f => ({ ...f, categoria_id: e.target.value ? Number(e.target.value) : null }))}
              >
                <option value="">Sin categoría</option>
                {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Precio de venta *</label>
                <input
                  type="number" min="0" step="0.50"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                  value={form.precio_venta || ''}
                  onChange={e => setForm(f => ({ ...f, precio_venta: Number(e.target.value) }))}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Costo de producción *</label>
                <input
                  type="number" min="0" step="0.50"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                  value={form.costo_produccion || ''}
                  onChange={e => setForm(f => ({ ...f, costo_produccion: Number(e.target.value) }))}
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* Preview margen */}
            {form.precio_venta > 0 && (
              <div className="bg-gray-50 rounded-xl p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Ganancia por unidad</span>
                  <span className="font-semibold text-gray-800">{$(form.precio_venta - form.costo_produccion)}</span>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-gray-500">Margen</span>
                  <span className={`font-semibold ${form.precio_venta > 0 ? (((form.precio_venta - form.costo_produccion) / form.precio_venta) * 100 >= 40 ? 'text-emerald-600' : 'text-orange-500') : 'text-gray-800'}`}>
                    {form.precio_venta > 0 ? Math.round(((form.precio_venta - form.costo_produccion) / form.precio_venta) * 100) : 0}%
                  </span>
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setModal(false)}
                className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={save}
                disabled={saving || !form.nombre.trim()}
                className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-medium transition-colors"
              >
                {saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Crear producto'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
