import fileM from "./mover/file.js";
import fileP from "./placer/file.js"
import random from "./placer/random.js"

/**
 * @type {PlayerOneStrategy[]}
 */
export const firstPlayerStrategies = [
    fileM
];
/**
 * @type {PlayerTwoStrategy[]}
 */
export const secondPlayerStrategies = [
    random,
    fileP
]