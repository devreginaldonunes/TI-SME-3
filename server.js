require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const http = require('http');
const { initSocket } = require('./socket');
const db = require('./database');
const { startBackupService } = require('./backup-service');
const { router: authRouter } = require('./auth');
const ordersRouter = require('./orders');

// Inicializar admin padrão se não existir
require('./init-db');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// Inicializar Socket.io
initSocket(server);

// Inicializar Serviço de Backup
startBackupService();

app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// Servir arquivos estáticos do frontend
app.use(express.static(path.join(__dirname, 'public')));

// Rotas da API
app.use('/api/auth', authRouter);
app.use('/api/orders', ordersRouter);

// Rota de saúde
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'T.I SYSTEM SME está rodando' });
});

// Rota raiz serve o index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Middleware de tratamento de erros global
app.use((err, req, res, next) => {
  console.error(`[${new Date().toISOString()}] Error:`, err.stack);
  const status = err.status || 500;
  res.status(status).json({
    message: err.message || 'Ocorreu um erro interno no servidor',
    error: process.env.NODE_ENV === 'development' ? err.stack : {}
  });
});

server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
