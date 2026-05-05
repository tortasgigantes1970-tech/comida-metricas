import { NextRequest, NextResponse } from 'next/server';
import { getDb, toRows } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = await getDb();
    const r = await db.execute({
      sql: `SELECT p.id, p.nombre, p.descripcion, p.precio_venta, p.costo_produccion,
                   p.activo, p.created_at, p.updated_at,
                   cp.id as categoria_id, cp.nombre as categoria
            FROM productos p
            LEFT JOIN categorias_producto cp ON cp.id = p.categoria_id
            ORDER BY cp.nombre, p.nombre`,
      args: [],
    });
    const productos = toRows(r.rows, r.columns as string[]).map(p => ({
      ...p,
      margen: Number(p.precio_venta) > 0
        ? Math.round(((Number(p.precio_venta) - Number(p.costo_produccion)) / Number(p.precio_venta)) * 100)
        : 0,
    }));
    return NextResponse.json(productos);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { nombre, descripcion, categoria_id, precio_venta, costo_produccion } = await req.json();
    if (!nombre || precio_venta == null || costo_produccion == null) {
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
    }
    const db = await getDb();
    const r = await db.execute({
      sql: `INSERT INTO productos (nombre, descripcion, categoria_id, precio_venta, costo_produccion)
            VALUES (?, ?, ?, ?, ?)`,
      args: [nombre.trim(), descripcion ?? '', categoria_id ?? null, Number(precio_venta), Number(costo_produccion)],
    });
    return NextResponse.json({ id: Number(r.lastInsertRowid) }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
