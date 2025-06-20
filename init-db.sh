#!/bin/bash
set -euo pipefail

# 載入環境變數
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

DB_CONTAINER=escape-db
APP_CONTAINER=escape-bot

# 建立使用者
echo "🔧 檢查使用者 ${DB_USER}..."
if docker exec -u "${POSTGRES_USER}" "$DB_CONTAINER" \
  psql -U "${POSTGRES_USER}" -tAc "SELECT 1 FROM pg_roles WHERE rolname = '${DB_USER}'" | grep -q 1; then
  echo "✅ 使用者已存在"
else
  echo "➕ 建立使用者 ${DB_USER}"
  docker exec -u "${POSTGRES_USER}" "$DB_CONTAINER" \
    psql -U "${POSTGRES_USER}" -c "CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASS}';"
fi

# 建立資料庫
echo "🔧 檢查資料庫 ${DB_NAME}..."
if docker exec -u "${POSTGRES_USER}" "$DB_CONTAINER" \
  psql -U "${POSTGRES_USER}" -tAc "SELECT 1 FROM pg_database WHERE datname = '${DB_NAME}'" | grep -q 1; then
  echo "✅ 資料庫已存在"
else
  echo "➕ 建立資料庫 ${DB_NAME}"
  docker exec -u "${POSTGRES_USER}" "$DB_CONTAINER" \
    psql -U "${POSTGRES_USER}" -c "CREATE DATABASE \"${DB_NAME}\" OWNER ${DB_USER};"
fi

# 執行 Prisma 初始化
echo "🚀 執行 Prisma"
docker exec "$APP_CONTAINER" npx prisma generate
docker exec "$APP_CONTAINER" npx prisma migrate deploy

echo "🎉 初始化完成！"

