//Этот файл предназначен только для сохранения доски.
const fs = require("fs");
const config = require("./config/config");
const { getSafeFilePath } = require("./utils");
const FILE_DATABASE_FOLDER = "savedBoards";

var savedBoards = {};
var savedUndos = {};
var saveDelay = {};

if (config.backend.enableFileDatabase) {
    // Убедитесь, что папка с сохраненными досками существует
    fs.mkdirSync(FILE_DATABASE_FOLDER, {
        // Эта опция также отключает ошибку, если путь существует
        recursive: true,
    });
}

/**
 * Получение пути к файлу доски.
 * @param {string} 
 * @returns {string} 
 * @throws {Error} 
 */
function fileDatabasePath(wid) {
    return getSafeFilePath(FILE_DATABASE_FOLDER, wid + ".json");
}

module.exports = {
    handleEventsAndData: function (content) {
        var tool = content["t"]; //Инструмен, который используется
        var wid = content["wid"]; //ID доски
        var username = content["username"];
        if (tool === "clear") {
            //Очищение доски
            delete savedBoards[wid];
            delete savedUndos[wid];
            // Удаление файла
            fs.unlink(fileDatabasePath(wid), function (err) {
                if (err) {
                    return console.log(err);
                }
            });
        } else if (tool === "undo") {
            //Отмена действия
            if (!savedUndos[wid]) {
                savedUndos[wid] = [];
            }
            let savedBoard = this.loadStoredData(wid);
            if (savedBoard) {
                for (var i = savedBoards[wid].length - 1; i >= 0; i--) {
                    if (savedBoards[wid][i]["username"] == username) {
                        var drawId = savedBoards[wid][i]["drawId"];
                        for (var i = savedBoards[wid].length - 1; i >= 0; i--) {
                            if (
                                savedBoards[wid][i]["drawId"] == drawId &&
                                savedBoards[wid][i]["username"] == username
                            ) {
                                savedUndos[wid].push(savedBoards[wid][i]);
                                savedBoards[wid].splice(i, 1);
                            }
                        }
                        break;
                    }
                }
                if (savedUndos[wid].length > 1000) {
                    savedUndos[wid].splice(0, savedUndos[wid].length - 1000);
                }
            }
        } else if (tool === "redo") {
            if (!savedUndos[wid]) {
                savedUndos[wid] = [];
            }
            let savedBoard = this.loadStoredData(wid);
            for (var i = savedUndos[wid].length - 1; i >= 0; i--) {
                if (savedUndos[wid][i]["username"] == username) {
                    var drawId = savedUndos[wid][i]["drawId"];
                    for (var i = savedUndos[wid].length - 1; i >= 0; i--) {
                        if (
                            savedUndos[wid][i]["drawId"] == drawId &&
                            savedUndos[wid][i]["username"] == username
                        ) {
                            savedBoard.push(savedUndos[wid][i]);
                            savedUndos[wid].splice(i, 1);
                        }
                    }
                    break;
                }
            }
        } else if (
            [
                "line",
                "pen",
                "rect",
                "circle",
                "eraser",
                "addImgBG",
                "recSelect",
                "eraseRec",
                "addTextBox",
                "setTextboxText",
                "removeTextbox",
                "setTextboxPosition",
                "setTextboxFontSize",
                "setTextboxFontColor",
            ].includes(tool)
        ) {
            let savedBoard = this.loadStoredData(wid);
            //Сохранение всех действий
            delete content["wid"]; //Удаление идентификатора из контента, чтобы не хранить его дважды
            if (tool === "setTextboxText") {
                for (var i = savedBoard.length - 1; i >= 0; i--) {
                    //Удаление старого текста текстового поля -> не сохранять его дважды
                    if (
                        savedBoard[i]["t"] === "setTextboxText" &&
                        savedBoard[i]["d"][0] === content["d"][0]
                    ) {
                        savedBoard.splice(i, 1);
                    }
                }
            }
            savedBoard.push(content);
        }
        this.saveToDB(wid);
    },
    saveToDB: function (wid) {
        if (config.backend.enableFileDatabase) {
            //Сохранение доски в файл
            if (!saveDelay[wid]) {
                saveDelay[wid] = true;
                setTimeout(function () {
                    saveDelay[wid] = false;
                    if (savedBoards[wid]) {
                        fs.writeFile(
                            fileDatabasePath(wid),
                            JSON.stringify(savedBoards[wid]),
                            (err) => {
                                if (err) {
                                    return console.log(err);
                                }
                            }
                        );
                    }
                }, 1000 * 10);
            }
        }
    },
    // Загузка сохраненной доски
    loadStoredData: function (wid) {
        if (wid in savedBoards) {
            return savedBoards[wid];
        }

        savedBoards[wid] = [];

        if (config.backend.enableFileDatabase) {
            var filePath = fileDatabasePath(wid);
            if (fs.existsSync(filePath)) {
                var data = fs.readFileSync(filePath);
                if (data) {
                    savedBoards[wid] = JSON.parse(data);
                }
            }
        }

        return savedBoards[wid];
    },
    copyStoredData: function (sourceWid, targetWid) {
        const sourceData = this.loadStoredData(sourceWid);
        if (sourceData.length === 0 || this.loadStoredData(targetWid).lenght > 0) {
            return;
        }
        savedBoards[targetWid] = sourceData.slice();
        this.saveToDB(targetWid);
    },
    saveData: function (wid, data) {
        const existingData = this.loadStoredData(wid);
        if (existingData.length > 0 || !data) {
            return;
        }
        savedBoards[wid] = JSON.parse(data);
        this.saveToDB(wid);
    },
};
