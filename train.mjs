import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { addTileAt, simulateAMove } from './app/engine.mjs';
import { NeuralNetwork, encodeState } from './app/strategies/nn.js';
import { reward } from './app/training/reward.mjs';
import { hasAnyMove, listEmptyCells } from './simulate.mjs';
import minmaxM from './app/strategies/mover/cooperative.js';
import minmaxP from './app/strategies/placer/cooperative.js';

function parseArgs(argv) {
    const args = {
        episodes: 2000,
        minutes: 0,
        maxTurns: 12000,
        cooperativeDepth: 1,
        learningRate: 0.0008,
        gamma: 0.98,
        targetClip: 5000,
        errorClip: 500,
        huberDelta: 25,
        epsilonStart: 0.5,
        epsilonEnd: 0.01,
        epsilonDecay: 0.996,
        rows: 4,
        cols: 4,
        tileValues: [2, 4],
        outDir: './training_output',
        prefix: 'nn',
        defaultModelPath: './default.model',
        resumeFrom: '',
        logEvery: 25
    };

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--episodes') args.episodes = Number(argv[++i] || args.episodes);
        else if (arg === '--generations') args.episodes = Number(argv[++i] || args.episodes);
        else if (arg === '--minutes') args.minutes = Number(argv[++i] || args.minutes);
        else if (arg === '--max-turns') args.maxTurns = Number(argv[++i] || args.maxTurns);
        else if (arg === '--cooperative-depth') args.cooperativeDepth = Number(argv[++i] || args.cooperativeDepth);
        else if (arg === '--minimax-depth') args.cooperativeDepth = Number(argv[++i] || args.cooperativeDepth);
        else if (arg === '--learning-rate') args.learningRate = Number(argv[++i] || args.learningRate);
        else if (arg === '--gamma') args.gamma = Number(argv[++i] || args.gamma);
        else if (arg === '--target-clip') args.targetClip = Number(argv[++i] || args.targetClip);
        else if (arg === '--error-clip') args.errorClip = Number(argv[++i] || args.errorClip);
        else if (arg === '--huber-delta') args.huberDelta = Number(argv[++i] || args.huberDelta);
        else if (arg === '--epsilon-start') args.epsilonStart = Number(argv[++i] || args.epsilonStart);
        else if (arg === '--epsilon-end') args.epsilonEnd = Number(argv[++i] || args.epsilonEnd);
        else if (arg === '--epsilon-decay') args.epsilonDecay = Number(argv[++i] || args.epsilonDecay);
        else if (arg === '--rows') args.rows = Number(argv[++i] || args.rows);
        else if (arg === '--cols') args.cols = Number(argv[++i] || args.cols);
        else if (arg === '--tile-values') args.tileValues = String(argv[++i] || '2,4').split(',').map(v => Number(v.trim())).filter(Number.isFinite);
        else if (arg === '--out-dir') args.outDir = argv[++i] || args.outDir;
        else if (arg === '--prefix') args.prefix = argv[++i] || args.prefix;
        else if (arg === '--default-model-path') args.defaultModelPath = argv[++i] || args.defaultModelPath;
        else if (arg === '--resume-from') args.resumeFrom = argv[++i] || args.resumeFrom;
        else if (arg === '--resume') args.resumeFrom = args.defaultModelPath;
        else if (arg === '--log-every') args.logEvery = Number(argv[++i] || args.logEvery);
    }

    return args;
}

function usage() {
    console.log('Usage: node train.mjs [options]');
    console.log('Options:');
    console.log('  --episodes <n>');
    console.log('  --minutes <n>              (run for up to n minutes, ignoring --episodes)');
    console.log('  --max-turns <n>');
    console.log('  --cooperative-depth <n>');
    console.log('  --minimax-depth <n>        (alias for --cooperative-depth)');
    console.log('  --learning-rate <n>');
    console.log('  --gamma <0..1>');
    console.log('  --target-clip <n>');
    console.log('  --error-clip <n>');
    console.log('  --huber-delta <n>');
    console.log('  --epsilon-start <0..1>');
    console.log('  --epsilon-end <0..1>');
    console.log('  --epsilon-decay <0..1>');
    console.log('  --rows <n> --cols <n>');
    console.log('  --tile-values <comma-separated, e.g. 2,4>');
    console.log('  --out-dir <path>');
    console.log('  --prefix <name>');
    console.log('  --default-model-path <path>');
    console.log('  --resume                 (resume from default-model-path)');
    console.log('  --resume-from <path>');
    console.log('  --log-every <n>');
}

function validateArgs(args) {
    if (!Number.isFinite(args.episodes) || args.episodes < 1) throw new Error('episodes must be >= 1');
    if (!Number.isFinite(args.minutes) || args.minutes < 0) throw new Error('minutes must be >= 0');
    if (!Number.isFinite(args.maxTurns) || args.maxTurns < 1) throw new Error('max-turns must be >= 1');
    if (!Number.isFinite(args.cooperativeDepth) || args.cooperativeDepth < 1) throw new Error('cooperative-depth must be >= 1');
    if (!Number.isFinite(args.learningRate) || args.learningRate <= 0) throw new Error('learning-rate must be > 0');
    if (!Number.isFinite(args.gamma) || args.gamma < 0 || args.gamma > 1) throw new Error('gamma must be in [0, 1]');
    if (!Number.isFinite(args.targetClip) || args.targetClip <= 0) throw new Error('target-clip must be > 0');
    if (!Number.isFinite(args.errorClip) || args.errorClip <= 0) throw new Error('error-clip must be > 0');
    if (!Number.isFinite(args.huberDelta) || args.huberDelta <= 0) throw new Error('huber-delta must be > 0');
    if (!Number.isFinite(args.epsilonStart) || args.epsilonStart < 0 || args.epsilonStart > 1) throw new Error('epsilon-start must be in [0, 1]');
    if (!Number.isFinite(args.epsilonEnd) || args.epsilonEnd < 0 || args.epsilonEnd > 1) throw new Error('epsilon-end must be in [0, 1]');
    if (!Number.isFinite(args.epsilonDecay) || args.epsilonDecay <= 0 || args.epsilonDecay > 1) throw new Error('epsilon-decay must be in (0, 1]');
    if (!Array.isArray(args.tileValues) || args.tileValues.length < 1) throw new Error('tile-values must contain at least one value');
    if (typeof args.defaultModelPath !== 'string' || args.defaultModelPath.trim().length === 0) throw new Error('default-model-path must be a non-empty path');
}

function versionedRunPrefix(outDir, prefix) {
    let version = 1;
    while (true) {
        const suffix = version === 1 ? '' : `.v${version}`;
        const candidatePrefix = `${prefix}${suffix}`;
        const modelPath = join(outDir, `${candidatePrefix}.model.json`);
        const statsPath = join(outDir, `${candidatePrefix}.stats.json`);
        if (!existsSync(modelPath) && !existsSync(statsPath)) {
            return candidatePrefix;
        }
        version++;
    }
}

function tryLoadModel(path, inputSize, rows, cols) {
    if (!path) return null;
    if (!existsSync(path)) {
        throw new Error(`resume model not found: ${path}`);
    }

    const rawText = readFileSync(path, 'utf8');
    const parsed = JSON.parse(rawText);
    const metadata = parsed?.metadata;
    if (metadata && typeof metadata === 'object') {
        if (Number.isFinite(metadata.inputSize) && metadata.inputSize !== inputSize) {
            throw new Error(`resume model metadata input size (${metadata.inputSize}) does not match expected size (${inputSize})`);
        }
        if (Number.isFinite(metadata.rows) && metadata.rows !== rows) {
            throw new Error(`resume model metadata rows (${metadata.rows}) does not match expected rows (${rows})`);
        }
        if (Number.isFinite(metadata.cols) && metadata.cols !== cols) {
            throw new Error(`resume model metadata cols (${metadata.cols}) does not match expected cols (${cols})`);
        }
    }

    const model = NeuralNetwork.fromJSON(rawText);
    if (model.layerSizes[0] !== inputSize) {
        throw new Error(`resume model input size (${model.layerSizes[0]}) does not match expected size (${inputSize})`);
    }
    const outputSize = model.layerSizes[model.layerSizes.length - 1];
    if (outputSize !== 1) {
        throw new Error(`resume model output size (${outputSize}) is invalid, expected 1`);
    }

    return model;
}

function createInitialState(rows, cols) {
    return {
        grid: Array.from({ length: rows }, () => Array(cols).fill(0)),
        score: 0,
        turn: 'place',
        history: [],
        turnNumber: 0
    };
}

function cloneState(state) {
    return {
        grid: state.grid.map(row => row.slice()),
        score: state.score,
        turn: state.turn,
        history: state.history.map(entry => JSON.parse(JSON.stringify(entry))),
        turnNumber: state.turnNumber
    };
}

function evaluateState(model, state, inputSize) {
    return model.forward(encodeState(state, inputSize))[0];
}

function legalPlacements(state, tileValues) {
    const empties = listEmptyCells(state.grid);
    const placements = [];
    for (const [r, c] of empties) {
        for (const value of tileValues) {
            placements.push({ r, c, value });
        }
    }
    return placements;
}

function legalMoves(state) {
    const directions = ['left', 'right', 'up', 'down'];
    const moves = [];
    for (const direction of directions) {
        const result = simulateAMove(direction, state);
        if (result.moved) moves.push(direction);
    }
    return moves;
}

function pickRandom(items) {
    return items[Math.floor(Math.random() * items.length)] ?? null;
}

function clamp(value, maxAbs) {
    if (value > maxAbs) return maxAbs;
    if (value < -maxAbs) return -maxAbs;
    return value;
}

function terminalInfo(state, params, turnsCompleted) {
    const noFutureMove = state.turn === 'move' && !hasAnyMove(state);
    if (noFutureMove) return { terminal: true, reason: 'no-move' };

    const noFuturePlacement = state.turn === 'place' && legalPlacements(state, params.tileValues).length === 0;
    if (noFuturePlacement) return { terminal: true, reason: 'no-placement' };

    if (turnsCompleted >= params.maxTurns) return { terminal: true, reason: 'max-turns' };
    return { terminal: false, reason: 'active' };
}

function applyMove(state, direction) {
    const result = simulateAMove(direction, state);
    if (!result.moved) return { moved: false };
    state.grid = result.grid;
    state.score += result.mergedScore;
    state.turn = 'place';
    state.turnNumber++;
    state.history.push({ action: { type: 'move', direction }, nextTurn: 'place' });
    return { moved: true };
}

function applyPlacement(state, placement) {
    const ok = addTileAt(state.grid, placement.r, placement.c, placement.value);
    if (!ok) return { placed: false };
    state.turn = 'move';
    state.turnNumber++;
    state.history.push({ action: { type: 'place', r: placement.r, c: placement.c, value: placement.value }, nextTurn: 'move' });
    return { placed: true };
}

function tdUpdate(model, state, target, inputSize, learningRate, errorClip, huberDelta) {
    const activations = [];
    const preActivations = [];

    let current = encodeState(state, inputSize);
    activations.push(current);

    for (const layer of model.layers) {
        const z = new Array(layer.outSize);
        for (let o = 0; o < layer.outSize; o++) {
            let sum = layer.biases[o];
            for (let i = 0; i < layer.inSize; i++) {
                sum += layer.weights[o][i] * current[i];
            }
            z[o] = sum;
        }
        preActivations.push(z);

        const a = layer.isOutput ? z.slice() : z.map(v => (v > 0 ? v : 0));
        activations.push(a);
        current = a;
    }

    const prediction = activations[activations.length - 1][0] ?? 0;
    if (!Number.isFinite(prediction) || !Number.isFinite(target)) {
        throw new Error(`non-finite TD term: prediction=${prediction} target=${target}`);
    }

    const rawError = prediction - target;
    const error = clamp(rawError, errorClip);

    const absError = Math.abs(error);
    const loss = absError <= huberDelta
        ? 0.5 * error * error
        : huberDelta * (absError - 0.5 * huberDelta);
    const outputDelta = absError <= huberDelta
        ? error
        : huberDelta * Math.sign(error);

    let delta = new Array(model.layers[model.layers.length - 1].outSize).fill(0);
    delta[0] = outputDelta;

    for (let layerIndex = model.layers.length - 1; layerIndex >= 0; layerIndex--) {
        const layer = model.layers[layerIndex];
        const aPrev = activations[layerIndex];
        const zCurrent = preActivations[layerIndex];

        const dz = new Array(layer.outSize);
        for (let o = 0; o < layer.outSize; o++) {
            dz[o] = layer.isOutput ? delta[o] : (zCurrent[o] > 0 ? delta[o] : 0);
        }

        const deltaPrev = new Array(layer.inSize).fill(0);
        for (let i = 0; i < layer.inSize; i++) {
            let sum = 0;
            for (let o = 0; o < layer.outSize; o++) {
                sum += layer.weights[o][i] * dz[o];
            }
            deltaPrev[i] = sum;
        }

        for (let o = 0; o < layer.outSize; o++) {
            for (let i = 0; i < layer.inSize; i++) {
                layer.weights[o][i] -= learningRate * dz[o] * aPrev[i];
            }
            layer.biases[o] -= learningRate * dz[o];
        }

        delta = deltaPrev;
    }

    return { loss, prediction };
}

function runEpisode(model, params, epsilon, inputSize) {
    const state = createInitialState(params.rows, params.cols);
    const cooperativeMover = minmaxM(model, params.cooperativeDepth);
    const cooperativePlacer = minmaxP(model, params.cooperativeDepth);

    for (let i = 0; i < 2; i++) {
        const placement = cooperativePlacer.fun(state);
        if (!placement) break;
        const placed = applyPlacement(state, placement);
        if (!placed.placed) break;
    }

    let done = false;
    let turns = 0;
    let totalLoss = 0;
    let updates = 0;
    let randomActions = 0;
    let moveActions = 0;
    let placementActions = 0;
    let terminalReason = 'active';

    while (!done && turns < params.maxTurns) {
        const stateTerminal = terminalInfo(state, params, turns);
        if (stateTerminal.terminal) {
            terminalReason = stateTerminal.reason;
            done = true;
            break;
        }

        const before = cloneState(state);
        let actionApplied = false;

        if (state.turn === 'move') {
            const availableMoves = legalMoves(state);
            if (availableMoves.length === 0) {
                done = true;
                terminalReason = 'no-move';
                break;
            }
            const useRandom = Math.random() < epsilon;
            const move = useRandom
                ? { direction: pickRandom(availableMoves) }
                : cooperativeMover.fun(state);
            if (!move) {
                done = true;
                terminalReason = 'no-move';
            } else {
                const result = applyMove(state, move.direction);
                actionApplied = result.moved;
                if (!result.moved) done = true;
                if (useRandom) randomActions++;
                moveActions++;
            }
        } else {
            const placements = legalPlacements(state, params.tileValues);
            if (placements.length === 0) {
                done = true;
                terminalReason = 'no-placement';
                break;
            }
            const useRandom = Math.random() < epsilon;
            const placement = useRandom
                ? pickRandom(placements)
                : cooperativePlacer.fun(state);
            if (!placement) {
                done = true;
                terminalReason = 'no-placement';
            } else {
                const result = applyPlacement(state, placement);
                actionApplied = result.placed;
                if (!result.placed) done = true;
                if (useRandom) randomActions++;
                placementActions++;
            }
        }

        if (!actionApplied) break;

        const immediateReward = reward(state) - reward(before);
        const postActionTerminal = terminalInfo(state, params, turns + 1);
        const terminal = postActionTerminal.terminal;
        if (terminal) terminalReason = postActionTerminal.reason;

        const bootstrap = terminal ? 0 : evaluateState(model, state, inputSize);
        const targetUnclipped = immediateReward + params.gamma * bootstrap;
        const target = clamp(targetUnclipped, params.targetClip);
        const { loss } = tdUpdate(
            model,
            before,
            target,
            inputSize,
            params.learningRate,
            params.errorClip,
            params.huberDelta
        );
        if (!Number.isFinite(loss)) {
            throw new Error(`non-finite loss detected: ${loss}`);
        }
        totalLoss += loss;
        updates++;

        turns++;
        if (terminal) done = true;
    }

    return {
        score: state.score,
        turns,
        avgLoss: updates > 0 ? totalLoss / updates : 0,
        updates,
        randomActions,
        moveActions,
        placementActions,
        terminalReason,
        finalState: state
    };
}

function saveResults(model, params, stats) {
    mkdirSync(params.outDir, { recursive: true });
    const resolvedPrefix = versionedRunPrefix(params.outDir, params.prefix);
    const modelPath = join(params.outDir, `${resolvedPrefix}.model.json`);
    const statsPath = join(params.outDir, `${resolvedPrefix}.stats.json`);

    const modelData = JSON.parse(model.toJSON());
    modelData.metadata = {
        rows: params.rows,
        cols: params.cols,
        inputSize: params.rows * params.cols + 4,
        createdAt: new Date().toISOString(),
        trainingMode: 'cooperative-td'
    };
    writeFileSync(modelPath, JSON.stringify(modelData), 'utf8');
    writeFileSync(statsPath, `${JSON.stringify(stats, null, 2)}\n`, 'utf8');
    mkdirSync(dirname(params.defaultModelPath), { recursive: true });
    copyFileSync(modelPath, params.defaultModelPath);

    console.log(JSON.stringify({ modelPath, statsPath, defaultModelPath: params.defaultModelPath }, null, 2));
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    if (process.argv.includes('--help') || process.argv.includes('-h')) {
        usage();
        return;
    }

    validateArgs(args);

    const inputSize = args.rows * args.cols + 4;
    const model = tryLoadModel(args.resumeFrom, inputSize, args.rows, args.cols) || new NeuralNetwork([inputSize, 512, 256, 128, 64, 32, 16, 1]);

    let epsilon = args.epsilonStart;
    const stats = [];
    const startTimeMs = Date.now();
    const timeBudgetMs = args.minutes > 0 ? args.minutes * 60_000 : null;
    const maxEpisodes = timeBudgetMs === null ? args.episodes : Number.POSITIVE_INFINITY;

    let episode = 0;
    while (episode < maxEpisodes) {
        if (timeBudgetMs !== null && (Date.now() - startTimeMs) >= timeBudgetMs) {
            break;
        }

        const episodeResult = runEpisode(model, args, epsilon, inputSize);
        epsilon = Math.max(args.epsilonEnd, epsilon * args.epsilonDecay);

        const entry = {
            episode,
            score: episodeResult.score,
            turns: episodeResult.turns,
            avgLoss: episodeResult.avgLoss,
            updates: episodeResult.updates,
            randomActions: episodeResult.randomActions,
            moveActions: episodeResult.moveActions,
            placementActions: episodeResult.placementActions,
            terminalReason: episodeResult.terminalReason,
            epsilon
        };
        stats.push(entry);

        if (episode % args.logEvery === 0) {
            const randomRate = entry.turns > 0 ? (100 * entry.randomActions / entry.turns) : 0;
            console.log(`episode=${episode} score=${entry.score.toFixed(1)} turns=${entry.turns} loss=${entry.avgLoss.toFixed(6)} epsilon=${entry.epsilon.toFixed(4)} randomRate=${randomRate.toFixed(1)}% terminal=${entry.terminalReason}`);
        }

        episode++;
    }

    saveResults(model, args, stats);
}

main();
