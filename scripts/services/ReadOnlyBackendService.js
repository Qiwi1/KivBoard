const { v4: uuidv4 } = require("uuid");

class ReadOnlyBackendService {
    /**
     * Сопоставление редактируемого идентификатора доски с соответствующим идентификатором доски только для чтения
     * @type {Map<string, string>}
     * @private
     */
    _idToReadOnlyId = new Map();

    /**
     * Сопоставление идентификатора доски, доступного только для чтения, с соответствующим идентификатором редактируемой доски.
     *
     * @type {Map<string, string>}
     * @private
     */
    _readOnlyIdToId = new Map();

    /**
     * Убедитесь, что в сервисе активирован whiteboardId.
     *
     * Если он не найден в сервисе, сайт будет думать, что это редактируемая доска.
     *
     * @param {string} whiteboardId
     */
    init(whiteboardId) {
        const idToReadOnlyId = this._idToReadOnlyId;
        const readOnlyIdToId = this._readOnlyIdToId;

        if (!idToReadOnlyId.has(whiteboardId) && !readOnlyIdToId.has(whiteboardId)) {
            const readOnlyId = uuidv4();
            idToReadOnlyId.set(whiteboardId, readOnlyId);
            readOnlyIdToId.set(readOnlyId, whiteboardId);
        }
    }

    /**
     * Получение идентификатора только для чтения, соответствующий идентификатору доски
     *
     * @param {string} whiteboardId
     * @return {string}
     */
    getReadOnlyId(whiteboardId) {
        if (this.isReadOnly(whiteboardId)) return whiteboardId;
        return this._idToReadOnlyId.get(whiteboardId);
    }

    /**
     * Получение идентификатора, соответствующий идентификатору только для чтения
     *
     * @param {string} readOnlyId
     * @return {string}
     */
    getIdFromReadOnlyId(readOnlyId) {
        return this._readOnlyIdToId.get(readOnlyId);
    }

    /**
     * Сообщает, соответствует ли идентификатор доски доске только для чтения
     *
     * @param whiteboardId
     * @return {boolean}
     */
    isReadOnly(whiteboardId) {
        this.init(whiteboardId);
        return this._readOnlyIdToId.has(whiteboardId);
    }
}

module.exports = new ReadOnlyBackendService();
