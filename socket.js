const { Server } = require('socket.io');

let io;

function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST", "PATCH", "PUT", "DELETE"]
    }
  });

  io.on('connection', (socket) => {
    console.log('Novo cliente conectado:', socket.id);

    socket.on('join_order', (orderId) => {
      socket.join(`order_${orderId}`);
      console.log(`Cliente ${socket.id} entrou na sala da OS: ${orderId}`);
    });

    socket.on('leave_order', (orderId) => {
      socket.leave(`order_${orderId}`);
      console.log(`Cliente ${socket.id} saiu da sala da OS: ${orderId}`);
    });

    socket.on('disconnect', () => {
      console.log('Cliente desconectado:', socket.id);
    });
  });

  return io;
}

function getIO() {
  if (!io) {
    throw new Error("Socket.io não inicializado!");
  }
  return io;
}

// Funções auxiliares para emitir eventos
const emitNewOrder = (order) => {
  if (io) io.emit('new_order', order);
};

const emitOrderUpdate = (orderId, data) => {
  if (io) io.emit('order_updated', { orderId, ...data });
};

const emitNewComment = (orderId, comment) => {
  if (io) io.to(`order_${orderId}`).emit('new_comment', comment);
};

module.exports = {
  initSocket,
  getIO,
  emitNewOrder,
  emitOrderUpdate,
  emitNewComment
};
