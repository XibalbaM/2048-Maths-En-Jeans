import { bestMove } from '../cooperative.js';
import { NeuralNetwork } from '../nn.js';

/**
 * @param {NeuralNetwork} model
 * @param {number} [depth]
 * @return {PlayerOneStrategy}
 */
export default (model, depth = 5) => ({
    name: "Cooperative",
    fun(state) {
        const result = bestMove(state, depth, model);
        if (!result) return null;
        return { type: 'move', direction: result.direction };
    }
})