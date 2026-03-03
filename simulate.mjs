import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname, basename, join } from 'node:path';
import { addTileAt, simulateAMove, simulateHistory } from './app/engine.mjs';

/** @type {Direction[]} */
const DIRECTIONS = ['left', 'right', 'up', 'down'];

function cloneState(state) {
    return {
        grid: state.grid.map(row => row.slice()),
        score: state.score,
        turn: state.turn,
        history: state.history.map(entry => JSON.parse(JSON.stringify(entry))),
        turnNumber: state.turnNumber
    };
}

function countEmptyCells(grid) {
    let count = 0;
    for (let r = 0; r < grid.length; r++) {
        for (let c = 0; c < grid[0].length; c++) {
            if (grid[r][c] === 0) count++;
        }
    }
    return count;
}

function listEmptyCells(grid) {
    const empties = [];
    for (let r = 0; r < grid.length; r++) {
        for (let c = 0; c < grid[0].length; c++) {
            if (grid[r][c] === 0) empties.push([r, c]);
        }
    }
    return empties;
}

function hasAnyMove(state) {
    return DIRECTIONS.some(direction => simulateAMove(direction, state).moved);
}

function pickRandom(array) {
    return array[Math.floor(Math.random() * array.length)];
}

function chooseTileValue(tileValues) {
    const first = tileValues[0] ?? 2;
    const second = tileValues[1] ?? first;
    return Math.random() < 0.9 ? first : second;
}

/** @type {Record<string, (state: GameState) => Move | null>} */
const moverStrategies = {
    random(state) {
        const validDirections = DIRECTIONS.filter(direction => simulateAMove(direction, state).moved);
        if (validDirections.length === 0) return null;
        return { type: 'move', direction: pickRandom(validDirections) };
    },
    'up-down-left-right'(state) {
        for (const direction of ['up', 'down', 'left', 'right']) {
            if (simulateAMove(direction, state).moved) return { type: 'move', direction };
        }
        return null;
    },
    greedy(state) {
        let bestDirection = null;
        let bestScore = -Infinity;
        for (const direction of DIRECTIONS) {
            const moveResult = simulateAMove(direction, state);
            if (!moveResult.moved) continue;
            const emptyAfter = countEmptyCells(moveResult.grid);
            const score = moveResult.mergedScore * 1000 + emptyAfter;
            if (score > bestScore) {
                bestScore = score;
                bestDirection = direction;
            }
        }
        if (!bestDirection) return null;
        return { type: 'move', direction: bestDirection };
    }
};

/** @type {Record<string, (state: GameState, tileValues: number[]) => Place | null>} */
const placerStrategies = {
    random(state, tileValues) {
        const empties = listEmptyCells(state.grid);
        if (empties.length === 0) return null;
        const [r, c] = pickRandom(empties);
        return { type: 'place', r, c, value: chooseTileValue(tileValues) };
    },
    'max-empty'(state, tileValues) {
        const empties = listEmptyCells(state.grid);
        if (empties.length === 0) return null;
        const best = empties.sort((a, b) => (a[0] + a[1]) - (b[0] + b[1]))[0];
        return { type: 'place', r: best[0], c: best[1], value: tileValues[0] ?? 2 };
    },
    'min-empty'(state, tileValues) {
        const empties = listEmptyCells(state.grid);
        if (empties.length === 0) return null;
        const best = empties.sort((a, b) => (b[0] + b[1]) - (a[0] + a[1]))[0];
        const first = tileValues[0] ?? 2;
        const second = tileValues[1] ?? first;
        return { type: 'place', r: best[0], c: best[1], value: second };
    }
};

function generateHistoryWithStrategies(initialState, options) {
    const maxTurns = Number(options.maxTurns || 1000);
    const tileValues = Array.isArray(options.tileValues) && options.tileValues.length > 0 ? options.tileValues : [2, 4];
    const mover = moverStrategies[options.player1];
    const placer = placerStrategies[options.player2];
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
        player1: 'random',
        player2: 'random',
        maxTurns: 1000,
        listStrategies: false
    };
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--state') args.state = argv[++i] || '';
        else if (arg === '--history') args.history = argv[++i] || '';
        else if (arg === '--history-out') args.historyOut = argv[++i] || '';
        else if (arg === '--final-state-out') args.finalStateOut = argv[++i] || '';
        else if (arg === '--generate') args.generate = true;
        else if (arg === '--player1') args.player1 = argv[++i] || 'random';
        else if (arg === '--player2') args.player2 = argv[++i] || 'random';
        else if (arg === '--max-turns') args.maxTurns = Number(argv[++i] || 1000);
        else if (arg === '--list-strategies') args.listStrategies = true;
    }
    return args;
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
    console.log('  List available strategy names:');
    console.log('    node simulate.mjs --list-strategies');
}

function defaultOutputPaths(statePath) {
    const folder = dirname(statePath);
    const base = basename(statePath, extname(statePath)) || 'simulation';
    return {
        historyOut: join(folder, `${base}.history.json`),
        finalStateOut: join(folder, `${base}.final_state.json`)
    };
}

const args = parseArgs(process.argv.slice(2));
if (args.listStrategies) {
    console.log(JSON.stringify({
        player1: Object.keys(moverStrategies),
        player2: Object.keys(placerStrategies)
    }, null, 2));
    process.exit(0);
}

if (!args.state) {
    usage();
    process.exit(1);
}

const loaded = readJson(args.state);
const loadedState = normalizeState(loaded);
if (!loadedState || !Array.isArray(loadedState.grid)) {
    console.error('Invalid state file: expected GameState or SaveState with game.grid');
    process.exit(1);
}

const initialState = {
    grid: loadedState.grid.map(row => row.slice()),
    score: Number(loadedState.score || 0),
    turn: loadedState.turn || 'move',
    history: [],
    turnNumber: Number(loadedState.turnNumber || 0)
};

const tileValues = Array.isArray(loaded?.config?.tileValues) ? loaded.config.tileValues : [2, 4];

let history;
if (args.generate) {
    history = generateHistoryWithStrategies(initialState, {
        player1: args.player1,
        player2: args.player2,
        maxTurns: args.maxTurns,
        tileValues
    });
} else {
    history = args.history ? readJson(args.history) : loadedState.history || [];
    if (!Array.isArray(history)) {
        console.error('Invalid history file: expected array');
        process.exit(1);
    }
}

const result = simulateHistory(history, initialState);

const defaults = defaultOutputPaths(args.state);
const historyOutPath = args.historyOut || defaults.historyOut;
const finalStateOutPath = args.finalStateOut || defaults.finalStateOut;

writeFileSync(historyOutPath, `${JSON.stringify(history, null, 2)}\n`, 'utf8');
writeFileSync(finalStateOutPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');

console.log(JSON.stringify({
    historyOut: historyOutPath,
    finalStateOut: finalStateOutPath,
    generatedWithStrategies: args.generate ? { player1: args.player1, player2: args.player2 } : undefined
}, null, 2));
