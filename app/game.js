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
    State.game.grid = Array.from({ length: State.config.SIZE }, () => Array(State.config.SIZE).fill(0));
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
 * Add a random tile (fallback when SECOND_PLAYER_ENABLED=false)
 * @returns {{r: number, c: number, value: number} | false} Tile info or false if no empty cells
 */
function addRandomTile() {
    const empties = [];
    for (let r = 0; r < State.config.SIZE; r++) for (let c = 0; c < State.config.SIZE; c++) if (State.game.grid[r][c] === 0) empties.push([r, c]);
    if (empties.length === 0) return false;
    const [r, c] = empties[Math.floor(Math.random() * empties.length)];
    const v = Math.random() < 0.9 ? State.config.TILE_VALUES[0] : (State.config.TILE_VALUES[1] || State.config.TILE_VALUES[0]);
    State.game.grid[r][c] = v;
    return { r, c, value: v };
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
        const tmp = Array.from({ length: State.config.SIZE }, () => Array(State.config.SIZE).fill(0));
        for (let r = 0; r < State.config.SIZE; r++) for (let c = 0; c < State.config.SIZE; c++) tmp[c][State.config.SIZE - 1 - r] = res[r][c];
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
    const out = Array.from({ length: State.config.SIZE }, () => Array(State.config.SIZE).fill(0));
    /** @type {TileMove[]} */
    const moves = [];
    /** @type {MergedDestination[]} */
    const mergedDestinations = [];

    for (let r = 0; r < State.config.SIZE; r++) {
        // collect non-zero tiles with original columns
        const entries = [];
        for (let c = 0; c < State.config.SIZE; c++) {
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
 * Check if any moves are possible on the grid
 * @param {number[][]} g - Grid to check
 * @returns {boolean} True if at least one move is possible
 */
function canMove(g) {
    for (let r = 0; r < State.config.SIZE; r++) for (let c = 0; c < State.config.SIZE; c++) {
        if (g[r][c] === 0) return true;
        if (c + 1 < State.config.SIZE && g[r][c] === g[r][c + 1]) return true;
        if (r + 1 < State.config.SIZE && g[r][c] === g[r + 1][c]) return true;
    }
    return false;
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
        const ncc = State.config.SIZE - 1 - rr;
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
    if (State.game.turn === 'place') return false;
    const rotatedTimes = rotatedForDirection(direction);
    const prev = State.game.grid;
    let working = rotate(prev, rotatedTimes);
    const result = moveLeftOnce(working);
    if (!result.moved) return false;
    const rotatedResults = restoreResults(result, rotatedTimes);
    // animate movements in original orientation before committing state
    await animateMoves(rotatedResults.moves, rotatedResults.mergedDestinations);
    // commit new state
    State.game.grid = rotatedResults.grid;
    State.game.score += rotatedResults.mergedScore;
    DataStore.saveGame();
    render();

    await second_player();
    return true;
}

async function second_player() {
    if (State.config.SECOND_PLAYER_ENABLED) {
        // switch to placement turn and await player 2
        await promptSecondPlayer(1);
    } else {
        addRandomTile();
    }
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
    if (State.config.SECOND_PLAYER_ENABLED) {
        await promptSecondPlayer(State.config.INITIAL_PLACEMENTS);
    } else {
        addRandomTile(); addRandomTile();
    }
    DataStore.saveGame(); render();
}

/**
 * Initialize the game on page load
 * @returns {void}
 */
function init() {
    document.documentElement.style.setProperty('--size', String(State.config.SIZE));
    render();
    // if empty grid and second player enabled, force initial placements
    const isEmpty = State.game.grid.every(row => row.every(v => v === 0));
    if (isEmpty) {
        newGame();
    }
}

init();