import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id   = Number(params.id);
    const body = await req.json() as { cobrado?: boolean; fiado?: boolean; fecha_cobro?: string };
    const db   = await getDb();

    if (body.cobrado !== undefined) {
      await db.execute({
        sql:  `UPDATE ventas SET cobrado=? WHERE id=?`,
        args: [body.cobrado ? 1 : 0, id],
      });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id);
    const body = await req.json();
    const { fecha, items, notas, fiado, fecha_cobro, cobrado } = body as {
      fecha: string;
      notas?: string;
      fiado?: boolean;
      fecha_cobro?: string;
      cobrado?: boolean;
      items: { producto_id?: number; nombre_producto: string; cantidad: number; precio_unitario: number; costo_unitario: number }[];
    };

    if (!fecha || !items || items.length === 0) {
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
    }

    const total       = items.reduce((s, i) => s + i.cantidad * i.precio_unitario, 0);
    const total_costo = items.reduce((s, i) => s + i.cantidad * i.costo_unitario,  0);

    const db = await getDb();

    // Actualizar la venta
    await db.execute({
      sql: `UPDATE ventas SET fecha=?, total=?, total_costo=?, notas=?, fiado=?, fecha_cobro=?, cobrado=? WHERE id=?`,
      args: [fecha, total, total_costo, notas ?? '', fiado ? 1 : 0, fecha_cobro ?? null, cobrado ? 1 : 0, id],
    });

    // Borrar ítems anteriores e insertar los nuevos
    await db.execute({ sql: `DELETE FROM venta_items WHERE venta_id=?`, args: [id] });

    for (const item of items) {
      await db.execute({
        sql: `INSERT INTO venta_items (venta_id, producto_id, nombre_producto, cantidad, precio_unitario, costo_unitario)
              VALUES (?, ?, ?, ?, ?, ?)`,
        args: [id, item.producto_id ?? null, item.nombre_producto, item.cantidad, item.precio_unitario, item.costo_unitario],
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

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
