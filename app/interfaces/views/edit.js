import State from '../../state.js';
import DataStore from '../../data.js';
import { boardEl } from '../elements.js'
import { addTileAt } from '../../game.js';
import { render } from '../rendering.js';

/**
 * Show edit mode UI for manually placing/removing tiles
 * @returns {void}
 */
export function showEditMode() {
    const overlay = document.createElement('div');
    overlay.className = 'overlay';

    const title = document.createElement('p');
    title.textContent = 'Mode Édition — Placez ou supprimez des tuiles librement.';

    const panel = document.createElement('div');
    panel.className = 'placement-panel';

    // picker grid
    const pickerGrid = document.createElement('div');
    pickerGrid.className = 'picker-grid';
    pickerGrid.style.setProperty('--size', String(State.config.SIZE));

    // build cells
    const cellEls = [];
    for (let r = 0; r < State.config.SIZE; r++) {
        for (let c = 0; c < State.config.SIZE; c++) {
            const el = document.createElement('div');
            el.className = 'picker-cell';
            if (State.game.grid[r][c] === 0) {
                el.classList.add('empty');
            } else {
                el.classList.add('t-' + State.game.grid[r][c]);
            }
            el.textContent = State.game.grid[r][c] === 0 ? '' : State.game.grid[r][c].toString();
            el.dataset.r = r.toString(); el.dataset.c = c.toString();
            pickerGrid.appendChild(el);
            cellEls.push(el);
        }
    }

    // values area
    const valuesDiv = document.createElement('div');
    valuesDiv.className = 'placement-values';
    const info = document.createElement('div');
    info.textContent = 'Sélectionnez une valeur pour placer:';
    valuesDiv.appendChild(info);
    const buttonsContainer = document.createElement('div');
    buttonsContainer.className = 'value-buttons-container';
    valuesDiv.appendChild(buttonsContainer);
    const valueButtons = [];
    let current = 2;
    for (let i = 0; i <= State.config.SIZE * State.config.SIZE; i++) {
        const b = document.createElement('button');
        b.className = 'value-btn';
        b.textContent = current.toString();
        b.dataset.value = current.toString();
        buttonsContainer.appendChild(b);
        valueButtons.push(b);
        current *= 2;
    }

    // current selection
    let selectedValue = null;

    function clearSelection() {
        selectedValue = null;
        valueButtons.forEach(b => b.classList.remove('selected'));
    }

    // click on picker cell
    cellEls.forEach(el => {
        el.addEventListener('click', () => {
            const r = parseInt(el.dataset.r), c = parseInt(el.dataset.c);
            if (State.game.grid[r][c] === 0) {
                // empty, place if value selected
                if (selectedValue !== null) {
                    addTileAt(r, c, selectedValue);
                    el.textContent = selectedValue;
                    el.classList.remove('empty');
                    el.classList.add('t-' + selectedValue);
                    clearSelection();
                }
            } else {
                // occupied, remove
                const oldVal = State.game.grid[r][c];
                State.game.grid[r][c] = 0;
                el.textContent = '';
                el.classList.remove('t-' + oldVal);
                el.classList.add('empty');
            }
        });
    });

    // value buttons
    valueButtons.forEach(b => {
        b.addEventListener('click', () => {
            const v = parseInt(b.dataset.value);
            if (selectedValue === v) {
                clearSelection();
            } else {
                valueButtons.forEach(bb => bb.classList.remove('selected'));
                selectedValue = v;
                b.classList.add('selected');
            }
        });
    });

    // done button
    const doneBtn = document.createElement('button');
    doneBtn.textContent = 'Terminé';
    doneBtn.onclick = () => {
        overlay.remove();
        DataStore.saveGame();
        render();
    };

    panel.appendChild(pickerGrid);
    panel.appendChild(valuesDiv);
    panel.appendChild(doneBtn);

    overlay.appendChild(title);
    overlay.appendChild(panel);
    boardEl.appendChild(overlay);
}