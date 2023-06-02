const path = require("path");

const config = require("./config/config");
const ReadOnlyBackendService = require("./services/ReadOnlyBackendService");
const WhiteboardInfoBackendService = require("./services/WhiteboardInfoBackendService");
const { getSafeFilePath } = require("./utils");

function startBackendServer(port) {
    var fs = require("fs-extra");
    var express = require("express");
    var formidable = require("formidable"); //Обработка загрузки формы

    const createDOMPurify = require("dompurify"); 
    const { JSDOM } = require("jsdom");
    const window = new JSDOM("").window;
    const DOMPurify = createDOMPurify(window);

    const { createClient } = require("webdav");

    var s_whiteboard = require("./s_whiteboard.js");

    var app = express();

    var server = require("http").Server(app);
    server.listen(port);
    var io = require("socket.io")(server, { path: "/ws-api" });
    WhiteboardInfoBackendService.start(io);

    console.log("socketserver running on port:" + port);

    const { accessToken, enableWebdav } = config.backend;

    app.use(express.static(path.join(__dirname, "..", "dist")));
    app.use("/uploads", express.static(path.join(__dirname, "..", "public", "uploads")));


    app.get("/api/health", function (req, res) {
        res.status(200); //OK
        res.end();
    });


    app.get("/api/loadwhiteboard", function (req, res) {
        let query = escapeAllContentStrings(req["query"]);
        const wid = query["wid"];
        const at = query["at"]; //accesstoken
        if (accessToken === "" || accessToken == at) {
            const widForData = ReadOnlyBackendService.isReadOnly(wid)
                ? ReadOnlyBackendService.getIdFromReadOnlyId(wid)
                : wid;
            const ret = s_whiteboard.loadStoredData(widForData);
            res.send(ret);
            res.end();
        } else {
            res.status(401); //Неавторизованный
            res.end();
        }
    });

 
    app.get("/api/getReadOnlyWid", function (req, res) {
        let query = escapeAllContentStrings(req["query"]);
        const wid = query["wid"];
        const at = query["at"]; //accesstoken
        if (accessToken === "" || accessToken == at) {
            res.send(ReadOnlyBackendService.getReadOnlyId(wid));
            res.end();
        } else {
            res.status(401); //Неавторизованный
            res.end();
        }
    });


    app.post("/api/upload", function (req, res) {
        //Загрузка файла
        var form = new formidable.IncomingForm(); //Получение формы
        var formData = {
            files: {},
            fields: {},
        };

        form.on("file", function (name, file) {
            formData["files"][file.name] = file;
        });

        form.on("field", function (name, value) {
            formData["fields"][name] = value;
        });

        form.on("error", function (err) {
            console.log("File uplaod Error!");
        });

        form.on("end", function () {
            if (accessToken === "" || accessToken == formData["fields"]["at"]) {
                progressUploadFormData(formData, function (err) {
                    if (err) {
                        if (err == "403") {
                            res.status(403);
                        } else {
                            res.status(500);
                        }
                        res.end();
                    } else {
                        res.send("done");
                    }
                });
            } else {
                res.status(401); //Неавторизованный
                res.end();
            }
            //Завершить загрузку файла
        });
        form.parse(req);
    });

    app.get("/api/drawToWhiteboard", function (req, res) {
        let query = escapeAllContentStrings(req["query"]);
        const wid = query["wid"];
        const at = query["at"]; //accesstoken
        if (!wid || ReadOnlyBackendService.isReadOnly(wid)) {
            res.status(401); //Неавторизованный
            res.end();
        }

        if (accessToken === "" || accessToken == at) {
            const broadcastTo = (wid) => io.compress(false).to(wid).emit("drawToWhiteboard", query);
            // транслирует на текущю доску
            broadcastTo(wid);
            // транслирует тот же контент на связанную доску только для чтения
            const readOnlyId = ReadOnlyBackendService.getReadOnlyId(wid);
            broadcastTo(readOnlyId);
            s_whiteboard.handleEventsAndData(query); //сохранение изменений доски на сервере
            res.send("done");
        } else {
            res.status(401); //Неавторизованный
            res.end();
        }
    });

    function progressUploadFormData(formData, callback) {
        console.log("Progress new Form Data");
        const fields = escapeAllContentStrings(formData.fields);
        const wid = fields["wid"];
        if (ReadOnlyBackendService.isReadOnly(wid)) return;

        const readOnlyWid = ReadOnlyBackendService.getReadOnlyId(wid);

        const date = fields["date"] || +new Date();
        const filename = `${readOnlyWid}_${date}.png`;
        let webdavaccess = fields["webdavaccess"] || false;
        try {
            webdavaccess = JSON.parse(webdavaccess);
        } catch (e) {
            webdavaccess = false;
        }

        const savingDir = getSafeFilePath("public/uploads", readOnlyWid);
        fs.ensureDir(savingDir, function (err) {
            if (err) {
                console.log("Could not create upload folder!", err);
                return;
            }
            let imagedata = fields["imagedata"];
            if (imagedata && imagedata != "") {
                imagedata = imagedata
                    .replace(/^data:image\/png;base64,/, "")
                    .replace(/^data:image\/jpeg;base64,/, "");
                console.log(filename, "uploaded");
                const savingPath = getSafeFilePath(savingDir, filename);
                fs.writeFile(savingPath, imagedata, "base64", function (err) {
                    if (err) {
                        console.log("error", err);
                        callback(err);
                    } else {
                        if (webdavaccess) {
                            if (enableWebdav) {
                                saveImageToWebdav(
                                    savingPath,
                                    filename,
                                    webdavaccess,
                                    function (err) {
                                        if (err) {
                                            console.log("error", err);
                                            callback(err);
                                        } else {
                                            callback();
                                        }
                                    }
                                );
                            } else {
                                callback("Webdav is not enabled on the server!");
                            }
                        } else {
                            callback();
                        }
                    }
                });
            } else {
                callback("no imagedata!");
                console.log("No image Data found for this upload!", filename);
            }
        });
    }

    function saveImageToWebdav(imagepath, filename, webdavaccess, callback) {
        if (webdavaccess) {
            const webdavserver = webdavaccess["webdavserver"] || "";
            const webdavpath = webdavaccess["webdavpath"] || "/";
            const webdavusername = webdavaccess["webdavusername"] || "";
            const webdavpassword = webdavaccess["webdavpassword"] || "";

            const client = createClient(webdavserver, {
                username: webdavusername,
                password: webdavpassword,
            });
            client
                .getDirectoryContents(webdavpath)
                .then((items) => {
                    const cloudpath = webdavpath + "" + filename;
                    console.log("webdav saving to:", cloudpath);
                    fs.createReadStream(imagepath).pipe(client.createWriteStream(cloudpath));
                    callback();
                })
                .catch((error) => {
                    callback("403");
                    console.log("Could not connect to webdav!");
                });
        } else {
            callback("Error: no access data!");
        }
    }

    io.on("connection", function (socket) {
        let whiteboardId = null;
        socket.on("disconnect", function () {
            WhiteboardInfoBackendService.leave(socket.id, whiteboardId);
            socket.compress(false).broadcast.to(whiteboardId).emit("refreshUserBadges", null); //Удаляет старые значки пользователей
        });

        socket.on("drawToWhiteboard", function (content) {
            if (!whiteboardId || ReadOnlyBackendService.isReadOnly(whiteboardId)) return;

            content = escapeAllContentStrings(content);
            content = purifyEncodedStrings(content);

            if (accessToken === "" || accessToken == content["at"]) {
                const broadcastTo = (wid) =>
                    socket.compress(false).broadcast.to(wid).emit("drawToWhiteboard", content);
                // транслирует на текущую доскуу
                broadcastTo(whiteboardId);
                // транслирует тот же контент на связанную доску только для чтения
                const readOnlyId = ReadOnlyBackendService.getReadOnlyId(whiteboardId);
                broadcastTo(readOnlyId);
                s_whiteboard.handleEventsAndData(content); //сохраняет изменения доски на сервере
            } else {
                socket.emit("wrongAccessToken", true);
            }
        });

        socket.on("joinWhiteboard", function (content) {
            content = escapeAllContentStrings(content);
            if (accessToken === "" || accessToken == content["at"]) {
                whiteboardId = content["wid"];

                socket.emit("whiteboardConfig", {
                    common: config.frontend,
                    whiteboardSpecific: {
                        correspondingReadOnlyWid:
                            ReadOnlyBackendService.getReadOnlyId(whiteboardId),
                        isReadOnly: ReadOnlyBackendService.isReadOnly(whiteboardId),
                    },
                });

                socket.join(whiteboardId);
                const screenResolution = content["windowWidthHeight"];
                WhiteboardInfoBackendService.join(socket.id, whiteboardId, screenResolution);
            } else {
                socket.emit("wrongAccessToken", true);
            }
        });

        socket.on("updateScreenResolution", function (content) {
            content = escapeAllContentStrings(content);
            if (accessToken === "" || accessToken == content["at"]) {
                const screenResolution = content["windowWidthHeight"];
                WhiteboardInfoBackendService.setScreenResolution(
                    socket.id,
                    whiteboardId,
                    screenResolution
                );
            }
        });
    });

    function escapeAllContentStrings(content, cnt) {
        if (!cnt) cnt = 0;

        if (typeof content === "string") {
            return DOMPurify.sanitize(content);
        }
        for (var i in content) {
            if (typeof content[i] === "string") {
                content[i] = DOMPurify.sanitize(content[i]);
            }
            if (typeof content[i] === "object" && cnt < 10) {
                content[i] = escapeAllContentStrings(content[i], ++cnt);
            }
        }
        return content;
    }

    function purifyEncodedStrings(content) {
        if (content.hasOwnProperty("t") && content["t"] === "setTextboxText") {
            return purifyTextboxTextInContent(content);
        }
        return content;
    }

    function purifyTextboxTextInContent(content) {
        const raw = content["d"][1];
        const decoded = base64decode(raw);
        const purified = DOMPurify.sanitize(decoded, {
            ALLOWED_TAGS: ["div", "br"],
            ALLOWED_ATTR: [],
            ALLOW_DATA_ATTR: false,
        });

        if (purified !== decoded) {
            console.warn("setTextboxText payload needed be DOMpurified");
            console.warn("raw: " + removeControlCharactersForLogs(raw));
            console.warn("decoded: " + removeControlCharactersForLogs(decoded));
            console.warn("purified: " + removeControlCharactersForLogs(purified));
        }

        content["d"][1] = base64encode(purified);
        return content;
    }

    function base64encode(s) {
        return Buffer.from(s, "utf8").toString("base64");
    }

    function base64decode(s) {
        return Buffer.from(s, "base64").toString("utf8");
    }

    function removeControlCharactersForLogs(s) {
        return s.replace(/[\u0000-\u001F\u007F-\u009F]/g, "");
    }

    process.on("unhandledRejection", (error) => {
        console.log("unhandledRejection", error.message);
    });
}

module.exports = startBackendServer;
