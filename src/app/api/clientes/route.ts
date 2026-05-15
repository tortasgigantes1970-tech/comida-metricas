import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

const noCache = { 'Cache-Control': 'no-store' };

// GET /api/clientes          → string[]
// GET /api/clientes?stats=1  → { nombre, ventas }[]
export async function GET(req: NextRequest) {
  try {
    const db = await getDb();
    const stats = req.nextUrl.searchParams.get('stats') === '1';

    if (stats) {
      const r = await db.execute({
        sql: `SELECT cliente, COUNT(*) as total
              FROM ventas
              WHERE cliente IS NOT NULL AND TRIM(cliente) != ''
              GROUP BY cliente
              ORDER BY cliente ASC`,
        args: [],
      });
      return NextResponse.json(
        r.rows.map(row => ({ nombre: String(row[0]), ventas: Number(row[1]) })),
        { headers: noCache }
      );
    }

    const r = await db.execute({
      sql: `SELECT DISTINCT cliente FROM ventas
            WHERE cliente IS NOT NULL AND TRIM(cliente) != ''
            ORDER BY cliente ASC`,
      args: [],
    });
    return NextResponse.json(r.rows.map(row => String(row[0])), { headers: noCache });
  } catch (err) {
    console.error(err);
    return NextResponse.json([], { status: 500 });
  }
}

// PATCH /api/clientes  → { nombre_actual, nombre_nuevo }
// Actualiza todas las ventas con ese nombre de cliente
export async function PATCH(req: NextRequest) {
  try {
    const { nombre_actual, nombre_nuevo } = await req.json() as {
      nombre_actual: string;
      nombre_nuevo: string;
    };

    if (!nombre_actual || !nombre_nuevo?.trim()) {
      return NextResponse.json({ error: 'Faltan campos' }, { status: 400 });
    }

    const db = await getDb();
    await db.execute({
      sql: `UPDATE ventas SET cliente = ? WHERE cliente = ?`,
      args: [nombre_nuevo.trim(), nombre_actual],
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
