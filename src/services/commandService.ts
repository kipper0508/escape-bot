// src/services/command.service.ts
import { ParsedCommand } from '../types/index.js';
import { AIService } from '../services/AIService.js'
import { EventService } from '../services/eventService.js';
import { GameService } from './gameService.js';
import { logger } from '../utils/logger.js';
import { format } from 'date-fns';
import { COMMAND_GUIDE } from '../config/strings/zh-tw.js';
import { CONSTANTS } from '../config/constants.js';

export class CommandService {
    constructor(
        private eventService: EventService,
        private gameService: GameService,
        private aiService: AIService,
    ) { }

    private readonly PATTERNS = {
        ADD: /^小精靈\s+新增\s+(\d{1,4}\/\d{1,2}(?:\/\d{1,2})?)\s+(\d{1,2}:\d{2})\s+([^\(]+?)(?:\s+\((.*?)\))?$/,
        QUERY_UPCOMINGS: /^小精靈\s+查詢所有$/,
        QUERY_HISTORY: /^小精靈\s+查詢歷史$/,
        QUERY_UPCOMING: /^小精靈\s+查詢\s+([^\(]+?)(?:\s+\((.*?)\))?$/,
        DELETE: /^小精靈\s+刪除\s+([^\(]+?)(?:\s+\((.*?)\))?$/,
        SEARCH: /^小精靈\s+找主題\s+([^\(]+?)(?:\s+\((.*?)\))?$/,
        COMMENT: /^小精靈\s+看評論\s+([^\(]+?)(?:\s+\((.*?)\))?$/,
        HELP: /^小精靈\s+幫助$/,
    } as const;

    private parseDateTime(raw: string): Date | null {
        const currentYear = new Date().getFullYear();

        // yyyy/MM/dd
        const fullMatch = raw.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})$/);
        if (fullMatch) {
            const [, year, month, day, hour, minute] = fullMatch.map(Number);
            return new Date(year, month - 1, day, hour, minute);
        }

        // MM/dd
        const shortMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})$/);
        if (shortMatch) {
            const [, month, day, hour, minute] = shortMatch.map(Number);
            return new Date(currentYear, month - 1, day, hour, minute);
        }

        return null;
    }

    // parse date, hour and location
    private parseDHL(meta: string): {
        eventTime?: Date;
        eventTimeHour?: boolean;
        location?: string;
    } {
        const parts = meta.trim().split(/\s+/);

        const datePart = parts[0];
        const timePart = parts[1];

        const isDate = /^(\d{4}\/)?\d{1,2}\/\d{1,2}$/.test(datePart);
        const isTime = timePart && /^\d{1,2}:\d{2}$/.test(timePart);

        if (isDate && isTime) {
            const time = this.parseDateTime(`${datePart} ${timePart}`);
            const location = parts.slice(2).join(' ') || undefined;
            return { eventTime: time || undefined, location, eventTimeHour: true };
        }

        if (isDate) {
            const time = this.parseDateTime(`${datePart} 00:00`);
            const location = parts.slice(1).join(' ') || undefined;
            return { eventTime: time || undefined, location, eventTimeHour: false };
        }

        return { location: parts.join(' ') || undefined };
    }

    // parse title, location and choice
    private parseTLC(meta: string): {
        location?: string;
        choiceNum?: string;
    } {
        const parts = meta.trim().split(/\s+/);
        const lastPart = parts[parts.length - 1];
        const isChoiceNum = /^\d+$/.test(lastPart);
        if (isChoiceNum) {
            const choiceNum = lastPart;
            const location = parts.slice(0, -1).join(' ') || undefined;
            return { location, choiceNum };
        }

        return { location: parts.join(' ') || undefined };
    }

    async parseCommand(
        messageText: string
    ): Promise<ParsedCommand> {
        try {
            const text = messageText.replace(/（/g, '(').replace(/）/g, ')').trim();

            let match: RegExpMatchArray | null;

            match = text.match(this.PATTERNS.ADD);
            if (match) {
                const [, date, time, titleRaw, meta] = match;
                const eventTime = this.parseDateTime(`${date} ${time}`);
                const title = titleRaw.trim();

                if (!eventTime) {
                    logger.warn('Failed to parse datetime', { date, time });
                    return { type: 'none' };
                }

                if (meta) {
                    const { location, choiceNum } = this.parseTLC(meta);
                    return {
                        type: 'add',
                        title: title,
                        eventTime: eventTime,
                        location: location,
                        choiceNum: choiceNum,
                    };
                }

                return {
                    type: 'add',
                    title: title.trim(),
                    eventTime: eventTime,
                };
            }

            if (this.PATTERNS.QUERY_UPCOMINGS.test(text)) {
                return { type: 'queryUpcomings' };
            }

            match = text.match(this.PATTERNS.QUERY_UPCOMING);
            if (match) {
                const [, titleRaw, meta] = match;
                const title = titleRaw.trim();

                if (meta) {
                    const { eventTime, eventTimeHour, location } = this.parseDHL(meta);

                    return {
                        type: 'query',
                        title,
                        eventTime,
                        eventTimeHour,
                        location,
                    };
                }

                return {
                    type: 'query',
                    title,
                };
            }

            if (this.PATTERNS.QUERY_HISTORY.test(text)) {
                return { type: 'queryHistory' };
            }

            match = text.match(this.PATTERNS.DELETE);
            if (match) {
                const [, titleRaw, meta] = match;
                const title = titleRaw.trim();

                if (meta) {
                    const { eventTime, eventTimeHour, location } = this.parseDHL(meta);
                    return {
                        type: 'delete',
                        title,
                        eventTime,
                        eventTimeHour,
                        location,
                    };
                }

                return {
                    type: 'delete',
                    title,
                };
            }

            match = text.match(this.PATTERNS.SEARCH);
            if (match) {
                const [, titleRaw, meta] = match;
                const title = titleRaw.trim();

                if (meta) {
                    const { location, choiceNum } = this.parseTLC(meta);
                    return {
                        type: 'search',
                        title: title,
                        location: location,
                        choiceNum: choiceNum,
                    };
                }

                return {
                    type: 'search',
                    title: title.trim(),
                };
            }

            match = text.match(this.PATTERNS.COMMENT);
            if (match) {
                const [, titleRaw, meta] = match;
                const title = titleRaw.trim();

                if (meta) {
                    const { location, choiceNum } = this.parseTLC(meta);
                    return {
                        type: 'comment',
                        title: title,
                        location: location,
                        choiceNum: choiceNum,
                    };
                }

                return {
                    type: 'comment',
                    title: title.trim(),
                };
            }

            if (this.PATTERNS.HELP.test(text)) {
                return { type: 'help' };
            }

            logger.info('Unknown command', { text });
            return { type: 'none' };

        } catch (error) {
            logger.error('Failed to parse command', error as Error, { messageText });
            return { type: 'none' };
        }
    }

    private async handleAddCommand(
        command: ParsedCommand,
        contextId: string,
        contextType: 'user' | 'group'
    ): Promise<string> {
        if (!command.title || !command.eventTime) {
            return '❌ 新增活動需要名稱、時間\n\n範例：\n小精靈 新增 6/20 16:00 偶像出道';
        }

        const result = await this.eventService.createEvent(
            command.title,
            command.location,
            command.eventTime,
            command.choiceNum,
            contextId,
            contextType
        );

        return result;
    }

    private async handleQueryUpcomingsCommand(
        contextId: string,
        contextType: 'user' | 'group'
    ): Promise<string> {
        const upcomingEvents = await this.eventService.getUpcomingEvents(contextId, contextType);

        if (upcomingEvents.length === 0) {
            return '📭 尚無即將舉行的活動';
        }

        const eventList = upcomingEvents
            .map(
                (e) =>
                    `📌 ${e.title}（${format(e.eventTime, 'M/d HH:mm')} ${e.location}）`
            )
            .join('\n');

        return `📅 未來活動列表：\n\n${eventList}`;
    }

    private async handleQueryCommand(
        command: ParsedCommand,
        contextId: string,
        contextType: 'user' | 'group'
    ): Promise<string> {
        if (!command.title) {
            return '❌ 請提供活動名稱\n\n範例：\n小精靈 查詢 偶像出道 (6/20 16:00 台北)';
        }

        const result = await this.eventService.getEvent(
            command.title,
            contextId,
            contextType,
            command.eventTime,
            command.eventTimeHour,
            command.location
        );

        return result;
    }

    private async handleQueryHistoryCommand(
        contextId: string,
        contextType: 'user' | 'group'
    ): Promise<string> {
        const historyEvents = await this.eventService.getHistoryEvents(contextId, contextType);


        if (historyEvents.length === 0) {
            return '👀 尚無參加過的活動';
        }

        const eventList = historyEvents
            .map(
                (e) =>
                    `📜 ${e.title}（${format(e.eventTime, 'M/d HH:mm')} ${e.location}）`
            )
            .join('\n');

        return `🏛️ 歷史活動列表：\n\n${eventList}`;
    }

    private async handleDeleteCommand(
        command: ParsedCommand,
        contextId: string,
        contextType: 'user' | 'group'
    ): Promise<string> {
        if (!command.title) {
            return '❌ 請提供活動名稱\n\n範例：\n小精靈 刪除 偶像出道 (6/20 16:00 台北)';
        }

        const result = await this.eventService.deleteEvent(
            command.title,
            contextId,
            contextType,
            command.eventTime,
            command.eventTimeHour,
            command.location
        );

        return result;
    }

    private async handleSearchCommand(command: ParsedCommand): Promise<string> {
        if (!command.title) {
            return '❌ 找主題需要名稱\n\n範例：\n小精靈 找主題 偶像出道';
        }

        try {
            const games = await this.gameService.searchGames(command.title);

            if (games.length === 0) {
                return `❌ 找不到「${command.title}」相關的密室主題`;
            }

            let matchedGames = games;
            if (games.length > 1) {
                if (command.location && command.choiceNum) {
                    matchedGames = games.filter((game, idx) =>
                        game.cityId === CONSTANTS.CITY_TO_ID[command.location] && idx + 1 === Number(command.choiceNum)
                    );
                }
                else if (command.location) {
                    matchedGames = games.filter((game) =>
                        game.cityId === CONSTANTS.CITY_TO_ID[command.location]
                    );
                }
                else if (command.choiceNum) {
                    matchedGames = games.filter((_, idx) =>
                        idx + 1 === Number(command.choiceNum)
                    );
                }

                if (matchedGames.length > 1) {
                    const titles = games.map((g, idx) => `${idx + 1}. ${g.title}`).join('\n');
                    return `⚠️ 搜尋「${command.title}」找到多個相關密室：\n\n${titles}\n\n請使用附加條件搜尋\n小精靈 找主題 偶像出道 (台北 1)\n`;
                }
            }

            if (matchedGames.length === 0) {
                return '❌ 找無條件相符的遊戲資訊';
            }

            const game = matchedGames[0];
            const scaredWaring = await this.gameService.isScaredTopic(game.gameId) ? '👻👻 恐怖警告 👻👻\n' : '';
            const description = await this.gameService.getGameDescription(game.title, game.gameId);

            return `🧭 主題資訊\n${scaredWaring}名稱：${game.title}\n${description ?? '（無說明）'}`;
        } catch (error) {
            logger.error('Game search failed', error as Error);
            return '❌ 搜尋遊戲資訊失敗，請稍後再試';
        }
    }

    private async handleCommentCommand(command: ParsedCommand): Promise<string> {
        if (!command.title) {
            return '❌ 看評論需要遊戲名稱\n\n範例：\n小精靈 看評論 偶像出道';
        }

        try {
            const games = await this.gameService.searchGames(command.title);

            if (games.length === 0) {
                return '❌ 找不到「${command.title}」相關的密室主題';
            } 
            
            let matchedGames = games;
            if (games.length > 1) {
                if (command.location && command.choiceNum) {
                    matchedGames = games.filter((game, idx) =>
                        game.cityId === CONSTANTS.CITY_TO_ID[command.location] && idx + 1 === Number(command.choiceNum)
                    );
                }
                else if (command.location) {
                    matchedGames = games.filter((game) =>
                        game.cityId === CONSTANTS.CITY_TO_ID[command.location]
                    );
                }
                else if (command.choiceNum) {
                    matchedGames = games.filter((_, idx) =>
                        idx + 1 === Number(command.choiceNum)
                    );
                }

                if (matchedGames.length > 1) {
                    const titles = games.map((g, idx) => `${idx + 1}. ${g.title}`).join('\n');
                    return `⚠️ 搜尋「${command.title}」找到多個相關密室：\n\n${titles}\n\n請使用附加條件搜尋\n小精靈 看評論 偶像出道 (台北 1)\n`;
                }
            }

            if (matchedGames.length === 0) {
                return '❌ 找無條件相符的遊戲資訊';
            }

            const game = matchedGames[0];
            const tags = await this.gameService.getTopicTags(game.gameId);
            const comment = await this.aiService.generateCustomerComment(game.gameId);

            return `💬 玩家評論\n\n主題標籤：${tags.join(", ")}\n\nAI總結：\n\n${comment}`;
        } catch (error) {
            logger.error('AI comment failed', error as Error);
            return '❌ 整理Comment失敗，請稍後再試';
        }
    }

    async handleCommand(
        command: ParsedCommand,
        contextId: string,
        contextType: 'user' | 'group'
    ): Promise<string> {
        try {
            switch (command.type) {
                case 'add':
                    return await this.handleAddCommand(command, contextId, contextType);
                case 'queryUpcomings':
                    return await this.handleQueryUpcomingsCommand(contextId, contextType);
                case 'query':
                    return await this.handleQueryCommand(command, contextId, contextType);
                case 'queryHistory':
                    return await this.handleQueryHistoryCommand(contextId, contextType);
                case 'delete':
                    return await this.handleDeleteCommand(command, contextId, contextType);
                case 'search':
                    return await this.handleSearchCommand(command);
                case 'comment':
                    return await this.handleCommentCommand(command);
                case 'help':
                    return COMMAND_GUIDE;
                default:
                    return '❌ 指令格式錯誤或不支援';
            }
        } catch (error) {
            logger.error('Command handling failed', error as Error);
            return '❌ 系統錯誤，請稍後再試';
        }
    }
}

