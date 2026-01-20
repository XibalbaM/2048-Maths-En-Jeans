import State from "../../state.js";

/**
 * @type {PlayerTwoStrategy}
 */
export default {
    name: "Coop Max Pass Bis",
    fun(state) {
        const grid = state.grid;
        const fourValue = State.config.tileValues[1] ?? 4;

        const placementsDone = countPlacements(state.history);
        const initialPlacements = [
            { r: 0, c: 0, value: fourValue },
            { r: Math.min(1, State.config.rows - 1), c: 0, value: fourValue },
        ];

        if (placementsDone < initialPlacements.length) {
            const target = initialPlacements[placementsDone];
            if (grid[target.r] && grid[target.r][target.c] === 0) {
                return { type: 'place', r: target.r, c: target.c, value: target.value };
            }
        }

        // Get snake path to find empty cells in order
        const snakePath = getSnakePath(State.config.rows, State.config.cols);
        if (!snakePath.length) return null;

        // Find all empty cells in snake order
        const emptyCells = snakePath.filter(([r, c]) => grid[r] && grid[r][c] === 0);
        if (emptyCells.length === 0) return null;

        if (hasFusionAvailable(grid)) {
            // Return last empty cell in snake order
            const [r, c] = emptyCells[emptyCells.length - 1];
            return { type: 'place', r, c, value: fourValue };
        }

        // First, try to find an empty cell where placing would make a fusion possible
        for (const [r, c] of emptyCells) {
            if (wouldEnableFusion(grid, r, c, fourValue)) {
                return { type: 'place', r, c, value: fourValue };
            }
        }

        // If no placement enables fusion, use the first empty cell in snake order
        const [r, c] = emptyCells[1];
        return { type: 'place', r, c, value: fourValue };
    }
}

let cachedSnakeRows = null;
let cachedSnakeCols = null;
let cachedSnakePath = [];

function getSnakePath(rows, cols) {
    if (rows <= 0 || cols <= 0) return [];
    if (cachedSnakeRows !== rows || cachedSnakeCols !== cols) {
        const path = [];
        for (let c = 0; c < cols; c++) {
            if (c % 2 === 0) {
                for (let r = 0; r < rows; r++) path.push([r, c]);
            } else {
                for (let r = rows - 1; r >= 0; r--) path.push([r, c]);
            }
        }
        cachedSnakePath = path;
        cachedSnakeRows = rows;
        cachedSnakeCols = cols;
    }
    return cachedSnakePath;
}

function hasFusionAvailable(grid) {
    const rows = grid.length;
    const cols = grid[0].length;
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const value = grid[r][c];
            if (!value) continue;
            if (r + 1 < rows && grid[r + 1][c] === value) return true;
            if (c + 1 < cols && grid[r][c + 1] === value) return true;
        }
    }
    return false;
}

function wouldEnableFusion(grid, r, c, value) {
    // Check if placing 'value' at (r, c) would create adjacent tiles with same value
    const rows = grid.length;
    const cols = grid[0].length;

    // Check all 4 directions for matching values
    const directions = [
        [r - 1, c], // up
        [r + 1, c], // down
        [r, c - 1], // left
        [r, c + 1]  // right
    ];

    for (const [nr, nc] of directions) {
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
            if (grid[nr][nc] === value) {
                return true;
            }
        }
    }

    return false;
}

function countPlacements(history) {
    if (!Array.isArray(history)) return 0;
    return history.reduce((acc, entry) => acc + (entry.action && entry.action.type === 'place' ? 1 : 0), 0);
}