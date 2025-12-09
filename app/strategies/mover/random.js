import { simulateAMove } from "../../utils.js";

/**
 * @type {Direction[]}
 */
const directions = ["up", "down", "left", "right"];

/**
 * @type {PlayerOneStrategy}
 */
export default {
    name: "Aléatoire",
    fun(state) {
        while (true) {
            const direction = directions[Math.floor(Math.random() * directions.length)];
            if (simulateAMove(direction, state).moved) {
                return {type: "move", direction};
            }
        }
    }
}