

/**
 * Compute top/left position in pixels for a cell
 * @param {number} r - Row index
 * @param {number} c - Column index
 * @returns {CellPosition} Position object with top and left in pixels
 */
export function cellPositionPx(r, c) {
    const cellSize = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--cell-size'));
    const gap = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--gap'));
    return { top: r * (cellSize + gap), left: c * (cellSize + gap) };
}