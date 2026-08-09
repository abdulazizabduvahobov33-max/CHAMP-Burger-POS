# Sharof KFS POS — развёртывание и эксплуатация

Документация по запуску проекта в продакшене: установка на VPS, домен, SSL, резервное
копирование БД, обновления, филиалы, администраторы, PWA на телефоне.

Два способа запуска описаны параллельно везде, где они отличаются:
- **Вариант A — Docker (рекомендуется).** Одна команда поднимает frontend, backend и
  PostgreSQL. Используются `docker-compose.yml`, `server/Dockerfile`, `client/Dockerfile`.
- **Вариант B — без Docker (PM2/systemd).** Backend запускается напрямую через Node.js,
  frontend раздаётся как статика через nginx. Используются файлы из `deploy/`.

Если не уверены, что выбрать — используйте **Вариант A**: меньше шагов, меньше способов
что-то настроить неправильно, вся связка (версии Node, Postgres, зависимости) зафиксирована
в образах и не зависит от того, что установлено на самом VPS.

---

## 1. Как установить проект на VPS

### Требования к серверу
Минимум: 1 vCPU, 2 ГБ RAM, 20 ГБ диска, Ubuntu 22.04/24.04 (или любой Linux с Docker).
Для комфортной работы нескольких касс одновременно — 2 vCPU, 4 ГБ RAM.

### Вариант A: Docker

```bash
# 1. Установить Docker + Docker Compose (официальный скрипт Docker)
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
# перелогиньтесь (exit и зайдите по SSH заново), чтобы группа применилась

# 2. Склонировать проект на сервер
git clone <адрес-вашего-репозитория> champ-pos
cd champ-pos

# 3. Настроить переменные окружения
cp .env.example .env
cp server/.env.example server/.env
nano .env             # задать POSTGRES_PASSWORD (реальный, не placeholder)
nano server/.env      # задать JWT_ACCESS_SECRET / JWT_REFRESH_SECRET (openssl rand -base64 48),
                       # CLIENT_URL (ваш будущий домен, см. раздел 2),
                       # SEED_ADMIN_PASSWORD (реальный пароль первого администратора)

# 4. Собрать и запустить всё одной командой
docker compose up -d --build

# 5. Проверить, что всё поднялось
docker compose ps
curl http://localhost:8080          # frontend
curl http://localhost:8080/api/health   # backend через прокси frontend'а

# 6. Засеять первого администратора и демо-данные (один раз)
docker compose exec backend npx tsx prisma/seed.ts
```

На этом этапе приложение уже работает по адресу `http://<IP-сервера>:8080`. Дальше —
разделы 2–3 (домен + HTTPS), чтобы открывать его по обычному `https://` без порта.

### Вариант B: без Docker (PM2)

```bash
# 1. Node.js 20, PostgreSQL 16, nginx, PM2
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt install -y nodejs postgresql nginx
sudo npm install -g pm2

# 2. Создать БД и пользователя
sudo -u postgres psql -c "CREATE USER champ WITH PASSWORD 'ваш-пароль';"
sudo -u postgres psql -c "CREATE DATABASE champ_pos OWNER champ;"

# 3. Склонировать и собрать
sudo mkdir -p /opt/champ-pos && sudo chown $USER /opt/champ-pos
git clone <адрес-репозитория> /opt/champ-pos
cd /opt/champ-pos

cd server
cp .env.example .env
nano .env   # DATABASE_URL с реальным паролем, JWT-секреты, CLIENT_URL, SEED_ADMIN_PASSWORD
npm ci
npx prisma migrate deploy
npx tsx prisma/seed.ts
npm run build

cd ../client
cp .env.example .env
npm ci
npm run build          # результат в client/dist — именно эту папку раздаёт nginx

# 4. Запустить backend через PM2
cd ../server
pm2 start ../deploy/ecosystem.config.cjs
pm2 save
pm2 startup            # выполнить команду, которую PM2 напечатает — это и есть
                        # "автозапуск после перезагрузки" (см. раздел ЭТАП 3 в задаче)
```

Альтернатива PM2 — systemd (`deploy/champ-pos-backend.service`), см. комментарии в файле;
делать оба варианта одновременно не нужно, выберите один.

Далее настройте nginx, чтобы раздавать `client/dist` и проксировать `/api` и `/uploads` на
`localhost:4000` — за основу возьмите `client/nginx.conf` (тот же конфиг, что использует
Docker-вариант внутри контейнера, работает и на голом nginx один в один, только замените
`proxy_pass http://backend:4000/...` на `proxy_pass http://127.0.0.1:4000/...`).

---

## 2. Как сменить домен

1. В DNS вашего домена добавьте A-запись, указывающую на IP сервера.
2. В `server/.env` замените `CLIENT_URL` на новый домен (с `https://`, без слэша на конце):
   ```
   CLIENT_URL="https://champpos.example.com"
   ```
   Можно указать сразу несколько (через запятую) — например apex и `www`:
   ```
   CLIENT_URL="https://champpos.example.com,https://www.champpos.example.com"
   ```
3. В `deploy/nginx-host.conf` замените `server_name champpos.example.com;` на ваш домен.
4. Примените:
   ```bash
   docker compose restart backend        # подхватить новый CLIENT_URL
   sudo cp deploy/nginx-host.conf /etc/nginx/sites-available/champ-pos
   sudo nginx -t && sudo systemctl reload nginx
   ```
5. Выпустите SSL для нового домена — см. раздел 3.

Менять домен НЕ требует пересборки Docker-образов — только перезапуска `backend` (переменная
окружения) и nginx (конфиг).

---

## 3. Как подключить SSL (Let's Encrypt)

```bash
# 1. Установить certbot
sudo apt install -y certbot python3-certbot-nginx

# 2. Установить nginx-конфиг (пока без HTTPS-блока — certbot допишет его сам)
sudo cp deploy/nginx-host.conf /etc/nginx/sites-available/champ-pos
sudo ln -s /etc/nginx/sites-available/champ-pos /etc/nginx/sites-enabled/
sudo mkdir -p /var/www/certbot
sudo nginx -t && sudo systemctl reload nginx

# 3. Выпустить сертификат — certbot сам найдёт server_name в конфиге и допишет HTTPS-блок
sudo certbot --nginx -d champpos.example.com

# 4. Автопродление уже настроено пакетом certbot (systemd timer). Проверить:
sudo systemctl status certbot.timer
sudo certbot renew --dry-run   # тестовый прогон продления, ничего не меняет
```

Сертификаты Let's Encrypt живут 90 дней и продлеваются автоматически заранее — вручную
ничего делать не нужно, если `certbot.timer` активен (шаг 4 это подтверждает).

---

## 4. Как сделать резервную копию базы

```bash
./scripts/backup-db.sh
```

Создаёт `backups/champ_pos_<дата-время>.sql.gz` и автоматически удаляет копии старше 14 дней
(настраивается через `BACKUP_RETENTION_DAYS` в `.env`).

**Автоматически, каждую ночь** — добавьте в `crontab -e`:
```
0 3 * * *  cd /opt/champ-pos && ./scripts/backup-db.sh >> /var/log/champ-pos/backup.log 2>&1
```

Рекомендуется также копировать содержимое папки `backups/` на отдельное хранилище (S3,
другой сервер, Google Drive и т.п.) — резервная копия, лежащая на том же диске, что и сама
база, не спасает при аппаратном отказе сервера.

---

## 5. Как восстановить базу

```bash
./scripts/restore-db.sh backups/champ_pos_20260709_030000.sql.gz
```

Скрипт покажет, какую базу вы перезаписываете, и попросит подтверждение (`YES`). После
восстановления backend перезапускается автоматически, чтобы сбросить пул соединений.

⚠️ Операция необратима — текущие данные в базе будут заменены содержимым бэкапа. Если
сомневаетесь, сначала сделайте свежий бэкап текущего состояния (раздел 4).

---

## 6. Как обновлять проект

### Вариант A: Docker
```bash
cd /opt/champ-pos   # или где склонирован репозиторий
git pull

# рекомендуется сделать бэкап перед обновлением, особенно если были изменения схемы БД
./scripts/backup-db.sh

docker compose up -d --build
```
Миграции применяются автоматически при каждом старте контейнера `backend`
(`docker-entrypoint.sh` запускает `prisma migrate deploy` перед стартом сервера) — отдельно
их прогонять не нужно.

### Вариант B: PM2
```bash
cd /opt/champ-pos
git pull
./scripts/backup-db.sh

cd server && npm ci && npx prisma migrate deploy && npm run build
pm2 restart champ-pos-backend

cd ../client && npm ci && npm run build
# client/dist уже раздаётся nginx напрямую — новую сборку подхватит сразу после npm run build
```

---

## 7. Как добавить новый филиал

Модель `Location` (филиал/точка продаж) уже заложена в архитектуре БД с самого начала — все
таблицы (склад, продажи, закупки, движения товара) содержат `locationId`, поэтому добавление
нового филиала не требует миграции схемы. Отдельного экрана «Управление филиалами» в
интерфейсе сейчас нет (это будет отдельная бизнес-фича вне рамок текущего этапа), поэтому
новый филиал создаётся напрямую в базе:

```bash
# Docker:
docker compose exec backend npx prisma studio
# Без Docker:
cd server && npx prisma studio
```

Prisma Studio откроется на `http://localhost:5555` (проброс порта по SSH, если сервер
удалённый: `ssh -L 5555:localhost:5555 user@server`). В таблице `locations` добавьте новую
строку (`name`, `address`, `phone`, `isActive = true`). После этого при создании нового
пользователя (раздел 8) в поле `locationId` можно указать этот филиал — сотрудник увидит
только склад/продажи своей точки.

---

## 8. Как создать нового администратора

Через интерфейс (после того как хотя бы один администратор уже может войти):
**Панель администратора → Пользователи → Добавить пользователя → роль «Администратор».**

Если это самый первый администратор (сразу после установки) — он создаётся автоматически
командой `seed` (раздел 1) из значений `SEED_ADMIN_LOGIN` / `SEED_ADMIN_PASSWORD` в
`server/.env`. Обязательно смените пароль сразу после первого входа: **Настройки → Сменить
пароль**.

---

## 9. Как открыть проект на телефоне

Просто откройте в браузере телефона (Chrome/Safari) адрес вашего домена:
`https://champpos.example.com`. Отдельного мобильного приложения не требуется — интерфейс
полностью адаптирован под телефон (см. этап Mobile First).

---

## 10. Как установить PWA на Android

1. Откройте сайт в Chrome на Android.
2. Через несколько секунд снизу должен появиться баннер «Установить Sharof KFS POS» —
   нажмите «Установить». (Если баннер не появился сразу — откройте меню Chrome ⋮ →
   «Установить приложение».)
3. Иконка Sharof KFS появится на рабочем столе и в списке приложений — открывается как обычное
   приложение, без адресной строки браузера.

---

## 11. Как установить PWA на iPhone

iOS не показывает автоматический баннер установки (ограничение Safari) — устанавливается
вручную, но так же быстро:

1. Откройте сайт в **Safari** (не Chrome — на iOS только Safari умеет устанавливать PWA).
2. Нажмите кнопку «Поделиться» (квадрат со стрелкой вверх) внизу экрана.
3. Прокрутите вниз и выберите **«На экран «Домой»»**.
4. Нажмите «Добавить» в правом верхнем углу.

Иконка появится на домашнем экране, приложение открывается в полноэкранном режиме без
адресной строки Safari (фирменная заставка при запуске тоже уже настроена — см. этап PWA).

---

## Переменные окружения — сводка

| Файл | Назначение |
|---|---|
| `.env` (корень) | Только для `docker-compose.yml`: пароль Postgres, порт frontend |
| `server/.env` | Вся конфигурация backend: БД, JWT-секреты, CORS, семена админа |
| `client/.env` | `VITE_API_URL` — обычно не требует изменений (см. комментарий в файле) |

Полный список переменных с описанием каждой — в соответствующих `*.env.example` файлах.

## Куда смотреть при проблемах

```bash
# Docker:
docker compose logs -f backend       # логи backend (включая ошибки, см. server/src/middleware/error.ts)
docker compose logs -f frontend
docker compose logs -f postgres
docker compose ps                     # статус и healthcheck каждого контейнера

# PM2:
pm2 logs champ-pos-backend
pm2 status

# systemd:
journalctl -u champ-pos-backend -f
```
