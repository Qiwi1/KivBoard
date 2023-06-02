const util = require("util");

const { getDefaultConfig, getConfig, deepMergeConfigs, isConfigValid } = require("./utils");

const { getArgs } = require("./../utils");

const defaultConfig = getDefaultConfig();

const cliArgs = getArgs();
let userConfig = {};

if (cliArgs["config"]) {
    userConfig = getConfig(cliArgs["config"]);
}

const config = deepMergeConfigs(defaultConfig, userConfig);

/**
 * Обновление конфигурации на основе аргументов CLI.
 * @param {object} startArgs
 */
function updateConfigFromStartArgs(startArgs) {
    function deprecateCliArg(key, callback) {
        const val = startArgs[key];
        if (val) {
            console.warn(
                "\x1b[33m\x1b[1m",
                `Setting config values (${key}) from the CLI is deprecated. ` +
                    "This ability will be removed in the next major version. " +
                    "You should use the config file. "
            );
            callback(val);
        }
    }

    deprecateCliArg("accesstoken", (val) => (config.backend.accessToken = val));
    deprecateCliArg(
        "disablesmallestscreen",
        () => (config.backend.showSmallestScreenIndicator = false)
    );
    deprecateCliArg("webdav", () => (config.backend.enableWebdav = true));
}

/**
 * Обновляет конфиг на основе переменных env
 */
function updateConfigFromEnv() {
    function deprecateEnv(key, callback) {
        const val = process.env[key];
        if (val) {
            console.warn(
                "\x1b[33m\x1b[1m",
                `Установка значений конфигурации (${key}) из среды устарела. ` +
                "Эта способность будет удалена в следующей основной версии." +
                "Вы должны использовать файл конфигурации. "
            );
            callback(val);
        }
    }

    deprecateEnv("accesstoken", (val) => (config.backend.accessToken = val));
    deprecateEnv(
        "disablesmallestscreen",
        () => (config.backend.showSmallestScreenIndicator = false)
    );
    deprecateEnv("webdav", () => (config.backend.enableWebdav = true));
}

// Уровень совместимости
updateConfigFromEnv();
updateConfigFromStartArgs(cliArgs);

if (!isConfigValid(config, true)) {
    throw new Error("Конфигурация недействительна. Подробности смотрите в журналах");
}

if (!process.env.JEST_WORKER_ID) {
    console.info(util.inspect(config, { showHidden: false, depth: null, colors: true }));
}

module.exports = config;
