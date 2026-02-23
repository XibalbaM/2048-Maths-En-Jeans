/**
 * @fileoverview
 * Minimal feedforward neural network — pure JavaScript, no dependencies.
 *
 * Architecture
 * ────────────
 *   • Arbitrary number of layers defined by `layerSizes`, e.g. [16, 64, 32, 1].
 *   • Hidden layers use ReLU activation.
 *   • Output layer uses a linear (identity) activation.
 *   • Weights are initialised with He-normal initialisation.
 *
 * Typical usage
 * ─────────────
 *   const net = new NeuralNetwork([16, 64, 32, 1]);
 *   const output = net.forward([...inputVector]);   // returns number[]
 *   const json   = net.toJSON();                    // serialise
 *   const net2   = NeuralNetwork.fromJSON(json);    // deserialise
 */

// ─── Math helpers ─────────────────────────────────────────────────────────────

/** @param {number} x */
function relu(x) { return x > 0 ? x : 0; }

/**
 * Box-Muller transform — returns one standard-normal sample.
 * @returns {number}
 */
function randn() {
    let u, v;
    do { u = Math.random(); } while (u === 0);
    do { v = Math.random(); } while (v === 0);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// ─── Layer ────────────────────────────────────────────────────────────────────

/**
 * A single fully-connected layer.
 * Weights are stored row-major: `weights[out][in]`.
 */
export class Layer {
    /**
     * @param {number} inSize   Number of input features.
     * @param {number} outSize  Number of output features (neurons).
     * @param {boolean} isOutput  If true, uses linear activation; otherwise ReLU.
     */
    constructor(inSize, outSize, isOutput = false) {
        this.inSize = inSize;
        this.outSize = outSize;
        this.isOutput = isOutput;

        // He-normal initialisation: std = sqrt(2 / inSize)
        const std = Math.sqrt(2 / inSize);
        /** @type {number[][]} weights[outSize][inSize] */
        this.weights = Array.from({ length: outSize }, () =>
            Array.from({ length: inSize }, () => randn() * std)
        );
        /** @type {number[]} biases[outSize] */
        this.biases = new Array(outSize).fill(0);
    }

    /**
     * Forward pass through this layer.
     * @param {number[]} input  Vector of length `inSize`.
     * @returns {number[]}      Vector of length `outSize`.
     */
    forward(input) {
        const out = new Array(this.outSize);
        for (let o = 0; o < this.outSize; o++) {
            let sum = this.biases[o];
            const row = this.weights[o];
            for (let i = 0; i < this.inSize; i++) {
                sum += row[i] * input[i];
            }
            out[o] = this.isOutput ? sum : relu(sum);
        }
        return out;
    }

    /** Serialise to a plain object. */
    toJSON() {
        return {
            inSize: this.inSize,
            outSize: this.outSize,
            isOutput: this.isOutput,
            weights: this.weights,
            biases: this.biases,
        };
    }

    /**
     * Deserialise from a plain object.
     * @param {ReturnType<Layer['toJSON']>} obj
     * @returns {Layer}
     */
    static fromJSON(obj) {
        const layer = new Layer(obj.inSize, obj.outSize, obj.isOutput);
        layer.weights = obj.weights;
        layer.biases = obj.biases;
        return layer;
    }
}

// ─── NeuralNetwork ────────────────────────────────────────────────────────────

/**
 * Feedforward neural network composed of fully-connected layers.
 *
 * @example
 * // 16 inputs → 64 hidden → 32 hidden → 1 output
 * const net = new NeuralNetwork([16, 64, 32, 1]);
 */
export class NeuralNetwork {
    /**
     * @param {number[]} layerSizes
     *   Array of sizes for each layer, including input and output.
     *   Minimum length: 2 (input → output, no hidden layers).
     */
    constructor(layerSizes) {
        if (layerSizes.length < 2) {
            throw new Error('NeuralNetwork requires at least 2 layer sizes (input and output).');
        }
        this.layerSizes = layerSizes;
        /** @type {Layer[]} */
        this.layers = [];
        for (let i = 0; i < layerSizes.length - 1; i++) {
            const isOutput = i === layerSizes.length - 2;
            this.layers.push(new Layer(layerSizes[i], layerSizes[i + 1], isOutput));
        }
    }

    /**
     * Run a forward pass through the entire network.
     * @param {number[]} input  Raw input vector (length must equal `layerSizes[0]`).
     * @returns {number[]}      Output vector (length equals last element of `layerSizes`).
     */
    forward(input) {
        let activation = input;
        for (const layer of this.layers) {
            activation = layer.forward(activation);
        }
        return activation;
    }

    /**
     * Convenience wrapper: encode a game state, run forward, return scalar.
     * @param {GameState} state
     * @returns {number}
     */
    evaluate(state) {
        const input = encodeState(state, this.layerSizes[0]);
        return this.forward(input)[0];
    }

    /** Serialise to JSON string. */
    toJSON() {
        return JSON.stringify({
            layerSizes: this.layerSizes,
            layers: this.layers.map(l => l.toJSON()),
        });
    }

    /**
     * Deserialise from JSON string.
     * @param {string} json
     * @returns {NeuralNetwork}
     */
    static fromJSON(json) {
        const obj = JSON.parse(json);
        const net = new NeuralNetwork(obj.layerSizes);
        net.layers = obj.layers.map(Layer.fromJSON);
        return net;
    }
}

// ─── State encoder ────────────────────────────────────────────────────────────

/**
 * Encode a `GameState` into a fixed-length numeric vector for neural-network input.
 *
 * Encoding per cell: log2(value) / 16  (so tile 2→0.0625, 4→0.125, … 65536→1.0).
 * Empty cells encode as 0.
 *
 * The vector is clamped / padded to `inputSize` in case the grid is smaller or
 * larger than expected (keeps the encoder robust to different grid sizes).
 *
 * @param {GameState} state
 * @param {number} [inputSize]  Expected input size; defaults to rows × cols.
 * @returns {number[]}
 */
export function encodeState(state, inputSize) {
    const grid = state.grid;
    const rows = grid.length;
    const cols = rows > 0 ? grid[0].length : 0;
    const expectedSize = inputSize ?? rows * cols;

    const vec = new Array(expectedSize).fill(0);
    let idx = 0;
    outer: for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (idx >= expectedSize) break outer;
            const v = grid[r][c];
            vec[idx++] = v > 0 ? Math.log2(v) / 16 : 0;
        }
    }
    return vec;
}

// ─── Default network instance ─────────────────────────────────────────────────

/**
 * Default network sized for a 4 × 4 grid:
 *   16 inputs → 128 hidden (ReLU) → 64 hidden (ReLU) → 1 output (linear).
 *
 * Replace weights via `defaultNetwork.layers[i].weights = ...` or load from JSON
 * to plug in trained parameters.
 *
 * @type {NeuralNetwork}
 */
export const defaultNetwork = new NeuralNetwork([16, 128, 64, 1]);
