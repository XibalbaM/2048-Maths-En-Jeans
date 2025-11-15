import State from '../../state.js';
import DataStore from '../../data.js';
import { boardEl } from '../elements.js';

/**
 * Show configuration popup for starting a new game
 * 
 * @param {Function} onSubmit - Callback when configuration is submitted
 * @returns {void}
 */
export function showConfigPopup(onSubmit) {
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    const title = document.createElement('p');
    title.textContent = 'Configuration de la nouvelle partie';
    const form = document.createElement('div');
    form.className = 'config-form';
    // Grid size
    const sizeLabel = document.createElement('label');
    sizeLabel.textContent = 'Taille de la grille (2-8): ';
    const sizeInput = document.createElement('input');
    sizeInput.type = 'number';
    sizeInput.min = String(2);
    sizeInput.max = String(8);
    sizeInput.value = String(State.config.SIZE);
    sizeLabel.appendChild(sizeInput);
    form.appendChild(sizeLabel);
    // Tile values
    const tileLabel = document.createElement('label');
    tileLabel.textContent = 'Valeurs des tuiles (séparées par des virgules): ';
    const tileInput = document.createElement('input');
    tileInput.type = 'text';
    tileInput.value = State.config.TILE_VALUES.join(',');
    tileLabel.appendChild(tileInput);
    form.appendChild(tileLabel);
    // Two player
    const playerLabel = document.createElement('label');
    const playerCheckbox = document.createElement('input');
    playerCheckbox.type = 'checkbox';
    playerCheckbox.checked = State.config.SECOND_PLAYER_ENABLED;
    playerLabel.appendChild(playerCheckbox);
    playerLabel.appendChild(document.createTextNode(' Mode deux joueurs'));
    form.appendChild(playerLabel);
    // Buttons
    const btnContainer = document.createElement('div');
    btnContainer.className = 'config-buttons';
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Annuler';
    cancelBtn.onclick = () => overlay.remove();
    const startBtn = document.createElement('button');
    startBtn.textContent = 'Démarrer';
    startBtn.onclick = () => {
        // Parse
        let size = parseInt(sizeInput.value);
        if (isNaN(size) || size < 2) size = 2;
        if (size > 8) size = 8;
        const tileStr = tileInput.value.trim();
        let tileValues = tileStr.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
        if (tileValues.length === 0) tileValues = [2, 4];
        const secondPlayer = playerCheckbox.checked;
        // Save
        DataStore.saveConfig();
        // Update State.config
        State.config.TILE_VALUES = tileValues;
        State.config.SECOND_PLAYER_ENABLED = secondPlayer;
        State.config.SIZE = size;
        document.documentElement.style.setProperty('--size', String(State.config.SIZE));
        // Start new game, force reset
        overlay.remove();
        onSubmit();
    };
    btnContainer.appendChild(cancelBtn);
    btnContainer.appendChild(startBtn);
    form.appendChild(btnContainer);
    overlay.appendChild(title);
    overlay.appendChild(form);
    boardEl.appendChild(overlay);
}