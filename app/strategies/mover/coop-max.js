import { simulateAMove } from '../../utils.js';

/**
 * Count contiguous full columns starting from the left edge.
 * @param {number[][]} grid
 * @returns {number}
 */
function countLeadingFullColumns(grid) {
    const size = grid.length;
    let count = 0;
    for (let c = 0; c < size; c++) {
        let full = true;
        for (let r = 0; r < size; r++) {
            const value = grid[r][c];
            if (value === 0) {
                full = false;
                break;
            }
            if (r < size - 1 && value === grid[r + 1][c]) {
                full = false;
                break;
            }
        }
        if (!full) break;
        count++;
    }
    return count;
}

/**
 * Choose the best direction following the snake pattern heuristic.
 * @param {GameState} state
 * @returns {Direction | null}
 */
function pickDirection(state) {
    const leadingFull = countLeadingFullColumns(state.grid);
    /** @type {Direction} */
    const primaryVertical = (leadingFull % 2 === 0) ? 'up' : 'down';
    const preferredOrder = /** @type {Direction[]} */ (['left', primaryVertical]);

    for (const direction of preferredOrder) {
        const { moved } = simulateAMove(direction, state);
        if (moved) return direction;
    }
    return null;
}

/**
 * @type {PlayerOneStrategy}
 */
// @ts-ignore
export default {
    name: "Coop Max Pass",
    fun(state) {
        // Keep the snake packed: alternate vertical sweeps per filled column, fall back to left, never go right.
        const direction = pickDirection(state);
        if (!direction) return null;
        return { type: 'move', direction };
    }
}