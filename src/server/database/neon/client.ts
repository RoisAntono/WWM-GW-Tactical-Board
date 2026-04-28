import { neon } from '@neondatabase/serverless';
import type { NeonSqlExecutor, NeonSqlRow } from './neonShareSnapshotStore';

export function createNeonSqlExecutor(databaseUrl: string): NeonSqlExecutor {
  const sql = neon(databaseUrl);

  return async <Row extends NeonSqlRow = NeonSqlRow>(query: string, params: readonly unknown[] = []) => {
    const rows = await sql.query(query, [...params]);
    return rows as readonly Row[];
  };
}
