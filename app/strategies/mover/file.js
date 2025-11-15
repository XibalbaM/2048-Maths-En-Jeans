import State from "../../state.js";
import { isEmptyCell } from "../utils.js";

/**
 * @type {PlayerOneStrategy}
 */
export default {
    name: "Fichier",
    fun(state) {
        const fileData = State.config.loadedHistory[State.game.turnNumber];
        console.log('File strategy move data:', fileData);
        if (fileData && fileData.type === 'move') {
            return fileData;
        }
        return null;
    }
}