const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statsEl = document.getElementById('stats');
const msgEl = document.getElementById('message');
const restartBtn = document.getElementById('restart');

const TILE = { WALL:0, FLOOR:1, EXIT:2 };
const COLORS = { [TILE.WALL]:'#0b2230', [TILE.FLOOR]:'#15384a', [TILE.EXIT]:'#5fe17a', player:'#ffd86b', monster:'#ff6b6b' };

let cols = 40, rows = 30; // grid size
let tileSize = Math.floor(Math.min(canvas.width/cols, canvas.height/rows));
canvas.width = tileSize * cols;
canvas.height = tileSize * rows;

let map = [];
let player = { x:1, y:1, hp:10, atk:3 };
let monsters = [];
let potions = [];
let exit = { x:cols-2, y:rows-2 };
let gameOver = false;

function createMap(){
  map = new Array(rows).fill(0).map(()=>new Array(cols).fill(TILE.WALL));
  // carve a simple random-walk dungeon
  let x = 1, y = 1;
  map[y][x] = TILE.FLOOR;
  for(let i=0;i<cols*rows*6;i++){
    let dir = [[1,0],[-1,0],[0,1],[0,-1]][Math.floor(Math.random()*4)];
    x = Math.max(1, Math.min(cols-2, x+dir[0]));
    y = Math.max(1, Math.min(rows-2, y+dir[1]));
    map[y][x] = TILE.FLOOR;
    // occasionally carve neighbors to make rooms
    if(Math.random()<0.15){
      for(let nx=-1;nx<=1;nx++) for(let ny=-1;ny<=1;ny++){
        let xx=x+nx, yy=y+ny;
        if(xx>0 && xx<cols-1 && yy>0 && yy<rows-1) map[yy][xx]=TILE.FLOOR;
      }
    }
  }
  // place exit at far corner floor cell
  for(let ry=rows-2;ry>0;ry--){
    for(let rx=cols-2;rx>0;rx--){
      if(map[ry][rx]===TILE.FLOOR){ exit.x=rx; exit.y=ry; map[ry][rx]=TILE.EXIT; ry=0; break; }
    }
  }
}

function placePlayer(){
  // find a floor cell near 1,1
  for(let r=1;r<rows-1;r++){
    for(let c=1;c<cols-1;c++){
      if(map[r][c]===TILE.FLOOR){ player.x=c; player.y=r; return; }
    }
  }
}

function placeMonsters(){
  monsters = [];
  for(let r=1;r<rows-1;r++) for(let c=1;c<cols-1;c++){
    if(map[r][c]===TILE.FLOOR && Math.random()<0.02 && !(c===player.x && r===player.y)){
      monsters.push({x:c,y:r,hp:4,atk:1});
    }
  }
}

function placePotions(){
  potions = [];
  const count = Math.max(4, Math.floor((cols*rows)/200)); // at least a few
  // gather floor positions
  const floors = [];
  for(let r=1;r<rows-1;r++) for(let c=1;c<cols-1;c++){
    if(map[r][c]===TILE.FLOOR && !(c===player.x && r===player.y) && !getMonsterAt(c,r)) floors.push({x:c,y:r});
  }
  for(let i=0;i<count && floors.length>0;i++){
    const idx = Math.floor(Math.random()*floors.length);
    const f = floors.splice(idx,1)[0];
    potions.push({x:f.x,y:f.y,heal:5});
  }
}

function draw(){
  for(let r=0;r<rows;r++){
    for(let c=0;c<cols;c++){
      let tile = map[r][c];
      ctx.fillStyle = COLORS[tile] || COLORS[TILE.FLOOR];
      ctx.fillRect(c*tileSize, r*tileSize, tileSize, tileSize);
    }
  }
  // monsters
  for(const m of monsters){
    ctx.fillStyle = COLORS.monster;
    ctx.fillRect(m.x*tileSize+2, m.y*tileSize+2, tileSize-4, tileSize-4);
  }
  // potions (pulsing)
  for(const p of potions){
    const cx = p.x*tileSize + tileSize/2;
    const cy = p.y*tileSize + tileSize/2;
    const pulse = 1 + 0.25*Math.sin((performance.now()/300) + (p.x+p.y));
    const r = Math.max(3, (tileSize/4) * pulse);
    // subtle glow
    ctx.fillStyle = 'rgba(123,223,255,0.18)';
    ctx.beginPath(); ctx.arc(cx, cy, r+4, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#7bdfff'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.fill();
  }
  // player
  ctx.fillStyle = COLORS.player;
  ctx.fillRect(player.x*tileSize+2, player.y*tileSize+2, tileSize-4, tileSize-4);
}

function updateStats(){
  statsEl.textContent = `HP: ${player.hp} | Attack: ${player.atk} | Monsters: ${monsters.length}`;
}

function getMonsterAt(x,y){
  return monsters.find(m=>m.x===x && m.y===y);
}

function getPotionAt(x,y){
  return potions.find(p=>p.x===x && p.y===y);
}

function removePotion(p){
  potions = potions.filter(q=>q!==p);
}

function removeMonster(mon){
  monsters = monsters.filter(m=>m!==mon);
}

function playerAttack(mon){
  mon.hp -= player.atk;
  addMessage(`You hit the monster for ${player.atk} damage.`);
  if(mon.hp<=0){ removeMonster(mon); addMessage('Monster dies.'); }
}

function monsterAttack(mon){
  player.hp -= mon.atk;
  addMessage(`Monster hits you for ${mon.atk} damage.`);
}

function addMessage(t){
  msgEl.textContent = t;
}

function stepMonsters(){
  for(const m of monsters.slice()){
    // if adjacent to player, attack
    if(Math.abs(m.x-player.x)+Math.abs(m.y-player.y)===1){
      monsterAttack(m);
      continue;
    }
    // try random move
    const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
    const d = dirs[Math.floor(Math.random()*4)];
    const nx = m.x+d[0], ny = m.y+d[1];
    if(nx===player.x && ny===player.y){
      monsterAttack(m);
    } else if(map[ny] && map[ny][nx]===TILE.FLOOR && !getMonsterAt(nx,ny)){
      m.x=nx; m.y=ny;
    }
  }
}

function tryMove(dx,dy){
  if(gameOver) return;
  const nx = player.x+dx, ny = player.y+dy;
  const tile = map[ny] && map[ny][nx];
  if(!tile || tile===TILE.WALL) return;
  const mon = getMonsterAt(nx,ny);
  const pot = getPotionAt(nx,ny);
  if(mon){
    playerAttack(mon);
    if(mon.hp>0){ monsterAttack(mon); }
  } else {
    player.x=nx; player.y=ny;
    if(pot){
      const heal = pot.heal || 5;
      player.hp = Math.min(player.maxHp || 10, player.hp + heal);
      removePotion(pot);
      addMessage(`You drink a potion and heal ${heal} HP.`);
    }
    if(tile===TILE.EXIT){
      addMessage('You found the exit — You win!'); gameOver=true; return;
    }
  }
  if(player.hp<=0){ addMessage('You died. Game over.'); gameOver=true; }
  stepMonsters();
  if(player.hp<=0){ addMessage('You died. Game over.'); gameOver=true; }
  updateStats(); draw();
}

window.addEventListener('keydown', e=>{
  if(gameOver && e.key==='r'){ init(); return; }
  const key = e.key;
  if(['ArrowUp','w','W'].includes(key)) tryMove(0,-1);
  if(['ArrowDown','s','S'].includes(key)) tryMove(0,1);
  if(['ArrowLeft','a','A'].includes(key)) tryMove(-1,0);
  if(['ArrowRight','d','D'].includes(key)) tryMove(1,0);
});

restartBtn.addEventListener('click', init);

function init(){
  createMap();
  placePlayer();
  placeMonsters();
  placePotions();
  player.hp=player.maxHp || 10; player.atk=3; gameOver=false; msgEl.textContent='';
  updateStats(); draw();
}

// animation loop so pulsing potions and other effects are visible
function loop(){
  if(!gameOver) draw();
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);

init();