import State from '../state.js';

/**
 * Check if a specific cell is empty
 * @param {number} r - Row index
 * @param {number} c - Column index
 * @returns {boolean} True if the cell is empty
 */
export function isEmptyCell(r, c) {
    return State.game.grid[r][c] === 0;
}

/**
 * Get a random empty cell from the grid
 * @returns {[number, number] | null} Row and column of random empty cell, or null if none available
 */
export function getRandomEmptyCell() {
    const empties = [];
    for (let r = 0; r < State.config.size; r++) for (let c = 0; c < State.config.size; c++) if (isEmptyCell(r, c)) empties.push([r, c]);
    if (empties.length === 0) return null;
    const [r, c] = empties[Math.floor(Math.random() * empties.length)];
    return [r, c];
}

/**
 * Check if any moves are possible on the grid
 * @param {number[][]} g - Grid to check
 * @returns {boolean} True if at least one move is possible
 */
export function canMove(g) {
    for (let r = 0; r < State.config.size; r++) for (let c = 0; c < State.config.size; c++) {
        if (g[r][c] === 0) return true;
        if (c + 1 < State.config.size && g[r][c] === g[r][c + 1]) return true;
        if (r + 1 < State.config.size && g[r][c] === g[r + 1][c]) return true;
    }
    return false;
}