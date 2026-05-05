import { NextResponse } from 'next/server';
import { getDb, toRows } from '@/lib/db';

export async function GET() {
  try {
    const db = await getDb();
    const r = await db.execute({ sql: `SELECT id, nombre FROM categorias_gasto ORDER BY nombre`, args: [] });
    return NextResponse.json(toRows(r.rows, r.columns as string[]));
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
