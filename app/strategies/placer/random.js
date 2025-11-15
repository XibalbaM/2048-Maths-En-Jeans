import { getRandomEmptyCell } from "../utils.js";
import State from "../../state.js";

/**
 * @type {PlayerTwoStrategy}
 */
export default {
    name: "Placement aléatoire",
    fun(state) {
        const pos = getRandomEmptyCell();
        const val = Math.random() < 0.9 ? State.config.tileValues[0] : (State.config.tileValues[1] || State.config.tileValues[0]);
        if (pos) {
            return { type: 'place', r: pos[0], c: pos[1], value: val };
        }
        return null;
    }
}