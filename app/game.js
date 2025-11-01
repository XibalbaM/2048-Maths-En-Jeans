import State from './state.js';
import DataStore from './data.js';

/**
 * @typedef {'left' | 'right' | 'up' | 'down'} Direction
 */

/**
 * @typedef {Object} TileMove
 * @property {number} fromR - Source row
 * @property {number} fromC - Source column
 * @property {number} toR - Destination row
 * @property {number} toC - Destination column
 * @property {number} value - Tile value
 * @property {boolean} merged - Whether this tile was merged
 * @property {number} [newValue] - New value after merge (if merged)
 */

/**
 * @typedef {Object} MergedDestination
 * @property {number} r - Row
 * @property {number} c - Column
 * @property {number} newValue - Value after merge
 */

/**
 * @typedef {Object} MoveResult
 * @property {number[][]} grid - New grid state
 * @property {boolean} moved - Whether any tiles moved
 * @property {number} mergedScore - Score gained from merges
 * @property {TileMove[]} moves - Array of tile movements
 * @property {MergedDestination[]} mergedDestinations - Cells that received merges
 */

/**
 * @typedef {Object} CellPosition
 * @property {number} top - Top position in pixels
 * @property {number} left - Left position in pixels
 */

// DOM
/** @type {HTMLElement | null} */
const gridEl = document.getElementById('grid');
/** @type {HTMLElement | null} */
const tileLayer = document.getElementById('tile-layer');
/** @type {HTMLElement | null} */
const scoreEl = document.getElementById('score');
/** @type {HTMLElement | null} */
const newBtn = document.getElementById('newgame');
/** @type {HTMLElement | null} */
const boardEl = document.getElementById('board');
/** @type {HTMLElement | null} */
const resetBtn = document.getElementById('reset');
/** @type {HTMLElement | null} */
const editBtn = document.getElementById('edit');

// init CSS size var
document.documentElement.style.setProperty('--size', String(State.config.SIZE));

/**
 * Create a copy of the grid
 * @param {number[][]} g - Grid to copy
 * @returns {number[][]} Deep copy of the grid
 */
function copyGrid(g){ return g.map(row => row.slice()); }

/**
 * Reset the grid to empty state
 * @returns {void}
 */
function resetGrid(){
  State.game.grid = Array.from({length: State.config.SIZE}, () => Array(State.config.SIZE).fill(0));
}

// Persistence helpers moved to app/data.js (global DataStore)

/**
 * Add a tile at a specific position
 * @param {number} r - Row index
 * @param {number} c - Column index
 * @param {number} value - Tile value
 * @returns {boolean} True if tile was added, false if cell was occupied
 */
function addTileAt(r,c,value){
  if(State.game.grid[r][c]!==0) return false;
  State.game.grid[r][c] = value;
  return true;
}

/**
 * Add a random tile (fallback when SECOND_PLAYER_ENABLED=false)
 * @returns {{r: number, c: number, value: number} | false} Tile info or false if no empty cells
 */
function addRandomTile(){
  const empties = [];
  for(let r=0;r<State.config.SIZE;r++) for(let c=0;c<State.config.SIZE;c++) if(State.game.grid[r][c]===0) empties.push([r,c]);
  if(empties.length===0) return false;
  const [r,c] = empties[Math.floor(Math.random()*empties.length)];
  const v = Math.random() < 0.9 ? State.config.TILE_VALUES[0] : (State.config.TILE_VALUES[1]||State.config.TILE_VALUES[0]);
  State.game.grid[r][c] = v;
  return {r,c,value:v};
}

/**
 * Rotate a grid clockwise by specified number of 90-degree turns
 * @param {number[][]} g - Grid to rotate
 * @param {number} [times=1] - Number of 90-degree clockwise rotations
 * @returns {number[][]} Rotated grid
 */
function rotate(g, times=1){
  let res = copyGrid(g);
  for(let t=0;t<times;t++){
    const tmp = Array.from({length:State.config.SIZE}, ()=>Array(State.config.SIZE).fill(0));
    for(let r=0;r<State.config.SIZE;r++) for(let c=0;c<State.config.SIZE;c++) tmp[c][State.config.SIZE-1-r] = res[r][c];
    res = tmp;
  }
  return res;
}

/**
 * Move all tiles left and merge adjacent matching tiles
 * @param {number[][]} g - Grid to process
 * @returns {MoveResult} Result containing new grid, movement info, and score
 */
function moveLeftOnce(g){
  // Re-implementation to also produce movement mapping for animations
  let moved = false; let mergedScore = 0;
  const out = Array.from({length:State.config.SIZE}, ()=>Array(State.config.SIZE).fill(0));
  /** @type {TileMove[]} */
  const moves = [];
  /** @type {MergedDestination[]} */
  const mergedDestinations = [];

  for(let r=0;r<State.config.SIZE;r++){
    // collect non-zero tiles with original columns
    const entries = [];
    for(let c=0;c<State.config.SIZE;c++){
      const v = g[r][c];
      if(v!==0) entries.push({c, val:v});
    }
    let pos = 0; // destination column
    for(let i=0;i<entries.length;){
      const cur = entries[i];
      if(i+1 < entries.length && entries[i+1].val === cur.val){
        const mergeVal = cur.val * 2;
        out[r][pos] = mergeVal;
        mergedScore += mergeVal;
        // two tiles move/merge into the same destination
        moves.push({fromR:r, fromC:cur.c, toR:r, toC:pos, value:cur.val, merged:true, newValue:mergeVal});
        moves.push({fromR:r, fromC:entries[i+1].c, toR:r, toC:pos, value:entries[i+1].val, merged:true, newValue:mergeVal});
        mergedDestinations.push({r, c:pos, newValue:mergeVal});
        if(cur.c !== pos || entries[i+1].c !== pos) moved = true;
        i += 2; pos += 1;
      } else {
        out[r][pos] = cur.val;
        moves.push({fromR:r, fromC:cur.c, toR:r, toC:pos, value:cur.val, merged:false});
        if(cur.c !== pos) moved = true;
        i += 1; pos += 1;
      }
    }
  }
  return {grid:out,moved,mergedScore,moves,mergedDestinations};
}

/**
 * Check if any moves are possible on the grid
 * @param {number[][]} g - Grid to check
 * @returns {boolean} True if at least one move is possible
 */
function canMove(g){
  for(let r=0;r<State.config.SIZE;r++) for(let c=0;c<State.config.SIZE;c++){
    if(g[r][c]===0) return true;
    if(c+1<State.config.SIZE && g[r][c]===g[r][c+1]) return true;
    if(r+1<State.config.SIZE && g[r][c]===g[r+1][c]) return true;
  }
  return false;
}

/**
 * Map movement direction to number of clockwise rotations needed
 * @param {Direction} direction - Movement direction
 * @returns {number} Number of rotations (0-3)
 */
function rotatedForDirection(direction){
  // left:0, up:3, right:2, down:1  (mapping chosen so that moveLeftOnce handles left)
  if(direction==='left') return 0;
  if(direction==='up') return 3;
  if(direction==='right') return 2;
  if(direction==='down') return 1;
  return 0;
}

/**
 * Rotate a coordinate clockwise by specified number of 90-degree turns
 * @param {number} r - Row coordinate
 * @param {number} c - Column coordinate
 * @param {number} [times=1] - Number of 90-degree clockwise rotations
 * @returns {[number, number]} New [row, column] coordinates
 */
function rotateCoord(r, c, times=1){
  let rr = r, cc = c;
  for(let t=0;t<times;t++){
    const nrr = cc;
    const ncc = State.config.SIZE - 1 - rr;
    rr = nrr; cc = ncc;
  }
  return [rr, cc];
}

/**
 * Compute top/left position in pixels for a cell
 * @param {number} r - Row index
 * @param {number} c - Column index
 * @returns {CellPosition} Position object with top and left in pixels
 */
function cellPositionPx(r,c){
  const cellSize = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--cell-size'));
  const gap = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--gap'));
  return { top: r * (cellSize + gap), left: c * (cellSize + gap) };
}

/**
 * Animate tile movements from their source to destination positions
 * @param {TileMove[]} moves - Array of tile movements to animate
 * @param {number} rotatedTimes - Number of times the grid was rotated
 * @returns {Promise<void>} Promise that resolves when animations complete
 */
function animateMoves(moves, rotatedTimes){
  if (!tileLayer) return Promise.resolve();
  // Remove any previous moving tiles
  tileLayer.querySelectorAll('.moving-tile').forEach(el=>el.remove());
  const inv = (4 - rotatedTimes) % 4;
  /** @type {HTMLElement[]} */
  const animEls = [];
  moves.forEach(m => {
    // skip tiles that don't move
    const [fromR, fromC] = rotateCoord(m.fromR, m.fromC, inv);
    const [toR, toC] = rotateCoord(m.toR, m.toC, inv);
    if(fromR === toR && fromC === toC) return;
    // hide the original static tile at its origin so we don't see duplicates
    const baseEl = tileLayer?.querySelector(`.tile[data-r="${fromR}"][data-c="${fromC}"]`);
    if(baseEl && baseEl instanceof HTMLElement) baseEl.style.opacity = '0';
    const ghost = document.createElement('div');
    ghost.className = 'tile t-' + m.value + ' moving-tile';
    ghost.textContent = String(m.value);
    const fromPx = cellPositionPx(fromR, fromC);
    const toPx = cellPositionPx(toR, toC);
    ghost.style.top = fromPx.top + 'px';
    ghost.style.left = fromPx.left + 'px';
    tileLayer?.appendChild(ghost);
    // trigger transition
    requestAnimationFrame(()=>{
      ghost.style.top = toPx.top + 'px';
      ghost.style.left = toPx.left + 'px';
    });
    animEls.push(ghost);
  });
  if(animEls.length === 0) return Promise.resolve();
  // Wait for all transitions to finish (fallback timeout)
  return new Promise(resolve => {
    let remaining = animEls.length;
    const done = ()=>{ if(--remaining <= 0) resolve(); };
    setTimeout(()=>{ resolve(); }, 200);
    animEls.forEach(el => {
      el.addEventListener('transitionend', ()=>{
        el.remove();
        done();
      }, { once:true });
    });
  });
}

/**
 * Move tiles in the specified direction with animation
 * @param {Direction} direction - Direction to move tiles
 * @returns {Promise<boolean>} True if movement occurred, false otherwise
 */
async function move(direction){
  // prevent moving while player 2 is placing
  if(State.game.turn === 'place') return false;
  const rotatedTimes = rotatedForDirection(direction);
  const prev = State.game.grid;
  let working = rotate(prev, rotatedTimes);
  const result = moveLeftOnce(working);
  if(!result.moved) return false;
  // animate movements in original orientation before committing state
  await animateMoves(result.moves, rotatedTimes);
  // commit new state
  working = result.grid;
  working = rotate(working, (4-rotatedTimes)%4);
  State.game.grid = working;
  State.game.score += result.mergedScore;
  DataStore.saveGame();
  render();

  // After player 1 move: ask player 2 to place (unless disabled)
  if(State.config.SECOND_PLAYER_ENABLED){
    // switch to placement turn and await player 2
    await promptSecondPlayer(1);
  } else {
    addRandomTile();
  }
  DataStore.saveGame();
  render();
  // apply merge pop animation on merged destinations
  if(result.mergedDestinations && result.mergedDestinations.length){
    const inv = (4 - rotatedTimes) % 4;
    result.mergedDestinations.forEach(({r,c})=>{
      const [rr,cc] = rotateCoord(r,c, inv);
      const el = tileLayer.querySelector(`.tile[data-r="${rr}"][data-c="${cc}"]`);
      if(el) el.classList.add('merged');
    });
  }
  return true;
}

/**
 * Render the game board with current state
 * @returns {void}
 */
function render(){
  if (scoreEl) scoreEl.textContent = String(State.game.score);
  // grid visuals
  if (!gridEl) return;
  gridEl.innerHTML = '';
  for(let r=0;r<State.config.SIZE;r++){
    for(let c=0;c<State.config.SIZE;c++){
      const cell = document.createElement('div');
      cell.className = 'cell';
      gridEl.appendChild(cell);
    }
  }

  // tiles
  if (!tileLayer) return;
  tileLayer.innerHTML = '';
  const cellSize = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--cell-size'));
  const gap = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--gap'));
  for(let r=0;r<State.config.SIZE;r++){
    for(let c=0;c<State.config.SIZE;c++){
      const val = State.game.grid[r][c];
      if(val===0) continue;
      const tile = document.createElement('div');
      tile.className = 'tile t-' + val;
      tile.textContent = String(val);
      tile.dataset.r = String(r);
      tile.dataset.c = String(c);
      const topPx = r * (cellSize + gap);
      const leftPx = c * (cellSize + gap);
      tile.style.top = topPx + 'px';
      tile.style.left = leftPx + 'px';
      tileLayer.appendChild(tile);
      requestAnimationFrame(()=>{ tile.classList.add('show'); });
    }
  }
}

/**
 * Show configuration popup for starting a new game
 * @returns {void}
 */
function showConfigPopup(){
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  const title = document.createElement('p');
  title.textContent = 'Configuration de la nouvelle partie';
  const form = document.createElement('div');
  form.className = 'config-form';
  // Grid size
  const sizeLabel = document.createElement('label');
  sizeLabel.textContent = 'Taille de la grille (2-8): ';
  const sizeInput = document.createElement('input');
  sizeInput.type = 'number';
  sizeInput.min = String(2);
  sizeInput.max = String(8);
  sizeInput.value = String(State.config.SIZE);
  sizeLabel.appendChild(sizeInput);
  form.appendChild(sizeLabel);
  // Tile values
  const tileLabel = document.createElement('label');
  tileLabel.textContent = 'Valeurs des tuiles (séparées par des virgules): ';
  const tileInput = document.createElement('input');
  tileInput.type = 'text';
  tileInput.value = State.config.TILE_VALUES.join(',');
  tileLabel.appendChild(tileInput);
  form.appendChild(tileLabel);
  // Two player
  const playerLabel = document.createElement('label');
  const playerCheckbox = document.createElement('input');
  playerCheckbox.type = 'checkbox';
  playerCheckbox.checked = State.config.SECOND_PLAYER_ENABLED;
  playerLabel.appendChild(playerCheckbox);
  playerLabel.appendChild(document.createTextNode(' Mode deux joueurs'));
  form.appendChild(playerLabel);
  // Buttons
  const btnContainer = document.createElement('div');
  btnContainer.className = 'config-buttons';
  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Annuler';
  cancelBtn.onclick = () => overlay.remove();
  const startBtn = document.createElement('button');
  startBtn.textContent = 'Démarrer';
  startBtn.onclick = () => {
    // Parse
    let size = parseInt(sizeInput.value);
    if(isNaN(size) || size < 2) size = 2;
    if(size > 8) size = 8;
    const tileStr = tileInput.value.trim();
    let tileValues = tileStr.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
    if(tileValues.length === 0) tileValues = [2,4];
    const secondPlayer = playerCheckbox.checked;
    // Save
  const config = { tileValues, secondPlayerEnabled: secondPlayer, size };
  DataStore.saveConfig();
    // Update State.config
    State.config.TILE_VALUES = tileValues;
    State.config.SECOND_PLAYER_ENABLED = secondPlayer;
    State.config.SIZE = size;
    document.documentElement.style.setProperty('--size', String(State.config.SIZE));
    // Start new game, force reset
    overlay.remove();
    newGame();
  };
  btnContainer.appendChild(cancelBtn);
  btnContainer.appendChild(startBtn);
  form.appendChild(btnContainer);
  overlay.appendChild(title);
  overlay.appendChild(form);
  boardEl.appendChild(overlay);
}

/**
 * Prompt second player to place tiles
 * @param {number} [count=1] - Number of tiles to place
 * @returns {Promise<void>} Promise that resolves when placement is complete
 */
function promptSecondPlayer(count=1){
  // if already in placement turn, don't open another prompt
  if(State.game.turn === 'place') return Promise.resolve();
  // enter placement turn
  State.game.turn = 'place';
  return new Promise((resolve)=>{
    // create overlay with a small picker
    const overlay = document.createElement('div');
    overlay.className = 'overlay';

    const title = document.createElement('p');
    title.textContent = `Joueur 2 — placez ${count} tuile(s). Choisissez une case vide et une valeur.`;

    const panel = document.createElement('div');
    panel.className = 'placement-panel';

    // picker grid
    const pickerGrid = document.createElement('div');
    pickerGrid.className = 'picker-grid';
    pickerGrid.style.setProperty('--size', String(State.config.SIZE));

    // collect empties
    const empties = [];
  for(let r=0;r<State.config.SIZE;r++) for(let c=0;c<State.config.SIZE;c++) if(State.game.grid[r][c]===0) empties.push([r,c]);

    // build cells (clickable)
    /** @type {HTMLElement[]} */
    const cellEls = [];
    for(let r=0;r<State.config.SIZE;r++){
      for(let c=0;c<State.config.SIZE;c++){
        const el = document.createElement('div');
        el.className = 'picker-cell';
        if(State.game.grid[r][c]===0){ el.classList.add('empty'); el.textContent = ''; }
        else el.textContent = String(State.game.grid[r][c]);
        el.dataset.r = String(r);
        el.dataset.c = String(c);
        pickerGrid.appendChild(el);
        cellEls.push(el);
      }
    }

    // values area
    const valuesDiv = document.createElement('div');
    valuesDiv.className = 'placement-values';
    const info = document.createElement('div');
    info.textContent = 'Valeurs disponibles :';
    valuesDiv.appendChild(info);
    /** @type {HTMLButtonElement[]} */
    const valueButtons = [];
    State.config.TILE_VALUES.forEach(v=>{
      const b = document.createElement('button');
      b.className = 'value-btn';
      b.textContent = String(v);
      b.dataset.value = String(v);
      valuesDiv.appendChild(b);
      valueButtons.push(b);
    });

    // make value buttons draggable
    valueButtons.forEach(b => {
      b.draggable = true;
      b.addEventListener('dragstart', (e) => {
        if (e.dataTransfer) e.dataTransfer.setData('text/plain', b.dataset.value || '');
      });
    });

    // current selection
    /** @type {[number, number] | null} */
    let selectedCell = null;
    /** @type {number | null} */
    let selectedValue = null;
    let placementsLeft = count;

    function clearSelection(){
      selectedCell = null;
      selectedValue = null;
      cellEls.forEach(el=>el.classList.remove('selected'));
      valueButtons.forEach(b=>b.classList.remove('selected'));
    }

    // click on picker cell
    cellEls.forEach(el=>{
      el.addEventListener('click', ()=>{
        const r = parseInt(el.dataset.r || '0'), c = parseInt(el.dataset.c || '0');
        if(State.game.grid[r][c]!==0) return; // only empty
        if(selectedValue !== null){
          // place
          addTileAt(r,c,selectedValue);
          placementsLeft--;
          clearSelection();
          // update picker visuals
          pickerGrid.querySelectorAll('.picker-cell').forEach(cell=>{
            // @ts-ignore
            const rr = parseInt(cell.dataset.r), cc = parseInt(cell.dataset.c);
            if(State.game.grid[rr][cc]===0){ cell.classList.add('empty'); cell.textContent = ''; }
            else { cell.classList.remove('empty'); cell.textContent = State.game.grid[rr][cc].toString(); }
          });
          if(placementsLeft<=0){
            overlay.remove();
            // placement finished -> back to move turn
            State.game.turn = 'move';
            render();
            resolve();
          } else {
            title.textContent = `Joueur 2 — placez ${placementsLeft} tuile(s). Choisissez une case vide et une valeur.`;
          }
        } else {
          // select/deselect cell
          if(selectedCell && selectedCell[0] === r && selectedCell[1] === c){
            clearSelection();
          } else {
            clearSelection();
            selectedCell = [r,c];
            el.classList.add('selected');
          }
        }
      });

      // drag and drop
      el.addEventListener('dragover', (e) => {
        e.preventDefault();
      });
      el.addEventListener('dragenter', (e) => {
        const r = parseInt(el.dataset.r), c = parseInt(el.dataset.c);
        if(State.game.grid[r][c] === 0) el.classList.add('drag-over');
      });
      el.addEventListener('dragleave', (e) => {
        el.classList.remove('drag-over');
      });
      el.addEventListener('drop', (e) => {
        e.preventDefault();
        el.classList.remove('drag-over');
        const v = parseInt(e.dataTransfer.getData('text/plain'));
        const r = parseInt(el.dataset.r), c = parseInt(el.dataset.c);
        if(State.game.grid[r][c] === 0){
          addTileAt(r,c,v);
          placementsLeft--;
          clearSelection();
          // update picker visuals
          pickerGrid.querySelectorAll('.picker-cell').forEach(cell=>{
            // @ts-ignore
            const rr = parseInt(cell.dataset.r), cc = parseInt(cell.dataset.c);
            if(State.game.grid[rr][cc]===0){ cell.classList.add('empty'); cell.textContent = ''; }
            else { cell.classList.remove('empty'); cell.textContent = State.game.grid[rr][cc].toString(); }
          });
          if(placementsLeft<=0){
            overlay.remove();
            State.game.turn = 'move';
            render();
            resolve();
          } else {
            title.textContent = `Joueur 2 — placez ${placementsLeft} tuile(s). Choisissez une case vide et une valeur.`;
          }
        }
      });
    });

    // value buttons
    valueButtons.forEach(b=>{
      b.addEventListener('click', ()=>{
        const v = parseInt(b.dataset.value);
        if(selectedValue === v){
          // deselect
          selectedValue = null;
          b.classList.remove('selected');
        } else {
          // select this value
          valueButtons.forEach(bb=>bb.classList.remove('selected'));
          selectedValue = v;
          b.classList.add('selected');
          if(selectedCell !== null){
            // place
            const r = selectedCell[0], c = selectedCell[1];
            addTileAt(r,c,v);
            placementsLeft--;
            clearSelection();
            // update picker visuals
            pickerGrid.querySelectorAll('.picker-cell').forEach(cell=>{
              // @ts-ignore
              const rr = parseInt(cell.dataset.r), cc = parseInt(cell.dataset.c);
              if(State.game.grid[rr][cc]===0){ cell.classList.add('empty'); cell.textContent = ''; }
              else { cell.classList.remove('empty'); cell.textContent = State.game.grid[rr][cc].toString(); }
            });
            if(placementsLeft<=0){
              overlay.remove();
              // placement finished -> back to move turn
              State.game.turn = 'move';
              render();
              resolve();
            } else {
              title.textContent = `Joueur 2 — placez ${placementsLeft} tuile(s). Choisissez une case vide et une valeur.`;
            }
          }
        }
      });
    });

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Passer';
    cancelBtn.onclick = ()=>{
      overlay.remove();
      State.game.turn = 'move';
      resolve();
    };

    panel.appendChild(pickerGrid);
    panel.appendChild(valuesDiv);
    panel.appendChild(cancelBtn);

    overlay.appendChild(title);
    overlay.appendChild(panel);
    boardEl.appendChild(overlay);
  });
}

/**
 * Show edit mode UI for manually placing/removing tiles
 * @returns {void}
 */
function showEditMode(){
  const overlay = document.createElement('div');
  overlay.className = 'overlay';

  const title = document.createElement('p');
  title.textContent = 'Mode Édition — Placez ou supprimez des tuiles librement.';

  const panel = document.createElement('div');
  panel.className = 'placement-panel';

  // picker grid
  const pickerGrid = document.createElement('div');
  pickerGrid.className = 'picker-grid';
  pickerGrid.style.setProperty('--size', String(State.config.SIZE));

  // build cells
  const cellEls = [];
  for(let r=0;r<State.config.SIZE;r++){
    for(let c=0;c<State.config.SIZE;c++){
      const el = document.createElement('div');
      el.className = 'picker-cell';
      if(State.game.grid[r][c] === 0){
        el.classList.add('empty');
      } else {
        el.classList.add('t-' + State.game.grid[r][c]);
      }
      el.textContent = State.game.grid[r][c] === 0 ? '' : State.game.grid[r][c].toString();
      el.dataset.r = r.toString(); el.dataset.c = c.toString();
      pickerGrid.appendChild(el);
      cellEls.push(el);
    }
  }

  // values area
  const valuesDiv = document.createElement('div');
  valuesDiv.className = 'placement-values';
  const info = document.createElement('div');
  info.textContent = 'Sélectionnez une valeur pour placer:';
  valuesDiv.appendChild(info);
  const buttonsContainer = document.createElement('div');
  buttonsContainer.className = 'value-buttons-container';
  valuesDiv.appendChild(buttonsContainer);
  const valueButtons = [];
  let current = 2;
  for(let i = 0; i <= State.config.SIZE * State.config.SIZE; i++){
    const b = document.createElement('button');
    b.className = 'value-btn';
    b.textContent = current.toString();
    b.dataset.value = current.toString();
    buttonsContainer.appendChild(b);
    valueButtons.push(b);
    current *= 2;
  }

  // current selection
  let selectedValue = null;

  function clearSelection(){
    selectedValue = null;
    valueButtons.forEach(b=>b.classList.remove('selected'));
  }

  // click on picker cell
  cellEls.forEach(el=>{
    el.addEventListener('click', ()=>{
      const r = parseInt(el.dataset.r), c = parseInt(el.dataset.c);
      if(State.game.grid[r][c] === 0){
        // empty, place if value selected
        if(selectedValue !== null){
          addTileAt(r,c,selectedValue);
          el.textContent = selectedValue;
          el.classList.remove('empty');
          el.classList.add('t-' + selectedValue);
          clearSelection();
        }
      } else {
        // occupied, remove
        const oldVal = State.game.grid[r][c];
        State.game.grid[r][c] = 0;
        el.textContent = '';
        el.classList.remove('t-' + oldVal);
        el.classList.add('empty');
      }
    });
  });

  // value buttons
  valueButtons.forEach(b=>{
    b.addEventListener('click', ()=>{
      const v = parseInt(b.dataset.value);
      if(selectedValue === v){
        clearSelection();
      } else {
        valueButtons.forEach(bb=>bb.classList.remove('selected'));
        selectedValue = v;
        b.classList.add('selected');
      }
    });
  });

  // done button
  const doneBtn = document.createElement('button');
  doneBtn.textContent = 'Terminé';
  doneBtn.onclick = ()=>{
    overlay.remove();
    DataStore.saveGame();
    render();
  };

  panel.appendChild(pickerGrid);
  panel.appendChild(valuesDiv);
  panel.appendChild(doneBtn);

  overlay.appendChild(title);
  overlay.appendChild(panel);
  boardEl.appendChild(overlay);
}

/**
 * Start a new game with current configuration
 * @returns {Promise<void>}
 */
async function newGame(){
  resetGrid(); State.game.score = 0;
  // default to player 1 move turn
  State.game.turn = 'move';
  DataStore.saveGame();
  render();
  if(State.config.SECOND_PLAYER_ENABLED){
    await promptSecondPlayer(State.config.INITIAL_PLACEMENTS);
    DataStore.saveGame();
    render();
  } else {
    addRandomTile(); addRandomTile();
    DataStore.saveGame(); render();
  }
  location.reload();
}

// Keyboard & touch
window.addEventListener('keydown', async (e)=>{
  const key = e.key;
  let moved = false;
  if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(key)) e.preventDefault();
  if(key === 'ArrowLeft' || key==='a' || key==='A') moved = await move('left');
  if(key === 'ArrowRight' || key==='d' || key==='D') moved = await move('right');
  if(key === 'ArrowUp' || key==='w' || key==='W' || key==='z' || key==='Z') moved = await move('up');
  if(key === 'ArrowDown' || key==='s' || key==='S') moved = await move('down');

  if(moved) DataStore.saveGame();
});

// touch swipe support
let touchStartX=0,touchStartY=0;
boardEl.addEventListener('touchstart',(e)=>{ if(e.touches.length===1){ touchStartX=e.touches[0].clientX; touchStartY=e.touches[0].clientY } });
boardEl.addEventListener('touchend', async (e)=>{
  if(!touchStartX) return;
  const dx = (e.changedTouches[0].clientX - touchStartX);
  const dy = (e.changedTouches[0].clientY - touchStartY);
  const absX = Math.abs(dx), absY = Math.abs(dy);
  if(Math.max(absX,absY) > 20){
    if(absX > absY){ if(dx>0) await move('right'); else await move('left'); }
    else { if(dy>0) await move('down'); else await move('up'); }
    DataStore.saveGame();
  }
  touchStartX=0; touchStartY=0;
});

newBtn.addEventListener('click', ()=>{ showConfigPopup(); });

editBtn.addEventListener('click', ()=>{ showEditMode(); });

// Reset button
resetBtn.addEventListener('click', ()=>{
  if(confirm('Êtes-vous sûr de vouloir réinitialiser tout le stockage local ? Cela effacera la sauvegarde de la partie, le meilleur score et les configurations.')){
    DataStore.clearAll();
    location.reload(); // Reload to reset everything
  }
});

/**
 * Initialize the game on page load
 * @returns {Promise<void>}
 */
async function init(){
  document.documentElement.style.setProperty('--size', String(State.config.SIZE));
  // Load and apply persisted config (if any)
  DataStore.loadConfig();
  if(State.config.TILE_VALUES){
    State.config.TILE_VALUES = State.config.TILE_VALUES;
  }
  if(State.config.SECOND_PLAYER_ENABLED !== undefined) {
    State.config.SECOND_PLAYER_ENABLED = State.config.SECOND_PLAYER_ENABLED;
  }
  if(State.config.SIZE && typeof State.config.SIZE === 'number'){
    State.config.SIZE = State.config.SIZE;
    document.documentElement.style.setProperty('--size', String(State.config.SIZE));
  }
  // Load game State.game or initialize
  DataStore.loadGame();

  // ensure turn starts as move; promptSecondPlayer will set to 'move' again after placements
  State.game.turn = 'move';
  render();
  // if empty grid and second player enabled, force initial placements
  const isEmpty = State.game.grid.every(row=>row.every(v=>v===0));
  if(isEmpty){
    if(State.config.SECOND_PLAYER_ENABLED){
      await promptSecondPlayer(State.config.INITIAL_PLACEMENTS);
      DataStore.saveGame(); render();
    } else {
      addRandomTile(); addRandomTile(); DataStore.saveGame(); render();
    }
  }
}

init();