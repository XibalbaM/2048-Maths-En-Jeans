import { getRandomEmptyCell } from "../utils.js";
import State from "../../state.js";

/**
 * @type {PlayerTwoStrategy}
 */
export default {
    name: "Coop Max",
    fun(state) {
        if (state.turnNumber == 0) {
            return {type: 'place', r: 0, c: 0, value: 4};
        } else if (state.turnNumber == 1) {
            return {type: 'place', r: 1, c: 0, value: 4};
        } else {
            return null;
        }
    }
}