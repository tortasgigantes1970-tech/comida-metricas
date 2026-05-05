import { NextRequest, NextResponse } from 'next/server';
import { getDb, toRows } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const desde = searchParams.get('desde');
    const hasta = searchParams.get('hasta');

    const db = await getDb();
    let sql = `SELECT g.id, g.fecha, g.descripcion, g.monto, g.created_at,
                      cg.id as categoria_id, cg.nombre as categoria
               FROM gastos g
               LEFT JOIN categorias_gasto cg ON cg.id = g.categoria_id`;
    const args: (string | number)[] = [];

    if (desde && hasta) {
      sql += ` WHERE g.fecha BETWEEN ? AND ?`;
      args.push(desde, hasta);
    } else if (desde) {
      sql += ` WHERE g.fecha >= ?`;
      args.push(desde);
    }
    sql += ` ORDER BY g.fecha DESC, g.created_at DESC`;

    const r = await db.execute({ sql, args });
    return NextResponse.json(toRows(r.rows, r.columns as string[]));
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { fecha, categoria_id, descripcion, monto } = await req.json();
    if (!fecha || monto == null) {
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
    }
    const db = await getDb();
    const r = await db.execute({
      sql: `INSERT INTO gastos (fecha, categoria_id, descripcion, monto) VALUES (?, ?, ?, ?)`,
      args: [fecha, categoria_id ?? null, descripcion ?? '', Number(monto)],
    });
    return NextResponse.json({ id: Number(r.lastInsertRowid) }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
