const { getArgs } = require("./utils");
const startFrontendDevServer = require("./server-frontend-dev");
const startBackendServer = require("./server-backend");

const SERVER_MODES = {
    PRODUCTION: 1,
    DEVELOPMENT: 2,
};

const args = getArgs();

if (typeof args.mode === "undefined") {
    args.mode = "production";
}

if (args.mode !== "production" && args.mode !== "development") {
    throw new Error("Ошибка");
}

const server_mode = args.mode === "production" ? SERVER_MODES.PRODUCTION : SERVER_MODES.DEVELOPMENT;

if (server_mode === SERVER_MODES.DEVELOPMENT) {
    console.info("Запуск сервера в режиме разработки.");
    startFrontendDevServer(8080);
    startBackendServer(3000);
} else {
    console.info("Запуск сервера в рабочем режиме.");
    startBackendServer(process.env.PORT || 8080);
}
