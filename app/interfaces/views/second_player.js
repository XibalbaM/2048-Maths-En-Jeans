import State from '../../state.js';
import { render } from '../rendering.js';
import { abstractEdit } from './abstract_edit.js';
import DataStore from '../../data.js';

/**
 * Prompt second player to place tiles
 * @param {number} [count=1] - Number of tiles to place
 * @returns {Promise<GameAction[]>} Promise that resolves when placement is complete
 */
export function promptSecondPlayer(count = 1) {
    function callback(actions) {}
    return abstractEdit(count,
        "Joueur 2 — placez $count tuile(s). Choisissez une case vide et une valeur.",
        State.config.tileValues,
        false,
        "Passer",
        callback,
        callback
    );
}