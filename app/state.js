// Centralized mutable game state (ES module)
// Import this object and mutate its properties (live binding for modules).

/**
 * @typedef {'move' | 'place'} TurnType
 */

/**
 * @typedef {Object} GameState
 * @property {number[][]} grid - 2D array of numbers (size x size)
 * @property {number} score - current score
 * @property {TurnType} turn - 'move' => player 1 moves; 'place' => player 2 places tiles
 */

/**
 * @typedef {Object} GameConfig
 * @property {number} SIZE - Grid size (e.g., 4 for 4x4)
 * @property {string} STORAGE_KEY - LocalStorage key for game data
 * @property {number[]} TILE_VALUES - Available tile values for placement
 * @property {boolean} SECOND_PLAYER_ENABLED - Enable two-player mode
 * @property {number} INITIAL_PLACEMENTS - Number of initial tile placements
 */

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
function resetState(){
	game.grid = [];
	game.score = 0;
	game.turn = 'move';
}

export default {
    game,
    config,
    resetState
};