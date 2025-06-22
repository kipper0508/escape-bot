# 🧩 密室逃脫小精靈 LINE Bot

密室逃脫小精靈 是一個用於管理密室逃脫活動的 LINE Bot。支援新增、查詢、刪除活動，並會在活動前自動提醒群組成員集合。整合爬蟲與Escape.bar的資訊，自動生成主題資訊。

# 專案結構
```
src/
├── cron/              # 定時提醒任務
├── routes/            # Route Handle
├── services/          # 處理爬蟲服務
├── strings/           # 定義訊息內容
├── test/              # 簡易測試
└── webhook/           # 處理 LINE webhook 事件
```

# 主機設置
1. 須具備 domain
2. 設置 nginx
    * 建立設定檔 /etc/nginx/sites-available/escape-bot
    ```
    server {
        listen 80;
        server_name your-domain.com;

        location / {
            proxy_pass http://localhost:3000; # 你的 Node.js 服務 port
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
        }
    }
    ```
    * 啟用設定
    ```
    sudo ln -s /etc/nginx/sites-available/escape-bot /etc/nginx/sites-enabled/
    sudo nginx -t
    sudo systemctl reload nginx
    ```
3. certbot 簽署
```
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```
4. 在 LINE Bot 後台設定 Webhook URL

# 部屬流程
1. clone 專案
```
git clone https://github.com/your-user/escape-bot.git
cd escape-bot
```
2. 建立 .env 環境變數檔
```
cp .env.example .env
vim .env
===
# LINE Bot 設定
LINE_CHANNEL_ACCESS_TOKEN=your_line_channel_access_token
LINE_CHANNEL_SECRET=your_line_channel_secret

# 資料庫 - PostgreSQL root 設定
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres_root_password

# 資料庫 - App 專用帳號
DB_USER=escape
DB_PASS=escape_user_password
DB_NAME=escape-bot

# Prisma 資料庫連線字串（供應用程式使用）
DATABASE_URL=postgresql://escape:escape_user_password@db:5432/escape-bot
===
```
3. 確保有安裝 Docker 與 Docker Compose
```
docker -v
docker compose version
```
4. 啟動所有服務
```
docker compose up --build -d
```
5. 第一次啟用(請初始化DB)
```
bash scripts/init-db.sh
```
