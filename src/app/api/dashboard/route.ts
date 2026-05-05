import { NextResponse } from 'next/server';
import { getDb, toRows } from '@/lib/db';
import { format, startOfWeek, startOfMonth, subDays } from 'date-fns';

export async function GET() {
  try {
    const db = await getDb();
    const hoy = format(new Date(), 'yyyy-MM-dd');
    const inicioSemana = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const inicioMes = format(startOfMonth(new Date()), 'yyyy-MM-dd');
    const hace30 = format(subDays(new Date(), 29), 'yyyy-MM-dd');

    // Ventas por período
    const [rHoy, rSemana, rMes] = await Promise.all([
      db.execute({
        sql: `SELECT COALESCE(SUM(total),0) as ventas, COALESCE(SUM(total_costo),0) as costo
              FROM ventas WHERE fecha = ?`,
        args: [hoy],
      }),
      db.execute({
        sql: `SELECT COALESCE(SUM(total),0) as ventas, COALESCE(SUM(total_costo),0) as costo
              FROM ventas WHERE fecha >= ?`,
        args: [inicioSemana],
      }),
      db.execute({
        sql: `SELECT COALESCE(SUM(total),0) as ventas, COALESCE(SUM(total_costo),0) as costo
              FROM ventas WHERE fecha >= ?`,
        args: [inicioMes],
      }),
    ]);

    // Gastos del mes
    const rGastosMes = await db.execute({
      sql: `SELECT COALESCE(SUM(monto),0) as total FROM gastos WHERE fecha >= ?`,
      args: [inicioMes],
    });

    // Tendencia últimos 30 días
    const rTendencia = await db.execute({
      sql: `SELECT fecha,
                   COALESCE(SUM(total),0)       as ventas,
                   COALESCE(SUM(total_costo),0) as costo
            FROM ventas
            WHERE fecha >= ?
            GROUP BY fecha
            ORDER BY fecha ASC`,
      args: [hace30],
    });

    // Top 5 productos del mes
    const rTop = await db.execute({
      sql: `SELECT vi.nombre_producto,
                   SUM(vi.cantidad)                             as unidades,
                   SUM(vi.cantidad * vi.precio_unitario)        as revenue,
                   SUM(vi.cantidad * vi.costo_unitario)         as costo
            FROM venta_items vi
            JOIN ventas v ON v.id = vi.venta_id
            WHERE v.fecha >= ?
            GROUP BY vi.nombre_producto
            ORDER BY revenue DESC
            LIMIT 5`,
      args: [inicioMes],
    });

    // Gastos del mes por categoría
    const rGastosCat = await db.execute({
      sql: `SELECT cg.nombre as categoria, COALESCE(SUM(g.monto),0) as total
            FROM gastos g
            JOIN categorias_gasto cg ON cg.id = g.categoria_id
            WHERE g.fecha >= ?
            GROUP BY cg.nombre
            ORDER BY total DESC`,
      args: [inicioMes],
    });

    const hoyData   = toRows(rHoy.rows, rHoy.columns as string[])[0] ?? { ventas: 0, costo: 0 };
    const semData   = toRows(rSemana.rows, rSemana.columns as string[])[0] ?? { ventas: 0, costo: 0 };
    const mesData   = toRows(rMes.rows, rMes.columns as string[])[0] ?? { ventas: 0, costo: 0 };
    const gastosMes = Number(toRows(rGastosMes.rows, rGastosMes.columns as string[])[0]?.total ?? 0);

    const cal = (d: Record<string, unknown>) => ({
      ventas:   Number(d.ventas ?? 0),
      costo:    Number(d.costo  ?? 0),
      ganancia: Number(d.ventas ?? 0) - Number(d.costo ?? 0),
      margen:   Number(d.ventas ?? 0) > 0
        ? Math.round(((Number(d.ventas ?? 0) - Number(d.costo ?? 0)) / Number(d.ventas ?? 0)) * 100)
        : 0,
    });

    const mesCalc = cal(mesData);

    return NextResponse.json({
      hoy:     cal(hoyData),
      semana:  cal(semData),
      mes: {
        ...mesCalc,
        gastos:         gastosMes,
        ganancia_neta:  mesCalc.ganancia - gastosMes,
        margen_neto:    mesCalc.ventas > 0
          ? Math.round(((mesCalc.ganancia - gastosMes) / mesCalc.ventas) * 100)
          : 0,
      },
      tendencia:    toRows(rTendencia.rows, rTendencia.columns as string[]),
      top_productos: toRows(rTop.rows, rTop.columns as string[]),
      gastos_cat:   toRows(rGastosCat.rows, rGastosCat.columns as string[]),
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
