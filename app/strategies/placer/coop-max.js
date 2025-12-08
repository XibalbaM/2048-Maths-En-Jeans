import State from "../../state.js";

/**
 * @type {PlayerTwoStrategy}
 */
export default {
    name: "Coop Max Pass",
    fun(state) {
        const grid = state.grid;
        const fourValue = State.config.tileValues[1] ?? 4;

        const placementsDone = countPlacements(state.history);
        const initialPlacements = [
            { r: 0, c: 0, value: fourValue },
            { r: Math.min(1, State.config.size - 1), c: 0, value: fourValue },
        ];

        if (placementsDone < initialPlacements.length) {
            const target = initialPlacements[placementsDone];
            if (grid[target.r] && grid[target.r][target.c] === 0) {
                return { type: 'place', r: target.r, c: target.c, value: target.value };
            }
        }

        if (hasFusionAvailable(grid)) {
            return null;
        }

        // Find empty cells adjacent to filled cells
        const adjacentEmpty = findAdjacentEmptyCells(grid);
        if (adjacentEmpty.length === 0) {
            return null;
        }

        // Use snake path to determine which adjacent empty cell to fill
        const snakePath = getSnakePath(State.config.size);
        if (!snakePath.length) return null;

        // Find the first adjacent empty cell in snake path order
        const snakePathSet = new Set(snakePath.map(([r, c]) => `${r},${c}`));
        const snakeOrder = adjacentEmpty
            .map(([r, c]) => ({
                r, c,
                snakeIdx: snakePath.findIndex(([sr, sc]) => sr === r && sc === c)
            }))
            .filter(cell => cell.snakeIdx !== -1)
            .sort((a, b) => a.snakeIdx - b.snakeIdx);

        if (snakeOrder.length === 0) {
            return null;
        }

        const [r, c] = [snakeOrder[0].r, snakeOrder[0].c];
        return { type: 'place', r, c, value: fourValue };
    }
}

let cachedSnakeSize = null;
let cachedSnakePath = [];

function getSnakePath(size) {
    if (size <= 0) return [];
    if (cachedSnakeSize !== size) {
        const path = [];
        for (let c = 0; c < size; c++) {
            if (c % 2 === 0) {
                for (let r = 0; r < size; r++) path.push([r, c]);
            } else {
                for (let r = size - 1; r >= 0; r--) path.push([r, c]);
            }
        }
        cachedSnakePath = path;
        cachedSnakeSize = size;
    }
    return cachedSnakePath;
}

function hasFusionAvailable(grid) {
    const size = grid.length;
    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            const value = grid[r][c];
            if (!value) continue;
            if (r + 1 < size && grid[r + 1][c] === value) return true;
            if (c + 1 < size && grid[r][c + 1] === value) return true;
        }
    }
    return false;
}

function findFirstEmptyIndex(grid, path) {
    for (let i = 0; i < path.length; i++) {
        const [r, c] = path[i];
        if (grid[r] && grid[r][c] === 0) return i;
    }
    return -1;
}

function findLastFilledIndex(grid, path) {
    for (let i = path.length - 1; i >= 0; i--) {
        const [r, c] = path[i];
        if (grid[r] && grid[r][c]) return i;
    }
    return -1;
}

function findNextEmptyIndexFrom(grid, path, startIdx) {
    if (startIdx < 0) startIdx = 0;
    for (let i = startIdx; i < path.length; i++) {
        const [r, c] = path[i];
        if (grid[r] && grid[r][c] === 0) return i;
    }
    return path.length;
}

function findAdjacentEmptyCells(grid) {
    const size = grid.length;
    const adjacent = new Set();
    
    // For each filled cell, add adjacent empty cells
    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            if (grid[r][c] !== 0) {
                // Check all 4 directions
                if (r > 0 && grid[r - 1][c] === 0) adjacent.add(`${r - 1},${c}`);
                if (r < size - 1 && grid[r + 1][c] === 0) adjacent.add(`${r + 1},${c}`);
                if (c > 0 && grid[r][c - 1] === 0) adjacent.add(`${r},${c - 1}`);
                if (c < size - 1 && grid[r][c + 1] === 0) adjacent.add(`${r},${c + 1}`);
            }
        }
    }
    
    return Array.from(adjacent).map(key => {
        const [r, c] = key.split(',').map(Number);
        return [r, c];
    });
}

function countPlacements(history) {
    if (!Array.isArray(history)) return 0;
    return history.reduce((acc, entry) => acc + (entry.action && entry.action.type === 'place' ? 1 : 0), 0);
}