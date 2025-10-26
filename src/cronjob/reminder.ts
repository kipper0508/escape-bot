import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { Client } from '@line/bot-sdk';
import { config } from '../config/env.js';
import { EventRepository } from '../repositories/eventRepository.js';
import { EventService } from '../services/eventService.js';
import { GameService } from '../services/gameService.js';
import { NotificationService } from '../services/notificationService.js';
import { CONSTANTS } from '../config/constants.js';
import { logger } from '../utils/logger.js';

function createReminder() {
	logger.info('Reminder starting...');

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

	cron.schedule('0 * * * *', async () => {
		const nowTimeZone = new Date(new Date().getTime() + CONSTANTS.TIME_ZONE * 60 * 60 * 1000);

		logger.info(`Reminder check at ${nowTimeZone}`);

		const events = await eventService.getEventsNeedingReminder();

		for (const event of events) {
			await notificationService.sendEventReminder(event);
			await eventService.markEventAsReminded(event.id);
		}
	});
}

createReminder()
