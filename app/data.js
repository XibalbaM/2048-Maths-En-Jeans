/* Centralized data storage for 2048 game (config, game state, best score) */
(function(global){
  'use strict';

  const DEFAULT_STORAGE_KEY = 'local2048_v2';
  const KEYS = {
    game: DEFAULT_STORAGE_KEY,
    config: 'gameConfig'
  };

  const DataStore = {
    // Game state: { grid, score, best }
    saveGame(state, storageKey = DEFAULT_STORAGE_KEY){
      try{
        localStorage.setItem(storageKey, JSON.stringify(state));
        return true;
      }catch(e){ console.warn('saveGame failed', e); return false; }
    },
    loadGame(storageKey = DEFAULT_STORAGE_KEY){
      try{
        const raw = localStorage.getItem(storageKey);
        if(!raw) return null;
        const obj = JSON.parse(raw);
        if(obj && obj.grid) return obj;
        return null;
      }catch(e){ console.warn('loadGame failed', e); return null; }
    },

    // Config persistence: { tileValues, secondPlayerEnabled, size }
    getConfig(){
      try{
        const raw = localStorage.getItem(KEYS.config);
        return raw ? JSON.parse(raw) : null;
      }catch(e){ console.warn('getConfig failed', e); return null; }
    },
    setConfig(cfg){
      try{
        localStorage.setItem(KEYS.config, JSON.stringify(cfg));
        return true;
      }catch(e){ console.warn('setConfig failed', e); return false; }
    },

    // Danger: clears all localStorage for this origin
    clearAll(){
      try{ localStorage.clear(); }
      catch(e){ /* ignore */ }
    },

    // Expose keys for reference if needed
    keys: KEYS
  };

  global.DataStore = DataStore;
})(window);
