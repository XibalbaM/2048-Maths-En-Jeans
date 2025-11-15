import { tileLayer } from "./elements.js";
import { cellPositionPx } from "./utils.js";

/**
 * Animate tile movements from their source to destination positions
 * @param {TileMove[]} moves - Array of tile movements to animate
 * @param {MergedDestination[]} mergedDestinations - Array of merged tile destinations
 * @returns {Promise<void>} Promise that resolves when animations complete
 */
export function animateMoves(moves, mergedDestinations) {
    if (!tileLayer) return Promise.resolve();
    // Remove any previous moving tiles
    tileLayer.querySelectorAll('.moving-tile').forEach(el => el.remove());
    /** @type {HTMLElement[]} */
    const animEls = [];
    moves.forEach(m => {
        // skip tiles that don't move
        if (m.fromR === m.toR && m.fromC === m.toC) return;
        // hide the original static tile at its origin so we don't see duplicates
        const baseEl = tileLayer?.querySelector(`.tile[data-r="${m.fromR}"][data-c="${m.fromC}"]`);
        if (baseEl && baseEl instanceof HTMLElement) baseEl.style.opacity = '0';
        const ghost = document.createElement('div');
        ghost.className = 'tile t-' + m.value + ' moving-tile';
        ghost.textContent = String(m.value);
        const fromPx = cellPositionPx(m.fromR, m.fromC);
        const toPx = cellPositionPx(m.toR, m.toC);
        ghost.style.top = fromPx.top + 'px';
        ghost.style.left = fromPx.left + 'px';
        tileLayer?.appendChild(ghost);
        // trigger transition
        requestAnimationFrame(() => {
            ghost.style.top = toPx.top + 'px';
            ghost.style.left = toPx.left + 'px';
        });
        animEls.push(ghost);
    });
    // apply merge pop animation on merged destinations
    if (mergedDestinations && mergedDestinations.length) {
        mergedDestinations.forEach(({ r, c }) => {
            const el = tileLayer.querySelector(`.tile[data-r="${r}"][data-c="${c}"]`);
            if (el) el.classList.add('merged');
        });
    }
    if (animEls.length === 0) return Promise.resolve();
    // Wait for all transitions to finish (fallback timeout)
    return new Promise(resolve => {
        let remaining = animEls.length;
        const done = () => { if (--remaining <= 0) resolve(); };
        setTimeout(() => { resolve(); }, 200);
        animEls.forEach(el => {
            el.addEventListener('transitionend', () => {
                el.remove();
                done();
            }, { once: true });
        });
    });
}