const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// No Railway, usaremos um Volume montado em /data
// Se não estiver no Railway, usa o diretório local
const dbDir = process.env.DB_PATH ? path.dirname(process.env.DB_PATH) : __dirname;
const dbName = process.env.DB_NAME || 'database.sqlite';
const dbPath = process.env.DB_PATH || path.join(__dirname, dbName);

// Garantir que o diretório do banco de dados existe
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

console.log(`Conectando ao banco de dados em: ${dbPath}`);

const db = new sqlite3.Database(dbPath);

// Configurações
db.serialize(() => {
  db.run("PRAGMA foreign_keys = ON");
  db.run("PRAGMA journal_mode = WAL");
});

// Interface compatível com o que precisamos (async)
const database = {
  dbPath: dbPath, // Exportar o caminho para uso no backup
  exec: (sql) => {
    return new Promise((resolve, reject) => {
      db.exec(sql, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  },
  prepare: (sql) => {
    return {
      run: (...params) => {
        return new Promise((resolve, reject) => {
          db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve({ lastInsertRowid: this.lastID, changes: this.changes });
          });
        });
      },
      get: (...params) => {
        return new Promise((resolve, reject) => {
          db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
          });
        });
      },
      all: (...params) => {
        return new Promise((resolve, reject) => {
          db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          });
        });
      }
    };
  }
};

// Inicialização das tabelas
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT CHECK(role IN ('admin', 'tecnico', 'user')) NOT NULL,
      phone TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS service_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT CHECK(status IN ('pendente', 'em_atendimento', 'concluido', 'nao_resolvido', 'cancelado')) DEFAULT 'pendente',
      priority TEXT CHECK(priority IN ('baixa', 'media', 'alta', 'urgente')) DEFAULT 'media',
      user_id INTEGER NOT NULL,
      tecnico_id INTEGER,
      location TEXT NOT NULL,
      category TEXT DEFAULT 'suporte',
      attachment_url TEXT,
      solution_description TEXT,
      failure_reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (tecnico_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      comment TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES service_orders(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS os_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES service_orders(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_orders_user ON service_orders(user_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_orders_status ON service_orders(status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_comments_order ON comments(order_id)`);
});

module.exports = database;
