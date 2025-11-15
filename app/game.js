/// <reference path="../types.d.ts" />
import State from './state.js';
import DataStore from './data.js';
import { promptSecondPlayer } from './interfaces/views/second_player.js';
import { animateMoves } from './interfaces/animations.js';
import { render } from './interfaces/rendering.js';

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
    State.game.grid = Array.from({ length: State.config.size }, () => Array(State.config.size).fill(0));
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
function rotate(g, times = 1) {
    let res = copyGrid(g);
    for (let t = 0; t < times; t++) {
        const tmp = Array.from({ length: State.config.size }, () => Array(State.config.size).fill(0));
        for (let r = 0; r < State.config.size; r++) for (let c = 0; c < State.config.size; c++) tmp[c][State.config.size - 1 - r] = res[r][c];
        res = tmp;
    }
    return res;
}

/**
 * Move all tiles left and merge adjacent matching tiles
 * @param {number[][]} g - Grid to process
 * @returns {MoveResult} Result containing new grid, movement info, and score
 */
function moveLeftOnce(g) {
    // Re-implementation to also produce movement mapping for animations
    let moved = false; let mergedScore = 0;
    const out = Array.from({ length: State.config.size }, () => Array(State.config.size).fill(0));
    /** @type {TileMove[]} */
    const moves = [];
    /** @type {MergedDestination[]} */
    const mergedDestinations = [];

    for (let r = 0; r < State.config.size; r++) {
        // collect non-zero tiles with original columns
        const entries = [];
        for (let c = 0; c < State.config.size; c++) {
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
function rotatedForDirection(direction) {
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
 * @param {number} [times=1] - Number of 90-degree clockwise rotations
 * @returns {[number, number]} New [row, column] coordinates
 */
function rotateCoord(r, c, times = 1) {
    let rr = r, cc = c;
    for (let t = 0; t < times; t++) {
        const nrr = cc;
        const ncc = State.config.size - 1 - rr;
        rr = nrr; cc = ncc;
    }
    return [rr, cc];
}

/**
 * Move tiles in the specified direction with animation
 * @param {Direction} direction - Direction to move tiles
 * @returns {Promise<boolean>} True if movement occurred, false otherwise
 */
export async function move(direction) {
    // prevent moving while player 2 is placing
    if (State.game.turn === 'place' || State.tempStorage.isProcessing) return false;
    State.tempStorage.isProcessing = true;
    if (State.config.firstPlayerStrategy) {
        const choosenMove = State.config.firstPlayerStrategy.fun(State.game);
        if (!choosenMove) {
            alert("Le joueur 1 n'a pas pu choisir de mouvement valide.");
            State.tempStorage.isProcessing = false;
            return false;
        }
        direction = choosenMove.direction;
    }
    const rotatedTimes = rotatedForDirection(direction);
    const prev = State.game.grid;
    let working = rotate(prev, rotatedTimes);
    const result = moveLeftOnce(working);
    if (!result.moved) {
        State.tempStorage.isProcessing = false;
        return false;
    }
    const rotatedResults = restoreResults(result, rotatedTimes);
    // animate movements in original orientation before committing state
    await animateMoves(rotatedResults.moves, rotatedResults.mergedDestinations);
    // commit new state
    State.game.grid = rotatedResults.grid;
    State.game.score += rotatedResults.mergedScore;
    State.game.turn = 'place';
    State.game.history.push({ type: 'move', direction });
    State.game.turnNumber++;
    DataStore.saveGame();
    render();

    await second_player();
    State.tempStorage.isProcessing = false;
    return true;
}

async function second_player(count = 1) {
    if (State.game.turn !== 'place') return;
    if (!State.config.secondPlayerStrategy) {
        let history = await promptSecondPlayer(count);
        State.game.history = [...State.game.history, ...history];
        State.game.turnNumber += count;
    } else {
        for (let i = 0; i < count; i++) {
            let move = applySecondPlayerStrategy();
            if (move) {
                State.game.history = [...State.game.history, move];
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
function restoreResults(result, rotatedTimes) {
    if (rotatedTimes === 0) return result;
    // rotate moves and mergedDestinations back to original orientation
    const inv = (4 - rotatedTimes) % 4;
    /** @Type number[][] */
    const rotatedGrid = rotate(result.grid, inv);
    /** @type {TileMove[]} */
    const rotatedMoves = result.moves.map(m => {
        const [fromR, fromC] = rotateCoord(m.fromR, m.fromC, inv);
        const [toR, toC] = rotateCoord(m.toR, m.toC, inv);
        return {
            fromR, fromC, toR, toC,
            value: m.value,
            merged: m.merged,
            newValue: m.newValue
        };
    });
    /** @type {MergedDestination[]} */
    const rotatedMergedDestinations = result.mergedDestinations.map(md => {
        const [rr, cc] = rotateCoord(md.r, md.c, inv);
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
    await second_player(State.config.initialPlacementsCount);
}

function applySecondPlayerStrategy() {
    if (State.config.secondPlayerStrategy) {
        const placement = State.config.secondPlayerStrategy.fun(State.game);
        if (!placement) {
            alert("Le joueur 2 n'a pas pu choisir de placement valide.");
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
    document.documentElement.style.setProperty('--size', String(State.config.size));
    // if empty grid and second player enabled, force initial placements
    const isEmpty = State.game.grid.every(row => row.every(v => v === 0));
    if (isEmpty) {
        newGame();
    } else {
        render();
        second_player();
    }
}

init();