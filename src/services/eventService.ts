import { EventRepository } from '../repositories/eventRepository.js';
import { GameService } from './gameService.js';
import { Event, CreateEventData } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { format } from 'date-fns';

export class EventService {
    constructor(
        private eventRepository: EventRepository,
        private gameService: GameService
    ) { }

    private validateEventData(data: any): {
        isValid: boolean;
        errors: string[];
    } {
        const errors: string[] = [];

        if (!data.title?.trim()) {
            errors.push('活動名稱不能為空');
        }

        if (!data.location?.trim()) {
            errors.push('地點不能為空');
        }

        if (!data.eventTime || !(data.eventTime instanceof Date)) {
            errors.push('活動時間格式錯誤');
        } else if (data.eventTime <= new Date()) {
            errors.push('活動時間必須是未來時間');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    async createEvent(
        title: string,
        location: string,
        eventTime: Date,
        createdById: string,
        createByType: 'user' | 'group'
    ): Promise<string> {
        try {
            const validation = this.validateEventData({ title, location, eventTime });
            if (!validation.isValid) {
                return `❌ ${validation.errors.join(', ')}`;
            }

            const games = await this.gameService.searchGames(title, location);
            if (games.length === 0) {
                return '❌ 找不到密室主題';
            }

            if (games.length > 1) {
                const gameList = games.map((g, idx) => `${idx + 1}. ${g.title}`).join('\n');
                return `⚠️ 有多個同名密室在「${location}」:\n${gameList}`;
            }

            const conflicts = await this.eventRepository.findByCreator(createdById, createByType);
            const hasConflict = conflicts.some(event =>
                Math.abs(event.eventTime.getTime() - eventTime.getTime()) < 60 * 60 * 1000
            );

            if (hasConflict) {
                return '⚠️ 該時間已有活動';
            }

            const game = games[0];
            const description = await this.gameService.getGameDescription(game.title, game.gameId);

            const eventData: CreateEventData = {
                title: game.title,
                location,
                eventTime,
                createdById,
                createByType,
                description
            };

            const event = await this.eventRepository.create(eventData);

            logger.info('Event created successfully', { eventId: event.id, title: game.title });

            return `✅ 已新增活動：「${game.title}」\n時間：${format(event.eventTime, 'yyyy/M/d HH:mm')}\n${description ?? '（無說明）'}`;

        } catch (error) {
            logger.error('Failed to create event', error as Error);
            return '❌ 系統錯誤，請稍後再試';
        }
    }

    async getUpcomingEvents(createdById: string, createByType: 'user' | 'group'): Promise<Event[]> {
        return await this.eventRepository.findUpcomings(createdById, createByType);
    }

    async getEvent(
        title: string,
        createdById: string,
        createByType: 'user' | 'group',
        eventTime?: Date,
        eventTimeHour?: boolean,
        location?: string
    ): Promise<string> {
        try {
            const matchedEvents = await this.eventRepository.findMatching(
                createdById,
                createByType,
                title,
                eventTime,
                eventTimeHour,
                location
            );

            if (matchedEvents.length === 0) {
                return '❌ 查無符合條件的活動';
            }

            if (matchedEvents.length > 1) {
                const titles = matchedEvents.map((event, idx) => `${idx + 1}. ${event.title}`).join('\n');
                return `⚠️ 查詢到多筆活動，請提供更完整的時間或地點資訊\n${titles}`;
            }

            const event = matchedEvents[0];

            return `📌 活動資訊\n名稱：${event.title}\n時間：${format(event.eventTime, 'yyyy/M/d HH:mm')}\n${event.description || '（無說明）'}`;
        } catch (error) {
            logger.error('Failed to find event', error as Error);
            return '❌ 查無符合條件的活動';
        }
    }

    async getHistoryEvents(createdById: string, createByType: 'user' | 'group'): Promise<Event[]> {
        return await this.eventRepository.findHistory(createdById, createByType);
    }

    async deleteEvent(
        title: string,
        createdById: string,
        createByType: 'user' | 'group',
        eventTime?: Date,
        eventTimeHour?: boolean,
        location?: string
    ): Promise<string> {
        try {
            const matchedEvents = await this.eventRepository.findMatching(
                createdById,
                createByType,
                title,
                eventTime,
                eventTimeHour,
                location
            );

            if (matchedEvents.length === 0) {
                return '❌ 查無符合條件的活動';
            }

            if (matchedEvents.length > 1) {
                const titles = matchedEvents.map((event, idx) => `${idx + 1}. ${event.title}`).join('\n');
                return `⚠️ 查詢到多筆活動，請提供更完整的時間或地點資訊\n${titles}`;
            }

            const event = matchedEvents[0];
            await this.eventRepository.delete(event.id);

            logger.info('Event deleted successfully', { eventId: event.id, title });

            return `🗑️ 已刪除活動：「${event.title}」`;

        } catch (error) {
            logger.error('Failed to delete event', error as Error);
            return '❌ 刪除活動失敗';
        }
    }

    async getEventsNeedingReminder(): Promise<Event[]> {
        const events = await this.eventRepository.findNeedingReminder();
        const now = new Date();

        return events.filter(event => {
            const diffMinutes = (event.eventTime.getTime() - now.getTime()) / 1000 / 60;
            return diffMinutes <= event.remindBefore && diffMinutes > 0;
        });
    }

    async markEventAsReminded(eventId: number): Promise<void> {
        await this.eventRepository.markAsReminded(eventId);
    }
}
