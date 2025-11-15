import State from './state.js';
import { firstPlayerStrategies, secondPlayerStrategies } from './strategies/list.js';

const DEFAULT_STORAGE_KEY = 'local2048_v2';
const KEYS = {
    game: DEFAULT_STORAGE_KEY,
    config: 'gameConfig'
};

/**
 * DataStore class for persisting game state and configuration to localStorage
 */
export default class DataStore {
    /**
     * Save the current game state to localStorage
     * @returns {void}
     */
    static saveGame() {
        try {
            localStorage.setItem(DEFAULT_STORAGE_KEY, JSON.stringify(State.game));
        } catch (e) { console.warn('saveGame failed', e); }
    }

    /**
     * Load game state from localStorage
     * @returns {void}
     */
    static loadGame() {
        try {
            const raw = localStorage.getItem(DEFAULT_STORAGE_KEY);
            if (!raw) return;
            const obj = JSON.parse(raw);
            if (obj && obj.grid) State.game = obj;
        } catch (e) {
            console.warn('loadGame failed', e);
        }
    }

    /**
     * Load configuration from localStorage
     * @returns {void}
     */
    static loadConfig() {
        try {
            const raw = localStorage.getItem(KEYS.config);
            if (raw) {
                const obj = JSON.parse(raw);
                if (obj && typeof obj === 'object') {
                    // primitives
                    if (typeof obj.size === 'number') State.config.size = obj.size;
                    if (Array.isArray(obj.tileValues)) State.config.tileValues = obj.tileValues.filter(n=>typeof n==='number');
                    if (typeof obj.storageKey === 'string') State.config.storageKey = obj.storageKey;
                    if (typeof obj.initialPlacementsCount === 'number') State.config.initialPlacementsCount = obj.initialPlacementsCount;
                    // strategies by name (support legacy object-with-name too)
                    const p1Name = typeof obj.firstPlayerStrategy === 'string' ? obj.firstPlayerStrategy
                        : (obj.firstPlayerStrategy && typeof obj.firstPlayerStrategy.name === 'string' ? obj.firstPlayerStrategy.name : '');
                    const p2Name = typeof obj.secondPlayerStrategy === 'string' ? obj.secondPlayerStrategy
                        : (obj.secondPlayerStrategy && typeof obj.secondPlayerStrategy.name === 'string' ? obj.secondPlayerStrategy.name : '');
                    State.config.firstPlayerStrategy = p1Name ? firstPlayerStrategies.find(s=>s.name===p1Name) : undefined;
                    State.config.secondPlayerStrategy = p2Name ? secondPlayerStrategies.find(s=>s.name===p2Name) : undefined;
                    if (Array.isArray(obj.loadedHistory)) {
                        State.config.loadedHistory = obj.loadedHistory.filter(a=>typeof a==='object');
                    }
                }
            }
            console.log('Loaded config', State.config);
        } catch (e) { console.warn('getConfig failed', e); }
    }

    /**
     * Save configuration to localStorage
     * @returns {void}
     */
    static saveConfig() {
        try {
            const toSave = {
                size: State.config.size,
                storageKey: State.config.storageKey,
                tileValues: State.config.tileValues,
                initialPlacementsCount: State.config.initialPlacementsCount,
                firstPlayerStrategy: State.config.firstPlayerStrategy ? State.config.firstPlayerStrategy.name : '',
                secondPlayerStrategy: State.config.secondPlayerStrategy ? State.config.secondPlayerStrategy.name : '',
                loadedHistory: State.config.loadedHistory
            };
            localStorage.setItem(KEYS.config, JSON.stringify(toSave));
        } catch (e) { console.warn('setConfig failed', e); }
    }

    /**
     * Clear all localStorage data
     * @returns {void}
     */
    static clearAll() {
        try { localStorage.clear(); }
        catch (e) { /* ignore */ }
    }

    /**
     * Initialize game state if not already initialized
     * @returns {void}
     */
    static initGameIfNeeded() {
        if (!State.game || !State.game.grid || State.game.grid.length === 0 || State.game.grid[0].length === 0) {
            State.resetGame();
        }
    }

    static init() {
        this.loadConfig();
        this.loadGame();
        this.initGameIfNeeded();
    }
};

DataStore.init();