import { newGame, turn, goBackOneTurn, spectatorStep, isSpectatorModeEnabled } from './game.js';
import { showConfigPopup } from './interfaces/views/config.js';
import { showEditMode } from './interfaces/views/edit.js';
import { newBtn, editBtn, resetBtn, boardEl, exportBtn, importBtn, exportStateBtn, importStateBtn } from './interfaces/elements.js';
import DataStore from './data.js';
import State from './state.js';
import { configPopupOpen } from './interfaces/views/config.js';
import { firstPlayerStrategies, secondPlayerStrategies } from './strategies/list.js';
import { render } from './interfaces/rendering.js';

let isProcessingKeyEvent = false;

// Keyboard & touch
window.addEventListener('keydown', async (e) => {
    if (isProcessingKeyEvent) return;
    const key = e.key;
    const spectator = isSpectatorModeEnabled();
    let moved = false;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',' '].includes(key)) e.preventDefault();
    if (spectator) {
        if (key === ' ') {
            isProcessingKeyEvent = true;
            try {
                moved = await spectatorStep();
                if (moved) DataStore.saveGame();
            } finally {
                isProcessingKeyEvent = false;
            }
        }
        if (key === 'Backspace') goBackOneTurn();
        return;
    }
    isProcessingKeyEvent = true;
    if (key === 'ArrowLeft' || key === 'q' || key === 'Q') moved = await turn('left');
    if (key === 'ArrowRight' || key === 'd' || key === 'D') moved = await turn('right');
    if (key === 'ArrowUp' || key === 'z' || key === 'Z') moved = await turn('up');
    if (key === 'ArrowDown' || key === 's' || key === 'S') moved = await turn('down');
    if (key === ' ') moved = await turn(null);
    if (key === 'Backspace') goBackOneTurn();
    if (moved) DataStore.saveGame();
    isProcessingKeyEvent = false;
});

// touch swipe support
let touchStartX = 0, touchStartY = 0;
boardEl.addEventListener('touchstart', (e) => { if (e.touches.length === 1) { touchStartX = e.touches[0].clientX; touchStartY = e.touches[0].clientY } });
boardEl.addEventListener('touchend', async (e) => {
    if (!touchStartX) return;
    if (isSpectatorModeEnabled()) { touchStartX = 0; touchStartY = 0; return; }
    const dx = (e.changedTouches[0].clientX - touchStartX);
    const dy = (e.changedTouches[0].clientY - touchStartY);
    const absX = Math.abs(dx), absY = Math.abs(dy);
    if (Math.max(absX, absY) > 20) {
        if (absX > absY) { if (dx > 0) await turn('right'); else await turn('left'); }
        else { if (dy > 0) await turn('down'); else await turn('up'); }
        DataStore.saveGame();
    }
    touchStartX = 0; touchStartY = 0;
});

newBtn.addEventListener('click', () => { 
    if (State.game.turn === 'move') {
        if (configPopupOpen)
            return;
        showConfigPopup(newGame); 
    }
});

editBtn.addEventListener('click', () => { if (State.game.turn === 'move') showEditMode(); });

exportBtn.addEventListener('click', () => {
    const history = State.game.history;
    const data = JSON.stringify(history);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '2048_game_history.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});

importBtn.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = (e) => {
        // @ts-ignore
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                // @ts-ignore
                const importedHistory = JSON.parse(event.target.result);
                if (Array.isArray(importedHistory)) {
                    State.config.loadedHistory = importedHistory;
                    DataStore.saveConfig();
                    alert('Historique de jeu importé avec succès. Vous pouvez maintenant commencer une nouvelle partie et l\'historique sera utilisé.');
                } else {
                    alert('Le fichier importé n\'est pas un historique de jeu valide.');
                }
            } catch (err) {
                alert('Erreur lors de la lecture du fichier : ' + err.message);
            }
        };
        reader.readAsText(file);
    };
    input.click();
});

exportStateBtn.addEventListener('click', () => {
    const configToSave = {
        rows: State.config.rows,
        cols: State.config.cols,
        storageKey: State.config.storageKey,
        tileValues: State.config.tileValues,
        initialPlacementsCount: State.config.initialPlacementsCount,
        firstPlayerStrategy: State.config.firstPlayerStrategy ? State.config.firstPlayerStrategy.name : '',
        secondPlayerStrategy: State.config.secondPlayerStrategy ? State.config.secondPlayerStrategy.name : '',
        loadedHistory: State.config.loadedHistory
    };
    const data = JSON.stringify({ game: State.game, config: configToSave }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '2048_state.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});

importStateBtn.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = (e) => {
        // @ts-ignore
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                // @ts-ignore
                const obj = JSON.parse(event.target.result);
                if (!obj || typeof obj !== 'object') throw new Error('Format invalide');
                // Restore game
                if (obj.game && obj.game.grid) State.game = obj.game;
                // Restore config
                if (obj.config && typeof obj.config === 'object') {
                    const c = obj.config;
                    if (typeof c.rows === 'number') State.config.rows = c.rows;
                    if (typeof c.cols === 'number') State.config.cols = c.cols;
                    if (Array.isArray(c.tileValues)) State.config.tileValues = c.tileValues.filter(n => typeof n === 'number');
                    if (typeof c.storageKey === 'string') State.config.storageKey = c.storageKey;
                    if (typeof c.initialPlacementsCount === 'number') State.config.initialPlacementsCount = c.initialPlacementsCount;
                    const p1Name = typeof c.firstPlayerStrategy === 'string' ? c.firstPlayerStrategy : '';
                    const p2Name = typeof c.secondPlayerStrategy === 'string' ? c.secondPlayerStrategy : '';
                    State.config.firstPlayerStrategy = p1Name ? firstPlayerStrategies.find(s => s.name === p1Name) : undefined;
                    State.config.secondPlayerStrategy = p2Name ? secondPlayerStrategies.find(s => s.name === p2Name) : undefined;
                    if (Array.isArray(c.loadedHistory)) State.config.loadedHistory = c.loadedHistory;
                }
                DataStore.saveGame();
                DataStore.saveConfig();
                render();
                alert('État importé avec succès.');
            } catch (err) {
                alert('Erreur lors de la lecture du fichier : ' + err.message);
            }
        };
        reader.readAsText(file);
    };
    input.click();
});

// Reset button
resetBtn.addEventListener('click', () => {
    if (confirm('Êtes-vous sûr de vouloir réinitialiser tout le stockage local ? Cela effacera la sauvegarde de la partie, le meilleur score et les configurations.')) {
        DataStore.clearAll();
        location.reload(); // Reload to reset everything
    }
});