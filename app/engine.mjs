/// <reference path="../types.d.ts" />

/**
 * Create a copy of the grid
 * @param {number[][]} grid - Grid to copy
 * @returns {number[][]} Deep copy of the grid
 */
function copyGrid(grid) {
    return grid.map(row => row.slice());
}

/**
 * Create an empty grid
 * @param {number} rows
 * @param {number} cols
 * @returns {number[][]}
 */
export function createEmptyGrid(rows, cols) {
    return Array.from({ length: rows }, () => Array(cols).fill(0));
}

/**
 * Add a tile at a specific position in a provided grid
 * @param {number[][]} grid
 * @param {number} r
 * @param {number} c
 * @param {number} value
 * @returns {boolean}
 */
export function addTileAt(grid, r, c, value) {
    if (value === 0) {
        grid[r][c] = 0;
        return true;
    }
    if (grid[r][c] !== 0) return false;
    grid[r][c] = value;
    return true;
}

/**
 * Rotate a grid clockwise by specified number of 90-degree turns
 * @param {number[][]} grid - Grid to rotate
 * @param {number} [times=1] - Number of 90-degree clockwise rotations
 * @returns {number[][]} Rotated grid
 */
export function rotate(grid, times = 1) {
    let result = copyGrid(grid);
    for (let turn = 0; turn < times; turn++) {
        const rows = result.length;
        const cols = result[0].length;
        const rotated = Array.from({ length: cols }, () => Array(rows).fill(0));
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                rotated[c][rows - 1 - r] = result[r][c];
            }
        }
        result = rotated;
    }
    return result;
}

/**
 * Move all tiles left and merge adjacent matching tiles
 * @param {number[][]} grid - Grid to process
 * @returns {MoveResult} Result containing new grid, movement info, and score
 */
export function moveLeftOnce(grid) {
    let moved = false;
    let mergedScore = 0;
    const rows = grid.length;
    const cols = grid[0].length;
    const out = Array.from({ length: rows }, () => Array(cols).fill(0));
    /** @type {TileMove[]} */
    const moves = [];
    /** @type {MergedDestination[]} */
    const mergedDestinations = [];

    for (let r = 0; r < rows; r++) {
        const entries = [];
        for (let c = 0; c < cols; c++) {
            const value = grid[r][c];
            if (value !== 0) entries.push({ c, value });
        }

        let destination = 0;
        for (let index = 0; index < entries.length;) {
            const current = entries[index];
            if (index + 1 < entries.length && entries[index + 1].value === current.value) {
                const mergeVal = current.value * 2;
                out[r][destination] = mergeVal;
                mergedScore += mergeVal;
                moves.push({ fromR: r, fromC: current.c, toR: r, toC: destination, value: current.value, merged: true, newValue: mergeVal });
                moves.push({ fromR: r, fromC: entries[index + 1].c, toR: r, toC: destination, value: entries[index + 1].value, merged: true, newValue: mergeVal });
                mergedDestinations.push({ r, c: destination, newValue: mergeVal });
                if (current.c !== destination || entries[index + 1].c !== destination) moved = true;
                index += 2;
                destination += 1;
            } else {
                out[r][destination] = current.value;
                moves.push({ fromR: r, fromC: current.c, toR: r, toC: destination, value: current.value, merged: false });
                if (current.c !== destination) moved = true;
                index += 1;
                destination += 1;
            }
        }
    }

    return { grid: out, moved, mergedScore, moves, mergedDestinations };
}

/**
 * Map movement direction to number of clockwise rotations needed
 * @param {Direction} direction - Movement direction
 * @returns {number} Number of rotations (0-3)
 */
export function rotatedForDirection(direction) {
    if (direction === 'left') return 0;
    if (direction === 'up') return 3;
    if (direction === 'right') return 2;
    if (direction === 'down') return 1;
    return 0;
}

/**
 * Rotate a coordinate clockwise by specified number of 90-degree turns
 * @param {number} r
 * @param {number} c
 * @param {number} startRows
 * @param {number} startCols
 * @param {number} [times=1]
 * @returns {[number, number]}
 */
function rotateCoord(r, c, startRows, startCols, times = 1) {
    let rr = r;
    let cc = c;
    let rows = startRows;
    let cols = startCols;
    for (let turn = 0; turn < times; turn++) {
        const nextR = cc;
        const nextC = rows - 1 - rr;
        rr = nextR;
        cc = nextC;
        const swap = rows;
        rows = cols;
        cols = swap;
    }
    return [rr, cc];
}

/**
 * Restore movement results to original orientation
 * @param {MoveResult} result - Result from moveLeftOnce
 * @param {number} rotatedTimes - Number of times the grid was rotated
 * @returns {MoveResult}
 */
export function restoreResults(result, rotatedTimes) {
    if (rotatedTimes === 0) return result;

    const inverse = (4 - rotatedTimes) % 4;
    const rotatedGrid = rotate(result.grid, inverse);
    const workingRows = result.grid.length;
    const workingCols = result.grid[0].length;

    /** @type {TileMove[]} */
    const rotatedMoves = result.moves.map(m => {
        const [fromR, fromC] = rotateCoord(m.fromR, m.fromC, workingRows, workingCols, inverse);
        const [toR, toC] = rotateCoord(m.toR, m.toC, workingRows, workingCols, inverse);
        return {
            fromR,
            fromC,
            toR,
            toC,
            value: m.value,
            merged: m.merged,
            newValue: m.newValue
        };
    });

    /** @type {MergedDestination[]} */
    const rotatedMergedDestinations = result.mergedDestinations.map(md => {
        const [row, col] = rotateCoord(md.r, md.c, workingRows, workingCols, inverse);
        return { r: row, c: col, newValue: md.newValue };
    });

    return {
        grid: rotatedGrid,
        moved: result.moved,
        mergedScore: result.mergedScore,
        moves: rotatedMoves,
        mergedDestinations: rotatedMergedDestinations
    };
}

/**
 * Simulates a single move in a given direction on the provided game state.
 * @param {Direction} direction
 * @param {GameState} state
 * @returns {MoveResult}
 */
export function simulateAMove(direction, state) {
    const rotatedTimes = rotatedForDirection(direction);
    const working = rotate(state.grid, rotatedTimes);
    const result = moveLeftOnce(working);
    return restoreResults(result, rotatedTimes);
}

/**
 * Simulates a game by applying a series of actions to an initial state.
 * @param {HistoryEntry[]} history
 * @param {GameState} initialState
 * @returns {GameState}
 */
export function simulateHistory(history, initialState) {
    const finalState = JSON.parse(JSON.stringify(initialState));
    for (let entry of history) {
        const action = entry.action;
        const nextTurn = entry.nextTurn;
        if (action.type === 'move') {
            const moveResult = simulateAMove(action.direction, finalState);
            finalState.grid = moveResult.grid;
            finalState.score += moveResult.mergedScore;
            finalState.turnNumber++;
        } else if (action.type === 'place') {
            finalState.grid[action.r][action.c] = action.value;
            finalState.turnNumber++;
        }
        finalState.turn = nextTurn;
    }
    finalState.history = JSON.parse(JSON.stringify(history));
    return finalState;
}