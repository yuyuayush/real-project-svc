import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { env } from './env.js';
import { logger } from './logger.js';
import { Order } from '../types/index.js';

let io: SocketIOServer | null = null;

export function initSocket(httpServer: HTTPServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: [env.CLIENT_URL, 'http://localhost:3000', 'http://127.0.0.1:3000'],
      credentials: true,
      methods: ['GET', 'POST'],
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  io.on('connection', (socket: Socket) => {
    logger.info({ socketId: socket.id }, '⚡ [WebSocket] Client connected to real-time gateway');

    socket.on('disconnect', (reason) => {
      logger.info({ socketId: socket.id, reason }, '🔌 [WebSocket] Client disconnected');
    });

    // Allow clients to join specific order rooms for tracking individual checkout
    socket.on('join:order', (orderId: string) => {
      if (orderId) {
        socket.join(`order:${orderId}`);
        logger.info({ socketId: socket.id, orderId }, '📌 [WebSocket] Subscribed to order stream');
      }
    });
  });

  logger.info('⚡ [WebSocket] Socket.io real-time engine initialized');
  return io;
}

export function getIO(): SocketIOServer {
  if (!io) {
    throw new Error('Socket.io has not been initialized yet. Call initSocket first.');
  }
  return io;
}

/**
 * Broadcast when a customer creates a new order / starts checkout
 */
export function emitOrderCreated(order: Order): void {
  if (!io) return;
  io.emit('order:created', order);
  io.to(`order:${order.id}`).emit('order:status', {
    orderId: order.id,
    status: order.status,
    order,
  });
  logger.info({ orderId: order.id, orderNumber: order.orderNumber }, '📢 [WebSocket Broadcast] order:created');
}

/**
 * Broadcast when an order is updated (e.g. PAID, FAILED, REFUNDED)
 */
export function emitOrderUpdated(order: Order): void {
  if (!io) return;
  io.emit('order:updated', order);
  io.to(`order:${order.id}`).emit('order:status', {
    orderId: order.id,
    status: order.status,
    order,
  });
  logger.info({ orderId: order.id, status: order.status }, '📢 [WebSocket Broadcast] order:updated');
}

/**
 * Broadcast when a payment is confirmed
 */
export function emitPaymentSuccess(payload: {
  orderId: string;
  orderNumber: string;
  amount: number;
  currency: string;
  customer: { name: string; email: string };
  paymentMethod?: string;
}): void {
  if (!io) return;
  io.emit('payment:success', payload);
  io.to(`order:${payload.orderId}`).emit('payment:confirmed', payload);
  logger.info({ orderId: payload.orderId, amount: payload.amount }, '📢 [WebSocket Broadcast] payment:success');
}
