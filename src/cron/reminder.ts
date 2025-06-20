// src/reminder.ts
import cron from 'node-cron';
import { PrismaClient, UserType } from '@prisma/client';
import { Client, ClientConfig } from '@line/bot-sdk';
import dotenv from 'dotenv';
import { format } from 'date-fns';

dotenv.config();

const prisma = new PrismaClient();

//client 專用 config（accessToken 必填）
const clientConfig: ClientConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN!,
};

const client = new Client(clientConfig);

cron.schedule('0 * * * *', async () => {
  const now = new Date();

  const events = await prisma.event.findMany({
    where: {
      reminded: false,
      createByType: UserType.group,
      eventTime: {
        gt: now,
      },
    },
  });

  for (const event of events) {
    const diffMinutes = (event.eventTime.getTime() - now.getTime()) / 1000 / 60;

    if (diffMinutes <= event.remindBefore) {
      try {
        await client.pushMessage(event.createdById, {
          type: 'text',
          text: `⏰ 活動提醒: 「${event.title}」\n時間：${format(event.eventTime, 'yyyy/M/d HH:mm')}\n${event.description}`,
        });

        await prisma.event.update({
          where: { id: event.id },
          data: { reminded: true },
        });

        console.log(`已提醒群組活動：${event.title}`);
      } catch (err) {
        console.error('提醒訊息發送失敗:', err);
      }
    }
  }
});
