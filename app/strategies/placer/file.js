import State from "../../state.js";
import { isEmptyCell } from "../utils.js";

/**
 * @type {PlayerTwoStrategy}
 */
export default {
    name: "Fichier",
    fun(state) {
        const fileData = State.config.loadedHistory[State.game.turnNumber];
        if (fileData && fileData.action.type === 'place' && isEmptyCell(fileData.action.r, fileData.action.c)) {
            return fileData.action;
        }
        return null;
    }
}