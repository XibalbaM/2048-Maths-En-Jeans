import { simulateAMove } from "../../utils.js"

/**
 * @type {PlayerOneStrategy}
 */
export default {
    name: "Coop Min",
    fun(state) {
        // Move up if possible, down otherwise
        if (simulateAMove('up', state).moved) {
            return { type: 'move', direction: 'up' };
        } else if (simulateAMove('down', state).moved) {
            return { type: 'move', direction: 'down' };
        } else if (simulateAMove('left', state).moved) {
            return { type: 'move', direction: 'left' };
        } else if (simulateAMove('right', state).moved) {
            return { type: 'move', direction: 'right' };
        }
        return null; // no valid move
    }
}