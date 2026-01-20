import State from '../../state.js';
import DataStore from '../../data.js';
import { boardEl } from '../elements.js'
import { addTileAt } from '../../game.js';
import { render } from '../rendering.js';
import { abstractEdit } from './abstract_edit.js';

/**
 * Show edit mode UI for manually placing/removing tiles
 * @returns {Promise<GameAction[]>} Promise that resolves when edit mode is exited
 */
export function showEditMode() {
    const allowedValues = [];
    let current = 2;
    for (let i = 0; i <= State.config.rows * State.config.cols; i++) {
        allowedValues.push(current);
        current *= 2;
    }
    function callback(actions) {
        State.game.history = [...State.game.history, ...actions];
        State.game.turnNumber = + actions.size;
        DataStore.saveGame();
        render();
    }
    return abstractEdit(-1,
        "Mode Édition — Placez ou supprimez des tuiles librement.",
        allowedValues,
        true,
        "Terminé",
        callback,
        callback
    );
}