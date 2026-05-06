import { NextRequest, NextResponse } from 'next/server';
import { getDb, toRows } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const desde = searchParams.get('desde');
    const hasta = searchParams.get('hasta');

    const db = await getDb();

    const pendientes = searchParams.get('pendientes');

    let sql = `SELECT v.id, v.fecha, v.total, v.total_costo, v.notas, v.fiado, v.fecha_cobro, v.cobrado, v.cliente, v.tipo_pago, v.created_at
               FROM ventas v`;
    const args: (string | number)[] = [];

    if (pendientes === '1') {
      sql += ` WHERE (v.tipo_pago = 'entregar' AND v.cobrado = 0)`;
      sql += ` ORDER BY v.created_at ASC`;
    } else {
      if (desde && hasta) {
        sql += ` WHERE v.fecha BETWEEN ? AND ?`;
        args.push(desde, hasta);
      } else if (desde) {
        sql += ` WHERE v.fecha >= ?`;
        args.push(desde);
      }
      sql += ` ORDER BY v.fecha DESC, v.created_at DESC`;
    }

    const rVentas = await db.execute({ sql, args });
    const ventas = toRows(rVentas.rows, rVentas.columns as string[]);

    // Cargar ítems para cada venta
    if (ventas.length === 0) return NextResponse.json([]);

    const ids = ventas.map(v => v.id as number);
    const placeholders = ids.map(() => '?').join(',');
    const rItems = await db.execute({
      sql: `SELECT venta_id, nombre_producto, cantidad, precio_unitario, costo_unitario
            FROM venta_items WHERE venta_id IN (${placeholders})`,
      args: ids,
    });
    const items = toRows(rItems.rows, rItems.columns as string[]);

    const itemsByVenta: Record<number, typeof items> = {};
    for (const item of items) {
      const vid = item.venta_id as number;
      if (!itemsByVenta[vid]) itemsByVenta[vid] = [];
      itemsByVenta[vid].push(item);
    }

    const noCache = {
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Netlify-CDN-Cache-Control': 'no-store',
      'Pragma': 'no-cache',
    };
    return NextResponse.json(
      ventas.map(v => ({
        ...v,
        ganancia: Number(v.total) - Number(v.total_costo),
        items: itemsByVenta[v.id as number] ?? [],
      })),
      { headers: noCache }
    );
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { fecha, items, notas, fiado, fecha_cobro, cliente, tipo_pago } = body as {
      fecha: string;
      notas?: string;
      fiado?: boolean;
      fecha_cobro?: string;
      cliente?: string;
      tipo_pago?: 'cobrado' | 'entregar' | 'fiado';
      items: { producto_id?: number; nombre_producto: string; cantidad: number; precio_unitario: number; costo_unitario: number }[];
    };

    if (!fecha || !items || items.length === 0) {
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
    }

    // Derivar tipo_pago (retrocompatible con campo fiado legacy)
    const tipoPagoFinal = tipo_pago ?? (fiado ? 'fiado' : 'cobrado');
    const esFiado   = tipoPagoFinal === 'fiado'   ? 1 : 0;
    const esCobrado = tipoPagoFinal === 'cobrado' ? 1 : 0;

    const total       = items.reduce((s, i) => s + i.cantidad * i.precio_unitario, 0);
    const total_costo = items.reduce((s, i) => s + i.cantidad * i.costo_unitario,  0);

    const db = await getDb();

    const rVenta = await db.execute({
      sql: `INSERT INTO ventas (fecha, total, total_costo, notas, fiado, fecha_cobro, cobrado, cliente, tipo_pago) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [fecha, total, total_costo, notas ?? '', esFiado, fecha_cobro ?? null, esCobrado, cliente ?? '', tipoPagoFinal],
    });
    const ventaId = Number(rVenta.lastInsertRowid);

    for (const item of items) {
      await db.execute({
        sql: `INSERT INTO venta_items (venta_id, producto_id, nombre_producto, cantidad, precio_unitario, costo_unitario)
              VALUES (?, ?, ?, ?, ?, ?)`,
        args: [
          ventaId,
          item.producto_id ?? null,
          item.nombre_producto,
          item.cantidad,
          item.precio_unitario,
          item.costo_unitario,
        ],
      });
    }

    return NextResponse.json({ id: ventaId }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
