import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = await getDb();
    const r = await db.execute({
      sql: `SELECT DISTINCT cliente FROM ventas
            WHERE cliente IS NOT NULL AND TRIM(cliente) != ''
            ORDER BY cliente ASC`,
      args: [],
    });
    const clientes = r.rows.map(row => String(row[0]));
    return NextResponse.json(clientes, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json([], { status: 500 });
  }
}
