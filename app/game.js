/// <reference path="../types.d.ts" />
import State from './state.js';
import DataStore from './data.js';
import { promptSecondPlayer } from './interfaces/views/second_player.js';
import { animateMoves } from './interfaces/animations.js';
import { render } from './interfaces/rendering.js';
import { simulate } from './utils.js';

export function isSpectatorModeEnabled() {
    return Boolean(State.config.firstPlayerStrategy && State.config.secondPlayerStrategy);
}

/**
 * Create a copy of the grid
 * @param {number[][]} g - Grid to copy
 * @returns {number[][]} Deep copy of the grid
 */
function copyGrid(g) { return g.map(row => row.slice()); }

/**
 * Reset the grid to empty state
 * @returns {void}
 */
function resetGrid() {
    State.game.grid = Array.from({ length: State.config.rows }, () => Array(State.config.cols).fill(0));
}

// Persistence helpers moved to app/data.js (global DataStore)

/**
 * Add a tile at a specific position
 * @param {number} r - Row index
 * @param {number} c - Column index
 * @param {number} value - Tile value
 * @returns {boolean} True if tile was added, false if cell was occupied
 */
export function addTileAt(r, c, value) {
    if (State.game.grid[r][c] !== 0) return false;
    State.game.grid[r][c] = value;
    return true;
}

/**
 * Rotate a grid clockwise by specified number of 90-degree turns
 * @param {number[][]} g - Grid to rotate
 * @param {number} [times=1] - Number of 90-degree clockwise rotations
 * @returns {number[][]} Rotated grid
 */
export function rotate(g, times = 1) {
    let res = copyGrid(g);
    for (let t = 0; t < times; t++) {
        const rows = res.length;
        const cols = res[0].length;
        const tmp = Array.from({ length: cols }, () => Array(rows).fill(0));
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) tmp[c][rows - 1 - r] = res[r][c];
        res = tmp;
    }
    return res;
}

/**
 * Move all tiles left and merge adjacent matching tiles
 * @param {number[][]} g - Grid to process
 * @returns {MoveResult} Result containing new grid, movement info, and score
 */
export function moveLeftOnce(g) {
    // Re-implementation to also produce movement mapping for animations
    let moved = false; let mergedScore = 0;
    const rows = g.length;
    const cols = g[0].length;
    const out = Array.from({ length: rows }, () => Array(cols).fill(0));
    /** @type {TileMove[]} */
    const moves = [];
    /** @type {MergedDestination[]} */
    const mergedDestinations = [];

    for (let r = 0; r < rows; r++) {
        // collect non-zero tiles with original columns
        const entries = [];
        for (let c = 0; c < cols; c++) {
            const v = g[r][c];
            if (v !== 0) entries.push({ c, val: v });
        }
        let pos = 0; // destination column
        for (let i = 0; i < entries.length;) {
            const cur = entries[i];
            if (i + 1 < entries.length && entries[i + 1].val === cur.val) {
                const mergeVal = cur.val * 2;
                out[r][pos] = mergeVal;
                mergedScore += mergeVal;
                // two tiles move/merge into the same destination
                moves.push({ fromR: r, fromC: cur.c, toR: r, toC: pos, value: cur.val, merged: true, newValue: mergeVal });
                moves.push({ fromR: r, fromC: entries[i + 1].c, toR: r, toC: pos, value: entries[i + 1].val, merged: true, newValue: mergeVal });
                mergedDestinations.push({ r, c: pos, newValue: mergeVal });
                if (cur.c !== pos || entries[i + 1].c !== pos) moved = true;
                i += 2; pos += 1;
            } else {
                out[r][pos] = cur.val;
                moves.push({ fromR: r, fromC: cur.c, toR: r, toC: pos, value: cur.val, merged: false });
                if (cur.c !== pos) moved = true;
                i += 1; pos += 1;
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
    // left:0, up:3, right:2, down:1  (mapping chosen so that moveLeftOnce handles left)
    if (direction === 'left') return 0;
    if (direction === 'up') return 3;
    if (direction === 'right') return 2;
    if (direction === 'down') return 1;
    return 0;
}

/**
 * Rotate a coordinate clockwise by specified number of 90-degree turns
 * @param {number} r - Row coordinate
 * @param {number} c - Column coordinate
 * @param {number} startRows - Initial number of rows
 * @param {number} startCols - Initial number of columns
 * @param {number} [times=1] - Number of 90-degree clockwise rotations
 * @returns {[number, number]} New [row, column] coordinates
 */
function rotateCoord(r, c, startRows, startCols, times = 1) {
    let rr = r, cc = c, curRows = startRows, curCols = startCols;
    for (let t = 0; t < times; t++) {
        const nrr = cc;
        const ncc = curRows - 1 - rr;
        rr = nrr; cc = ncc;
        // swap dims
        const tmp = curRows; curRows = curCols; curCols = tmp;
    }
    return [rr, cc];
}


export async function goBackOneTurn() {
    if (State.game.turnNumber === 0 || State.tempStorage.isProcessing) return;
    State.tempStorage.isProcessing = true;
    // revert to previous state by simulating history up to turnNumber - 1
    const targetTurn = State.game.turnNumber - (State.config.secondPlayerStrategy ? 2 : 1);
    const initialState = State.defaultGameState();
    const newState = simulate(State.game.history.slice(0, targetTurn), initialState);
    State.game.grid = newState.grid;
    State.game.score = newState.score;
    State.game.turnNumber = newState.turnNumber;
    State.game.turn = newState.turn;
    State.game.history = State.game.history.slice(0, targetTurn);
    DataStore.saveGame();
    render();
    if (State.game.turn === 'place') {
        await second_player();
    }
    State.tempStorage.isProcessing = false;
}

/**
 * Move tiles in the specified direction with animation
 * @param {Direction} direction - Direction to move tiles
 * @returns {Promise<boolean>} True if movement occurred, false otherwise
 */
export async function turn(direction) {
    if (isSpectatorModeEnabled()) return false;
    await move(direction);
    await second_player();
    State.tempStorage.isProcessing = false;
    return true;
}
async function move(direction) {
    // prevent moving while player 2 is placing
    if (State.game.turn === 'place' || State.tempStorage.isProcessing) return false;
    State.tempStorage.isProcessing = true;
    if (State.config.firstPlayerStrategy) {
        const choosenMove = State.config.firstPlayerStrategy.fun(State.game);
        if (!choosenMove) {
            State.game.turn = 'place';
            return false;
        }
        direction = choosenMove.direction;
    }
    if (direction === null) {
        State.game.turn = 'place';
        return true;
    }
    const rotatedTimes = rotatedForDirection(direction);
    const prev = State.game.grid;
    let working = rotate(prev, rotatedTimes);
    const result = moveLeftOnce(working);
    if (!result.moved) {
        return false;
    }
    const rotatedResults = restoreResults(result, rotatedTimes);
    // animate movements in original orientation before committing state
    await animateMoves(rotatedResults.moves, rotatedResults.mergedDestinations);
    // commit new state
    State.game.grid = rotatedResults.grid;
    State.game.score += rotatedResults.mergedScore;
    State.game.turn = 'place';
    State.game.history.push({ action: { type: 'move', direction }, nextTurn: 'place' });
    State.game.turnNumber++;
    DataStore.saveGame();
    render();
}

async function second_player(count = 1, options = {}) {
    const { force = false } = options;
    if (isSpectatorModeEnabled() && !force) return;
    if (State.game.turn !== 'place') return;
    if (!State.config.secondPlayerStrategy) {
        let history = await promptSecondPlayer(count);
        let mappedHistory = history.map(entry => ({ action: entry, nextTurn: 'place' }));
        //replace last 'nextTurn' of the last entry to 'move'
        if (mappedHistory.length > 0) {
            mappedHistory[mappedHistory.length - 1].nextTurn = 'move';
        }
        // @ts-ignore
        State.game.history = [...State.game.history, ...mappedHistory];
        State.game.turnNumber += history.length;
    } else {
        for (let i = 0; i < count; i++) {
            let move = applySecondPlayerStrategy();
            let turnType = (i === count - 1) ? 'move' : 'place';
            if (move) {
                // @ts-ignore
                State.game.history = [...State.game.history, { action: move, nextTurn: turnType }];
                State.game.turnNumber++;
            }
        }
    }
    State.game.turn = 'move';
    DataStore.saveGame();
    render();
}

/**
 * Restore movement results to original orientation
 * @param {MoveResult} result - Result from moveLeftOnce
 * @param {number} rotatedTimes - Number of times the grid was rotated
 * @returns {MoveResult} Result with moves and mergedDestinations in original orientation
 */
export function restoreResults(result, rotatedTimes) {
    if (rotatedTimes === 0) return result;
    // rotate moves and mergedDestinations back to original orientation
    const inv = (4 - rotatedTimes) % 4;
    /** @Type number[][] */
    const rotatedGrid = rotate(result.grid, inv);

    // For rotateCoord, we need the dimensions at the start of the inverse rotation.
    // result.grid is the grid AFTER moveLeftOnce (which operates on 'working' grid).
    // The working grid has dimensions relative to how many times we rotated.
    // However, rotateCoord simulates rotation step by step.
    // We want to transform from (r, c) in 'working' grid to (r, c) in original 'prev' grid.
    // 'working' grid dimensions:
    const workingRows = result.grid.length;
    const workingCols = result.grid[0].length;

    /** @type {TileMove[]} */
    const rotatedMoves = result.moves.map(m => {
        const [fromR, fromC] = rotateCoord(m.fromR, m.fromC, workingRows, workingCols, inv);
        const [toR, toC] = rotateCoord(m.toR, m.toC, workingRows, workingCols, inv);
        return {
            fromR, fromC, toR, toC,
            value: m.value,
            merged: m.merged,
            newValue: m.newValue
        };
    });
    /** @type {MergedDestination[]} */
    const rotatedMergedDestinations = result.mergedDestinations.map(md => {
        const [rr, cc] = rotateCoord(md.r, md.c, workingRows, workingCols, inv);
        return { r: rr, c: cc, newValue: md.newValue };
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
 * Start a new game with current configuration
 * @returns {Promise<void>}
 */
export async function newGame() {
    resetGrid(); State.resetGame();
    DataStore.saveGame();
    render();
    State.game.turn = 'place';
    await second_player(State.config.initialPlacementsCount, { force: true });
}

function applySecondPlayerStrategy() {
    if (State.config.secondPlayerStrategy) {
        const placement = State.config.secondPlayerStrategy.fun(State.game);
        if (!placement) {
            return null;
        }
        addTileAt(placement.r, placement.c, placement.value);
        return placement;
    }
}

/**
 * Initialize the game on page load
 * @returns {void}
 */
function init() {
    document.documentElement.style.setProperty('--rows', String(State.config.rows));
    document.documentElement.style.setProperty('--cols', String(State.config.cols));
    // if empty grid and second player enabled, force initial placements
    const isEmpty = State.game.grid.every(row => row.every(v => v === 0));
    if (isEmpty) {
        newGame();
    } else {
        render();
        second_player();
    }
}

async function performStrategyMoveStep() {
    const strategy = State.config.firstPlayerStrategy;
    if (!strategy) return false;
    const choosenMove = strategy.fun(State.game);
    if (!choosenMove) {
        State.game.turn = 'place';
        render();
        return false;
    }
    const direction = choosenMove.direction;
    const rotatedTimes = rotatedForDirection(direction);
    const working = rotate(State.game.grid, rotatedTimes);
    const result = moveLeftOnce(working);
    if (!result.moved) {
        State.game.turn = 'place';
        render();
        return false;
    }
    const rotatedResults = restoreResults(result, rotatedTimes);
    await animateMoves(rotatedResults.moves, rotatedResults.mergedDestinations);
    State.game.grid = rotatedResults.grid;
    State.game.score += rotatedResults.mergedScore;
    State.game.turn = 'place';
    State.game.history.push({ action: { type: 'move', direction }, nextTurn: 'place' });
    State.game.turnNumber++;
    DataStore.saveGame();
    render();
    return true;
}

function performStrategyPlacementStep() {
    const placement = applySecondPlayerStrategy();
    State.game.turn = 'move';
    if (placement) {
        // @ts-ignore
        State.game.history = [...State.game.history, { action: placement, nextTurn: 'move' }];
        State.game.turnNumber++;
    }
    DataStore.saveGame();
    render();
    return Boolean(placement);
}

export async function spectatorStep() {
    if (!isSpectatorModeEnabled()) return turn(null);
    if (State.tempStorage.isProcessing) return false;
    State.tempStorage.isProcessing = true;
    let result = false;
    try {
        if (State.game.turn === 'move') {
            result = await performStrategyMoveStep();
        } else if (State.game.turn === 'place') {
            result = performStrategyPlacementStep();
        }
    } finally {
        State.tempStorage.isProcessing = false;
    }
    return result;
}

init();