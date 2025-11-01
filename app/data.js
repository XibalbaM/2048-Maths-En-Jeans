import State from './state.js';

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
  static saveGame(){
    try{
      localStorage.setItem(DEFAULT_STORAGE_KEY, JSON.stringify(State.game));
    }catch(e){ console.warn('saveGame failed', e); }
  }
  
  /**
   * Load game state from localStorage
   * @returns {void}
   */
  static loadGame(){
    try{
      const raw = localStorage.getItem(DEFAULT_STORAGE_KEY);
      if(!raw) return;
      const obj = JSON.parse(raw);
      if(obj && obj.grid) State.game = obj;
    } catch(e) { 
      console.warn('loadGame failed', e);
    }
  }

  /**
   * Load configuration from localStorage
   * @returns {void}
   */
  static loadConfig(){
    try{
      const raw = localStorage.getItem(KEYS.config);
      if (raw) State.config = JSON.parse(raw);
    }catch(e){ console.warn('getConfig failed', e); }
  }
  
  /**
   * Save configuration to localStorage
   * @returns {void}
   */
  static saveConfig(){
    try{
      localStorage.setItem(KEYS.config, JSON.stringify(State.config));
    }catch(e){ console.warn('setConfig failed', e); }
  }

  /**
   * Clear all localStorage data
   * @returns {void}
   */
  static clearAll(){
    try{ localStorage.clear(); }
    catch(e){ /* ignore */ }
  }
};
