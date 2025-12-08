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
 * Generate a default game state based on current configuration
 * @returns {GameState} Default game state
 */
function defaultGameState() {
    return {
        grid: Array.from({ length: config.size }, () => Array(config.size).fill(0)),
        score: 0,
        turn: 'place',
        history: [],
        turnNumber: 0,
    };
}

/**
 * Reset the game state to initial values
 * @returns {void}
 */
function resetGame() {
    game = defaultGameState();
}

export default {
    get game() { return game; },
    set game(v) { game = v; },
    get config() { return config; },
    set config(v) { config = v; },
    get tempStorage() { return tempStorage; },
    set tempStorage(v) { tempStorage = v; },
    resetGame,
    defaultGameState
};