import State from "../../state.js";

/**
 * @type {PlayerTwoStrategy}
 */
export default {
    name: "Coop Min",
    fun(state) {
        if (state.turnNumber === 0) {
            return { type: 'place', r: 0, c: 0, value: 2 };
        } else if (state.turnNumber === 1) {
            return { type: 'place', r: 1, c: 0, value: 4 };
        }

        let workingColumn = findWorkingColumn(state.grid);
        console.log("Working column:", workingColumn);
        if (workingColumn == null) {
            workingColumn = findFirstEmptyColumnWithNeighbour(state.grid);
            let cell = {c : workingColumn, r: 0};
            let neighbouringCell = findFirstNeighbouringCell(state.grid, cell);
            console.log("First empty column with neighbour:", workingColumn);
            console.log("First neighbouring cell:", neighbouringCell);
            if (neighbouringCell) {
                return { type: 'place', r: cell.r, c: cell.c, value: state.grid[neighbouringCell.r][neighbouringCell.c] === 4 ? 2 : 4 };
            } else {
                return { type: 'place', r: cell.r, c: cell.c, value: 4 };
            }
        } else {
            let firstEmptyCell = findFirstEmptyCellWithNeighbourInColumn(state.grid, workingColumn);
            let firstNeighbouringCell = findFirstNeighbouringCell(state.grid, firstEmptyCell);
            console.log("First empty cell with neighbour:", firstEmptyCell);
            console.log("First neighbouring cell:", firstNeighbouringCell);
            if (firstNeighbouringCell) {
                return { type: 'place', r: firstEmptyCell.r, c: firstEmptyCell.c, value: state.grid[firstNeighbouringCell.r][firstNeighbouringCell.c] === 4 ? 2 : 4 };
            } else {
                return { type: 'place', r: firstEmptyCell.r, c: firstEmptyCell.c, value: 4 };
            }
        }
    }
}

/**
 * Finds the first column that has at least one empty cell and is not full.
 * @param {number[][]} grid
 * @returns {number|null} The index of the first working column or null if none found.
 */
function findWorkingColumn(grid) {
    for (let c = 0; c < grid.length; c++) {
        let hasEmptyCell = false;
        let isFull = true;
        for (let r = 0; r < grid.length; r++) {
            if (grid[r][c] === 0) {
                hasEmptyCell = true;
            } else {
                isFull = false;
            }
        }
        console.log(`Column ${c}: hasEmptyCell=${hasEmptyCell}, isFull=${isFull}`);
        if (hasEmptyCell && !isFull) {
            return c;
        }
    }
    return null;
}

/**
 * Finds the first empty cell with a neighbouring filled cell in the specified column.
 * @param {number[][]} grid
 * @param {number} column The index of the column to search.
 * @return {{r: number, c: number}|null} The coordinates of the first empty cell with a neighbour or null if none found.
 */
function findFirstEmptyCellWithNeighbourInColumn(grid, column) {
    for (let r = 0; r < grid.length; r++) {
        if (grid[r][column] === 0) {
            const cell = { r, c: column };
            //Check for neighbouring filled cells above and below
            const neighbours = [
                { dr: -1, dc: 0 }, // up
                { dr: 1, dc: 0 }   // down
            ];
            for (const { dr, dc } of neighbours) {
                const nr = cell.r + dr;
                const nc = cell.c + dc;
                if (nr >= 0 && nr < grid.length && nc >= 0 && nc < grid.length && grid[nr][nc] !== 0) {
                    return cell; // Found a neighbouring filled cell
                }
            }
        }
    }
    return null;
}

/**
 * Finds the first neighbouring cell of a given cell that is not empty.
 * @param {number[][]} grid
 * @param {{r: number, c: number}} cell
 * @returns {{r: number, c: number}|null} The coordinates of the first neighbouring cell or null if none found.
 */
function findFirstNeighbouringCell(grid, cell) {
    const directions = [
        { dr: -1, dc: 0 }, // up
        { dr: 1, dc: 0 },  // down
        { dr: 0, dc: -1 }, // left
        { dr: 0, dc: 1 }   // right
    ];
    for (const { dr, dc } of directions) {
        const r = cell.r + dr;
        const c = cell.c + dc;
        if (r >= 0 && r < grid.length && c >= 0 && c < grid.length && grid[r][c] !== 0) {
            return { r, c };
        }
    }
    return null;
}

/**
 * Finds the first empty column that has at least one neighbouring cell.
 * @param {number[][]} grid
 * @returns {number|null} The index of the first empty column with a neighbour or null if none found.
 */
function findFirstEmptyColumnWithNeighbour(grid) {
    for (let c = 0; c < grid.length; c++) {
        let hasNeighbour = false;
        for (let r = 0; r < grid.length; r++) {
            if (grid[r][c] === 0) {
                const cell = { r, c };
                if (findFirstNeighbouringCell(grid, cell)) {
                    hasNeighbour = true;
                    break;
                }
            }
        }
        if (hasNeighbour) return c;
    }
    return null;
}