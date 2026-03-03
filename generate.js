
let cachedSnakeRows = null;
let cachedSnakeCols = null;
let cachedSnakePath = [];
function getSnakePath(rows, cols) {
    if (rows <= 0 || cols <= 0) return [];
    if (cachedSnakeRows !== rows || cachedSnakeCols !== cols) {
        const path = [];
        for (let c = 0; c < cols; c++) {
            if (c % 2 === 0) {
                for (let r = 0; r < rows; r++) path.push([r, c]);
            } else {
                for (let r = rows - 1; r >= 0; r--) path.push([r, c]);
            }
        }
        cachedSnakePath = path;
        cachedSnakeRows = rows;
        cachedSnakeCols = cols;
    }
    return cachedSnakePath;
}

function generateDecaying(rows, cols, maxDecay, maxMalus) {
    const path = getSnakePath(rows, cols);
    const decaying = [];
    let value = Math.pow(2, rows * cols + 1 - maxMalus); // Start with the largest possible tile value
    for (let i = 0; i < path.length; i++) {
        const [r, c] = path[i];
        value = Math.floor(value / Math.pow(2, Math.round(Math.random() * maxDecay))); // Randomly decay the value
        if (value <= 4) value = 0; // Set small values to 0 for more empty space
        decaying.push({
            row: r,
            col: c,
            value: value
        });
    }
    return decaying;
}

/** @returns {SaveState} */
function decayToState(decaying, rows, cols) {
    return { 
        game: {
            grid: Array(rows).fill().map((_, i) => Array(cols).fill().map((_, j) => decaying.find(t => t.row === i && t.col === j)?.value || 0)),
            score: 0,
            turn: 'move',
            history: [],
            turnNumber: 0,
        }, config: {
            rows,
            cols,
            storageKey: "local2048_v2",
            tileValues: [2, 4],
            firstPlayerStrategy: undefined,
            secondPlayerStrategy: undefined,
            initialPlacementsCount: 0,
            loadedHistory: undefined
        }
    };
}

const generatedDecaying = decayToState(generateDecaying(4, 4, 2, 6), 4, 4);
//store to file (nodejs)
const fs = require('fs');
fs.writeFileSync('generated_decaying.json', JSON.stringify(generatedDecaying, null, 2));