(() => {
  'use strict';

  const canvas = document.getElementById('game');
  if (!canvas) {
    console.error('Canvas with id="game" not found.');
    return;
  }
  const ctx = canvas.getContext('2d');

  // Survey items: emoji are only the "icons"; labels are what you are ranking.
  const ITEMS = [
    { key: 'service',    label: 'Service Quality',     emoji: '🍎', color: '#FF0000' },
    { key: 'speed',      label: 'Speed & Wait Time',   emoji: '🍌', color: '#FFD700' },
    { key: 'staff',      label: 'Staff Friendliness',  emoji: '🍓', color: '#FF6347' },
    { key: 'price',      label: 'Pricing & Value',     emoji: '🍇', color: '#8A2BE2' },
    { key: 'experience', label: 'Overall Experience',  emoji: '🥝', color: '#228B22' },
  ];

  // Grid size
  const CELL = 20;
  const COLS = Math.floor(canvas.width / CELL);
  const ROWS = Math.floor(canvas.height / CELL);

  // Game speed (bigger = slower)
  const TICK_MS = 220;

  // State
  let snake = [];
  let dir = { x: 1, y: 0 };
  let nextDir = { x: 1, y: 0 };
  let running = true;
  let items = [];     // {key,label,emoji,x,y,alive}
  let ranking = [];   // eaten in order (most -> least)

  // UI
  const rankingEl = document.getElementById('ranking');
  const restartBtn = document.getElementById('restartBtn');
  const submitBtn = document.getElementById('submitBtn');

  const randInt = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;

  function cellOccupiedBySnake(x, y) {
    return snake.some(s => s.x === x && s.y === y);
  }

  function cellOccupiedByAliveItem(x, y) {
    return items.some(it => it.alive && it.x === x && it.y === y);
  }

  function cellOccupied(x, y) {
    return cellOccupiedBySnake(x, y) || cellOccupiedByAliveItem(x, y);
  }

  function updateRankingUI() {
    if (!rankingEl) return;
    if (ranking.length === 0) {
      rankingEl.innerHTML = '<span style="opacity:.75">None yet — start eating items.</span>';
      return;
    }
    rankingEl.innerHTML = ranking
      .map((r, i) => `<span>${i + 1}. ${r.emoji} ${r.label}</span>`)
      .join('');
  }

  function placeAllItems() {
    items = ITEMS.map(it => {
      let x, y;
      let tries = 0;
      do {
        x = randInt(2, COLS - 3);
        y = randInt(2, ROWS - 3);
        tries += 1;
        if (tries > 2000) break;
      } while (cellOccupied(x, y));
      return { ...it, x, y, alive: true };
    });
  }

  function resetGame() {
    snake = [
      { x: 6, y: 6 },
      { x: 5, y: 6 },
      { x: 4, y: 6 },
    ];
    dir = { x: 1, y: 0 };
    nextDir = { x: 1, y: 0 };
    running = true;
    ranking = [];
    placeAllItems();
    updateRankingUI();
    submitBtn.disabled = false;
  }

  function setNextDir(dx, dy) {
    // prevent reversing into itself
    if (snake.length > 1) {
      if (dx === -dir.x && dy === -dir.y) return;
    }
    nextDir = { x: dx, y: dy };
  }

  function onKeyDown(e) {
    const k = (e.key || '').toLowerCase();

    if (k === 'arrowup' || k === 'w') setNextDir(0, -1);
    else if (k === 'arrowdown' || k === 's') setNextDir(0, 1);
    else if (k === 'arrowleft' || k === 'a') setNextDir(-1, 0);
    else if (k === 'arrowright' || k === 'd') setNextDir(1, 0);
    else if (k === 'r') resetGame();
  }

  function step() {
    if (!running) return;

    dir = nextDir;

    const head = snake[0];
    const next = { x: head.x + dir.x, y: head.y + dir.y };

    // wall collision
    if (next.x < 0 || next.y < 0 || next.x >= COLS || next.y >= ROWS) {
      running = false;
      return;
    }

    // self collision
    if (cellOccupiedBySnake(next.x, next.y)) {
      running = false;
      return;
    }

    snake.unshift(next);

    // check item hit
    const hit = items.find(it => it.alive && it.x === next.x && it.y === next.y);
    if (hit) {
      hit.alive = false;
      ranking.push(hit);  // Add the eaten item to the ranking
      updateRankingUI();
    } else {
      snake.pop();
    }

    // complete
    if (items.every(it => !it.alive)) {
      running = false;
      submitBtn.disabled = false;
    }
  }

  function drawGrid() {
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;

    for (let x = 0; x <= COLS; x++) {
      ctx.beginPath();
      ctx.moveTo(x * CELL, 0);
      ctx.lineTo(x * CELL, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * CELL);
      ctx.lineTo(canvas.width, y * CELL);
      ctx.stroke();
    }
  }

  function drawItems() {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.font = `${CELL * 1.5}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",system-ui`; // Bigger fruits!

    items.forEach(it => {
      if (!it.alive) return;
      const px = it.x * CELL + CELL / 2;
      const py = it.y * CELL + CELL / 2;

      // Add color to the fruit based on its type
      ctx.fillStyle = it.color || "#FFF";  // Fallback to white if no color is set
      ctx.fillText(it.emoji, px, py);
    });
  }

  function drawSnake() {
    snake.forEach((s, i) => {
      ctx.fillStyle = (i === 0) ? 'rgba(34,197,94,0.95)' : 'rgba(34,197,94,0.65)';
      ctx.fillRect(s.x * CELL + 2, s.y * CELL + 2, CELL - 4, CELL - 4);
    });
  }

  function drawEndOverlay() {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 30px system-ui';

    const complete = items.every(it => !it.alive);
    ctx.fillText(complete ? 'Survey Complete' : 'Game Over', canvas.width / 2, canvas.height / 2 - 10);

    ctx.font = '16px system-ui';
    ctx.fillText('Press R to restart', canvas.width / 2, canvas.height / 2 + 28);
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // background
    ctx.fillStyle = 'rgba(0,0,0,0.10)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawGrid();
    drawItems();
    drawSnake();

    if (!running) drawEndOverlay();
  }

  // Loop
  let last = performance.now();
  function loop(now) {
    if (now - last >= TICK_MS) {
      last = now;
      step();
    }
    draw();
    requestAnimationFrame(loop);
  }

  // Wire up events
  window.addEventListener('keydown', onKeyDown);
  if (restartBtn) restartBtn.addEventListener('click', resetGame);

  submitBtn.addEventListener('click', () => {
  // Define the XP earned for completing the Snake game
  if (ranking.length < ITEMS.length) {
      alert('Please eat all the fruits before submitting!');
      return;
  }
  
  const xpEarned = 20;

  fetch('/api/snake-submit', {
    method: 'POST',
    body: JSON.stringify({
      payload: ranking,  // Send the ranking to the backend for storing
      xp_earned: xpEarned  // Send XP earned
    }),
    headers: { 'Content-Type': 'application/json' }
  })
  .then(response => response.json())
  .then(data => {
    alert(`Survey Completed! XP Earned: ${data.store.xp}`);
  });
  });

  // Start
  resetGame();
  requestAnimationFrame(loop);
})();