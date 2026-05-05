import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname, basename, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { addTileAt, simulateAMove, simulateHistory } from './app/engine.mjs';
import { NeuralNetwork, encodeState } from './app/strategies/nn.js';
import { firstPlayerStrategies, secondPlayerStrategies } from './app/strategies/list.js';

/** @type {Direction[]} */
const DIRECTIONS = ['left', 'right', 'up', 'down'];

export function cloneState(state) {
    return {
        grid: state.grid.map(row => row.slice()),
        score: state.score,
        turn: state.turn,
        history: state.history.map(entry => JSON.parse(JSON.stringify(entry))),
        turnNumber: state.turnNumber
    };
}

export function countEmptyCells(grid) {
    let count = 0;
    for (let r = 0; r < grid.length; r++) {
        for (let c = 0; c < grid[0].length; c++) {
            if (grid[r][c] === 0) count++;
        }
    }
    return count;
}

export function listEmptyCells(grid) {
    const empties = [];
    for (let r = 0; r < grid.length; r++) {
        for (let c = 0; c < grid[0].length; c++) {
            if (grid[r][c] === 0) empties.push([r, c]);
        }
    }
    return empties;
}

export function hasAnyMove(state) {
    return DIRECTIONS.some(direction => simulateAMove(direction, state).moved);
}

export function pickRandom(array) {
    return array[Math.floor(Math.random() * array.length)];
}

export function chooseTileValue(tileValues) {
    const first = tileValues[0] ?? 2;
    const second = tileValues[1] ?? first;
    return Math.random() < 0.9 ? first : second;
}

export function generateHistoryWithStrategies(initialState, options) {
    const maxTurns = Number(options.maxTurns || 1000);
    const tileValues = Array.isArray(options.tileValues) && options.tileValues.length > 0 ? options.tileValues : [2, 4];
    const mover = firstPlayerStrategies[options.player1]?.fun;
    const placer = secondPlayerStrategies[options.player2]?.fun;
    if (!mover) throw new Error(`Unknown player1 strategy: ${options.player1}`);
    if (!placer) throw new Error(`Unknown player2 strategy: ${options.player2}`);

    const state = cloneState(initialState);
    const history = [];

    while (history.length < maxTurns) {
        if (state.turn === 'move') {
            if (!hasAnyMove(state)) break;
            const move = mover(state);
            if (!move) break;
            const result = simulateAMove(move.direction, state);
            if (!result.moved) break;
            state.grid = result.grid;
            state.score += result.mergedScore;
            state.turnNumber++;
            state.turn = 'place';
            history.push({ action: { type: 'move', direction: move.direction }, nextTurn: 'place' });
        } else {
            const place = placer(state, tileValues);
            if (!place) break;
            const placed = addTileAt(state.grid, place.r, place.c, place.value);
            if (!placed) break;
            state.turnNumber++;
            state.turn = 'move';
            history.push({ action: { type: 'place', r: place.r, c: place.c, value: place.value }, nextTurn: 'move' });
        }
    }

    return history;
}

function parseArgs(argv) {
    const args = {
        state: '',
        history: '',
        historyOut: '',
        finalStateOut: '',
        generate: false,
        defaultNn: false,
        defaultModelPath: './default.model',
        player1: 'random',
        player2: 'random',
        rows: 4,
        cols: 4,
        tileValues: [2, 4],
        maxTurns: 1000,
        depth: 10,
        listStrategies: false
    };
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--state') args.state = argv[++i] || '';
        else if (arg === '--history') args.history = argv[++i] || '';
        else if (arg === '--history-out') args.historyOut = argv[++i] || '';
        else if (arg === '--final-state-out') args.finalStateOut = argv[++i] || '';
        else if (arg === '--generate') args.generate = true;
        else if (arg === '--default-nn') args.defaultNn = true;
        else if (arg === '--default-model-path') args.defaultModelPath = argv[++i] || './default.model';
        else if (arg === '--player1') args.player1 = argv[++i] || 'random';
        else if (arg === '--player2') args.player2 = argv[++i] || 'random';
        else if (arg === '--rows') args.rows = Number(argv[++i] || 4);
        else if (arg === '--cols') args.cols = Number(argv[++i] || 4);
        else if (arg === '--tile-values') args.tileValues = String(argv[++i] || '2,4').split(',').map(v => Number(v.trim())).filter(Number.isFinite);
        else if (arg === '--max-turns') args.maxTurns = Number(argv[++i] || 1000);
        else if (arg === '--depth') args.depth = Number(argv[++i] || 10);
        else if (arg === '--list-strategies') args.listStrategies = true;
    }
    return args;
}

function createDefaultState(rows, cols) {
    return {
        grid: Array.from({ length: rows }, () => Array(cols).fill(0)),
        score: 0,
        turn: 'place',
        history: [],
        turnNumber: 0
    };
}

function readJson(path) {
    return JSON.parse(readFileSync(path, 'utf8'));
}

function normalizeState(raw) {
    if (raw && raw.game && raw.game.grid) return raw.game;
    return raw;
}

function usage() {
    console.log('Usage:');
    console.log('  Replay history:');
    console.log('    node simulate.mjs --state <state.json> [--history <history.json>] [--history-out <history.json>] [--final-state-out <final_state.json>]');
    console.log('  Generate history from strategies:');
    console.log('    node simulate.mjs --state <state.json> --generate --player1 <name> --player2 <name> [--max-turns <n>] [--history-out <history.json>] [--final-state-out <final_state.json>]');
    console.log('  Generate with default neural network model:');
    console.log('    node simulate.mjs --default-nn [--default-model-path <model>] [--depth <n>] [--rows <n>] [--cols <n>] [--tile-values <2,4>] [--max-turns <n>] [--history-out <history.json>] [--final-state-out <final_state.json>]');
    console.log('  List available strategy names:');
    console.log('    node simulate.mjs --list-strategies');
}

function defaultOutputPaths(statePath, fallbackBase = 'simulation') {
    if (!statePath) {
        return {
            historyOut: `${fallbackBase}.history.json`,
            finalStateOut: `${fallbackBase}.final_state.json`
        };
    }

    const folder = dirname(statePath);
    const base = basename(statePath, extname(statePath)) || fallbackBase;
    return {
        historyOut: join(folder, `${base}.history.json`),
        finalStateOut: join(folder, `${base}.final_state.json`)
    };
}

function buildSaveState(game, args, tileValues, loadedConfig) {
    const rows = Array.isArray(game.grid) ? game.grid.length : Number(args.rows || 4);
    const cols = Array.isArray(game.grid) && game.grid.length > 0 ? game.grid[0].length : Number(args.cols || 4);
    const config = {
        rows: Number(loadedConfig?.rows || rows),
        cols: Number(loadedConfig?.cols || cols),
        storageKey: loadedConfig?.storageKey || 'local2048_v2',
        tileValues: Array.isArray(loadedConfig?.tileValues) ? loadedConfig.tileValues : tileValues,
        firstPlayerStrategy: loadedConfig?.firstPlayerStrategy || args.player1,
        secondPlayerStrategy: loadedConfig?.secondPlayerStrategy || args.player2,
        initialPlacementsCount: Number(loadedConfig?.initialPlacementsCount || 0),
        loadedHistory: loadedConfig?.loadedHistory
    };

    return {
        game,
        config
    };
}

export function runSimulationCli(argv = process.argv.slice(2)) {
    const args = parseArgs(argv);
    if (args.defaultNn) {
        args.generate = true;
        args.player1 = 4;
        args.player2 = 5;
    }

    if (!args.state && !args.defaultNn) {
        usage();
        process.exit(1);
    }

    let loaded;
    let loadedState;
    if (args.state) {
        loaded = readJson(args.state);
        loadedState = normalizeState(loaded);
        if (!loadedState || !Array.isArray(loadedState.grid)) {
            console.error('Invalid state file: expected GameState or SaveState with game.grid');
            process.exit(1);
        }
    } else {
        loadedState = createDefaultState(args.rows, args.cols);
    }

    const initialState = {
        grid: loadedState.grid.map(row => row.slice()),
        score: Number(loadedState.score || 0),
        turn: loadedState.turn || 'move',
        history: [],
        turnNumber: Number(loadedState.turnNumber || 0)
    };

    const tileValues = Array.isArray(loaded?.config?.tileValues)
        ? loaded.config.tileValues
        : (Array.isArray(args.tileValues) && args.tileValues.length > 0 ? args.tileValues : [2, 4]);
    const activeMoverStrategies = firstPlayerStrategies;
    const activePlacerStrategies = secondPlayerStrategies;

    let history;
    if (args.generate) {
        history = generateHistoryWithStrategies(initialState, {
            player1: args.player1,
            player2: args.player2,
            maxTurns: args.maxTurns,
            tileValues,
            moverStrategies: activeMoverStrategies,
            placerStrategies: activePlacerStrategies
        });
    } else {
        history = args.history ? readJson(args.history) : loadedState.history || [];
        if (!Array.isArray(history)) {
            console.error('Invalid history file: expected array');
            process.exit(1);
        }
    }

    const result = simulateHistory(history, initialState);

    const defaults = defaultOutputPaths(args.state, args.defaultNn ? 'default_nn' : 'simulation');
    const historyOutPath = args.historyOut || defaults.historyOut;
    const finalStateOutPath = args.finalStateOut || defaults.finalStateOut;

    const finalSaveState = buildSaveState(result, args, tileValues, loaded?.config);

    writeFileSync(historyOutPath, `${JSON.stringify(history, null, 2)}\n`, 'utf8');
    writeFileSync(finalStateOutPath, `${JSON.stringify(finalSaveState, null, 2)}\n`, 'utf8');

    console.log(JSON.stringify({
        historyOut: historyOutPath,
        finalStateOut: finalStateOutPath,
        modelPath: args.defaultNn ? args.defaultModelPath : undefined,
        generatedWithStrategies: args.generate ? { player1: args.player1, player2: args.player2 } : undefined
    }, null, 2));
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
    runSimulationCli();
}
