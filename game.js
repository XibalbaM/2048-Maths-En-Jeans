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
let best = 0;
// turn: 'move' => player 1 should move tiles; 'place' => player 2 must place tiles
let turn = 'move';

// DOM
const gridEl = document.getElementById('grid');
const tileLayer = document.getElementById('tile-layer');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const newBtn = document.getElementById('newgame');
const boardEl = document.getElementById('board');
const resetBtn = document.getElementById('reset');

// init CSS size var
document.documentElement.style.setProperty('--size', CONFIG.SIZE);

// helpers
function copyGrid(g){ return g.map(row => row.slice()); }
function resetGrid(){ grid = Array.from({length:CONFIG.SIZE}, ()=>Array.from({length:CONFIG.SIZE}, ()=>0)); }

function loadConfig(){
  try{
    const stored = localStorage.getItem('gameConfig');
    if(stored){
      const parsed = JSON.parse(stored);
      if(parsed.tileValues) CONFIG.TILE_VALUES = parsed.tileValues;
      if(parsed.secondPlayerEnabled !== undefined) CONFIG.SECOND_PLAYER_ENABLED = parsed.secondPlayerEnabled;
    }
  }catch(e){}
}

function saveState(){
  localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify({grid,score,best}));
}
function loadState(){
  try{
    const raw = localStorage.getItem(CONFIG.STORAGE_KEY);
    if(!raw) return false;
    const obj = JSON.parse(raw);
    if(obj && obj.grid) { grid = obj.grid; score = obj.score || 0; best = obj.best || 0; return true }
  }catch(e){console.warn(e)}
  return false;
}

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
  let moved = false; let mergedScore = 0;
  const out = Array.from({length:CONFIG.SIZE}, ()=>Array(CONFIG.SIZE).fill(0));
  for(let r=0;r<CONFIG.SIZE;r++){
    let pos = 0;
    for(let c=0;c<CONFIG.SIZE;c++){
      const val = g[r][c];
      if(val===0) continue;
      if(out[r][pos]===0) { out[r][pos]=val; if(c!==pos) moved = true; }
      else if(out[r][pos]===val){ out[r][pos]*=2; mergedScore += out[r][pos]; out[r][pos+1]=0; pos++; moved=true; }
      else { pos++; out[r][pos]=val; if(c!==pos) moved = true; }
    }
  }
  return {grid:out,moved,mergedScore};
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

// Core move function now async because after a move we may wait for player 2
async function move(direction){
  // prevent moving while player 2 is placing
  if(turn === 'place') return false;
  const rotatedTimes = rotatedForDirection(direction);
  let working = rotate(grid, rotatedTimes);
  const result = moveLeftOnce(working);
  if(!result.moved) return false;
  working = result.grid;
  working = rotate(working, (4-rotatedTimes)%4);
  grid = working;
  score += result.mergedScore;
  if(score > best) best = score;
  saveState();

  // After player 1 move: ask player 2 to place (unless disabled)
  if(CONFIG.SECOND_PLAYER_ENABLED){
    // switch to placement turn and await player 2
    await promptSecondPlayer(1);
  } else {
    addRandomTile();
  }
  saveState();
  render();
  return true;
}

// RENDER
function render(){
  scoreEl.textContent = score;
  bestEl.textContent = best;
  localStorage.setItem('best2048', best);
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
      const topPx = r * (cellSize + gap);
      const leftPx = c * (cellSize + gap);
      tile.style.top = topPx + 'px';
      tile.style.left = leftPx + 'px';
      tileLayer.appendChild(tile);
      requestAnimationFrame(()=>{ tile.classList.add('show'); });
    }
  }

  // win/lose
  if(grid.some(row=>row.some(v=>v===2048))){
    showOverlay('Bravo — vous avez atteint 2048 !', 'Continuer', ()=>{});
  } else if(!canMove(grid)){
    showOverlay('Partie terminée — plus de mouvements', 'Nouvelle partie', ()=>{ newGame(); });
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
    const tileStr = tileInput.value.trim();
    const tileValues = tileStr.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
    if(tileValues.length === 0) tileValues = [2,4];
    const secondPlayer = playerCheckbox.checked;
    // Save
    const config = { tileValues, secondPlayerEnabled: secondPlayer };
    localStorage.setItem('gameConfig', JSON.stringify(config));
    // Update CONFIG
    CONFIG.TILE_VALUES = tileValues;
    CONFIG.SECOND_PLAYER_ENABLED = secondPlayer;
    // Start new game
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

// NEW GAME
async function newGame(){
  resetGrid(); score = 0; best = Number(localStorage.getItem('best2048')||0);
  // default to player 1 move turn
  turn = 'move';
  saveState();
  render();
  if(CONFIG.SECOND_PLAYER_ENABLED){
    await promptSecondPlayer(CONFIG.INITIAL_PLACEMENTS);
    saveState();
    render();
  } else {
    addRandomTile(); addRandomTile();
    saveState(); render();
  }
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

  if(moved) saveState();
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
    saveState();
  }
  touchStartX=0; touchStartY=0;
});

newBtn.addEventListener('click', ()=>{ showConfigPopup(); });

// Reset button
resetBtn.addEventListener('click', ()=>{
  if(confirm('Êtes-vous sûr de vouloir réinitialiser tout le stockage local ? Cela effacera la sauvegarde de la partie, le meilleur score et les configurations.')){
    localStorage.clear();
    location.reload(); // Reload to reset everything
  }
});

// Init
async function init(){
  document.documentElement.style.setProperty('--size', CONFIG.SIZE);
  loadConfig();
  if(!loadState()){
    resetGrid(); score = 0; best = Number(localStorage.getItem('best2048')||0);
    saveState();
  }
  // ensure turn starts as move; promptSecondPlayer will set to 'move' again after placements
  turn = 'move';
  render();
  // if empty grid and second player enabled, force initial placements
  const isEmpty = grid.every(row=>row.every(v=>v===0));
  if(isEmpty){
    if(CONFIG.SECOND_PLAYER_ENABLED){
      await promptSecondPlayer(CONFIG.INITIAL_PLACEMENTS);
      saveState(); render();
    } else {
      addRandomTile(); addRandomTile(); saveState(); render();
    }
  }
}

init();
