// src/routes/webhook.ts
import express from 'express';
import { middleware, Client, ClientConfig, MiddlewareConfig, WebhookEvent } from '@line/bot-sdk';
import dotenv from 'dotenv';
import { parseCommand } from '../webhook/commandParser.js';
import { handleCommand } from '../webhook/commandHandler.js';


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
  if (event.type === 'join' || event.type === 'follow') {
    const welcomeMessage = `🎉 歡迎加入《密室逃脫小精靈》！

我是你們的活動秘書，能幫你們管理密室逃脫的行程，也會在活動前提醒大家準時集合🧩

📌 指令使用方式如下：

🆕 新增活動：
小精靈 新增 6/20 16:00 奪命鎖鏈1 台北

📅 查詢所有未來活動：
小精靈 查詢所有

🔍 查詢特定活動（可省略時間地點）：
小精靈 查詢 奪命鎖鏈1（6/20 16:00 台北）

❌ 刪除特定活動（若有多筆將提示）：
小精靈 刪除 奪命鎖鏈1（6/20 16:00 台北）

📢 群組活動將提醒所有成員，活動前會自動發送通知！

有任何問題請不要私訊小精靈，小精靈已經提前逃脫了🏃`

    await client.replyMessage(event.replyToken, {
      type: 'text',
      text: welcomeMessage,
    });
    return;
  }
  if (event.type !== 'message' || event.message.type !== 'text') return;

  const messageText = event.message.text.trim();

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
  
  if ( contextType !== 'group') {
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

