import OpenAI from 'openai';
import { config } from '../config/env.js';
import { GameService } from './gameService.js';

export class AIService {
    constructor(
        private gameService: GameService
    ) { }

    private openai = new OpenAI({
        apiKey: config.OPENAI_API_KEY,
    });

    async generateCustomerComment(gameId: string) {
        const comments = await this.gameService.getCustomerComment(gameId);

        const response = await this.openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: '你是一位密室逃脫老手，會看其他玩家的留言' },
                { role: 'user', content: `請幫我根據留言，分析這個主題: \n${comments}的特色、令人讚賞的地方與被嫌棄的地方，分別條列式這些內容，內容請精簡，不要過多的贅述或鋪陳，請根據feedbackPoints(代表其他人贊不贊同這則留言)，與rating(留言者給此主題的評價)，做為加權。另外請給出總分1~5分，需參考留言多寡，去除標準差問題，可以有小數點，總分請以分數/總分表示，希望總分可以放在回覆的開頭以便閱讀` }
            ],
            temperature: 0.7,
        });

        return response.choices[0].message.content;
    }
}
