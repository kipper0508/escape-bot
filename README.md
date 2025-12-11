# 🧩 密室逃脫小精靈 (EscapeAngel) LINE Bot

密室逃脫小精靈是一個用於管理密室逃脫活動的 LINE Bot，支援活動新增、查詢、刪除，並會在活動前自動提醒群組成員。整合爬蟲與 Escape.bar 的資訊，自動生成主題資訊與評論摘要。

## ✨ 主要功能

- 📅 **活動管理**: 新增、查詢、刪除密室逃脫活動
- 🔔 **自動提醒**: 活動前自動通知群組成員集合
- 🎮 **主題搜尋**: 整合 Escape.bar 爬蟲，搜尋主題資訊
- 💬 **評論摘要**: 使用 AI 生成主題評論摘要
- 📊 **歷史查詢**: 查詢已結束的活動記錄

## 🏗️ 技術架構

### 專案結構
```
escape-bot/
├── src/
│   ├── app.ts                    # 應用程式進入點
│   ├── config/                   # 配置檔案
│   │   ├── constants.ts          # 常數定義
│   │   ├── env.ts                # 環境變數管理
│   │   └── strings/              # 多語系訊息
│   │       └── zh-tw.ts          # 繁體中文訊息
│   ├── controllers/              # 控制層
│   │   └── webhookController.ts  # LINE Webhook 處理
│   ├── services/                 # 業務邏輯層
│   │   ├── commandService.ts     # 命令解析與處理
│   │   ├── eventService.ts       # 活動管理服務
│   │   ├── gameService.ts        # 主題搜尋與爬蟲
│   │   ├── AIService.ts          # AI 評論摘要
│   │   └── notificationService.ts # LINE 通知服務
│   ├── repositories/             # 資料存取層
│   │   └── eventRepository.ts    # 活動資料庫操作
│   ├── cronjob/                  # 定時任務
│   │   └── reminder.ts           # 活動提醒排程
│   ├── types/                    # TypeScript 型別定義
│   │   └── index.ts
│   └── utils/                    # 工具函式
│       └── logger.ts             # 日誌記錄
├── prisma/                       # Prisma ORM
│   ├── schema.prisma             # 資料庫 Schema
│   └── migrations/               # 資料庫遷移
├── docker-compose.yaml           # Docker Compose 配置
├── Dockerfile                    # Docker 映像檔
└── init-db.sh                    # 資料庫初始化腳本
```

## 🚀 部署指南

### 前置需求

1. **主機環境**
   - Ubuntu 20.04+ 或其他 Linux 發行版
   - 已安裝 Docker 與 Docker Compose
   - 具備公開的 Domain Name
   - 開放 80 與 443 Port

2. **LINE Bot 設定**
   - 在 [LINE Developers](https://developers.line.biz/) 建立 Messaging API Channel
   - 取得 `Channel Access Token` 和 `Channel Secret`

3. **可選服務**
   - OpenAI API Key (用於 AI 評論摘要功能)

### 安裝步驟

#### 1. Clone 專案

```bash
git clone https://github.com/your-username/escape-bot.git
cd escape-bot
```

#### 2. 設定環境變數

```bash
cp .env.example .env
vim .env
```

編輯 `.env` 檔案：

```env
# LINE Bot 設定
LINE_CHANNEL_ACCESS_TOKEN=your_line_channel_access_token
LINE_CHANNEL_SECRET=your_line_channel_secret

# PostgreSQL Root 設定
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_secure_root_password

# 應用程式專用資料庫帳號
DB_USER=escape
DB_PASS=your_secure_db_password
DB_NAME=escape-bot

# Prisma 資料庫連線字串
DATABASE_URL="postgresql://escape:your_secure_db_password@db:5432/escape-bot"

# 選用設定
PORT=3000
NODE_ENV=production
OPENAI_API_KEY=your_openai_api_key  # 選用，用於 AI 評論摘要
```

#### 3. 安裝 Nginx 與設定反向代理

```bash
# 安裝 Nginx
sudo apt update
sudo apt install nginx -y

# 建立 Nginx 設定檔
sudo vim /etc/nginx/sites-available/escape-bot
```

Nginx 設定內容：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

啟用設定：

```bash
# 建立符號連結
sudo ln -s /etc/nginx/sites-available/escape-bot /etc/nginx/sites-enabled/

# 測試設定
sudo nginx -t

# 重新載入 Nginx
sudo systemctl reload nginx
```

#### 4. 安裝 SSL 憑證 (使用 Let's Encrypt)

```bash
# 安裝 Certbot
sudo apt install certbot python3-certbot-nginx -y

# 自動設定 SSL 憑證
sudo certbot --nginx -d your-domain.com

# 測試自動續約
sudo certbot renew --dry-run
```

#### 5. 啟動 Docker 服務

```bash
# Build Docker 映像檔
docker compose build

# 啟動所有服務 (背景執行)
docker compose up -d
```

#### 6. 初始化資料庫

**首次部署時執行**：

```bash
bash init-db.sh
```

此腳本會自動：
- 建立資料庫使用者 (`escape`)
- 建立資料庫 (`escape-bot`)
- 執行 Prisma migrations
- 生成 Prisma Client

#### 7. 設定 LINE Bot Webhook

1. 登入 [LINE Developers Console](https://developers.line.biz/console/)
2. 選擇你的 Messaging API Channel
3. 在 **Messaging API** 設定中：
   - Webhook URL: `https://your-domain.com/webhook`
   - 開啟 **Use webhook**
   - 關閉 **Auto-reply messages** (避免衝突)
4. 點擊 **Verify** 測試 Webhook 連線

## 📝 使用說明

### 命令格式

所有命令都以 `小精靈` 開頭，支援以下功能：

#### 1. 新增活動

```
小精靈 新增 [日期] [時間] [主題名稱] ([地點])
```

**範例**：
```
小精靈 新增 12/25 14:30 神秘莊園 (台北車站)
小精靈 新增 2025/1/15 19:00 末日逃生
```

**說明**：
- 日期格式: `MM/DD` 或 `YYYY/MM/DD`
- 時間格式: `HH:MM` (24小時制)
- 地點為選填，用括號包起來

#### 2. 查詢活動

```
小精靈 查詢所有          # 查詢所有未來活動
小精靈 查詢歷史          # 查詢已結束活動
小精靈 查詢 [主題] ([地點])  # 查詢特定活動
```

**範例**：
```
小精靈 查詢所有
小精靈 查詢歷史
小精靈 查詢 神秘莊園 (台北車站)
```

#### 3. 刪除活動

```
小精靈 刪除 [主題] ([地點])
```

**範例**：
```
小精靈 刪除 神秘莊園
小精靈 刪除 末日逃生 (西門町)
```

#### 4. 搜尋主題

```
小精靈 找主題 [關鍵字] ([地點])
```

**範例**：
```
小精靈 找主題 恐怖
小精靈 找主題 推理 (台北)
```

從 Escape.bar 搜尋主題，並顯示主題列表供選擇。

#### 5. 查看評論

```
小精靈 看評論 [主題] ([選項編號])
```

**範例**：
```
小精靈 看評論 神秘莊園
小精靈 看評論 推理 1
```

使用 AI 生成該主題的評論摘要。

#### 6. 幫助

```
小精靈 幫助
```

顯示所有可用命令說明。

### 自動提醒功能

系統會在活動時間前自動發送提醒：
- **1 天前**: 提醒活動即將到來
- **1 小時前**: 最後提醒集合

## License
MIT License
