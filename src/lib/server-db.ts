import { createDb, type Db } from "./db";
let _db: Db | null = null;
export function db(): Db {
  if (!_db) _db = createDb(process.env.JOBRADAR_DB ?? "data/jobradar.db");
  return _db;
}
