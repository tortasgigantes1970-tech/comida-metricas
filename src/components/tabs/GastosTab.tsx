'use client';
import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, Receipt } from 'lucide-react';
import { format, endOfMonth } from 'date-fns';
import Modal from '@/components/Modal';

interface Categoria { id: number; nombre: string; }
interface Gasto { id: number; fecha: string; descripcion: string; monto: number; categoria_id: number | null; categoria: string; }

const $ = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 }).format(n);

const hoyStr = () => format(new Date(), 'yyyy-MM-dd');

const EMPTY_FORM = { fecha: hoyStr(), categoria_id: '' as string | number, descripcion: '', monto: '' as string | number };

export default function GastosTab() {
  const [gastos, setGastos]         = useState<Gasto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading]       = useState(true);
  const [modal, setModal]           = useState(false);
  const [editing, setEditing]       = useState<Gasto | null>(null);
  const [form, setForm]             = useState(EMPTY_FORM);
  const [saving, setSaving]         = useState(false);
  const [mes, setMes]               = useState(format(new Date(), 'yyyy-MM'));

  const load = useCallback(async () => {
    setLoading(true);
    const desde = `${mes}-01`;
    const hasta = format(endOfMonth(new Date(`${mes}-01T12:00:00`)), 'yyyy-MM-dd');
    const [rG, rC] = await Promise.all([
      fetch(`/api/gastos?desde=${desde}&hasta=${hasta}`).then(r => r.json()),
      fetch('/api/categorias-gasto').then(r => r.json()),
    ]);
    setGastos(rG as Gasto[]);
    setCategorias(rC as Categoria[]);
    setLoading(false);
  }, [mes]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, fecha: hoyStr() });
    setModal(true);
  };

  const openEdit = (g: Gasto) => {
    setEditing(g);
    setForm({ fecha: g.fecha, categoria_id: g.categoria_id ?? '', descripcion: g.descripcion, monto: g.monto });
    setModal(true);
  };

  const save = async () => {
    if (!form.fecha || !form.monto) return;
    setSaving(true);
    try {
      const body = { ...form, categoria_id: form.categoria_id || null, monto: Number(form.monto) };
      if (editing) {
        await fetch(`/api/gastos/${editing.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      } else {
        await fetch('/api/gastos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      }
      setModal(false);
      await load();
      window.dispatchEvent(new CustomEvent('datos-actualizados'));
    } finally {
      setSaving(false);
    }
  };

  const del = async (id: number) => {
    if (!confirm('¿Eliminar este gasto?')) return;
    await fetch(`/api/gastos/${id}`, { method: 'DELETE' });
    await load();
  };

  const total = gastos.reduce((s, g) => s + g.monto, 0);

  // Agrupar por categoría para el resumen
  const porCat = gastos.reduce<Record<string, number>>((acc, g) => {
    const cat = g.categoria || 'Sin categoría';
    acc[cat] = (acc[cat] ?? 0) + g.monto;
    return acc;
  }, {});

  if (loading) return <div className="flex items-center justify-center h-60 text-gray-400">Cargando...</div>;

  return (
    <div className="space-y-4 pb-24 md:pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Gastos</h1>
          <p className="text-sm text-gray-400">{gastos.length} registro{gastos.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
        >
          <Plus size={16} /> Nuevo gasto
        </button>
      </div>

      {/* Filtro mes */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-500">Mes:</label>
        <input
          type="month"
          value={mes}
          onChange={e => setMes(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
        />
      </div>

      {gastos.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Receipt size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">Sin gastos en este período</p>
          <p className="text-sm">Registra tus gastos operativos</p>
        </div>
      ) : (
        <>
          {/* Total y resumen */}
          <div className="bg-red-50 rounded-2xl p-4">
            <p className="text-xs text-red-400 font-medium mb-1">Total gastos del período</p>
            <p className="text-2xl font-bold text-red-500">{$(total)}</p>
          </div>

          {/* Por categoría */}
          {Object.keys(porCat).length > 1 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest px-4 pt-3 pb-2">Por categoría</p>
              {Object.entries(porCat).sort(([, a], [, b]) => b - a).map(([cat, monto], i, arr) => (
                <div key={cat} className={`flex justify-between items-center px-4 py-2.5 ${i < arr.length - 1 ? 'border-b border-gray-50' : ''}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-700">{cat}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-800">{$(monto)}</p>
                    <p className="text-xs text-gray-400">{total > 0 ? Math.round((monto / total) * 100) : 0}%</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Lista detallada */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Detalle</p>
            <div className="space-y-2">
              {gastos.map(g => (
                <div key={g.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">{g.descripcion || g.categoria || 'Sin descripción'}</p>
                    <p className="text-xs text-gray-400">{g.fecha} · {g.categoria || 'Sin categoría'}</p>
                  </div>
                  <p className="text-sm font-bold text-red-500">{$(g.monto)}</p>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(g)} className="p-1.5 text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-colors">
                      <Pencil size={15} />
                    </button>
                    <button onClick={() => del(g.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Modal */}
      {modal && (
        <Modal title={editing ? 'Editar gasto' : 'Nuevo gasto'} onClose={() => setModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Fecha *</label>
              <input
                type="date"
                value={form.fecha}
                onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Categoría</label>
              <select
                value={form.categoria_id}
                onChange={e => setForm(f => ({ ...f, categoria_id: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 bg-white"
              >
                <option value="">Sin categoría</option>
                {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Descripción</label>
              <input
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                value={form.descripcion}
                onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                placeholder="Ej. Pago de renta mayo"
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Monto *</label>
              <input
                type="number" min="0" step="0.01"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                value={form.monto}
                onChange={e => setForm(f => ({ ...f, monto: e.target.value }))}
                placeholder="0.00"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setModal(false)} className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50">
                Cancelar
              </button>
              <button
                onClick={save}
                disabled={saving || !form.monto}
                className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-medium transition-colors"
              >
                {saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Registrar gasto'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
