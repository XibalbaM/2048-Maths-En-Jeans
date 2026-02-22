import State from "../../state.js";
import { isEmptyCell } from "../utils.js";

/**
 * @type {PlayerOneStrategy}
 */
export default {
    name: "Fichier",
    fun(state) {
        let fileData = State.config.loadedHistory[State.game.turnNumber];
        console.log("File data:", fileData);
        if (!fileData) {
            return null;
        }
        // @ts-ignore
        if (!fileData.action) fileData = {action: fileData, nextTurn: "place"};
        if (fileData.action.type === 'move') {
            return fileData.action;
        }
        return null;
    }
}