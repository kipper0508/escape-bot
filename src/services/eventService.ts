import { EventRepository } from '../repositories/eventRepository.js';
import { GameService } from './gameService.js';
import { Event, CreateEventData } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { format } from 'date-fns';
import { CONSTANTS } from '../config/constants.js';

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
        choiceNum: string,
        createdById: string,
        createByType: 'user' | 'group'
    ): Promise<string> {
        try {
            const validation = this.validateEventData({ title, location, eventTime });
            if (!validation.isValid) {
                return `❌ ${validation.errors.join(', ')}`;
            }

            const conflicts = await this.eventRepository.findByCreator(createdById, createByType);
            const hasConflict = conflicts.some(event =>
                Math.abs(event.eventTime.getTime() - eventTime.getTime()) < 60 * 60 * 1000
            );
            
            if (hasConflict) {
                return '⚠️ 該時間已有活動';
            }

            const games = await this.gameService.searchGames(title);
            if (games.length === 0) {
                return '❌ 找不到「${title}」相關的密室主題';
            }

            let matchedGames = games;
            if (games.length > 1) {
                if (location && choiceNum) {
                    matchedGames = games.filter((game, idx) =>
                        game.cityId === CONSTANTS.CITY_TO_ID[location] && idx + 1 === Number(choiceNum)
                    );
                }
                else if (location) {
                    matchedGames = games.filter((game) =>
                        game.cityId === CONSTANTS.CITY_TO_ID[location]
                    );
                }
                else if (choiceNum) {
                    matchedGames = games.filter((_, idx) =>
                        idx + 1 === Number(choiceNum)
                    );
                }

                if (matchedGames.length > 1) {
                    const titles = games.map((g, idx) => `${idx + 1}. ${g.title}`).join('\n');
                    return `⚠️ 搜尋「${title}」找到多個相關密室：\n\n${titles}\n\n請使用附加條件搜尋\n小精靈 新增 6/20 16:00 偶像出道 (1)\n`;
                }
            }

            if (matchedGames.length === 0) {
                return '❌ 找不到條件相符的密室主題';
            }

            const game = matchedGames[0];
            const description = await this.gameService.getGameDescription(game.title, game.gameId);
            
            const cityName = game.cityId === '500'
                ? '外島'
                : Object.entries(CONSTANTS.CITY_TO_ID).find(
                    ([, id]) => id === game.cityId
                )?.[0] ?? '未知';

            const eventData: CreateEventData = {
                title: game.title,
                location: cityName,
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
                return '❌ 找不到符合條件的活動';
            }

            if (matchedEvents.length > 1) {
                const titles = matchedEvents.map((event, idx) => `${idx + 1}. ${event.title}`).join('\n');
                return `⚠️ 查詢「${title}」找到多筆活動：\n\n${titles}\n\n請提供更完整的附加條件\n小精靈 查詢 偶像出道 (6/20)\n`;
            }

            const event = matchedEvents[0];

            return `📌 活動資訊\n名稱：${event.title}\n時間：${format(event.eventTime, 'yyyy/M/d HH:mm')}\n${event.description || '（無說明）'}`;
        } catch (error) {
            logger.error('Failed to find event', error as Error);
            return '❌ 找不到符合條件的活動';
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
                return '❌ 找不到符合條件的活動';
            }

            if (matchedEvents.length > 1) {
                const titles = matchedEvents.map((event, idx) => `${idx + 1}. ${event.title}`).join('\n');
                return `⚠️ 查詢「${title}」找到多筆活動：\n\n${titles}\n\n請提供更完整的附加條件\n小精靈 刪除 偶像出道 (6/20)\n`;
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

    async getEventsNeedingReminder(
        nowTime: Date,
    ): Promise<Event[]> {
        const events = await this.eventRepository.findNeedingReminder(nowTime);

        return events.filter(event => {
            const diffMinutes = (event.eventTime.getTime() - nowTime.getTime()) / 1000 / 60;
            return diffMinutes <= event.remindBefore && diffMinutes > 0;
        });
    }

    async markEventAsReminded(eventId: number): Promise<void> {
        await this.eventRepository.markAsReminded(eventId);
    }
}

