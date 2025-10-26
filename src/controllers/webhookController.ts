import { Request, Response } from 'express';
import { WebhookEvent, MessageEvent } from '@line/bot-sdk';
import { CommandService } from '../services/commandService.js';
import { NotificationService } from '../services/notificationService.js';
import { logger } from '../utils/logger.js';
import { WELCOME_MESSAGE, COMMAND_GUIDE } from '../config/strings/zh-tw.js';

export class WebhookController {
    constructor(
        private commandSerive: CommandService,
        private notificationService: NotificationService
    ) { }

    async handleWebhook(req: Request, res: Response): Promise<void> {
        try {
            const events: WebhookEvent[] = req.body.events;

            if (!events || events.length === 0) {
                res.status(200).end();
                return;
            }

            await Promise.all(events.map(event => this.handleEvent(event)));

            res.status(200).end();
        } catch (error) {
            logger.error('Webhook handling failed', error as Error);
            res.status(500).end();
        }
    }

    private async handleEvent(event: WebhookEvent): Promise<void> {
        try {
            if (event.type === 'join') {
                await this.notificationService.replyMessage(
                    event.replyToken,
                    `${WELCOME_MESSAGE}`
                );
                return;
            }

            if (event.type === 'message' && event.message.type === 'text') {
                await this.handleMessageEvent(event);
                return;
            }

        } catch (error) {
            logger.error('Event handling failed', error as Error);
        }
    }

    private async handleMessageEvent(event: MessageEvent): Promise<void> {
        const messageText = event.message.type === 'text' ? event.message.text.trim() : '';
        logger.info(messageText);
        if (!messageText.startsWith('小精靈')) {
            return;
        }

        const { contextId, contextType } = this.extractContext(event);

        if (!contextId || !contextType) {
            return;
        }

        if (contextType !== 'group') {
            logger.warn('Only support group Message now!')
            return;
        }

        const command = await this.commandSerive.parseCommand(messageText);
        logger.info('Command received', {
            command: command.type,
            contextId,
            raw: messageText
        });

        const response = await this.commandSerive.handleCommand(command, contextId, contextType);
        await this.notificationService.replyMessage(event.replyToken, response);
    }

    private extractContext(event: MessageEvent): {
        contextId: string | null;
        contextType: 'user' | 'group' | null;
    } {
        const source = event.source;

        if ('groupId' in source && source.groupId) {
            return { contextId: source.groupId, contextType: 'group' };
        }

        if ('userId' in source && source.userId) {
            return { contextId: source.userId, contextType: 'user' };
        }

        return { contextId: null, contextType: null };
    }
}
