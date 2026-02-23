import { bestPlacement } from '../minimax.js';

/**
 * @type {PlayerTwoStrategy}
 */
export default {
    name: "Min-Max",
    fun(state) {
        const result = bestPlacement(state, 3);
        if (!result) return null;
        return { type: 'place', r: result.r, c: result.c, value: result.value };
    }
}
