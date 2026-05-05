import { createClient, Client, Row } from '@libsql/client';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(process.cwd(), 'data', 'comida.db');
const SCHEMA_VERSION = 1;

declare global {
  // eslint-disable-next-line no-var
  var __comida_db: { client: Client; version: number } | undefined;
}

export async function getDb(): Promise<Client> {
  if (global.__comida_db && global.__comida_db.version >= SCHEMA_VERSION) {
    return global.__comida_db.client;
  }

  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const client: Client =
    global.__comida_db?.client ?? createClient({ url: `file:${DB_PATH}` });

  await client.execute({ sql: 'PRAGMA journal_mode = WAL', args: [] });
  await client.execute({ sql: 'PRAGMA foreign_keys = ON', args: [] });

  await client.batch([
    // Categorías de productos
    `CREATE TABLE IF NOT EXISTS categorias_producto (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre     TEXT    NOT NULL UNIQUE,
      created_at TEXT    DEFAULT (datetime('now'))
    )`,
    `INSERT OR IGNORE INTO categorias_producto (nombre) VALUES ('Comida')`,
    `INSERT OR IGNORE INTO categorias_producto (nombre) VALUES ('Bebidas')`,
    `INSERT OR IGNORE INTO categorias_producto (nombre) VALUES ('Postres')`,
    `INSERT OR IGNORE INTO categorias_producto (nombre) VALUES ('Otros')`,

    // Catálogo de productos
    `CREATE TABLE IF NOT EXISTS productos (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre           TEXT    NOT NULL,
      descripcion      TEXT    DEFAULT '',
      categoria_id     INTEGER REFERENCES categorias_producto(id),
      precio_venta     REAL    NOT NULL DEFAULT 0,
      costo_produccion REAL    NOT NULL DEFAULT 0,
      activo           INTEGER DEFAULT 1,
      created_at       TEXT    DEFAULT (datetime('now')),
      updated_at       TEXT    DEFAULT (datetime('now'))
    )`,

    // Ventas (cabecera)
    `CREATE TABLE IF NOT EXISTS ventas (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      fecha       TEXT    NOT NULL,
      total       REAL    DEFAULT 0,
      total_costo REAL    DEFAULT 0,
      notas       TEXT    DEFAULT '',
      created_at  TEXT    DEFAULT (datetime('now'))
    )`,

    // Ítems de cada venta
    `CREATE TABLE IF NOT EXISTS venta_items (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      venta_id        INTEGER NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
      producto_id     INTEGER REFERENCES productos(id),
      nombre_producto TEXT    NOT NULL,
      cantidad        INTEGER NOT NULL DEFAULT 1,
      precio_unitario REAL    NOT NULL DEFAULT 0,
      costo_unitario  REAL    NOT NULL DEFAULT 0
    )`,

    // Categorías de gastos operativos
    `CREATE TABLE IF NOT EXISTS categorias_gasto (
      id     INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT    NOT NULL UNIQUE
    )`,
    `INSERT OR IGNORE INTO categorias_gasto (nombre) VALUES ('Renta')`,
    `INSERT OR IGNORE INTO categorias_gasto (nombre) VALUES ('Servicios (luz/agua/gas)')`,
    `INSERT OR IGNORE INTO categorias_gasto (nombre) VALUES ('Insumos/Ingredientes')`,
    `INSERT OR IGNORE INTO categorias_gasto (nombre) VALUES ('Sueldos')`,
    `INSERT OR IGNORE INTO categorias_gasto (nombre) VALUES ('Empaques')`,
    `INSERT OR IGNORE INTO categorias_gasto (nombre) VALUES ('Publicidad')`,
    `INSERT OR IGNORE INTO categorias_gasto (nombre) VALUES ('Otros')`,

    // Gastos operativos
    `CREATE TABLE IF NOT EXISTS gastos (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      fecha        TEXT    NOT NULL,
      categoria_id INTEGER REFERENCES categorias_gasto(id),
      descripcion  TEXT    DEFAULT '',
      monto        REAL    NOT NULL DEFAULT 0,
      created_at   TEXT    DEFAULT (datetime('now'))
    )`,

    // Índices
    `CREATE INDEX IF NOT EXISTS idx_ventas_fecha      ON ventas(fecha)`,
    `CREATE INDEX IF NOT EXISTS idx_venta_items_venta ON venta_items(venta_id)`,
    `CREATE INDEX IF NOT EXISTS idx_gastos_fecha      ON gastos(fecha)`,
  ], 'write');

  global.__comida_db = { client, version: SCHEMA_VERSION };
  return client;
}

export function toObj(row: Row, columns: string[]): Record<string, unknown> {
  return Object.fromEntries(columns.map((col, i) => [col, row[i]]));
}

export function toRows(rows: Row[], columns: string[]): Record<string, unknown>[] {
  return rows.map(row => toObj(row, columns));
}
