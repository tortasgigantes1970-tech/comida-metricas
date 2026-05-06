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

const noCache = {
  'Cache-Control':             'no-store, no-cache, must-revalidate, max-age=0',
  'Netlify-CDN-Cache-Control': 'no-store',
  'Vercel-CDN-Cache-Control':  'no-store',
  'CDN-Cache-Control':         'no-store',
  'Surrogate-Control':         'no-store',
  'Pragma':                    'no-cache',
};

export async function GET(req: NextRequest) {
  try {
    const db = await getDb();

    const paramFecha = req.nextUrl.searchParams.get('fecha');
    const ahora      = paramFecha ? new Date(`${paramFecha}T12:00:00`) : new Date();
    const hoy        = paramFecha ?? format(ahora, 'yyyy-MM-dd');
    const inicioSem  = format(startOfWeek(ahora, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const inicioMes  = format(startOfMonth(ahora), 'yyyy-MM-dd');
    const hace30     = format(subDays(ahora, 29), 'yyyy-MM-dd');

    // Ejecutar TODAS las queries en un solo batch 'write' para garantizar
    // que todas lean del servidor primario de Turso (sin réplicas desactualizadas).
    const results = await db.batch([
      // [0] hoy
      { sql: 'SELECT SUM(total), SUM(total_costo) FROM ventas WHERE fecha = ?',
        args: [hoy] },
      // [1] semana
      { sql: 'SELECT SUM(total), SUM(total_costo) FROM ventas WHERE fecha >= ? AND fecha <= ?',
        args: [inicioSem, hoy] },
      // [2] mes
      { sql: 'SELECT SUM(total), SUM(total_costo) FROM ventas WHERE fecha >= ? AND fecha <= ?',
        args: [inicioMes, hoy] },
      // [3] gastos mes
      { sql: 'SELECT SUM(monto) FROM gastos WHERE fecha >= ? AND fecha <= ?',
        args: [inicioMes, hoy] },
      // [4] tendencia 30 días
      { sql: `SELECT fecha, SUM(total), SUM(total_costo)
              FROM ventas
              WHERE fecha >= ? AND fecha <= ?
              GROUP BY fecha ORDER BY fecha ASC`,
        args: [hace30, hoy] },
      // [5] top productos del mes
      { sql: `SELECT vi.nombre_producto,
                     SUM(vi.cantidad)                      AS unidades,
                     SUM(vi.cantidad * vi.precio_unitario) AS revenue,
                     SUM(vi.cantidad * vi.costo_unitario)  AS costo
              FROM venta_items vi
              JOIN ventas v ON v.id = vi.venta_id
              WHERE v.fecha >= ? AND v.fecha <= ?
              GROUP BY vi.nombre_producto
              ORDER BY revenue DESC
              LIMIT 5`,
        args: [inicioMes, hoy] },
      // [6] gastos por categoría del mes
      { sql: `SELECT cg.nombre, SUM(g.monto)
              FROM gastos g
              JOIN categorias_gasto cg ON cg.id = g.categoria_id
              WHERE g.fecha >= ? AND g.fecha <= ?
              GROUP BY cg.nombre
              ORDER BY SUM(g.monto) DESC`,
        args: [inicioMes, hoy] },
    ], 'write');

    const [rHoy, rSem, rMes, rGastos, rTend, rTop, rGastoCat] = results;

    const hoyV    = n(rHoy.rows[0]?.[0]);
    const hoyC    = n(rHoy.rows[0]?.[1]);
    const semV    = n(rSem.rows[0]?.[0]);
    const semC    = n(rSem.rows[0]?.[1]);
    const mesV    = n(rMes.rows[0]?.[0]);
    const mesC    = n(rMes.rows[0]?.[1]);
    const gastosM = n(rGastos.rows[0]?.[0]);
    const mesCalc = cal(mesV, mesC);

    const tendencia = rTend.rows.map(r => ({
      fecha:  String(r[0]),
      ventas: n(r[1]),
      costo:  n(r[2]),
    }));

    const top_productos = rTop.rows.map(r => ({
      nombre_producto: String(r[0]),
      unidades: n(r[1]),
      revenue:  n(r[2]),
      costo:    n(r[3]),
    }));

    const gastos_cat = rGastoCat.rows.map(r => ({
      categoria: String(r[0]),
      total:     n(r[1]),
    }));

    return NextResponse.json(
      {
        server_time: new Date().toISOString(),
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
      { headers: noCache }
    );
  } catch (err) {
    console.error('[dashboard]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
