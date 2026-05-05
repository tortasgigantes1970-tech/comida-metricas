import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { fecha, categoria_id, descripcion, monto } = await req.json();
    const db = await getDb();
    await db.execute({
      sql: `UPDATE gastos SET fecha=?, categoria_id=?, descripcion=?, monto=? WHERE id=?`,
      args: [fecha, categoria_id ?? null, descripcion ?? '', Number(monto), Number(params.id)],
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const db = await getDb();
    await db.execute({ sql: `DELETE FROM gastos WHERE id=?`, args: [Number(params.id)] });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
