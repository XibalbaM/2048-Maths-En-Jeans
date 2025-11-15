/// <reference path="../types.d.ts" />

/** @type {GameState} */
let game = {
    grid: [],
    score: 0,
    turn: 'move',
    history: [],
    turnNumber: 0,
};

/** @type {GameConfig} */
let config = {
    size: 4,
    storageKey: 'local2048_v2',
    tileValues: [2, 4],
    firstPlayerStrategy: undefined,
    secondPlayerStrategy: undefined,
    initialPlacementsCount: 2,
    loadedHistory: []
};

let tempStorage = {
    isProcessing: false
};

/**
 * Reset the game state to initial values
 * @returns {void}
 */
function resetGame() {
    game.grid = Array.from({ length: config.size }, () => Array(config.size).fill(0));
    game.score = 0;
    game.turn = 'move';
    game.history = [];
    game.turnNumber = 0;
}

export default {
    get game() { return game; },
    set game(v) { game = v; },
    get config() { return config; },
    set config(v) { config = v; },
    get tempStorage() { return tempStorage; },
    set tempStorage(v) { tempStorage = v; },
    resetGame
};