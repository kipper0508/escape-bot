import { PrismaClient, UserType } from '@prisma/client';
import { ParsedCommand } from './commandParser.js';
import { format } from 'date-fns';
import dotenv from 'dotenv';
import { extractAllGamesList, extractGamesInLoacation, isScaredTopic, generateDescription, getTopicTags } from '../services/searchEscapeBar.js';
import { commandGuide } from '../strings/zh-tw.js'
import { generateCustomerComment } from '../services/openai.js';

dotenv.config();

const prisma = new PrismaClient();

export async function handleCommand(
    command: ParsedCommand,
    contextId: string,
    contextType: 'user' | 'group'
): Promise<string> {
    switch (command.type) {
        case 'add': {
            if (!command.title || !command.time || !command.location) {
                return '❌ 新增活動需要名稱、時間與地點';
            }

            // 檢查是否已有同時間、同建立者的活動
            const conflict = await prisma.event.findFirst({
                where: {
                    eventTime: command.time,
                    createdById: contextId,
                    createByType: contextType as UserType,
                },
            });
            if (conflict) {
                return `⚠️ 該時間已存在活動，請重新選擇時間。`;
            }

            // 建立使用者(若不存在)
            await prisma.user.upsert({
                where: { id: contextId },
                update: {},
                create: { id: contextId, type: contextType as UserType },
            });
            
            // Escape Bar 的遊戲列表
            const games = await extractAllGamesList(command.title);
            const gamesInLocation = await extractGamesInLoacation(games, command.location);
            if (!gamesInLocation || gamesInLocation.length === 0) {
                return '❌ 找不到密室主題';
            } else if (gamesInLocation.length > 1) {
                const sortedGames = gamesInLocation.sort((a, b) => a.title.localeCompare(b.title));
                const titles = sortedGames.map((g, idx) => `${idx + 1}. ${g.title}`).join('\n');
                return `⚠️ 有多個同名密室在「${command.location}」，請確認要新增的主題並重新新增:。\n${titles}`;
            }

            const game = gamesInLocation[0];
            const description = await generateDescription(game.gameId);
            // 新增活動
            const event = await prisma.event.create({
                data: {
                    title: game.title,
                    location: command.location,
                    description: description,
                    eventTime: command.time,
                    createdById: contextId,
                    createByType: contextType as UserType,
                    remindBefore: 60 * 24, // 預設提醒前1天，可調整或由command擴充
                },
            });

            // 新增 UserOnEvent (把建立者加入參加者)
            await prisma.userOnEvent.create({
                data: {
                    userId: contextId,
                    eventId: event.id,
                },
            });
            return `✅ 已新增活動：「${game.title}」\n時間：${format(command.time, 'yyyy/M/d HH:mm')}\n${description ?? '（無說明）'}`;
        }

        case 'queryAll': {
            const now = new Date();
            const events = await prisma.event.findMany({
                where: {
                    eventTime: { gt: now },
                    createdById: contextId,
                    createByType: contextType as UserType,
                },
                orderBy: { eventTime: 'asc' },
            });

            if (events.length === 0) {
                return '📭 尚無即將舉行的活動';
            }

            const list = events
                .map(
                    (e) =>
                        `📌 ${e.title}（${format(e.eventTime, 'M/d HH:mm')} ${e.location}）`
                )
                .join('\n');

            return `📅 未來活動列表：\n\n${list}`;
        }

        case 'queryOne':
        case 'deleteOne': {
            if (!command.title) {
                return '❌ 請提供活動名稱';
            }

            // 建立搜尋條件，時間與地點為選填
            const whereClause: any = {
                title: command.title,
                createdById: contextId,
                createByType: contextType as UserType,
            };

            if (command.time) {
		if(command.specificTime) {	
                    whereClause.eventTime = command.time;
		} else {
	            const day = new Date(command.time);
                    const start = new Date(day.setHours(0, 0, 0, 0));
                    const end = new Date(day.setHours(23, 59, 59, 999));
		    whereClause.eventTime = {
                        gte: start,
                        lte: end,
                    };
		}
            }

            if (command.location) {
                whereClause.location = command.location;
            }

	    console.log(whereClause);

            const matchedEvents = await prisma.event.findMany({
                where: whereClause,
            });

            if (matchedEvents.length === 0) {
                return '❌ 查無符合條件的活動';
            }
            if (matchedEvents.length > 1) {
                return `⚠️ 查詢到多筆活動，請提供更完整時間或地點資訊以縮小範圍`;
            }

            const event = matchedEvents[0];

            if (command.type === 'queryOne') {
                return `📌 活動資訊\n名稱：${event.title}\n時間：${format(event.eventTime, 'yyyy/M/d HH:mm')}\n${event.description || '（無說明）'}`;
            }

            if (command.type === 'deleteOne') {
                // 刪除關聯 UserOnEvent
                await prisma.userOnEvent.deleteMany({
                    where: { eventId: event.id },
                });
                // 刪除活動
                await prisma.event.delete({
                    where: { id: event.id },
                });

                return `🗑️ 已刪除活動：「${event.title}」\n時間：${format(event.eventTime, 'yyyy/M/d HH:mm')}\n地點：${event.location}`;
            }

            return '❓ 未知指令類型';
        }

        case 'search': {
            if (!command.title || !command.location) {
                return '❌ 找主題需要名稱與地點';
            }

            const games = await extractAllGamesList(command.title);
            const gamesInLocation = await extractGamesInLoacation(games, command.location);
            if (!gamesInLocation || gamesInLocation.length === 0) {
                return '❌ 找不到密室主題';
            } else if (gamesInLocation.length > 1) {
                const sortedGames = gamesInLocation.sort((a, b) => a.title.localeCompare(b.title));
                const titles = sortedGames.map((g, idx) => `${idx + 1}. ${g.title}`).join('\n');
                return `⚠️ 有多個同名密室在「${command.location}」，請確認要查詢的主題並重新查詢:。\n${titles}`;
            }

            const game =  gamesInLocation[0];
            const scaredWaring = await isScaredTopic(game.gameId) ? '👻👻 恐怖警告 👻👻\n' : '';
            const description = await generateDescription(game.gameId);
            return `🧭 主題資訊\n${scaredWaring}名稱：${gamesInLocation[0].title}\n${description ?? '（無說明）'}`;
        }

        case 'comment': {
            // Escape Bar 的遊戲列表
            const games = await extractAllGamesList(command.title);
            const gamesInLocation = await extractGamesInLoacation(games, command.location);
            if (!gamesInLocation || gamesInLocation.length === 0) {
                return '❌ 找不到密室主題';
            } else if (gamesInLocation.length > 1) {
                const sortedGames = gamesInLocation.sort((a, b) => a.title.localeCompare(b.title));
                const titles = sortedGames.map((g, idx) => `${idx + 1}. ${g.title}`).join('\n');
                return `⚠️ 有多個同名密室在「${command.location}」，請確認要查詢的主題並重新查詢:。\n${titles}`;
            }

            const game = gamesInLocation[0];
            const tags = await getTopicTags(game.gameId);
            const comment = await generateCustomerComment(game.gameId);

            return `💬 玩家評論\n\n主題標籤：${tags.join(", ")}\n\nAI總結：\n\n${comment}`;
        }

        case 'help': {
            return commandGuide;
        }

        /*case 'donate': {
            return `謝謝你的支持！如果你想贊助小精靈的開發，可以透過以下方式捐款：\n\n銀行帳號：(${process.env.BANK_CODE})-${process.env.BANK_ACCOUNT}\n\n每一分支持都將用於提升小精靈的功能與服務！`;
        }*/


        case 'queryHistory': {
            const now = new Date();
            const events = await prisma.event.findMany({
                where: {
                    eventTime: { lt: now },
                    createdById: contextId,
                    createByType: contextType as UserType,
                },
                orderBy: { eventTime: 'asc' },
            });

            if (events.length === 0) {
                return '👀 尚無參加過的活動';
            }

            const list = events
                .map(
                    (e) =>
                        `📜 ${e.title}（${format(e.eventTime, 'M/d HH:mm')} ${e.location}）`
                )
                .join('\n');

            return `🏛️ 歷史活動列表：\n\n${list}`;
        }

        default:
            return '❌ 指令格式錯誤或不支援';
    }
}

