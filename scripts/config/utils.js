const path = require("path");
const fs = require("fs");
const yaml = require("js-yaml");

const Ajv = require("ajv");
const ajv = new Ajv({ allErrors: true });

const configSchema = require("./config-schema.json");

/**
 * Загрузка файла конфигурации yaml по заданному пути.
 *
 * @param path
 * @return {Object}
 */
function getConfig(path) {
    return yaml.safeLoad(fs.readFileSync(path, "utf8"));
}

/**
 * Проверяет, что объект конфигурации действителен.
 *
 * @param {Object} config Config object
 * @param {boolean} warn Should we warn in console for errors
 * @return {boolean}
 */
function isConfigValid(config, warn = true) {
    const validate = ajv.compile(configSchema);
    const isValidAgainstSchema = validate(config);

    if (!isValidAgainstSchema && warn) console.warn(validate.errors);

    let structureIsValid = false;
    try {
        structureIsValid = config.frontend.performance.pointerEventsThrottling.some(
            (item) => item.fromUserCount === 0
        );
    } catch (e) {
        if (!e instanceof TypeError) {
            throw e;
        }
    }

    if (!structureIsValid && warn)
        console.warn(
            "At least one item under frontend.performance.pointerEventsThrottling" +
                "must have fromUserCount set to 0"
        );

    return isValidAgainstSchema && structureIsValid;
}

/**
 * Загружает конфигурацию проекта по умолчанию
 * @return {Object}
 */
function getDefaultConfig() {
    const defaultConfigPath = path.join(__dirname, "..", "..", "config.default.yml");
    return getConfig(defaultConfigPath);
}

/**
 * @param baseConfig
 * @param overrideConfig
 * @return {Object}
 */
function deepMergeConfigs(baseConfig, overrideConfig) {
    const out = {};

    Object.entries(baseConfig).forEach(([key, val]) => {
        out[key] = val;
        if (overrideConfig.hasOwnProperty(key)) {
            const overrideVal = overrideConfig[key];
            if (typeof val === "object" && !Array.isArray(val) && val !== null) {
                out[key] = deepMergeConfigs(val, overrideVal);
            } else {
                out[key] = overrideVal;
            }
        }
    });

    return out;
}

module.exports.getConfig = getConfig;
module.exports.getDefaultConfig = getDefaultConfig;
module.exports.deepMergeConfigs = deepMergeConfigs;
module.exports.isConfigValid = isConfigValid;
