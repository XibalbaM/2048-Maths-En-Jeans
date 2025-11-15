import { move, newGame } from './game.js';
import { showConfigPopup } from './interfaces/views/config.js';
import { showEditMode } from './interfaces/views/edit.js';
import { newBtn, editBtn, resetBtn, boardEl, exportBtn, importBtn } from './interfaces/elements.js';
import DataStore from './data.js';
import State from './state.js';

// Keyboard & touch
window.addEventListener('keydown', async (e) => {
    const key = e.key;
    let moved = false;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(key)) e.preventDefault();
    if (key === 'ArrowLeft' || key === 'q' || key === 'Q') moved = await move('left');
    if (key === 'ArrowRight' || key === 'd' || key === 'D') moved = await move('right');
    if (key === 'ArrowUp' || key === 'z' || key === 'Z') moved = await move('up');
    if (key === 'ArrowDown' || key === 's' || key === 'S') moved = await move('down');

    if (moved) DataStore.saveGame();
});

// touch swipe support
let touchStartX = 0, touchStartY = 0;
boardEl.addEventListener('touchstart', (e) => { if (e.touches.length === 1) { touchStartX = e.touches[0].clientX; touchStartY = e.touches[0].clientY } });
boardEl.addEventListener('touchend', async (e) => {
    if (!touchStartX) return;
    const dx = (e.changedTouches[0].clientX - touchStartX);
    const dy = (e.changedTouches[0].clientY - touchStartY);
    const absX = Math.abs(dx), absY = Math.abs(dy);
    if (Math.max(absX, absY) > 20) {
        if (absX > absY) { if (dx > 0) await move('right'); else await move('left'); }
        else { if (dy > 0) await move('down'); else await move('up'); }
        DataStore.saveGame();
    }
    touchStartX = 0; touchStartY = 0;
});

newBtn.addEventListener('click', () => { if (State.game.turn === 'move') showConfigPopup(newGame); });

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

// Reset button
resetBtn.addEventListener('click', () => {
    if (confirm('Êtes-vous sûr de vouloir réinitialiser tout le stockage local ? Cela effacera la sauvegarde de la partie, le meilleur score et les configurations.')) {
        DataStore.clearAll();
        location.reload(); // Reload to reset everything
    }
});