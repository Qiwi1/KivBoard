import ConfigService from "./ConfigService";

/**
 * Класс обрабатывает информацию о доске
 */
class InfoService {
    /**
     * @type {boolean}
     */
    #infoAreDisplayed = false;
    get infoAreDisplayed() {
        return this.#infoAreDisplayed;
    }

    /**
     * Содержит количество пользователей, подключенных к серверу
     *
     * @type {number}
     */
    #nbConnectedUsers = -1;
    get nbConnectedUsers() {
        return this.#nbConnectedUsers;
    }

    /**
     * @type {{w: number, h: number}}
     */
    #smallestScreenResolution = undefined;
    get smallestScreenResolution() {
        return this.#smallestScreenResolution;
    }

    /**
     * @type {number}
     */
    #nbMessagesSent = 0;
    get nbMessagesSent() {
        return this.#nbMessagesSent;
    }

    /**
     * @type {number}
     */
    #nbMessagesReceived = 0;
    get nbMessagesReceived() {
        return this.#nbMessagesReceived;
    }

    /**
     * Содержит идентификатор интервала
     * @type {number}
     */
    #refreshInfoIntervalId = undefined;
    get refreshInfoIntervalId() {
        return this.#refreshInfoIntervalId;
    }

    /**
     * @param {number} nbConnectedUsers
     * @param {{w: number, h: number}} smallestScreenResolution
     */
    updateInfoFromServer({ nbConnectedUsers, smallestScreenResolution = undefined }) {
        if (this.#nbConnectedUsers !== nbConnectedUsers) {
            // Обновление параметра службы конфигурации при изменении подключенного пользователя
            ConfigService.refreshUserCountDependant(nbConnectedUsers);
        }
        this.#nbConnectedUsers = nbConnectedUsers;
        if (smallestScreenResolution) {
            this.#smallestScreenResolution = smallestScreenResolution;
        }
    }

    incrementNbMessagesReceived() {
        this.#nbMessagesReceived++;
    }

    incrementNbMessagesSent() {
        this.#nbMessagesSent++;
    }

    refreshDisplayedInfo() {
        const {
            nbMessagesReceived,
            nbMessagesSent,
            nbConnectedUsers,
            smallestScreenResolution: ssr,
        } = this;
        $("#messageReceivedCount")[0].innerText = String(nbMessagesReceived);
        $("#messageSentCount")[0].innerText = String(nbMessagesSent);
        $("#connectedUsersCount")[0].innerText = String(nbConnectedUsers);
        $("#smallestScreenResolution")[0].innerText = ssr ? `(${ssr.w}, ${ssr.h})` : "Unknown";
    }

    /**
     * Показ информации
     */
    displayInfo() {
        $("#whiteboardInfoContainer").toggleClass("displayNone", false);
        $("#displayWhiteboardInfoBtn").toggleClass("active", true);
        this.#infoAreDisplayed = true;

        this.refreshDisplayedInfo();
        this.#refreshInfoIntervalId = setInterval(() => {
            // Обновление только через определенный интервал, чтобы снизить нагрузку обновления
            this.refreshDisplayedInfo();
        }, ConfigService.refreshInfoInterval);
    }

    /**
     * Скрыть информацию
     */
    hideInfo() {
        $("#whiteboardInfoContainer").toggleClass("displayNone", true);
        $("#displayWhiteboardInfoBtn").toggleClass("active", false);
        this.#infoAreDisplayed = false;
        const { refreshInfoIntervalId } = this;
        if (refreshInfoIntervalId) {
            clearInterval(refreshInfoIntervalId);
            this.#refreshInfoIntervalId = undefined;
        }
    }

    /**
     * Перключатель информации
     */
    toggleDisplayInfo() {
        const { infoAreDisplayed } = this;
        if (infoAreDisplayed) {
            this.hideInfo();
        } else {
            this.displayInfo();
        }
    }
}

export default new InfoService();
