import { move, newGame } from './game.js';
import { showConfigPopup } from './interfaces/views/config.js';
import { showEditMode } from './interfaces/views/edit.js';
import { newBtn, editBtn, resetBtn, boardEl } from './interfaces/elements.js';
import DataStore from './data.js';

// Keyboard & touch
window.addEventListener('keydown', async (e) => {
    const key = e.key;
    let moved = false;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(key)) e.preventDefault();
    if (key === 'ArrowLeft' || key === 'a' || key === 'A') moved = await move('left');
    if (key === 'ArrowRight' || key === 'd' || key === 'D') moved = await move('right');
    if (key === 'ArrowUp' || key === 'w' || key === 'W' || key === 'z' || key === 'Z') moved = await move('up');
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

newBtn.addEventListener('click', () => { showConfigPopup(newGame); });

editBtn.addEventListener('click', () => { showEditMode(); });

// Reset button
resetBtn.addEventListener('click', () => {
    if (confirm('Êtes-vous sûr de vouloir réinitialiser tout le stockage local ? Cela effacera la sauvegarde de la partie, le meilleur score et les configurations.')) {
        DataStore.clearAll();
        location.reload(); // Reload to reset everything
    }
});