import { Client } from '@line/bot-sdk';
import { Event } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { format } from 'date-fns';

export class NotificationService {
    constructor(private lineClient: Client) { }

    async sendEventReminder(event: Event): Promise<void> {
        try {
            const message = `⏰ 活動提醒: 「${event.title}」\n時間：${format(event.eventTime, 'yyyy/M/d HH:mm')}\n${event.description}`;

            await this.lineClient.pushMessage(event.createdById, {
                type: 'text',
                text: message,
            });

            logger.info('Event reminder sent successfully', { eventId: event.id });
        } catch (error) {
            logger.error('Failed to send event reminder', error as Error, { eventId: event.id });
            throw error;
        }
    }

    async replyMessage(replyToken: string, message: string): Promise<void> {
        try {
            await this.lineClient.replyMessage(replyToken, {
                type: 'text',
                text: message,
            });
        } catch (error) {
            logger.error('Failed to reply message', error as Error);
            throw error;
        }
    }
}