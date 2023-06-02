import Point from "../classes/Point";
import { getCurrentTimeMs } from "../utils";
import ConfigService from "./ConfigService";

/**
 * Класс для обработки всей логики регулирования
 */
class ThrottlingService {
    /**
     * @type {number}
     */
    #lastSuccessTime = 0;
    get lastSuccessTime() {
        return this.#lastSuccessTime;
    }

    /**
     * @type {Point}
     */
    #lastPointPosition = new Point(0, 0);
    get lastPointPosition() {
        return this.#lastPointPosition;
    }

    /**
     * Помощник для регулирования событий на основе конфигурации.
     * Только если проверки в порядке, будет вызван обратный вызов onSuccess
     *
     * @param {Point} 
     * @param {function()} 
     */
    throttle(newPosition, onSuccess) {
        const newTime = getCurrentTimeMs();
        const { lastPointPosition, lastSuccessTime } = this;
        if (newTime - lastSuccessTime > ConfigService.pointerEventsThrottling.minTimeDelta) {
            if (
                lastPointPosition.distTo(newPosition) >
                ConfigService.pointerEventsThrottling.minDistDelta
            ) {
                onSuccess();
                this.#lastPointPosition = newPosition;
                this.#lastSuccessTime = newTime;
            }
        }
    }
}

export default new ThrottlingService();
