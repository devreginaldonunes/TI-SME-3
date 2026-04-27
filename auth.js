const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./database');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'seduc_ti_secret_key_123';

// Middleware para verificar token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ message: 'Acesso negado' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Token inválido' });
    req.user = user;
    next();
  });
};

// Middleware para verificar se é admin
const isAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Acesso restrito a administradores' });
  }
  next();
};

// Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  
  try {
    const user = await db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ message: 'E-mail ou senha incorretos' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    });
  } catch (error) {
    res.status(500).json({ message: 'Erro no servidor', error: error.message });
  }
});

// Criar usuário (Apenas Admin)
router.post('/users', authenticateToken, isAdmin, async (req, res) => {
  const { name, email, password, role, phone } = req.body;
  
  if (!email || !email.includes('@')) {
    return res.status(400).json({ message: 'E-mail inválido' });
  }
  
  const hashedPassword = bcrypt.hashSync(password, 10);

  try {
    const info = await db.prepare('INSERT INTO users (name, email, password, role, phone) VALUES (?, ?, ?, ?, ?)')
      .run(name, email, hashedPassword, role, phone);
    res.status(201).json({ id: info.lastInsertRowid, message: 'Usuário criado com sucesso' });
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ message: 'E-mail já cadastrado' });
    }
    console.error('Erro ao criar usuário:', error);
    res.status(500).json({ message: 'Erro ao criar usuário', error: error.message });
  }
});

// Listar usuários (Apenas Admin)
router.get('/users', authenticateToken, isAdmin, async (req, res) => {
  try {
    const users = await db.prepare('SELECT id, name, email, role, phone, created_at FROM users').all();
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar usuários' });
  }
});

// Excluir usuário (Apenas Admin)
router.delete('/users/:id', authenticateToken, isAdmin, async (req, res) => {
  const targetId = parseInt(req.params.id);
  if (targetId === req.user.id) {
    return res.status(400).json({ message: 'Você não pode excluir sua própria conta de administrador.' });
  }
  
  try {
    await db.prepare('DELETE FROM users WHERE id = ?').run(targetId);
    res.json({ message: 'Usuário excluído com sucesso' });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao excluir usuário' });
  }
});

// Editar usuário (Apenas Admin)
router.put('/users/:id', authenticateToken, isAdmin, async (req, res) => {
  const { name, email, role, password, phone } = req.body;
  const targetId = parseInt(req.params.id);
  
  let finalRole = role;
  if (targetId === req.user.id && role !== 'admin') {
    finalRole = 'admin'; 
  }

  try {
    if (password) {
      const hashedPassword = bcrypt.hashSync(password, 10);
      await db.prepare('UPDATE users SET name = ?, email = ?, role = ?, password = ?, phone = ? WHERE id = ?')
        .run(name, email, finalRole, hashedPassword, phone, targetId);
    } else {
      await db.prepare('UPDATE users SET name = ?, email = ?, role = ?, phone = ? WHERE id = ?')
        .run(name, email, finalRole, phone, targetId);
    }
    res.json({ message: 'Usuário atualizado com sucesso' });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao atualizar usuário' });
  }
});

module.exports = { router, authenticateToken, isAdmin };
