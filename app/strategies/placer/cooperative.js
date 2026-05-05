import { bestPlacement } from '../cooperative.js';
import { NeuralNetwork } from '../nn.js';

/**
 * @param {NeuralNetwork} model
 * @param {number} [depth]
 * @returns {PlayerTwoStrategy}
 */
export default (model, depth = 5) => ({
    name: "Cooperative",
    fun(state) {
        const result = bestPlacement(state, depth, model);
        if (!result) return null;
        return { type: 'place', r: result.r, c: result.c, value: result.value };
    }
})