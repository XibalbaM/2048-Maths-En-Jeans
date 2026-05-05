import { simulateAMove } from '../utils.js';
import State from '../state.js';

/** @typedef {import('../utils.js')} */

const DIRECTIONS = /** @type {Direction[]} */ (['left', 'right', 'up', 'down']);

const TT_EXACT = 0;

/** @type {Map<string, { depth: number, value: number, bound: number }>} */
const transpositionTable = new Map();
/** @type {Map<string, number>} */
const evalCache = new Map();

const TRANS_TABLE_LIMIT = 300000;
const EVAL_CACHE_LIMIT = 300000;

/**
 * Evaluate a game state using a single value model.
 * Higher is better for both players in cooperative mode.
 * @param {GameState} state
 * @returns {number}
 */
export function evaluate(state, model) {
    return model.evaluate(state);
}

/**
 * @param {number[][]} grid
 * @returns {number[][]}
 */
function cloneGrid(grid) {
    return grid.map(row => row.slice());
}

/**
 * @param {GameState} state
 * @returns {string}
 */
function stateKey(state) {
    const rows = state.grid.length;
    const cols = rows > 0 ? state.grid[0].length : 0;
    let key = `${state.turn === 'move' ? 'm' : 'p'}|${state.score}|${state.turnNumber}|`;
    for (let r = 0; r < rows; r++) {
        const row = state.grid[r];
        for (let c = 0; c < cols; c++) {
            key += `${row[c]},`;
        }
    }
    return key;
}

/**
 * @param {GameState} state
 * @returns {number}
 */
function evaluateCached(state, model) {
    const key = stateKey(state);
    const cached = evalCache.get(key);
    if (cached !== undefined) return cached;

    const value = evaluate(state, model);
    if (evalCache.size >= EVAL_CACHE_LIMIT) evalCache.clear();
    evalCache.set(key, value);
    return value;
}

/**
 * @param {GameState} state
 * @returns {boolean}
 */
function hasLegalMove(state) {
    for (const direction of DIRECTIONS) {
        const result = simulateAMove(direction, state);
        if (result.moved) return true;
    }
    return false;
}

/**
 * @param {GameState} state
 * @returns {boolean}
 */
function hasLegalPlacement(state) {
    const { rows, cols, tileValues } = State.config;
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (state.grid[r][c] !== 0) continue;
            return tileValues.length > 0;
        }
    }
    return false;
}

/**
 * @param {GameState} state
 * @returns {boolean}
 */
function isTerminalState(state) {
    if (state.turn === 'move') return !hasLegalMove(state);
    return !hasLegalPlacement(state);
}

/**
 * Progressive placement width: reduce branching on deep levels to make depth-10 practical.
 * @param {number} depth
 * @param {number} totalPlacements
 * @returns {number}
 */
function placementLimit(depth, totalPlacements) {
    if (depth >= 9) return Math.min(3, totalPlacements);
    if (depth >= 7) return Math.min(4, totalPlacements);
    if (depth >= 5) return Math.min(6, totalPlacements);
    if (depth >= 3) return Math.min(8, totalPlacements);
    return totalPlacements;
}

/**
 * Bias placement ordering toward disrupting local mobility: center + crowded neighbors first.
 * @param {GameState} state
 * @param {{ r: number, c: number, value: number }} placement
 * @returns {number}
 */
function placementOrderScore(state, placement) {
    const { rows, cols } = State.config;
    const centerR = (rows - 1) / 2;
    const centerC = (cols - 1) / 2;
    const dr = Math.abs(placement.r - centerR);
    const dc = Math.abs(placement.c - centerC);
    const centerPenalty = dr + dc;

    let occupiedNeighbors = 0;
    if (placement.r > 0 && state.grid[placement.r - 1][placement.c] !== 0) occupiedNeighbors++;
    if (placement.r + 1 < rows && state.grid[placement.r + 1][placement.c] !== 0) occupiedNeighbors++;
    if (placement.c > 0 && state.grid[placement.r][placement.c - 1] !== 0) occupiedNeighbors++;
    if (placement.c + 1 < cols && state.grid[placement.r][placement.c + 1] !== 0) occupiedNeighbors++;

    return occupiedNeighbors * 10 + placement.value - centerPenalty;
}

/**
 * @param {GameState} state
 * @param {number} depth
 * @returns {{ placement: { r: number, c: number, value: number }, heuristic: number }[]}
 */
function getCandidatePlacements(state, depth) {
    const { rows, cols, tileValues } = State.config;
    //const limitedValues = depth >= 7
    //    ? [Math.max(...tileValues)]
    //    : tileValues;

    /** @type {{ placement: { r: number, c: number, value: number }, heuristic: number }[]} */
    const placements = [];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (state.grid[r][c] !== 0) continue;
            for (const value of [4]) {
                const placement = { r, c, value };
                placements.push({
                    placement,
                    heuristic: placementOrderScore(state, placement)
                });
            }
        }
    }

    if (placements.length <= 1) return placements;
    placements.sort((a, b) => b.heuristic - a.heuristic);
    return placements.slice(0, placementLimit(depth, placements.length));
}

/**
 * Apply a placement to a (deep-copied) state and return it.
 * @param {GameState} state
 * @param {{ r: number, c: number, value: number }} placement
 * @returns {GameState}
 */
function applyPlacement(state, placement) {
    const next = {
        grid: cloneGrid(state.grid),
        score: state.score,
        turn: /** @type {TurnType} */ ('move'),
        history: state.history,
        turnNumber: state.turnNumber + 1,
    };
    next.grid[placement.r][placement.c] = placement.value;
    return next;
}

/**
 * Apply a move to a (deep-copied) state and return it.
 * @param {GameState} state
 * @param {Direction} direction
 * @returns {{ state: GameState, moved: boolean, mergedScore: number }}
 */
function applyMove(state, direction) {
    const result = simulateAMove(direction, state);
    if (!result.moved) return { state, moved: false, mergedScore: 0 };
    const next = {
        grid: result.grid,
        score: state.score + result.mergedScore,
        turn: /** @type {TurnType} */ ('place'),
        history: state.history,
        turnNumber: state.turnNumber + 1,
    };
    return { state: next, moved: true, mergedScore: result.mergedScore };
}

/**
 * Cooperative search algorithm.
 * The `maximizingPlayer` parameter is kept for compatibility but ignored.
 * Both mover and placer maximize the same scalar evaluation.
 * @param {GameState} state
 * @param {number} depth
 * @param {boolean} maximizingPlayer
 * @returns {number}
 */
export function minimax(state, depth, maximizingPlayer, model) {
    void maximizingPlayer;
    return cooperativeSearch(state, depth, model);
}

/**
 * Cooperative max-max search with transposition table.
 * @param {GameState} state
 * @param {number} depth
 * @returns {number}
 */
function cooperativeSearch(state, depth, model) {
    if (isTerminalState(state)) return 0;
    if (depth <= 0) return evaluateCached(state, model);

    const ttKey = `${depth}|${stateKey(state)}`;
    const tt = transpositionTable.get(ttKey);
    if (tt && tt.depth >= depth) {
        return tt.value;
    }

    let best = -Infinity;
    if (state.turn === 'move') {

        /** @type {{ next: GameState, heuristic: number }[]} */
        const orderedMoves = [];
        for (const dir of DIRECTIONS) {
            const { state: next, moved, mergedScore } = applyMove(state, dir);
            if (!moved) continue;
            orderedMoves.push({ next, heuristic: mergedScore });
        }

        if (orderedMoves.length === 0) return evaluateCached(state, model);

        orderedMoves.sort((a, b) => b.heuristic - a.heuristic);
        for (const move of orderedMoves) {
            const value = cooperativeSearch(move.next, depth - 1, model);
            if (value > best) best = value;
        }
    } else {
        const placements = getCandidatePlacements(state, depth);
        if (placements.length === 0) return evaluateCached(state, model);

        for (let i = 0; i < placements.length; i++) {
            const placement = placements[i].placement;
            const next = applyPlacement(state, placement);
            const value = cooperativeSearch(next, depth - 1, model);
            if (value > best) best = value;
        }
    }

    if (transpositionTable.size >= TRANS_TABLE_LIMIT) transpositionTable.clear();
    transpositionTable.set(ttKey, { depth, value: best, bound: TT_EXACT });
    return best;
}

/**
 * Pick the best direction for the mover using minimax.
 * @param {GameState} state
 * @param {number} depth  Search depth (in half-turns: 1 = look one mover turn ahead).
 * @returns {{ direction: Direction, score: number } | null}
 */
export function bestMove(state, depth, model) {
    if (transpositionTable.size > 0) transpositionTable.clear();
    if (evalCache.size > 0) evalCache.clear();

    let bestDir = null;
    let bestScore = -Infinity;

    /** @type {{ direction: Direction, next: GameState, heuristic: number }[]} */
    const candidates = [];
    for (const dir of DIRECTIONS) {
        const { state: next, moved, mergedScore } = applyMove(state, dir);
        if (!moved) continue;
        candidates.push({ direction: dir, next, heuristic: mergedScore });
    }

    candidates.sort((a, b) => b.heuristic - a.heuristic);
    for (const candidate of candidates) {
        const score = cooperativeSearch(candidate.next, depth - 1, model);
        if (score > bestScore) {
            bestScore = score;
            bestDir = candidate.direction;
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
export function bestPlacement(state, depth, model) {
    if (transpositionTable.size > 0) transpositionTable.clear();
    if (evalCache.size > 0) evalCache.clear();

    const placements = getCandidatePlacements(state, depth);
    if (placements.length === 0) return null;

    let bestP = null;
    let bestScore = -Infinity;

    for (let i = 0; i < placements.length; i++) {
        const candidate = placements[i];
        const next = applyPlacement(state, candidate.placement);
        const score = cooperativeSearch(next, depth - 1, model);
        if (score > bestScore) {
            bestScore = score;
            bestP = candidate.placement;
        }
    }

    return bestP ? { ...bestP, score: bestScore } : null;
}
