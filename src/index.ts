// src/index.ts
import express from 'express';
import webhookRouter from './routes/webhook.js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use('/webhook', express.raw({ type: 'application/json' }));
app.use('/webhook', webhookRouter);

app.get('/', (_req, res) => {
    res.send('密室逃脫小精靈啟動中！');
});

app.listen(port, () => {
    console.log(`🚀 伺服器啟動於 http://localhost:${port}`);
});

