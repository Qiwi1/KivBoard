/**
 * Вычисление расстояния между двумя точками
 * @param {Point} p1
 * @param {Point} p2
 */
export function computeDist(p1, p2) {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
}

/**
 * Возвращает текущее время в мс с 1970 года.
 * @returns {number}
 */
export function getCurrentTimeMs() {
    return new Date().getTime();
}

export function getSubDir() {
    const url = document.URL.substr(0, document.URL.lastIndexOf("/"));
    const urlSplit = url.split("/");
    let subdir = "";
    for (let i = 3; i < urlSplit.length; i++) {
        subdir = subdir + "/" + urlSplit[i];
    }

    return subdir;
}
