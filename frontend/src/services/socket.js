import { io } from 'socket.io-client';

const socket = io(window.location.origin, {
  autoConnect: true,
  reconnection: true
});

export default socket;
