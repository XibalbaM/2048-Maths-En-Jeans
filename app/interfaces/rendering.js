import { scoreEl, gridEl, tileLayer, turnIndicatorEl } from "./elements.js";
import State from "../state.js";

/**
 * Render the game board with current state
 * @returns {void}
 */
export function render() {
    if (scoreEl) scoreEl.textContent = String(State.game.score);
    if (turnIndicatorEl) {
        const spectator = Boolean(State.config.firstPlayerStrategy && State.config.secondPlayerStrategy);
        if (spectator) {
            const label = State.game.turn === 'move' ? 'Déplacement — stratégie joueur 1' : 'Placement — stratégie joueur 2';
            turnIndicatorEl.textContent = `Mode spectateur : ${label}`;
            turnIndicatorEl.style.display = 'block';
        } else {
            turnIndicatorEl.textContent = '';
            turnIndicatorEl.style.display = 'none';
        }
    }
    // grid visuals
    if (!gridEl) return;
    gridEl.innerHTML = '';
    for (let r = 0; r < State.config.size; r++) {
        for (let c = 0; c < State.config.size; c++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            gridEl.appendChild(cell);
        }
    }

    // tiles
    if (!tileLayer) return;
    tileLayer.innerHTML = '';
    const cellSize = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--cell-size'));
    const gap = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--gap'));
    for (let r = 0; r < State.config.size; r++) {
        for (let c = 0; c < State.config.size; c++) {
            const val = State.game.grid[r][c];
            if (val === 0) continue;
            const tile = document.createElement('div');
            tile.className = 'tile t-' + val;
            tile.textContent = String(val);
            tile.dataset.r = String(r);
            tile.dataset.c = String(c);
            const topPx = r * (cellSize + gap);
            const leftPx = c * (cellSize + gap);
            tile.style.top = topPx + 'px';
            tile.style.left = leftPx + 'px';
            tileLayer.appendChild(tile);
            requestAnimationFrame(() => { tile.classList.add('show'); });
        }
    }
}