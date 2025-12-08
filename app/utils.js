import { rotatedForDirection, rotate, moveLeftOnce, restoreResults } from "./game.js";

/**
 * Simulates a game by applying a series of actions to an initial state.
 * @param {HistoryEntry[]} history 
 * @param {GameState} initialState
 * @returns {GameState} Simulated game state after applying history
 */
export function simulate(history, initialState) {
    const finalState = JSON.parse(JSON.stringify(initialState));
    for (let entry of history) {
        const action = entry.action;
        const nextTurn = entry.nextTurn;
        if (action.type === 'move') {
            const rotatedResults = simulateAMove(action.direction, finalState);
            finalState.grid = rotatedResults.grid;
            finalState.score += rotatedResults.mergedScore;
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

/**
 * Simulates a single move in a given direction on the provided game state.
 * @param {Direction} direction 
 * @param {GameState} state 
 * @returns {MoveResult} Resulting grid and score from the move
 */
export function simulateAMove(direction, state) {
    const rotatedTimes = rotatedForDirection(direction);
    let working = rotate(state.grid, rotatedTimes);
    const result = moveLeftOnce(working);
    return restoreResults(result, rotatedTimes);
}