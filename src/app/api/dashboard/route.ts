import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { format, startOfWeek, startOfMonth, subDays } from 'date-fns';

export const dynamic = 'force-dynamic';

const n = (v: unknown) => Number(v ?? 0);

const cal = (ventas: number, costo: number) => ({
  ventas,
  costo,
  ganancia: ventas - costo,
  margen: ventas > 0 ? Math.round(((ventas - costo) / ventas) * 100) : 0,
});

export async function GET(req: NextRequest) {
  try {
    const db = await getDb();

    const paramFecha = req.nextUrl.searchParams.get('fecha');
    const ahora      = paramFecha ? new Date(`${paramFecha}T12:00:00`) : new Date();
    const hoy        = paramFecha ?? format(ahora, 'yyyy-MM-dd');
    const inicioSem  = format(startOfWeek(ahora, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const inicioMes  = format(startOfMonth(ahora), 'yyyy-MM-dd');
    const hace30     = format(subDays(ahora, 29), 'yyyy-MM-dd');

    // ── Ventas por período (secuencial para evitar problemas de concurrencia con Turso) ──
    const qHoy = await db.execute({
      sql:  'SELECT SUM(total), SUM(total_costo) FROM ventas WHERE fecha = ?',
      args: [hoy],
    });
    const qSem = await db.execute({
      sql:  'SELECT SUM(total), SUM(total_costo) FROM ventas WHERE fecha >= ?',
      args: [inicioSem],
    });
    const qMes = await db.execute({
      sql:  'SELECT SUM(total), SUM(total_costo) FROM ventas WHERE fecha >= ? AND fecha <= ?',
      args: [inicioMes, hoy],
    });

    // ── Gastos del mes ──
    const qGastos = await db.execute({
      sql:  'SELECT SUM(monto) FROM gastos WHERE fecha >= ? AND fecha <= ?',
      args: [inicioMes, hoy],
    });

    // ── Tendencia 30 días ──
    const qTend = await db.execute({
      sql:  'SELECT fecha, SUM(total), SUM(total_costo) FROM ventas WHERE fecha >= ? AND fecha <= ? GROUP BY fecha ORDER BY fecha ASC',
      args: [hace30, hoy],
    });

    // ── Top 5 productos del mes ──
    const qTop = await db.execute({
      sql: `SELECT vi.nombre_producto,
                   SUM(vi.cantidad)                        AS unidades,
                   SUM(vi.cantidad * vi.precio_unitario)   AS revenue,
                   SUM(vi.cantidad * vi.costo_unitario)    AS costo
            FROM venta_items vi
            JOIN ventas v ON v.id = vi.venta_id
            WHERE v.fecha >= ? AND v.fecha <= ?
            GROUP BY vi.nombre_producto
            ORDER BY revenue DESC
            LIMIT 5`,
      args: [inicioMes, hoy],
    });

    // ── Gastos por categoría ──
    const qGastoCat = await db.execute({
      sql: `SELECT cg.nombre, SUM(g.monto)
            FROM gastos g
            JOIN categorias_gasto cg ON cg.id = g.categoria_id
            WHERE g.fecha >= ? AND g.fecha <= ?
            GROUP BY cg.nombre
            ORDER BY SUM(g.monto) DESC`,
      args: [inicioMes, hoy],
    });

    // ── Leer valores por índice (evita problemas con nombres de columna en Turso) ──
    const hoyV   = n(qHoy.rows[0]?.[0]);
    const hoyC   = n(qHoy.rows[0]?.[1]);
    const semV   = n(qSem.rows[0]?.[0]);
    const semC   = n(qSem.rows[0]?.[1]);
    const mesV   = n(qMes.rows[0]?.[0]);
    const mesC   = n(qMes.rows[0]?.[1]);
    const gastosM = n(qGastos.rows[0]?.[0]);

    const mesCalc = cal(mesV, mesC);

    const tendencia = qTend.rows.map(r => ({
      fecha:  String(r[0]),
      ventas: n(r[1]),
      costo:  n(r[2]),
    }));

    const top_productos = qTop.rows.map(r => ({
      nombre_producto: String(r[0]),
      unidades: n(r[1]),
      revenue:  n(r[2]),
      costo:    n(r[3]),
    }));

    const gastos_cat = qGastoCat.rows.map(r => ({
      categoria: String(r[0]),
      total:     n(r[1]),
    }));

    return NextResponse.json(
      {
        hoy:    cal(hoyV, hoyC),
        semana: cal(semV, semC),
        mes: {
          ...mesCalc,
          gastos:        gastosM,
          ganancia_neta: mesCalc.ganancia - gastosM,
          margen_neto:   mesCalc.ventas > 0
            ? Math.round(((mesCalc.ganancia - gastosM) / mesCalc.ventas) * 100)
            : 0,
        },
        tendencia,
        top_productos,
        gastos_cat,
      },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  } catch (err) {
    console.error('[dashboard]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
