/* Game logic moved out of HTML to game.js for maintainability */

const CONFIG = {
  SIZE: 4,
  STORAGE_KEY: 'local2048_v2',
  TILE_VALUES: [2, 4], // <-- modifiez ici facilement
  SECOND_PLAYER_ENABLED: true, // passer à false pour revenir à l'ajout aléatoire
  INITIAL_PLACEMENTS: 2 // nombre de placements par le joueur 2 au démarrage
};

// State
let grid = [];
let score = 0;
// turn: 'move' => player 1 should move tiles; 'place' => player 2 must place tiles
let turn = 'move';

// DOM
const gridEl = document.getElementById('grid');
const tileLayer = document.getElementById('tile-layer');
const scoreEl = document.getElementById('score');
const newBtn = document.getElementById('newgame');
const boardEl = document.getElementById('board');
const resetBtn = document.getElementById('reset');
const editBtn = document.getElementById('edit');

// init CSS size var
document.documentElement.style.setProperty('--size', CONFIG.SIZE);

// helpers
function copyGrid(g){ return g.map(row => row.slice()); }
function resetGrid(){
  grid = Array.from({length:CONFIG.SIZE}, ()=>Array.from({length:CONFIG.SIZE}, ()=>0));
  // Also update CSS variable for grid size
  document.documentElement.style.setProperty('--size', CONFIG.SIZE);
}

// Persistence helpers moved to app/data.js (global DataStore)

// Basic tile setter (modulaire)
function addTileAt(r,c,value){
  if(grid[r][c]!==0) return false;
  grid[r][c] = value;
  return true;
}

// Old random fallback (used if SECOND_PLAYER_ENABLED=false)
function addRandomTile(){
  const empties = [];
  for(let r=0;r<CONFIG.SIZE;r++) for(let c=0;c<CONFIG.SIZE;c++) if(grid[r][c]===0) empties.push([r,c]);
  if(empties.length===0) return false;
  const [r,c] = empties[Math.floor(Math.random()*empties.length)];
  const v = Math.random() < 0.9 ? CONFIG.TILE_VALUES[0] : (CONFIG.TILE_VALUES[1]||CONFIG.TILE_VALUES[0]);
  grid[r][c] = v;
  return {r,c,value:v};
}

// Rotation utilities
function rotate(g, times=1){
  let res = copyGrid(g);
  for(let t=0;t<times;t++){
    const tmp = Array.from({length:CONFIG.SIZE}, ()=>Array(CONFIG.SIZE).fill(0));
    for(let r=0;r<CONFIG.SIZE;r++) for(let c=0;c<CONFIG.SIZE;c++) tmp[c][CONFIG.SIZE-1-r] = res[r][c];
    res = tmp;
  }
  return res;
}

function moveLeftOnce(g){
  // Re-implementation to also produce movement mapping for animations
  let moved = false; let mergedScore = 0;
  const out = Array.from({length:CONFIG.SIZE}, ()=>Array(CONFIG.SIZE).fill(0));
  const moves = []; // {fromR,fromC,toR,toC,value,merged:false|true,newValue?}
  const mergedDestinations = []; // [{r,c,newValue}]

  for(let r=0;r<CONFIG.SIZE;r++){
    // collect non-zero tiles with original columns
    const entries = [];
    for(let c=0;c<CONFIG.SIZE;c++){
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

function canMove(g){
  for(let r=0;r<CONFIG.SIZE;r++) for(let c=0;c<CONFIG.SIZE;c++){
    if(g[r][c]===0) return true;
    if(c+1<CONFIG.SIZE && g[r][c]===g[r][c+1]) return true;
    if(r+1<CONFIG.SIZE && g[r][c]===g[r+1][c]) return true;
  }
  return false;
}

// Movement wrapper — mapping directions to rotations (corrected)
function rotatedForDirection(direction){
  // left:0, up:3, right:2, down:1  (mapping chosen so that moveLeftOnce handles left)
  if(direction==='left') return 0;
  if(direction==='up') return 3;
  if(direction==='right') return 2;
  if(direction==='down') return 1;
  return 0;
}

// Rotate a coordinate (r,c) clockwise by `times` in a CONFIG.SIZE x CONFIG.SIZE grid
function rotateCoord(r, c, times=1){
  let rr = r, cc = c;
  for(let t=0;t<times;t++){
    const nrr = cc;
    const ncc = CONFIG.SIZE - 1 - rr;
    rr = nrr; cc = ncc;
  }
  return [rr, cc];
}

// Compute top/left in px for a given cell
function cellPositionPx(r,c){
  const cellSize = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--cell-size'));
  const gap = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--gap'));
  return { top: r * (cellSize + gap), left: c * (cellSize + gap) };
}

// Animate tile movements based on move mapping (in rotated-left space)
function animateMoves(moves, rotatedTimes){
  // Remove any previous moving tiles
  tileLayer.querySelectorAll('.moving-tile').forEach(el=>el.remove());
  const inv = (4 - rotatedTimes) % 4;
  const animEls = [];
  moves.forEach(m => {
    // skip tiles that don't move
    const [fromR, fromC] = rotateCoord(m.fromR, m.fromC, inv);
    const [toR, toC] = rotateCoord(m.toR, m.toC, inv);
    if(fromR === toR && fromC === toC) return;
    // hide the original static tile at its origin so we don't see duplicates
    const baseEl = tileLayer.querySelector(`.tile[data-r="${fromR}"][data-c="${fromC}"]`);
    if(baseEl) baseEl.style.opacity = '0';
    const ghost = document.createElement('div');
    ghost.className = 'tile t-' + m.value + ' moving-tile';
    ghost.textContent = m.value;
    const fromPx = cellPositionPx(fromR, fromC);
    const toPx = cellPositionPx(toR, toC);
    ghost.style.top = fromPx.top + 'px';
    ghost.style.left = fromPx.left + 'px';
    tileLayer.appendChild(ghost);
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
    const timeout = setTimeout(()=>{ resolve(); }, 200);
    animEls.forEach(el => {
      el.addEventListener('transitionend', ()=>{
        el.remove();
        done();
      }, { once:true });
    });
  });
}

// Core move function now async because after a move we may wait for player 2
async function move(direction){
  // prevent moving while player 2 is placing
  if(turn === 'place') return false;
  const rotatedTimes = rotatedForDirection(direction);
  const prev = grid;
  let working = rotate(prev, rotatedTimes);
  const result = moveLeftOnce(working);
  if(!result.moved) return false;
  // animate movements in original orientation before committing state
  await animateMoves(result.moves, rotatedTimes);
  // commit new state
  working = result.grid;
  working = rotate(working, (4-rotatedTimes)%4);
  grid = working;
  score += result.mergedScore;
  DataStore.saveGame({grid,score}, CONFIG.STORAGE_KEY);

  // After player 1 move: ask player 2 to place (unless disabled)
  if(CONFIG.SECOND_PLAYER_ENABLED){
    // switch to placement turn and await player 2
    await promptSecondPlayer(1);
  } else {
    addRandomTile();
  }
  DataStore.saveGame({grid,score}, CONFIG.STORAGE_KEY);
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

// RENDER
function render(){
  scoreEl.textContent = score;
  // grid visuals
  gridEl.innerHTML = '';
  for(let r=0;r<CONFIG.SIZE;r++){
    for(let c=0;c<CONFIG.SIZE;c++){
      const cell = document.createElement('div');
      cell.className = 'cell';
      gridEl.appendChild(cell);
    }
  }

  // tiles
  tileLayer.innerHTML = '';
  const cellSize = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--cell-size'));
  const gap = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--gap'));
  for(let r=0;r<CONFIG.SIZE;r++){
    for(let c=0;c<CONFIG.SIZE;c++){
      const val = grid[r][c];
      if(val===0) continue;
      const tile = document.createElement('div');
      tile.className = 'tile t-' + val;
      tile.textContent = val;
      tile.dataset.r = r; tile.dataset.c = c;
      const topPx = r * (cellSize + gap);
      const leftPx = c * (cellSize + gap);
      tile.style.top = topPx + 'px';
      tile.style.left = leftPx + 'px';
      tileLayer.appendChild(tile);
      requestAnimationFrame(()=>{ tile.classList.add('show'); });
    }
  }
}

function showOverlay(text, btnText, btnCallback){
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  const p = document.createElement('p'); p.textContent = text;
  const btn = document.createElement('button'); btn.textContent = btnText;
  btn.onclick = ()=>{ overlay.remove(); if(btnCallback) btnCallback(); };
  overlay.appendChild(p); overlay.appendChild(btn);
  boardEl.appendChild(overlay);
}

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
  sizeInput.min = 2;
  sizeInput.max = 8;
  sizeInput.value = CONFIG.SIZE;
  sizeLabel.appendChild(sizeInput);
  form.appendChild(sizeLabel);
  // Tile values
  const tileLabel = document.createElement('label');
  tileLabel.textContent = 'Valeurs des tuiles (séparées par des virgules): ';
  const tileInput = document.createElement('input');
  tileInput.type = 'text';
  tileInput.value = CONFIG.TILE_VALUES.join(',');
  tileLabel.appendChild(tileInput);
  form.appendChild(tileLabel);
  // Two player
  const playerLabel = document.createElement('label');
  const playerCheckbox = document.createElement('input');
  playerCheckbox.type = 'checkbox';
  playerCheckbox.checked = CONFIG.SECOND_PLAYER_ENABLED;
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
  DataStore.setConfig(config);
    // Update CONFIG
    CONFIG.TILE_VALUES = tileValues;
    CONFIG.SECOND_PLAYER_ENABLED = secondPlayer;
    CONFIG.SIZE = size;
    document.documentElement.style.setProperty('--size', CONFIG.SIZE);
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

// ----- Second player placement UI (modulaire) -----
// Prompt player to place `count` tiles. Returns a Promise that resolves when done.
function promptSecondPlayer(count=1){
  // if already in placement turn, don't open another prompt
  if(turn === 'place') return Promise.resolve();
  // enter placement turn
  turn = 'place';
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
    pickerGrid.style.setProperty('--size', CONFIG.SIZE);

    // collect empties
    const empties = [];
    for(let r=0;r<CONFIG.SIZE;r++) for(let c=0;c<CONFIG.SIZE;c++) if(grid[r][c]===0) empties.push([r,c]);

    // build cells (clickable)
    const cellEls = [];
    for(let r=0;r<CONFIG.SIZE;r++){
      for(let c=0;c<CONFIG.SIZE;c++){
        const el = document.createElement('div');
        el.className = 'picker-cell';
        if(grid[r][c]===0){ el.classList.add('empty'); el.textContent = ''; }
        else el.textContent = grid[r][c];
        el.dataset.r = r; el.dataset.c = c;
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
    const valueButtons = [];
    CONFIG.TILE_VALUES.forEach(v=>{
      const b = document.createElement('button');
      b.className = 'value-btn';
      b.textContent = v;
      b.dataset.value = v;
      valuesDiv.appendChild(b);
      valueButtons.push(b);
    });

    // make value buttons draggable
    valueButtons.forEach(b => {
      b.draggable = true;
      b.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', b.dataset.value);
      });
    });

    // current selection
    let selectedCell = null;
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
        const r = parseInt(el.dataset.r), c = parseInt(el.dataset.c);
        if(grid[r][c]!==0) return; // only empty
        if(selectedValue !== null){
          // place
          addTileAt(r,c,selectedValue);
          placementsLeft--;
          clearSelection();
          // update picker visuals
          pickerGrid.querySelectorAll('.picker-cell').forEach(cell=>{
            const rr = parseInt(cell.dataset.r), cc = parseInt(cell.dataset.c);
            if(grid[rr][cc]===0){ cell.classList.add('empty'); cell.textContent = ''; }
            else { cell.classList.remove('empty'); cell.textContent = grid[rr][cc]; }
          });
          if(placementsLeft<=0){
            overlay.remove();
            // placement finished -> back to move turn
            turn = 'move';
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
        if(grid[r][c] === 0) el.classList.add('drag-over');
      });
      el.addEventListener('dragleave', (e) => {
        el.classList.remove('drag-over');
      });
      el.addEventListener('drop', (e) => {
        e.preventDefault();
        el.classList.remove('drag-over');
        const v = parseInt(e.dataTransfer.getData('text/plain'));
        const r = parseInt(el.dataset.r), c = parseInt(el.dataset.c);
        if(grid[r][c] === 0){
          addTileAt(r,c,v);
          placementsLeft--;
          clearSelection();
          // update picker visuals
          pickerGrid.querySelectorAll('.picker-cell').forEach(cell=>{
            const rr = parseInt(cell.dataset.r), cc = parseInt(cell.dataset.c);
            if(grid[rr][cc]===0){ cell.classList.add('empty'); cell.textContent = ''; }
            else { cell.classList.remove('empty'); cell.textContent = grid[rr][cc]; }
          });
          if(placementsLeft<=0){
            overlay.remove();
            turn = 'move';
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
              const rr = parseInt(cell.dataset.r), cc = parseInt(cell.dataset.c);
              if(grid[rr][cc]===0){ cell.classList.add('empty'); cell.textContent = ''; }
              else { cell.classList.remove('empty'); cell.textContent = grid[rr][cc]; }
            });
            if(placementsLeft<=0){
              overlay.remove();
              // placement finished -> back to move turn
              turn = 'move';
              render();
              resolve();
            } else {
              title.textContent = `Joueur 2 — placez ${placementsLeft} tuile(s). Choisissez une case vide et une valeur.`;
            }
          }
        }
      });
    });

    // cancel button (allows undoing placement sequence)
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Annuler';
    cancelBtn.onclick = ()=>{
      overlay.remove();
      // restore move turn even if cancelled
      turn = 'move';
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

// EDIT MODE
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
  pickerGrid.style.setProperty('--size', CONFIG.SIZE);

  // build cells
  const cellEls = [];
  for(let r=0;r<CONFIG.SIZE;r++){
    for(let c=0;c<CONFIG.SIZE;c++){
      const el = document.createElement('div');
      el.className = 'picker-cell';
      if(grid[r][c] === 0){
        el.classList.add('empty');
      } else {
        el.classList.add('t-' + grid[r][c]);
      }
      el.textContent = grid[r][c] === 0 ? '' : grid[r][c];
      el.dataset.r = r; el.dataset.c = c;
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
  for(let i = 0; i <= CONFIG.SIZE * CONFIG.SIZE; i++){
    const b = document.createElement('button');
    b.className = 'value-btn';
    b.textContent = current;
    b.dataset.value = current;
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
      if(grid[r][c] === 0){
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
        const oldVal = grid[r][c];
        grid[r][c] = 0;
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
    DataStore.saveGame({grid,score}, CONFIG.STORAGE_KEY);
    render();
  };

  panel.appendChild(pickerGrid);
  panel.appendChild(valuesDiv);
  panel.appendChild(doneBtn);

  overlay.appendChild(title);
  overlay.appendChild(panel);
  boardEl.appendChild(overlay);
}

// NEW GAME
async function newGame(){
  resetGrid(); score = 0;
  // default to player 1 move turn
  turn = 'move';
  DataStore.saveGame({grid,score}, CONFIG.STORAGE_KEY);
  render();
  if(CONFIG.SECOND_PLAYER_ENABLED){
    await promptSecondPlayer(CONFIG.INITIAL_PLACEMENTS);
    DataStore.saveGame({grid,score}, CONFIG.STORAGE_KEY);
    render();
  } else {
    addRandomTile(); addRandomTile();
    DataStore.saveGame({grid,score}, CONFIG.STORAGE_KEY); render();
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

  if(moved) DataStore.saveGame({grid,score}, CONFIG.STORAGE_KEY);
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
    DataStore.saveGame({grid,score}, CONFIG.STORAGE_KEY);
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

// Init
async function init(){
  document.documentElement.style.setProperty('--size', CONFIG.SIZE);
  // Load and apply persisted config (if any)
  const storedCfg = DataStore.getConfig();
  if(storedCfg){
    if(storedCfg.tileValues) CONFIG.TILE_VALUES = storedCfg.tileValues;
    if(storedCfg.secondPlayerEnabled !== undefined) CONFIG.SECOND_PLAYER_ENABLED = storedCfg.secondPlayerEnabled;
    if(storedCfg.size && typeof storedCfg.size === 'number'){
      CONFIG.SIZE = storedCfg.size;
      document.documentElement.style.setProperty('--size', CONFIG.SIZE);
    }
  }
  // Load game state or initialize
  const loaded = DataStore.loadGame(CONFIG.STORAGE_KEY);
  if(loaded && loaded.grid){
    grid = loaded.grid; score = loaded.score || 0;
  } else {
    resetGrid(); score = 0;
    DataStore.saveGame({grid,score}, CONFIG.STORAGE_KEY);
  }
  // ensure turn starts as move; promptSecondPlayer will set to 'move' again after placements
  turn = 'move';
  render();
  // if empty grid and second player enabled, force initial placements
  const isEmpty = grid.every(row=>row.every(v=>v===0));
  if(isEmpty){
    if(CONFIG.SECOND_PLAYER_ENABLED){
      await promptSecondPlayer(CONFIG.INITIAL_PLACEMENTS);
      DataStore.saveGame({grid,score}, CONFIG.STORAGE_KEY); render();
    } else {
      addRandomTile(); addRandomTile(); DataStore.saveGame({grid,score}, CONFIG.STORAGE_KEY); render();
    }
  }
}

init();