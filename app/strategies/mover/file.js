import State from "../../state.js";
import { isEmptyCell } from "../utils.js";

/**
 * @type {PlayerOneStrategy}
 */
export default {
    name: "Fichier",
    fun(state) {
        const fileData = State.config.loadedHistory[State.game.turnNumber];
        if (fileData && fileData.action.type === 'move') {
            return fileData.action;
        }
        return null;
    }
}