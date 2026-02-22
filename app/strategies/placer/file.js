import State from "../../state.js";
import file from "../mover/file.js";
import { isEmptyCell } from "../utils.js";

/**
 * @type {PlayerTwoStrategy}
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
        if (!fileData.action) fileData = {action: fileData, nextTurn: "move"};
        if (fileData.action.type === 'place' && isEmptyCell(fileData.action.r, fileData.action.c)) {
            return fileData.action;
        // @ts-ignore
        } else if (fileData.action.type === 'delete' && !isEmptyCell(fileData.action.r, fileData.action.c)) {
        // @ts-ignore
            return {type: "place", r: fileData.action.r, c: fileData.action.c, value: 0};
        }
        return null;
    }
}