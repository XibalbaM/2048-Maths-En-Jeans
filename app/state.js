/// <reference path="../types.d.ts" />

/** @type {GameState} */
const game = {
    grid: [],
    score: 0,
    turn: 'move',
};

/** @type {GameConfig} */
const config = {
    SIZE: 4,
    STORAGE_KEY: 'local2048_v2',
    TILE_VALUES: [2, 4],
    SECOND_PLAYER_ENABLED: true,
    INITIAL_PLACEMENTS: 2
};

/**
 * Reset the game state to initial values
 * @returns {void}
 */
function resetGame() {
    game.grid = [];
    game.score = 0;
    game.turn = 'move';
}

export default {
    game,
    config,
    resetGame
};