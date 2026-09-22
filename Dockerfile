# Тег образу = версія @playwright/test у package.json (браузери вже всередині образу)
FROM mcr.microsoft.com/playwright:v1.63.0-noble

WORKDIR /app
ENV TZ=Europe/Kyiv \
    NODE_ENV=test \
    npm_config_update_notifier=false

# Залежності окремим шаром — перебудовується лише при зміні package*.json
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .

# Аргументи контейнера = аргументи `playwright test` (напр. --grep @smoke)
ENTRYPOINT ["bash", "docker/entrypoint.sh"]
