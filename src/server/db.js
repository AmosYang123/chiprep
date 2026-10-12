import Database from 'better-sqlite3';

export function openDatabase(filename) {
  const database = new Database(filename);
  database.pragma('foreign_keys = ON');
  database.pragma('journal_mode = WAL');
  database.exec(`
    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      created INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS study_state (
      workspace_id TEXT NOT NULL REFERENCES workspaces(id),
      name TEXT NOT NULL,
      value TEXT NOT NULL,
      PRIMARY KEY (workspace_id, name)
    );
  `);
  return database;
}
