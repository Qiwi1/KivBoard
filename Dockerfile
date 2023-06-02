FROM node:16 as base

# Создание каталога сайта
RUN mkdir -p /opt/app
WORKDIR /opt/app

# Установка расширений
COPY ./package.json package-lock.json ./
RUN npm ci

# Интерфейс пакета
COPY src ./src
COPY assets ./assets
COPY config ./config
RUN npm run build

#####################
# Окончательный Image
#####################

FROM node:16-alpine
ENV NODE_ENV=prod

MAINTAINER cracker0dks

# Содание директории
RUN mkdir -p /opt/app
WORKDIR /opt/app

COPY ./package.json ./package-lock.json config.default.yml ./
RUN npm ci --only=prod

COPY scripts ./scripts
COPY --from=base /opt/app/dist ./dist

EXPOSE 8080
ENTRYPOINT ["npm", "run", "start"]