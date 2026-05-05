import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { nombre, descripcion, categoria_id, precio_venta, costo_produccion, activo } = await req.json();
    const db = await getDb();
    await db.execute({
      sql: `UPDATE productos
            SET nombre=?, descripcion=?, categoria_id=?, precio_venta=?, costo_produccion=?, activo=?,
                updated_at=datetime('now')
            WHERE id=?`,
      args: [
        nombre.trim(),
        descripcion ?? '',
        categoria_id ?? null,
        Number(precio_venta),
        Number(costo_produccion),
        activo ?? 1,
        Number(params.id),
      ],
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
    // Soft delete: marcar como inactivo en lugar de borrar
    await db.execute({
      sql: `UPDATE productos SET activo=0, updated_at=datetime('now') WHERE id=?`,
      args: [Number(params.id)],
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
