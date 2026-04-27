const bcrypt = require('bcryptjs');
const db = require('./database');

async function initAdmin() {
  const adminEmail = 'adm@sme.com';
  const adminPass = 'poiu0987';
  const hashedPassword = bcrypt.hashSync(adminPass, 10);

  try {
    const existingAdmin = await db.prepare('SELECT * FROM users WHERE email = ?').get(adminEmail);
    if (!existingAdmin) {
      await db.prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)')
        .run('ADM SME', adminEmail, hashedPassword, 'admin');
      console.log('Admin padrão criado: adm@sme.com / poiu0987');
    } else {
      console.log('Admin já existe.');
    }
  } catch (error) {
    console.error('Erro ao inicializar banco:', error);
  }
}

initAdmin();
