import { fetch } from 'undici';
import { load } from 'cheerio';
import { GameInfo, Review, ReviewApiResponse } from '../types/index.js';
import { CONSTANTS } from '../config/constants.js';
import { logger } from '../utils/logger.js';

export class GameService {
    async searchGames(title: string, location: string): Promise<GameInfo[]> {
        try {
            const url = `${CONSTANTS.ESCAPE_BAR_BASE_URL}/games?outdoor=true&over=true&q=${encodeURIComponent(title)}`;
            const response = await fetch(url, {
                signal: AbortSignal.timeout(CONSTANTS.REQUEST_TIMEOUT_MS)
            });

            if (!response.ok) {
                throw new Error('Fail to fetch data from EscapeBar');
            }

            const html = await response.text();
            const games = this.parseGamesFromHtml(title, html);
            const filteredGames = this.filterGamesByLocation(games, location);

            return filteredGames;

        } catch (error) {
            logger.error('Failed to search games', error as Error, { title, location });
        }
    }

    async getGameDescription(title: string, gameId: string): Promise<string> {
        try {
            const url = `${CONSTANTS.ESCAPE_BAR_BASE_URL}/game/${gameId}`;
            const response = await fetch(url, {
                signal: AbortSignal.timeout(CONSTANTS.REQUEST_TIMEOUT_MS)
            });

            if (!response.ok) {
                throw new Error('Fail to fetch data from EscapeBar');
            }

            const html = await response.text();
            const description = this.parseGameDescription(html, url);

            return description;

        } catch (error) {
            logger.error('Failed to get game description', error as Error, { title, gameId });
            return '無法取得遊戲描述';
        }
    }

    private parseGamesFromHtml(title: string, html: string): GameInfo[] {
        const $ = load(html);
        const games: GameInfo[] = [];

        $('script').each((_, script) => {
            const content = $(script).html();
            if (!content?.includes('self.__next_f.push')) return;

            try {
                const match = content.match(/self\.__next_f\.push\(\[\d+,"(b:.*?)"\]\)/s);
                if (!match) return;

                const encodedStr = match[1];
                const colonIndex = encodedStr.indexOf(':');
                if (colonIndex === -1) return;

                const jsonLike = encodedStr.slice(colonIndex + 1);
                const level1JsonStr = JSON.parse(`"${jsonLike}"`);
                const level1 = JSON.parse(level1JsonStr);
                const gamesList = level1?.[3]?.gamesListData;

                if (Array.isArray(gamesList)) {
                    games.push(...gamesList.map((g: any) => ({
                        title: g.title,
                        cityId: g.cityId,
                        gameId: g.gameId,
                    })));
                }
            } catch (error) {
                logger.warn('Parse Games form HTML failed', title)
            }
        });

        return games;
    }

    private filterGamesByLocation(games: GameInfo[], location: string): GameInfo[] {
        const cityId = CONSTANTS.CITY_TO_ID[location as keyof typeof CONSTANTS.CITY_TO_ID] || null;
        if (!cityId) return [];

        return games.filter(game => game.cityId === cityId);
    }

    private parseGameDescription(html: string, url: string): string {
        const $ = load(html);

        const spans = $("span.text-sm.lg\\:text-base.font-medium").toArray();
        const people = spans[0] ? $(spans[0]).text().trim() : "未知";
        const duration = spans[1] ? $(spans[1]).text().trim() : "未知";

        const addrEl = $("a.text-sm.lg\\:text-base.hover\\:text-secondary").first();
        const address = addrEl.text().trim() || "未知";
        const googleMapLink = addrEl.attr("href") || "";

        const price = $("p.mb-2.pl-4.leading-normal.text-sm.lg\\:text-base.whitespace-pre-wrap")
            .first()
            .text()
            .replace(/\n/g, " ")
            .trim() || "未知";

        const studio = $("h5.chakra-heading.css-o8iskg")
            .first()
            .text()
            .trim() || "未知";

        return `人數：${people}\n遊戲時長：${duration}\n價格: ${price}\n工作室: ${studio}\n主題介紹: ${url}\n地址：${address}\n${googleMapLink}`;
    }

    async getTopicTags(gameId: string) {
        const url = `https://escape.bar/game/${gameId}`;
        const res = await fetch(url);
        if (!res.ok) return [];

        const html = await res.text();
        const $ = load(html);

        const tags_bar = $('div.chakra-stack.css-1rafi8n').first();
        const tags: string[] = [];
        tags_bar.find('b.chakra-text.css-0').each((_, el) => {
            tags.push($(el).text().trim());
        });
        return tags;
    }

    async isScaredTopic(gameId: string) {
        const tags = await this.getTopicTags(gameId);
        return tags.includes('恐怖驚悚');
    }

    async getCustomerComment(gameId: string) {
        const base_url = `https://bartender.escape.bar/review/get-by-game?=&gameId=${gameId}&sort=feedbackPoints`;
        const requestTimes = 3;
        let allResults: Review[] = [];
        let lastUserCustomId = null;

        for (let i = 0; i < requestTimes; i++) {
            let url = base_url;
            if (lastUserCustomId) {
                url += `&lastUserCustomId=${lastUserCustomId}`;
            }
            const res = await fetch(url);
            const data: ReviewApiResponse = await res.json();
            const result = (data.reviewDataList || [])
                .filter(obj => !obj.isSpoiler)
                .map(obj => ({
                    rating: obj.rating,
                    comment: obj.comment,
                    feedbackPoints: obj.feedbackPoints
                }));
            allResults = allResults.concat(result);
            lastUserCustomId = data.lastUserCustomId;
            if (!lastUserCustomId) break;
        }

        return JSON.stringify(allResults, null, 2);
    }
}
