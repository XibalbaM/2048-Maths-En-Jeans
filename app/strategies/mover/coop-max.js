import State from "../../state.js";
import { isEmptyCell } from "../utils.js";

/**
 * @type {PlayerOneStrategy}
 */
export default {
    name: "Coop Max",
    fun(state) {
        for (let x = 0; x < 4; x++) {
            for (let y = 0; y < 4; y++) {
                const a = state.grid?.[y]?.[x] ?? state.cells?.[y]?.[x];
                if (isEmptyCell(a)) continue;

                const getVal = c => (c && typeof c === "object" && "value" in c) ? c.value : c;

                // check right neighbor -> move LEFT to combine into the current cell
                if (x + 1 < 4) {
                    const b = state.grid?.[y]?.[x + 1] ?? state.cells?.[y]?.[x + 1];
                    if (!isEmptyCell(b) && getVal(a) === getVal(b)) return State.LEFT;
                }

                // check down neighbor -> move UP to combine into the current cell
                if (y + 1 < 4) {
                    const b = state.grid?.[y + 1]?.[x] ?? state.cells?.[y + 1]?.[x];
                    if (!isEmptyCell(b) && getVal(a) === getVal(b)) return State.UP;
                }
            }
        }

        // fallback if no adjacent pair found
        return State.UP;
    }
}