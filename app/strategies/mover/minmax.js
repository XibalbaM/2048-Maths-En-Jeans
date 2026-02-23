import { bestMove } from '../minimax.js';

/**
 * @type {PlayerOneStrategy}
 */
export default {
    name: "Min-Max",
    fun(state) {
        const result = bestMove(state, 3);
        if (!result) return null;
        return { type: 'move', direction: result.direction };
    }
}
