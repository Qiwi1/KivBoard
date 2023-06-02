const config = require("../config/config");
const ReadOnlyBackendService = require("./ReadOnlyBackendService");

/**
 * Класс для хранения информации, связанной с доской
 */
class WhiteboardInfo {
    static defaultScreenResolution = { w: 1000, h: 1000 };

    /**
     * @type {number}
     * @private
     */
    #nbConnectedUsers = 0;
    get nbConnectedUsers() {
        return this.#nbConnectedUsers;
    }

    /**
     * @type {Map<string, {w: number, h: number}>}
     * @private
     */
    #screenResolutionByClients = new Map();
    get screenResolutionByClients() {
        return this.#screenResolutionByClients;
    }

    /**
     * Переменная, чтобы узнать, были ли отправлены эти данные или нет
     *
     * @private
     * @type {boolean}
     */
    #hasNonSentUpdates = false;
    get hasNonSentUpdates() {
        return this.#hasNonSentUpdates;
    }

    incrementNbConnectedUsers() {
        this.#nbConnectedUsers++;
        this.#hasNonSentUpdates = true;
    }

    decrementNbConnectedUsers() {
        this.#nbConnectedUsers--;
        this.#hasNonSentUpdates = true;
    }

    hasConnectedUser() {
        return this.#nbConnectedUsers > 0;
    }

    /**
     * Хранение информации о разрешении экрана пользователя
     *
     * @param {string} clientId
     * @param {number} w client's width
     * @param {number} h client's hight
     */
    setScreenResolutionForClient(clientId, { w, h }) {
        this.#screenResolutionByClients.set(clientId, { w, h });
        this.#hasNonSentUpdates = true;
    }

    /**
     * Удаление сохраненной информации о разрешении экрана пользователя
     * @param clientId
     */
    deleteScreenResolutionOfClient(clientId) {
        this.#screenResolutionByClients.delete(clientId);
        this.#hasNonSentUpdates = true;
    }

    /**
     * Получение наименьшего размера экрана пользователя на доске
     * @return {{w: number, h: number}}
     */
    getSmallestScreenResolution() {
        const { screenResolutionByClients: resolutions } = this;
        return {
            w: Math.min(...Array.from(resolutions.values()).map((res) => res.w)),
            h: Math.min(...Array.from(resolutions.values()).map((res) => res.h)),
        };
    }

    infoWasSent() {
        this.#hasNonSentUpdates = false;
    }

    shouldSendInfo() {
        return this.#hasNonSentUpdates;
    }

    asObject() {
        const out = {
            nbConnectedUsers: this.#nbConnectedUsers,
        };

        if (config.frontend.showSmallestScreenIndicator) {
            out.smallestScreenResolution = this.getSmallestScreenResolution();
        }

        return out;
    }
}


class InfoByWhiteBoardMap extends Map {
    get(wid) {
        const readOnlyId = ReadOnlyBackendService.getReadOnlyId(wid);
        return super.get(readOnlyId);
    }

    set(wid, val) {
        const readOnlyId = ReadOnlyBackendService.getReadOnlyId(wid);
        return super.set(readOnlyId, val);
    }

    has(wid) {
        const readOnlyId = ReadOnlyBackendService.getReadOnlyId(wid);
        return super.has(readOnlyId);
    }

    delete(wid) {
        const readOnlyId = ReadOnlyBackendService.getReadOnlyId(wid);
        return super.delete(readOnlyId);
    }
}

class WhiteboardInfoBackendService {
    /**
     * @type {Map<string, WhiteboardInfo>}
     */
    #infoByWhiteboard = new InfoByWhiteBoardMap();

    /**
     * Запускает автоматическую отправку информации на все доски
     *
     * @param io
     */
    start(io) {
        // автоматическая очистка информации ByWhiteboard
        setInterval(() => {
            this.#infoByWhiteboard.forEach((info, readOnlyWhiteboardId) => {
                if (info.shouldSendInfo()) {
                    // трансляция на редактируемую доску
                    const wid = ReadOnlyBackendService.getIdFromReadOnlyId(readOnlyWhiteboardId);
                    io.sockets
                        .in(wid)
                        .compress(false)
                        .emit("whiteboardInfoUpdate", info.asObject());

                    // также отправка на доску только для чтения
                    io.sockets
                        .in(readOnlyWhiteboardId)
                        .compress(false)
                        .emit("whiteboardInfoUpdate", info.asObject());

                    info.infoWasSent();
                }
            });
        }, (1 / config.backend.performance.whiteboardInfoBroadcastFreq) * 1000);
    }

    /**
     * Отслеживание события присоединения пользователя к доске
     *
     * @param {string} clientId
     * @param {string} whiteboardId
     * @param {{w: number, h: number}} screenResolution
     */
    join(clientId, whiteboardId, screenResolution) {
        const infoByWhiteboard = this.#infoByWhiteboard;

        if (!infoByWhiteboard.has(whiteboardId)) {
            infoByWhiteboard.set(whiteboardId, new WhiteboardInfo());
        }

        const whiteboardServerSideInfo = infoByWhiteboard.get(whiteboardId);
        whiteboardServerSideInfo.incrementNbConnectedUsers();
        this.setScreenResolution(clientId, whiteboardId, screenResolution);
    }

    /**
     * Установка разрешение экрана пользователя
     * @param {string} clientId
     * @param {string} whiteboardId
     * @param {{w: number, h: number}} screenResolution
     */
    setScreenResolution(clientId, whiteboardId, screenResolution) {
        const infoByWhiteboard = this.#infoByWhiteboard;

        const whiteboardServerSideInfo = infoByWhiteboard.get(whiteboardId);
        if (whiteboardServerSideInfo) {
            whiteboardServerSideInfo.setScreenResolutionForClient(
                clientId,
                screenResolution || WhiteboardInfo.defaultScreenResolution
            );
        }
    }

    /**
     * @param {string} clientId
     * @param {string} whiteboardId
     */
    leave(clientId, whiteboardId) {
        const infoByWhiteboard = this.#infoByWhiteboard;

        if (infoByWhiteboard.has(whiteboardId)) {
            const whiteboardServerSideInfo = infoByWhiteboard.get(whiteboardId);

            if (clientId) {
                whiteboardServerSideInfo.deleteScreenResolutionOfClient(clientId);
            }

            whiteboardServerSideInfo.decrementNbConnectedUsers();

            if (whiteboardServerSideInfo.hasConnectedUser()) {
            } else {
                infoByWhiteboard.delete(whiteboardId);
            }
        }
    }

    /**
     * Получение количество пользователей на доске
     *
     * @param {string} wid
     * @returns number|null
     */
    getNbClientOnWhiteboard(wid) {
        const infoByWhiteboard = this.#infoByWhiteboard;
        const info = infoByWhiteboard.get(wid);

        if (info) return info.nbConnectedUsers;
        else return null;
    }
}

module.exports = new WhiteboardInfoBackendService();
