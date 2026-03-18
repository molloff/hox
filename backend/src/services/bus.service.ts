import { EventEmitter } from 'node:events';
import { logger } from '../utils/logger.js';

class HoxEventBus extends EventEmitter {
  emit(event: string, ...args: unknown[]): boolean {
    logger.info({ event, args }, `bus.emit: ${event}`);
    return super.emit(event, ...args);
  }
}

export const bus = new HoxEventBus();

// Register core listeners
bus.on('user_verified', ({ userId }: { userId: string }) => {
  logger.info({ userId }, 'User verified — Vault, Pay, Deal, Connect activated');
});

bus.on('file_archived', ({ userId, fileId }: { userId: string; fileId: string }) => {
  logger.info({ userId, fileId }, 'File archived in Vault — Index +0.5');
});

bus.on('bill_paid', ({ userId, billId }: { userId: string; billId: string }) => {
  logger.info({ userId, billId }, 'Bill paid — Index updated');
});

bus.on('deal_completed', ({ userId, dealId }: { userId: string; dealId: string }) => {
  logger.info({ userId, dealId }, 'Deal completed — Index +15%');
});
