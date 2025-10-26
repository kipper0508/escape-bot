import express from 'express';
import { middleware } from '@line/bot-sdk';
import { PrismaClient } from '@prisma/client';
import { Client } from '@line/bot-sdk';
import { config } from './config/env.js';
import { WebhookController } from './controllers/webhookController.js';
import { EventRepository } from './repositories/eventRepository.js';
import { CommandService } from './services/commandService.js';
import { EventService } from './services/eventService.js';
import { GameService } from './services/gameService.js';
import { NotificationService } from './services/notificationService.js';
import { logger } from './utils/logger.js';
import { AIService } from './services/AIService.js';

function createApp() {
    const app = express();

    const prisma = new PrismaClient({
        log: config.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });

    const lineClient = new Client({
        channelAccessToken: config.LINE_CHANNEL_ACCESS_TOKEN,
    });

    const eventRepository = new EventRepository(prisma);
    const gameService = new GameService();
    const notificationService = new NotificationService(lineClient);
    const eventService = new EventService(eventRepository, gameService);
    const aiService = new AIService(gameService);
    const commandSerive = new CommandService(eventService, gameService, aiService);

    const webhookController = new WebhookController(
        commandSerive,
        notificationService,
    );

    app.use('/webhook', express.raw({ type: 'application/json' }));

    app.use('/webhook', middleware({
        channelSecret: config.LINE_CHANNEL_SECRET,
    }));

    app.post('/webhook', (req, res) => {
        webhookController.handleWebhook(req, res);
    });

    app.get('/health', async (req, res) => {
        try {
            await prisma.$queryRaw`SELECT 1`;

            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                version: '2.0.0',
                environment: config.NODE_ENV,
            });
        } catch (error) {
            logger.error('Health check failed', error as Error);
            res.status(503).json({
                status: 'unhealthy',
                timestamp: new Date().toISOString(),
            });
        }
    });

    app.get('/', (req, res) => {
        res.json({
            message: '🧩 密室逃脫小精靈 API',
            version: '2.0.0',
            status: 'running',
            endpoints: {
                webhook: 'POST /webhook',
                health: 'GET /health',
            }
        });
    });

    return app;
}

const app = createApp();
app.listen(config.PORT || 3000, () => {
    console.log(`Server running on port ${config.PORT || 3000}`);
});
