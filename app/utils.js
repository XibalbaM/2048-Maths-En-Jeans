/**
 * Simulates a game by applying a series of actions to an initial state.
 * @param {GameAction[]} history 
 * @param {GameState} initialState
 * @returns {GameState} Simulated game state after applying history
 */
export function simulate(history, initialState) {
    const finalState = JSON.parse(JSON.stringify(initialState));
    for (let action of history) {
        if (action.type === 'move') {
            const rotatedTimes = rotatedForDirection(action.direction);
            let working = rotate(finalState.grid, rotatedTimes);
            const result = moveLeftOnce(working);
            const rotatedResults = restoreResults(result, rotatedTimes);
            finalState.grid = rotatedResults.grid;
            finalState.score += rotatedResults.mergedScore;
            finalState.turnNumber++;
        } else if (action.type === 'place') {
            finalState.grid[action.position.y][action.position.x] = action.value;
            finalState.turnNumber++;
        }
    }
    return finalState;
}