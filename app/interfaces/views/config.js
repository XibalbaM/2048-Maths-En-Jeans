import State from '../../state.js';
import DataStore from '../../data.js';
import { boardEl } from '../elements.js';
import { firstPlayerStrategies, secondPlayerStrategies } from '../../strategies/list.js';

export let configPopupOpen = false;

/**
 * Show configuration popup for starting a new game
 * 
 * @param {Function} onSubmit - Callback when configuration is submitted
 * @returns {void}
 */
export function showConfigPopup(onSubmit) {
    configPopupOpen = true;
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
    sizeInput.value = String(State.config.size);
    sizeLabel.appendChild(sizeInput);
    form.appendChild(sizeLabel);
    // Tile values
    const tileLabel = document.createElement('label');
    tileLabel.textContent = 'Valeurs des tuiles (séparées par des virgules): ';
    const tileInput = document.createElement('input');
    tileInput.type = 'text';
    tileInput.value = State.config.tileValues.join(',');
    tileLabel.appendChild(tileInput);
    form.appendChild(tileLabel);
    // Player 1 strategy select
    const p1Label = document.createElement('label');
    p1Label.textContent = 'Stratégie Joueur 1: ';
    const p1Select = document.createElement('select');
    // None option
    const p1None = document.createElement('option');
    p1None.value = '';
    p1None.textContent = 'Aucune';
    p1Select.appendChild(p1None);
    // Fill from list
    firstPlayerStrategies.forEach((s)=>{
        if (s.name === "Fichier" && State.config.loadedHistory.length === 0) return;
        const opt = document.createElement('option');
        opt.value = s.name;
        opt.textContent = s.name;
        p1Select.appendChild(opt);
    });
    // Preselect current
    if (State.config.firstPlayerStrategy) {
        p1Select.value = State.config.firstPlayerStrategy.name;
    } else {
        p1Select.value = '';
    }
    p1Label.appendChild(p1Select);
    form.appendChild(p1Label);

    // Player 2 strategy select
    const p2Label = document.createElement('label');
    p2Label.textContent = 'Stratégie Joueur 2: ';
    const p2Select = document.createElement('select');
    const p2None = document.createElement('option');
    p2None.value = '';
    p2None.textContent = 'Aucune';
    p2Select.appendChild(p2None);
    secondPlayerStrategies.forEach((s)=>{
        if (s.name === "Fichier" && State.config.loadedHistory.length === 0) return;
        const opt = document.createElement('option');
        opt.value = s.name;
        opt.textContent = s.name;
        p2Select.appendChild(opt);
    });
    if (State.config.secondPlayerStrategy) {
        p2Select.value = State.config.secondPlayerStrategy.name;
    } else {
        p2Select.value = '';
    }
    p2Label.appendChild(p2Select);
    form.appendChild(p2Label);
    // Buttons
    const btnContainer = document.createElement('div');
    btnContainer.className = 'config-buttons';
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Annuler';
    cancelBtn.onclick = () => {
        overlay.remove();
        configPopupOpen = false;
    };
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
        // Strategy selections
        const p1Name = p1Select.value;
        const p2Name = p2Select.value;
        const p1 = firstPlayerStrategies.find(s => s.name === p1Name);
        const p2 = secondPlayerStrategies.find(s => s.name === p2Name);
        // Update State.config
        State.config.tileValues = tileValues;
        State.config.size = size;
        State.config.firstPlayerStrategy = p1Name ? p1 : undefined;
        State.config.secondPlayerStrategy = p2Name ? p2 : undefined;
        document.documentElement.style.setProperty('--size', String(State.config.size));
        // Save
        DataStore.saveConfig();
        // Start new game, force reset
        overlay.remove();
        configPopupOpen = false;
        onSubmit();
    };
    btnContainer.appendChild(cancelBtn);
    btnContainer.appendChild(startBtn);
    form.appendChild(btnContainer);
    overlay.appendChild(title);
    overlay.appendChild(form);
    boardEl.appendChild(overlay);
}