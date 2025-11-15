import State from '../../state.js';
import { boardEl } from '../elements.js';
import { addTileAt } from '../../game.js';
import { render } from '../rendering.js';

/**
 * Show edit mode UI for placing/removing tiles
 * @param {number} count - Number of tiles to place
 * @param {string} titleText - Title text with $count placeholder
 * @param {number[]} allowedValues - Allowed tile values for placement
 * @param {boolean} allowRemove - Whether removing tiles is allowed
 * @param {string} closeText - Text for the close button
 * @param {(actions: GameAction[]) => void} closeCallback - Optional callback on close
 * @param {(actions: GameAction[]) => void} doneCallback - Optional callback on done
 * @returns {Promise<GameAction[]>} Promise that resolves when placement is complete
 */
export async function abstractEdit(count, titleText, allowedValues, allowRemove, closeText, closeCallback, doneCallback) {
    return new Promise((resolve) => {
        const actions = [];
        // create overlay with a small picker
        const overlay = document.createElement('div');
        overlay.className = 'overlay';

        const title = document.createElement('p');
        title.textContent = replaceCount(titleText, count);

        const panel = document.createElement('div');
        panel.className = 'placement-panel';

        // picker grid
        const pickerGrid = document.createElement('div');
        pickerGrid.className = 'picker-grid';
        pickerGrid.style.setProperty('--size', String(State.config.size));

        // collect empties
        const empties = [];
        for (let r = 0; r < State.config.size; r++) for (let c = 0; c < State.config.size; c++) if (State.game.grid[r][c] === 0) empties.push([r, c]);

        // build cells (clickable)
        /** @type {HTMLElement[]} */
        const cellEls = [];
        for (let r = 0; r < State.config.size; r++) {
            for (let c = 0; c < State.config.size; c++) {
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
        const buttonsContainer = document.createElement('div');
        buttonsContainer.className = 'value-buttons-container';
        valuesDiv.appendChild(buttonsContainer);
        /** @type {HTMLButtonElement[]} */
        const valueButtons = [];
        allowedValues.forEach(v => {
            const b = document.createElement('button');
            b.className = 'value-btn';
            b.textContent = String(v);
            b.dataset.value = String(v);
            buttonsContainer.appendChild(b);
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
            cellEls.forEach(el => el.classList.remove('selected'));
        }

        function place(r, c, v) {
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
                actions.push({ type: 'place', r, c, value: v });// log action
                if (placementsLeft == 0) {
                    overlay.remove();
                    doneCallback(actions);
                    resolve(actions);
                } else {
                    title.textContent = replaceCount(titleText, placementsLeft);
                }
            }
        }

        // click on picker cell
        cellEls.forEach(el => {
            el.addEventListener('click', () => {
                const r = parseInt(el.dataset.r || '0'), c = parseInt(el.dataset.c || '0');
                if (State.game.grid[r][c] !== 0) {
                    // occupied, remove if allowed
                    if (allowRemove) {
                        const oldVal = State.game.grid[r][c];
                        State.game.grid[r][c] = 0;
                        el.textContent = '';
                        el.classList.remove('t-' + oldVal);
                        el.classList.add('empty');
                        actions.push({ type: 'delete', r, c });// log action
                    }
                    return;
                }
                if (selectedValue !== null) {
                    place(r, c, selectedValue);
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
                place(r, c, v);
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
                        place(r, c, selectedValue);
                    }
                }
            });
        });

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = replaceCount(closeText, placementsLeft);
        cancelBtn.onclick = () => {
            overlay.remove();
            closeCallback(actions);
            resolve(actions);
        };

        panel.appendChild(pickerGrid);
        panel.appendChild(valuesDiv);
        panel.appendChild(cancelBtn);

        overlay.appendChild(title);
        overlay.appendChild(panel);
        boardEl.appendChild(overlay);
    });
}

function replaceCount(text, count) {
    return text.replace('$count', String(count));
}