import fileM from "./mover/file.js";
import coopMax from "./placer/coop-max.js";
import fileP from "./placer/file.js"
import random from "./placer/random.js"
import coopMax2 from "./mover/coop-max.js";

/**
 * @type {PlayerOneStrategy[]}
 */
export const firstPlayerStrategies = [
    fileM,
    coopMax2
];
/**
 * @type {PlayerTwoStrategy[]}
 */
export const secondPlayerStrategies = [
    random,
    fileP,
    coopMax
]