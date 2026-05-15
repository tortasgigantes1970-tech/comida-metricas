'use client';
import { useEffect, useRef, useState } from 'react';
import { User } from 'lucide-react';

interface Props {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
}

export default function ClienteInput({ value, onChange, placeholder = 'Buscar o nuevo cliente...', className = '' }: Props) {
  const [clientes, setClientes] = useState<string[]>([]);
  const [showSugg, setShowSugg] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Cargar clientes existentes una vez
  useEffect(() => {
    fetch('/api/clientes')
      .then(r => r.json())
      .then((data: string[]) => setClientes(data))
      .catch(() => {});
  }, []);

  // Cerrar al clic afuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setShowSugg(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const sugerencias = value.trim().length === 0
    ? clientes
    : clientes.filter(c => c.toLowerCase().includes(value.toLowerCase()));

  const esNuevo = value.trim().length > 0 &&
    !sugerencias.some(c => c.toLowerCase() === value.trim().toLowerCase());

  return (
    <div className={`relative ${className}`} ref={ref}>
      <div className="relative">
        <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          type="text"
          value={value}
          onChange={e => { onChange(e.target.value); setShowSugg(true); }}
          onFocus={() => setShowSugg(true)}
          placeholder={placeholder}
          className="w-full border border-gray-200 rounded-xl pl-8 pr-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-300"
        />
      </div>

      {showSugg && (sugerencias.length > 0 || esNuevo) && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-52 overflow-y-auto">
          {sugerencias.map(c => (
            <button
              key={c}
              type="button"
              onMouseDown={() => { onChange(c); setShowSugg(false); }}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left hover:bg-orange-50 transition-colors"
            >
              <User size={13} className="text-gray-400 shrink-0" />
              <span className="text-gray-800">{c}</span>
            </button>
          ))}
          {esNuevo && (
            <button
              type="button"
              onMouseDown={() => { onChange(value.trim()); setShowSugg(false); }}
              className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left text-orange-600 font-medium hover:bg-orange-50 transition-colors ${sugerencias.length > 0 ? 'border-t border-gray-100' : ''}`}
            >
              <span className="text-orange-400 font-bold text-base leading-none">+</span>
              <span>Nuevo cliente: &quot;{value.trim()}&quot;</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
