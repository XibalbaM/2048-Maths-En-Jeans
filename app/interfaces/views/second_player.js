import State from '../../state.js';
import { boardEl } from '../elements.js';
import { addTileAt } from '../../game.js';
import { render } from '../rendering.js';

/**
 * Prompt second player to place tiles
 * @param {number} [count=1] - Number of tiles to place
 * @returns {Promise<void>} Promise that resolves when placement is complete
 */
export function promptSecondPlayer(count = 1) {
    // if already in placement turn, don't open another prompt
    if (State.game.turn === 'place') return Promise.resolve();
    // enter placement turn
    State.game.turn = 'place';
    return new Promise((resolve) => {
        // create overlay with a small picker
        const overlay = document.createElement('div');
        overlay.className = 'overlay';

        const title = document.createElement('p');
        title.textContent = `Joueur 2 — placez ${count} tuile(s). Choisissez une case vide et une valeur.`;

        const panel = document.createElement('div');
        panel.className = 'placement-panel';

        // picker grid
        const pickerGrid = document.createElement('div');
        pickerGrid.className = 'picker-grid';
        pickerGrid.style.setProperty('--size', String(State.config.SIZE));

        // collect empties
        const empties = [];
        for (let r = 0; r < State.config.SIZE; r++) for (let c = 0; c < State.config.SIZE; c++) if (State.game.grid[r][c] === 0) empties.push([r, c]);

        // build cells (clickable)
        /** @type {HTMLElement[]} */
        const cellEls = [];
        for (let r = 0; r < State.config.SIZE; r++) {
            for (let c = 0; c < State.config.SIZE; c++) {
                const el = document.createElement('div');
                el.className = 'picker-cell';
                if (State.game.grid[r][c] === 0) { el.classList.add('empty'); el.textContent = ''; }
                else el.textContent = String(State.game.grid[r][c]);
                el.dataset.r = String(r);
                el.dataset.c = String(c);
                pickerGrid.appendChild(el);
                cellEls.push(el);
            }
        }

        // values area
        const valuesDiv = document.createElement('div');
        valuesDiv.className = 'placement-values';
        const info = document.createElement('div');
        info.textContent = 'Valeurs disponibles :';
        valuesDiv.appendChild(info);
        /** @type {HTMLButtonElement[]} */
        const valueButtons = [];
        State.config.TILE_VALUES.forEach(v => {
            const b = document.createElement('button');
            b.className = 'value-btn';
            b.textContent = String(v);
            b.dataset.value = String(v);
            valuesDiv.appendChild(b);
            valueButtons.push(b);
        });

        // make value buttons draggable
        valueButtons.forEach(b => {
            b.draggable = true;
            b.addEventListener('dragstart', (e) => {
                if (e.dataTransfer) e.dataTransfer.setData('text/plain', b.dataset.value || '');
            });
        });

        // current selection
        /** @type {[number, number] | null} */
        let selectedCell = null;
        /** @type {number | null} */
        let selectedValue = null;
        let placementsLeft = count;

        function clearSelection() {
            selectedCell = null;
            selectedValue = null;
            cellEls.forEach(el => el.classList.remove('selected'));
            valueButtons.forEach(b => b.classList.remove('selected'));
        }

        // click on picker cell
        cellEls.forEach(el => {
            el.addEventListener('click', () => {
                const r = parseInt(el.dataset.r || '0'), c = parseInt(el.dataset.c || '0');
                if (State.game.grid[r][c] !== 0) return; // only empty
                if (selectedValue !== null) {
                    // place
                    addTileAt(r, c, selectedValue);
                    placementsLeft--;
                    clearSelection();
                    // update picker visuals
                    pickerGrid.querySelectorAll('.picker-cell').forEach(cell => {
                        // @ts-ignore
                        const rr = parseInt(cell.dataset.r), cc = parseInt(cell.dataset.c);
                        if (State.game.grid[rr][cc] === 0) { cell.classList.add('empty'); cell.textContent = ''; }
                        else { cell.classList.remove('empty'); cell.textContent = State.game.grid[rr][cc].toString(); }
                    });
                    if (placementsLeft <= 0) {
                        overlay.remove();
                        // placement finished -> back to move turn
                        State.game.turn = 'move';
                        render();
                        resolve();
                    } else {
                        title.textContent = `Joueur 2 — placez ${placementsLeft} tuile(s). Choisissez une case vide et une valeur.`;
                    }
                } else {
                    // select/deselect cell
                    if (selectedCell && selectedCell[0] === r && selectedCell[1] === c) {
                        clearSelection();
                    } else {
                        clearSelection();
                        selectedCell = [r, c];
                        el.classList.add('selected');
                    }
                }
            });

            // drag and drop
            el.addEventListener('dragover', (e) => {
                e.preventDefault();
            });
            el.addEventListener('dragenter', (e) => {
                const r = parseInt(el.dataset.r), c = parseInt(el.dataset.c);
                if (State.game.grid[r][c] === 0) el.classList.add('drag-over');
            });
            el.addEventListener('dragleave', (e) => {
                el.classList.remove('drag-over');
            });
            el.addEventListener('drop', (e) => {
                e.preventDefault();
                el.classList.remove('drag-over');
                const v = parseInt(e.dataTransfer.getData('text/plain'));
                const r = parseInt(el.dataset.r), c = parseInt(el.dataset.c);
                if (State.game.grid[r][c] === 0) {
                    addTileAt(r, c, v);
                    placementsLeft--;
                    clearSelection();
                    // update picker visuals
                    pickerGrid.querySelectorAll('.picker-cell').forEach(cell => {
                        // @ts-ignore
                        const rr = parseInt(cell.dataset.r), cc = parseInt(cell.dataset.c);
                        if (State.game.grid[rr][cc] === 0) { cell.classList.add('empty'); cell.textContent = ''; }
                        else { cell.classList.remove('empty'); cell.textContent = State.game.grid[rr][cc].toString(); }
                    });
                    if (placementsLeft <= 0) {
                        overlay.remove();
                        State.game.turn = 'move';
                        render();
                        resolve();
                    } else {
                        title.textContent = `Joueur 2 — placez ${placementsLeft} tuile(s). Choisissez une case vide et une valeur.`;
                    }
                }
            });
        });

        // value buttons
        valueButtons.forEach(b => {
            b.addEventListener('click', () => {
                const v = parseInt(b.dataset.value);
                if (selectedValue === v) {
                    // deselect
                    selectedValue = null;
                    b.classList.remove('selected');
                } else {
                    // select this value
                    valueButtons.forEach(bb => bb.classList.remove('selected'));
                    selectedValue = v;
                    b.classList.add('selected');
                    if (selectedCell !== null) {
                        // place
                        const r = selectedCell[0], c = selectedCell[1];
                        addTileAt(r, c, v);
                        placementsLeft--;
                        clearSelection();
                        // update picker visuals
                        pickerGrid.querySelectorAll('.picker-cell').forEach(cell => {
                            // @ts-ignore
                            const rr = parseInt(cell.dataset.r), cc = parseInt(cell.dataset.c);
                            if (State.game.grid[rr][cc] === 0) { cell.classList.add('empty'); cell.textContent = ''; }
                            else { cell.classList.remove('empty'); cell.textContent = State.game.grid[rr][cc].toString(); }
                        });
                        if (placementsLeft <= 0) {
                            overlay.remove();
                            // placement finished -> back to move turn
                            State.game.turn = 'move';
                            render();
                            resolve();
                        } else {
                            title.textContent = `Joueur 2 — placez ${placementsLeft} tuile(s). Choisissez une case vide et une valeur.`;
                        }
                    }
                }
            });
        });

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Passer';
        cancelBtn.onclick = () => {
            overlay.remove();
            State.game.turn = 'move';
            resolve();
        };

        panel.appendChild(pickerGrid);
        panel.appendChild(valuesDiv);
        panel.appendChild(cancelBtn);

        overlay.appendChild(title);
        overlay.appendChild(panel);
        boardEl.appendChild(overlay);
    });
}