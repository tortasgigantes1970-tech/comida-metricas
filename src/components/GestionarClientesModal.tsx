'use client';
import { useEffect, useState } from 'react';
import { Pencil, Check, X, Users } from 'lucide-react';

interface ClienteStat { nombre: string; ventas: number; }

interface Props {
  open: boolean;
  onClose: () => void;
  onGuardado: () => void; // para refrescar datos después de renombrar
}

export default function GestionarClientesModal({ open, onClose, onGuardado }: Props) {
  const [clientes, setClientes]     = useState<ClienteStat[]>([]);
  const [loading, setLoading]       = useState(false);
  const [editando, setEditando]     = useState<string | null>(null);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [guardando, setGuardando]   = useState(false);
  const [error, setError]           = useState('');

  const cargar = async () => {
    setLoading(true);
    const r = await fetch('/api/clientes?stats=1').then(r => r.json());
    setClientes(r as ClienteStat[]);
    setLoading(false);
  };

  useEffect(() => { if (open) cargar(); }, [open]);

  const iniciarEdicion = (nombre: string) => {
    setEditando(nombre);
    setNuevoNombre(nombre);
    setError('');
  };

  const cancelar = () => { setEditando(null); setNuevoNombre(''); setError(''); };

  const guardar = async (nombreActual: string) => {
    if (!nuevoNombre.trim()) return;
    if (nuevoNombre.trim() === nombreActual) { cancelar(); return; }
    setGuardando(true);
    setError('');
    try {
      const r = await fetch('/api/clientes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre_actual: nombreActual, nombre_nuevo: nuevoNombre.trim() }),
      });
      if (!r.ok) throw new Error('Error al guardar');
      await cargar();
      setEditando(null);
      onGuardado();
    } catch {
      setError('No se pudo guardar. Intenta de nuevo.');
    } finally {
      setGuardando(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-orange-500" />
            <h2 className="font-bold text-gray-800">Gestionar clientes</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <p className="px-5 pt-3 pb-1 text-xs text-gray-400">
          Edita el nombre de un cliente para corregir errores o fusionar duplicados.
          Si renombras a un nombre que ya existe, quedará fusionado automáticamente.
        </p>

        {/* Lista */}
        <div className="overflow-y-auto flex-1 divide-y divide-gray-50 px-2 py-2">
          {loading ? (
            <p className="text-center text-gray-400 text-sm py-8">Cargando...</p>
          ) : clientes.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-8">Sin clientes registrados</p>
          ) : (
            clientes.map(c => (
              <div key={c.nombre} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50">
                {editando === c.nombre ? (
                  /* Modo edición */
                  <div className="flex-1 flex items-center gap-2">
                    <input
                      autoFocus
                      value={nuevoNombre}
                      onChange={e => setNuevoNombre(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') guardar(c.nombre); if (e.key === 'Escape') cancelar(); }}
                      className="flex-1 border border-orange-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                    />
                    <button
                      onClick={() => guardar(c.nombre)}
                      disabled={guardando || !nuevoNombre.trim()}
                      className="text-emerald-600 hover:text-emerald-700 disabled:opacity-40"
                    >
                      <Check size={17} />
                    </button>
                    <button onClick={cancelar} className="text-gray-400 hover:text-gray-600">
                      <X size={17} />
                    </button>
                  </div>
                ) : (
                  /* Modo lectura */
                  <>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{c.nombre}</p>
                      <p className="text-xs text-gray-400">{c.ventas} {c.ventas === 1 ? 'venta' : 'ventas'}</p>
                    </div>
                    <button
                      onClick={() => iniciarEdicion(c.nombre)}
                      className="text-gray-300 hover:text-orange-400 transition-colors shrink-0"
                    >
                      <Pencil size={15} />
                    </button>
                  </>
                )}
              </div>
            ))
          )}
        </div>

        {error && <p className="text-xs text-red-500 px-5 pb-2">{error}</p>}

        <div className="px-5 py-4 border-t border-gray-100">
          <button onClick={onClose} className="w-full py-2.5 border border-gray-200 rounded-xl text-sm text-gray-500 hover:bg-gray-50">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
