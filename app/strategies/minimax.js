import { simulateAMove } from '../utils.js';
import State from '../state.js';
import { defaultNetwork } from './nn.js';

/** @typedef {import('../utils.js')} */

const DIRECTIONS = /** @type {Direction[]} */ (['left', 'right', 'up', 'down']);

/**
 * Evaluate a game state using the neural network.
 * Returns a higher value for states that are better for the mover (Player 1).
 * Swap `defaultNetwork` for a trained network to improve play quality.
 * @param {GameState} state
 * @returns {number}
 */
export function evaluate(state) {
    return defaultNetwork.evaluate(state);
}

/**
 * Returns all valid placements for the placer (player 2).
 * @param {GameState} state
 * @returns {{ r: number, c: number, value: number }[]}
 */
function getPlacements(state) {
    const placements = [];
    const { rows, cols, tileValues } = State.config;
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (state.grid[r][c] === 0) {
                for (const value of tileValues) {
                    placements.push({ r, c, value });
                }
            }
        }
    }
    return placements;
}

/**
 * Apply a placement to a (deep-copied) state and return it.
 * @param {GameState} state
 * @param {{ r: number, c: number, value: number }} placement
 * @returns {GameState}
 */
function applyPlacement(state, placement) {
    const next = JSON.parse(JSON.stringify(state));
    next.grid[placement.r][placement.c] = placement.value;
    next.turn = 'move';
    next.turnNumber++;
    return next;
}

/**
 * Apply a move to a (deep-copied) state and return it.
 * @param {GameState} state
 * @param {Direction} direction
 * @returns {{ state: GameState, moved: boolean }}
 */
function applyMove(state, direction) {
    const result = simulateAMove(direction, state);
    if (!result.moved) return { state, moved: false };
    const next = JSON.parse(JSON.stringify(state));
    next.grid = result.grid;
    next.score += result.mergedScore;
    next.turn = 'place';
    next.turnNumber++;
    return { state: next, moved: true };
}

/**
 * Minimax algorithm.
 * - maximizingPlayer = true  → mover's turn (choose direction that maximises score)
 * - maximizingPlayer = false → placer's turn (choose placement that minimises score)
 * @param {GameState} state
 * @param {number} depth
 * @param {boolean} maximizingPlayer
 * @returns {number}
 */
export function minimax(state, depth, maximizingPlayer) {
    if (depth === 0) return evaluate(state);

    if (maximizingPlayer) {
        // Mover: maximise
        let best = -Infinity;
        let anyMoved = false;
        for (const dir of DIRECTIONS) {
            const { state: next, moved } = applyMove(state, dir);
            if (!moved) continue;
            anyMoved = true;
            const val = minimax(next, depth - 1, false);
            if (val > best) best = val;
        }
        return anyMoved ? best : evaluate(state);
    } else {
        // Placer: minimise
        const placements = getPlacements(state);
        if (placements.length === 0) return evaluate(state);
        let best = Infinity;
        for (const placement of placements) {
            const next = applyPlacement(state, placement);
            const val = minimax(next, depth - 1, true);
            if (val < best) best = val;
        }
        return best;
    }
}

/**
 * Pick the best direction for the mover using minimax.
 * @param {GameState} state
 * @param {number} depth  Search depth (in half-turns: 1 = look one mover turn ahead).
 * @returns {{ direction: Direction, score: number } | null}
 */
export function bestMove(state, depth) {
    let bestDir = null;
    let bestScore = -Infinity;
    for (const dir of DIRECTIONS) {
        const { state: next, moved } = applyMove(state, dir);
        if (!moved) continue;
        const score = minimax(next, depth - 1, false);
        if (score > bestScore) {
            bestScore = score;
            bestDir = dir;
        }
    }
    return bestDir ? { direction: bestDir, score: bestScore } : null;
}

/**
 * Pick the best placement for the placer using minimax.
 * @param {GameState} state
 * @param {number} depth  Search depth.
 * @returns {{ r: number, c: number, value: number, score: number } | null}
 */
export function bestPlacement(state, depth) {
    const placements = getPlacements(state);
    if (placements.length === 0) return null;
    let bestP = null;
    let bestScore = Infinity;
    for (const placement of placements) {
        const next = applyPlacement(state, placement);
        const score = minimax(next, depth - 1, true);
        if (score < bestScore) {
            bestScore = score;
            bestP = placement;
        }
    }
    return bestP ? { ...bestP, score: bestScore } : null;
}
