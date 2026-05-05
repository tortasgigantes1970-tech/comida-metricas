import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const db = await getDb();
    // ON DELETE CASCADE eliminará los venta_items automáticamente
    await db.execute({ sql: `DELETE FROM ventas WHERE id=?`, args: [Number(params.id)] });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
