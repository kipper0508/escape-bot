// src/routes/webhook.ts
import express from 'express';
import dotenv from 'dotenv';
import { middleware, Client, ClientConfig, MiddlewareConfig, WebhookEvent } from '@line/bot-sdk';
import { parseCommand } from '../webhook/commandParser.js';
import { handleCommand } from '../webhook/commandHandler.js';
import { welcomeMessage } from '../strings/zh-tw.js'


dotenv.config();

const router = express.Router();

// middleware 專用 config（channelSecret 必填）
const middlewareConfig: MiddlewareConfig = {
    channelSecret: process.env.LINE_CHANNEL_SECRET!,
};

// client 專用 config（accessToken 必填）
const clientConfig: ClientConfig = {
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN!,
};

const client = new Client(clientConfig);

// 處理 webhook event 的函式
const handleEvent = async (event: WebhookEvent) => {
    if (event.type === 'join') {
        await client.replyMessage(event.replyToken, {
            type: 'text',
            text: welcomeMessage,
        });
        return;
    }
    if (event.type !== 'message' || event.message.type !== 'text') return;

    const messageText = event.message.text.trim();

    if (!messageText.startsWith('小精靈')) {
        return;
    }

    const command = parseCommand(messageText);

    const source = event.source;

    let contextId: string;
    let contextType: 'user' | 'group';

    if ('groupId' in source) {
        contextId = source.groupId;
        contextType = 'group';
    } else if ('userId' in source) {
        contextId = source.userId;
        contextType = 'user';
    } else {
        return;
    }

    if (contextType !== 'group') {
        return;
    }
    const replyText = await handleCommand(command, contextId, contextType);

    await client.replyMessage(event.replyToken, {
        type: 'text',
        text: replyText,
    });
}

// webhook 路由：LINE 會 POST 到這裡
router.post('/', middleware(middlewareConfig), async (req, res) => {
    const events: WebhookEvent[] = req.body.events;

    console.log('✅ 收到 LINE webhook 事件', JSON.stringify(events));

    await Promise.all(events.map(handleEvent))
        .then(() => res.status(200).end())
        .catch((err) => {
            console.error('Webhook 處理錯誤:', err);
            res.status(500).end();
        });;
});

export default router;

