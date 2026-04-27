const express = require('express');
const db = require('./database');
const { authenticateToken } = require('./auth');
const { emitNewOrder, emitOrderUpdate, emitNewComment } = require('./socket');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pdfService = require('./pdf-service');

const router = express.Router();

// Configuração do Multer para upload de arquivos
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, 'public', 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Limite de 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Apenas imagens são permitidas (jpeg, jpg, png, gif)'));
  }
});

// Helper para registrar logs
async function logAction(orderId, userId, action, details) {
  try {
    await db.prepare('INSERT INTO os_logs (order_id, user_id, action, details) VALUES (?, ?, ?, ?)')
      .run(orderId, userId, action, details);
  } catch (e) {
    console.error('Erro ao registrar log:', e);
  }
}

// Dashboard Stats
router.get('/stats', authenticateToken, async (req, res) => {
    try {
        let stats;
        let dailyStats;
        
        if (req.user.role === 'admin' || req.user.role === 'tecnico') {
            stats = await db.prepare(`
                SELECT 
                    COUNT(*) as total,
                    COALESCE(SUM(CASE WHEN status = 'pendente' THEN 1 ELSE 0 END), 0) as pendentes,
                    COALESCE(SUM(CASE WHEN status = 'em_atendimento' THEN 1 ELSE 0 END), 0) as em_atendimento,
                    COALESCE(SUM(CASE WHEN status = 'concluido' THEN 1 ELSE 0 END), 0) as concluidas,
                    COALESCE(SUM(CASE WHEN status = 'nao_resolvido' THEN 1 ELSE 0 END), 0) as nao_resolvidas,
                    COALESCE(SUM(CASE WHEN status = 'cancelado' THEN 1 ELSE 0 END), 0) as canceladas
                FROM service_orders
            `).get();

            dailyStats = await db.prepare(`
                SELECT 
                    strftime('%Y-%m-%d', created_at, 'localtime') as date,
                    COUNT(*) as count
                FROM service_orders
                WHERE created_at >= datetime('now', '-7 days')
                GROUP BY date
                ORDER BY date ASC
            `).all();
        } else {
            stats = await db.prepare(`
                SELECT 
                    COUNT(*) as total,
                    COALESCE(SUM(CASE WHEN status = 'pendente' THEN 1 ELSE 0 END), 0) as pendentes,
                    COALESCE(SUM(CASE WHEN status = 'em_atendimento' THEN 1 ELSE 0 END), 0) as em_atendimento,
                    COALESCE(SUM(CASE WHEN status = 'concluido' THEN 1 ELSE 0 END), 0) as concluidas,
                    COALESCE(SUM(CASE WHEN status = 'nao_resolvido' THEN 1 ELSE 0 END), 0) as nao_resolvidas,
                    COALESCE(SUM(CASE WHEN status = 'cancelado' THEN 1 ELSE 0 END), 0) as canceladas
                FROM service_orders
                WHERE user_id = ?
            `).get(req.user.id);

            dailyStats = await db.prepare(`
                SELECT 
                    strftime('%Y-%m-%d', created_at, 'localtime') as date,
                    COUNT(*) as count
                FROM service_orders
                WHERE user_id = ? AND created_at >= datetime('now', '-7 days')
                GROUP BY date
                ORDER BY date ASC
            `).all(req.user.id);
        }
        res.json({ ...stats, daily: dailyStats });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro ao buscar estatísticas' });
    }
});

// Criar nova OS com suporte a upload de arquivo
router.post('/', authenticateToken, upload.single('attachment'), async (req, res) => {
  const { title, description, priority, location, category } = req.body;
  const userId = req.user.id;
  
  let attachment_url = null;
  if (req.file) {
    attachment_url = `/uploads/${req.file.filename}`;
  }

  if (!title || !description || !priority || !location) {
    return res.status(400).json({ message: 'Todos os campos são obrigatórios' });
  }

  try {
    const info = await db.prepare(`
      INSERT INTO service_orders (title, description, priority, location, category, attachment_url, user_id) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(title, description, priority, location, category || 'suporte', attachment_url, userId);
    
    const orderId = info.lastInsertRowid;
    await logAction(orderId, userId, 'Criação', 'Ordem de serviço aberta');
    
    // Buscar a OS completa para emitir via socket
    const newOrder = await db.prepare(`
      SELECT so.*, u.name as requester_name 
      FROM service_orders so
      JOIN users u ON so.user_id = u.id
      WHERE so.id = ?
    `).get(orderId);

    emitNewOrder(newOrder);
    
    res.status(201).json({ id: orderId, message: 'Ordem de serviço aberta com sucesso' });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao abrir OS', error: error.message });
  }
});

// Listar OS
router.get('/', authenticateToken, async (req, res) => {
  const { role, id } = req.user;
  const { status, priority, search } = req.query;
  
  try {
    let query = `
      SELECT so.*, u.name as requester_name, t.name as tecnico_name 
      FROM service_orders so
      JOIN users u ON so.user_id = u.id
      LEFT JOIN users t ON so.tecnico_id = t.id
      WHERE 1=1
    `;
    const params = [];

    if (role !== 'admin' && role !== 'tecnico') {
      query += ' AND so.user_id = ?';
      params.push(id);
    }

    if (status) {
      query += ' AND so.status = ?';
      params.push(status);
    }

    if (priority) {
      query += ' AND so.priority = ?';
      params.push(priority);
    }

    if (search) {
      query += ' AND (so.title LIKE ? OR so.description LIKE ? OR so.location LIKE ?)';
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam);
    }

    query += ' ORDER BY so.created_at DESC';
    
    const orders = await db.prepare(query).all(...params);
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar OS', error: error.message });
  }
});

// Gerar PDF de uma OS
router.get('/:id/pdf', authenticateToken, async (req, res) => {
  const orderId = req.params.id;
  const { role, id: userId } = req.user;

  try {
    const order = await db.prepare(`
      SELECT so.*, u.name as requester_name, t.name as tecnico_name 
      FROM service_orders so
      JOIN users u ON so.user_id = u.id
      LEFT JOIN users t ON so.tecnico_id = t.id
      WHERE so.id = ?
    `).get(orderId);

    if (!order) return res.status(404).json({ message: 'OS não encontrada' });

    if (role !== 'admin' && role !== 'tecnico' && order.user_id !== userId) {
      return res.status(403).json({ message: 'Acesso negado' });
    }

    const pdfBuffer = await pdfService.generateOSPDF(order);
    
    res.contentType("application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=OS_${orderId}.pdf`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Erro ao gerar PDF:', error);
    res.status(500).json({ message: 'Erro ao gerar PDF da OS', error: error.message });
  }
});

// Obter detalhes de uma OS
router.get('/:id', authenticateToken, async (req, res) => {
  const orderId = req.params.id;
  const { role, id: userId } = req.user;

  try {
    const order = await db.prepare(`
      SELECT so.*, u.name as requester_name, t.name as tecnico_name 
      FROM service_orders so
      JOIN users u ON so.user_id = u.id
      LEFT JOIN users t ON so.tecnico_id = t.id
      WHERE so.id = ?
    `).get(orderId);

    if (!order) return res.status(404).json({ message: 'OS não encontrada' });

    if (role !== 'admin' && role !== 'tecnico' && order.user_id !== userId) {
      return res.status(403).json({ message: 'Acesso negado' });
    }

    const comments = await db.prepare(`
      SELECT c.*, u.name as user_name 
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.order_id = ?
      ORDER BY c.created_at ASC
    `).all(orderId);

    const logs = await db.prepare(`
      SELECT l.*, u.name as user_name 
      FROM os_logs l
      JOIN users u ON l.user_id = u.id
      WHERE l.order_id = ?
      ORDER BY l.created_at DESC
    `).all(orderId);

    res.json({ ...order, comments, logs });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar detalhes da OS' });
  }
});

// Atualizar status da OS
router.patch('/:id/status', authenticateToken, async (req, res) => {
  const { status, solution_description, failure_reason } = req.body;
  const orderId = req.params.id;
  const userId = req.user.id;

  if (req.user.role !== 'admin' && req.user.role !== 'tecnico') {
    return res.status(403).json({ message: 'Ação não permitida' });
  }

  // Validação de campos obrigatórios
  if (status === 'concluido' && !solution_description) {
    return res.status(400).json({ message: 'Descrição da solução é obrigatória para concluir a O.S.' });
  }

  if (status === 'nao_resolvido' && !failure_reason) {
    return res.status(400).json({ message: 'Motivo da falha é obrigatório para marcar como não resolvido.' });
  }

  if (status === 'cancelado' && req.user.role === 'tecnico') {
    return res.status(403).json({ message: 'Técnicos não têm permissão para cancelar Ordens de Serviço.' });
  }

  try {
    const oldOrder = await db.prepare('SELECT status FROM service_orders WHERE id = ?').get(orderId);
    if (!oldOrder) return res.status(404).json({ message: 'OS não encontrada' });

    if (oldOrder.status === 'cancelado' || oldOrder.status === 'concluido' || oldOrder.status === 'nao_resolvido') {
      return res.status(400).json({ message: 'Esta Ordem de Serviço já foi finalizada e não pode mais ser alterada.' });
    }

    await db.prepare('UPDATE service_orders SET status = ?, tecnico_id = ?, solution_description = ?, failure_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(status, userId, solution_description || null, failure_reason || null, orderId);
    
    const actionDetails = status === 'concluido' ? `Concluído - ${solution_description}` : 
                         status === 'nao_resolvido' ? `Não Resolvido - ${failure_reason}` :
                         `Alterado de ${oldOrder.status} para ${status}`;
    await logAction(orderId, userId, 'Status', actionDetails);
    
    // Notificar atualização
    emitOrderUpdate(orderId, { status, userId });
    
    res.json({ message: 'Status atualizado com sucesso' });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao atualizar status' });
  }
});

// Atribuir técnico à OS (Apenas Admin)
router.patch('/:id/assign', authenticateToken, async (req, res) => {
  const { tecnico_id } = req.body;
  const orderId = req.params.id;
  const adminId = req.user.id;

  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Apenas administradores podem atribuir técnicos.' });
  }

  if (!tecnico_id) {
    return res.status(400).json({ message: 'ID do técnico é obrigatório.' });
  }

  try {
    const tecnico = await db.prepare('SELECT name FROM users WHERE id = ? AND role = ?').get(tecnico_id, 'tecnico');
    if (!tecnico) {
      return res.status(404).json({ message: 'Técnico não encontrado ou usuário não possui perfil de técnico.' });
    }

    const order = await db.prepare('SELECT status FROM service_orders WHERE id = ?').get(orderId);
    if (!order) return res.status(404).json({ message: 'OS não encontrada' });

    if (order.status === 'cancelado' || order.status === 'concluido') {
      return res.status(400).json({ message: 'Não é possível atribuir técnico a uma Ordem de Serviço finalizada.' });
    }

    // Atualizar técnico e mudar status para 'em_atendimento' se estiver 'pendente'
    let newStatus = order.status;
    if (order.status === 'pendente') {
      newStatus = 'em_atendimento';
    }

    await db.prepare('UPDATE service_orders SET tecnico_id = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(tecnico_id, newStatus, orderId);
    
    await logAction(orderId, adminId, 'Atribuição', `Técnico ${tecnico.name} atribuído à O.S.`);
    
    // Notificar atualização
    emitOrderUpdate(orderId, { tecnico_id, status: newStatus, tecnico_name: tecnico.name });
    
    res.json({ message: `Técnico ${tecnico.name} atribuído com sucesso`, tecnico_name: tecnico.name });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erro ao atribuir técnico' });
  }
});

// Adicionar comentário
router.post('/:id/comments', authenticateToken, async (req, res) => {
  const { comment } = req.body;
  const orderId = req.params.id;
  const userId = req.user.id;

  if (!comment) return res.status(400).json({ message: 'Comentário não pode ser vazio' });

  try {
    const order = await db.prepare('SELECT status FROM service_orders WHERE id = ?').get(orderId);
    if (order && (order.status === 'cancelado' || order.status === 'concluido')) {
      return res.status(400).json({ message: 'Não é possível adicionar comentários em uma Ordem de Serviço finalizada.' });
    }

    const info = await db.prepare('INSERT INTO comments (order_id, user_id, comment) VALUES (?, ?, ?)')
      .run(orderId, userId, comment);
    
    await logAction(orderId, userId, 'Comentário', 'Novo comentário adicionado');
    
    // Buscar comentário completo para emitir
    const newComment = await db.prepare(`
      SELECT c.*, u.name as user_name 
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.id = ?
    `).get(info.lastInsertRowid);

    emitNewComment(orderId, newComment);
    
    res.status(201).json({ message: 'Comentário adicionado' });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao adicionar comentário' });
  }
});

module.exports = router;
