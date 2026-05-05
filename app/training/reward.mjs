/// <reference path="../../types.d.ts" />

/**
 * Pure score-based reward potential.
 * @param {GameState} state
 * @returns {number}
 */
export function reward(state) {
    //return Number(state?.score || 0);
    //For each tile, count the number of neighbours with the same value times two, and the number of neighbours with half the value, and the number of neighbours with double the value, and sum these up.
    let potential = 0;
    const grid = state.grid;
    const rows = grid.length;
    const cols = rows > 0 ? grid[0].length : 0;
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const v = grid[r][c];
            if (v === 0) continue;
            const half = v / 2;
            const double = v * 2;
            const neighbours = [
                [r - 1, c],
                [r + 1, c],
                [r, c - 1],
                [r, c + 1],
            ];
            for (const [nr, nc] of neighbours) {
                if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
                    const nv = grid[nr][nc];
                    if (nv === v) potential += 2;
                    else if (nv === half || nv === double) potential += 1;
                    // Add penality corresponding to the difference in log of the cell and its neighbour minus one
                    else potential -= (Math.abs(Math.log2(v) - Math.log2(nv)) - 1) / 16; // Normalise by max log difference (16 for 65536) to keep the reward in a reasonable range.
                }

            }
        }
    }
    return Math.max(potential + Math.log2((state.score || 0) + 1), 0); // Add normalised score as a tiebreaker and a constant to keep the reward positive.
}

/**
 * Transition reward derived from potential difference.
 * @param {GameState} previousState
 * @param {GameState} nextState
 * @returns {number}
 */
export function transitionReward(previousState, nextState) {
    return reward(nextState) - reward(previousState);
}
