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
        console.log("Simulating action:", action, "Next turn:", nextTurn);
        if (action.type === 'move') {
            const rotatedTimes = rotatedForDirection(action.direction);
            let working = rotate(finalState.grid, rotatedTimes);
            const result = moveLeftOnce(working);
            const rotatedResults = restoreResults(result, rotatedTimes);
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