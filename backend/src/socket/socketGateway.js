let io = null;

function initSocketGateway(socketIoInstance) {
  io = socketIoInstance;

  io.on('connection', (socket) => {
    console.log(`🔌 Client connected to Socket.IO [ID: ${socket.id}]`);

    socket.on('join:room', (room) => {
      socket.join(room);
      console.log(`Socket ${socket.id} joined room: ${room}`);
    });

    socket.on('disconnect', () => {
      console.log(`🔌 Client disconnected [ID: ${socket.id}]`);
    });
  });
}

function broadcastQueueUpdate(payload = {}) {
  if (io) {
    io.emit('queue:updated', payload);
    console.log('📡 [SOCKET BROADCAST] queue:updated');
  }
}

function broadcastDoctorStatusChange(payload = {}) {
  if (io) {
    io.emit('doctor:status-changed', payload);
    console.log('📡 [SOCKET BROADCAST] doctor:status-changed');
  }
}

function broadcastEmergencyInserted(payload = {}) {
  if (io) {
    io.emit('queue:emergency', payload);
    console.log('📡 [SOCKET BROADCAST] queue:emergency');
  }
}

function broadcastNotification(payload = {}) {
  if (io) {
    io.emit('notification:new', payload);
  }
}

module.exports = {
  initSocketGateway,
  broadcastQueueUpdate,
  broadcastDoctorStatusChange,
  broadcastEmergencyInserted,
  broadcastNotification
};
