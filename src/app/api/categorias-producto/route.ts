import { NextRequest, NextResponse } from 'next/server';
import { getDb, toRows } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = await getDb();
    const r = await db.execute({ sql: `SELECT id, nombre FROM categorias_producto ORDER BY nombre`, args: [] });
    return NextResponse.json(toRows(r.rows, r.columns as string[]));
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { nombre } = await req.json();
    if (!nombre?.trim()) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 });
    const db = await getDb();
    const r = await db.execute({
      sql: `INSERT OR IGNORE INTO categorias_producto (nombre) VALUES (?)`,
      args: [nombre.trim()],
    });
    return NextResponse.json({ id: Number(r.lastInsertRowid) }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
