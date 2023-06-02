import ConfigService from "./ConfigService";

/**
 * Класс отвечающий за блокировку панели инструментов
 */
class ReadOnlyService {
    /**
     * @type {boolean}
     */
    #readOnlyActive = true;
    get readOnlyActive() {
        return this.#readOnlyActive;
    }

    /**
     * @type {object}
     */
    #previousToolHtmlElem = null;
    get previousToolHtmlElem() {
        return this.#previousToolHtmlElem;
    }

    /**
     * Активация режима только для чтения
     */
    activateReadOnlyMode() {
        this.#readOnlyActive = true;

        this.#previousToolHtmlElem = $(".whiteboard-tool.active");

        // switch to mouse tool to prevent the use of the
        // other tools
        $(".whiteboard-tool[tool=mouse]").click();
        $(".whiteboard-tool").prop("disabled", true);
        $(".whiteboard-edit-group > button").prop("disabled", true);
        $(".whiteboard-edit-group").addClass("group-disabled");
        $("#whiteboardUnlockBtn").hide();
        $("#whiteboardLockBtn").show();
    }

    /**
     * Выключение режима только для чтения
     */
    deactivateReadOnlyMode() {
        if (ConfigService.isReadOnly) return;

        this.#readOnlyActive = false;

        $(".whiteboard-tool").prop("disabled", false);
        $(".whiteboard-edit-group > button").prop("disabled", false);
        $(".whiteboard-edit-group").removeClass("group-disabled");
        $("#whiteboardUnlockBtn").show();
        $("#whiteboardLockBtn").hide();

        // Восстановление выбранного ранее инструмента
        const { previousToolHtmlElem } = this;
        if (previousToolHtmlElem) previousToolHtmlElem.click();
    }
}

export default new ReadOnlyService();
