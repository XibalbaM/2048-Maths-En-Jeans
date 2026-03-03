import { simulateAMove as simulateOneMove, simulateHistory } from "./engine.mjs";

/**
 * Simulates a game by applying a series of actions to an initial state.
 * @param {HistoryEntry[]} history 
 * @param {GameState} initialState
 * @returns {GameState} Simulated game state after applying history
 */
export function simulate(history, initialState) {
    return simulateHistory(history, initialState);
}

/**
 * Simulates a single move in a given direction on the provided game state.
 * @param {Direction} direction 
 * @param {GameState} state 
 * @returns {MoveResult} Resulting grid and score from the move
 */
export function simulateAMove(direction, state) {
    return simulateOneMove(direction, state);
}