import { Pool, PoolClient, QueryResult, QueryResultRow } from "pg";

// ---------------------------------------------------------------------------
// Single pg.Pool shared across all vault API routes
// Same DATABASE_URL as Prisma — vault uses raw SQL for its own tables
// ---------------------------------------------------------------------------

const globalForVaultDb = globalThis as unknown as { _vaultPool: Pool | null };

function getPool(): Pool {
  if (!globalForVaultDb._vaultPool) {
    globalForVaultDb._vaultPool = new Pool({
      connectionString: process.env.DATABASE_URL!,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });

    globalForVaultDb._vaultPool.on("error", (err) => {
      console.error("[vault-db] Pool error:", err.message);
    });
  }
  return globalForVaultDb._vaultPool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  return getPool().query<T>(sql, params);
}

export async function queryRows<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params?: unknown[]
): Promise<T[]> {
  const result = await getPool().query<T>(sql, params);
  return result.rows;
}

export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params?: unknown[]
): Promise<T | null> {
  const result = await getPool().query<T>(sql, params);
  return result.rows[0] ?? null;
}

export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
