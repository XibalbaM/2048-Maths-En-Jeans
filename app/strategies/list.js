import fileM from "./mover/file.js";
import coopMax from "./placer/coop-max.js";
import fileP from "./placer/file.js"
import random from "./placer/random.js"
import random2 from "./mover/random.js";
import coopMax2 from "./mover/coop-max.js";
import coopMin from "./placer/coop-min.js";
import coopMin2 from "./mover/coop-min.js";
import coopMaxBis from "./placer/coop-max-bis.js";

/**
 * @type {PlayerOneStrategy[]}
 */
export const firstPlayerStrategies = [
    fileM,
    coopMax2,
    coopMin2,
    random2
];
/**
 * @type {PlayerTwoStrategy[]}
 */
export const secondPlayerStrategies = [
    random,
    fileP,
    coopMax,
    coopMin,
    coopMaxBis
]