const game = document.getElementById('game');
const player = document.getElementById('player');
const obstacle = document.getElementById('obstacle');
const medkit = document.getElementById('medkit');
const effectText = document.getElementById('effectText');
const invincibleTimerText = document.getElementById('invincibleTimer');
const scoreText = document.getElementById('score');
const goalScoreText = document.getElementById('goalScore');
const stageText = document.getElementById('stageText');
const lifeText = document.getElementById('lifeText');
const bestScoreText = document.getElementById('bestScore');
const gameStatusText = document.getElementById('gameStatus');
const startPanel = document.getElementById('startPanel');
const gameOverPanel = document.getElementById('gameOverPanel');
const stageClearPanel = document.getElementById('stageClearPanel');
const stageClearTitle = document.getElementById('stageClearTitle');
const stageClearMessage = document.getElementById('stageClearMessage');
const winPanel = document.getElementById('winPanel');
const startButton = document.getElementById('startButton');
const restartButton = document.getElementById('restartButton');
const nextStageButton = document.getElementById('nextStageButton');
const winRestartButton = document.getElementById('winRestartButton');
const finalScoreText = document.getElementById('finalScore');
const winScoreText = document.getElementById('winScore');
const rankForm = document.getElementById('rankForm');
const nicknameInput = document.getElementById('nicknameInput');
const rankMessage = document.getElementById('rankMessage');
const loseRankForm = document.getElementById('loseRankForm');
const loseNicknameInput = document.getElementById('loseNicknameInput');
const loseRankMessage = document.getElementById('loseRankMessage');
const rankingList = document.getElementById('rankingList');
const clearRankButton = document.getElementById('clearRankButton');
const pauseButton = document.getElementById('pauseButton');
const pausePanel = document.getElementById('pausePanel');
const resumeButton = document.getElementById('resumeButton');

const FINAL_WIN_SCORE = 45;
const OBSTACLE_SCORE = 1;
const RANKING_KEY = 'jumpTimingRanking';
const BEST_SCORE_KEY = 'jumpTimingBestScore';
const OBSTACLE_START_OFFSET = 70;
const PLAYER_GROUND_BOTTOM = 82;
const BASE_JUMP_VELOCITY = 760;
const HOLD_BOOST_POWER = 1800;
const MAX_HOLD_TIME = 0.24;
const GRAVITY = 2450;
const MAX_LIFE = 3;
const DAMAGE_INVINCIBLE_TIME = 1000;
const MEDKIT_INVINCIBLE_TIME = 5000;
const MAX_MEDKIT_PER_STAGE = 3;

const STAGES = [
  { level: 1, goalScore: 15, speed: 520, label: '1단계' },
  { level: 2, goalScore: 30, speed: 690, label: '2단계' },
  { level: 3, goalScore: 45, speed: 860, label: '3단계' }
];

const OBSTACLE_HEIGHTS = [42, 58, 76, 96, 118, 138, 152];

let isPlaying = false;
let isPaused = false;
let isJumping = false;
let isHoldingJump = false;
let holdTime = 0;
let playerY = PLAYER_GROUND_BOTTOM;
let playerVelocityY = 0;
let score = 0;
let bestScore = Number(localStorage.getItem(BEST_SCORE_KEY)) || 0;
let currentStage = STAGES[0];
let obstacleSpeed = currentStage.speed;
let obstacleX = 0;
let medkitX = 0;
let animationFrameId = null;
let lastFrameTime = 0;
let audioContext = null;
let hasScoredCurrentObstacle = false;
let isRankSavedThisRound = false;
let currentResult = '패배';
let life = MAX_LIFE;
let isInvincible = false;
let invincibleTimer = null;
let invincibleCountdownTimer = null;
let invincibleEndTime = 0;
let medkitSpawnScores = [];
let medkitSpawnIndex = 0;
let medkitCollectedCountThisStage = 0;
let isMedkitActive = false;
let pausedInvincibleRemainTime = 0;

function initScreen() {
  obstacleSpeed = getStageSpeed();
  goalScoreText.textContent = currentStage.goalScore;
  winScoreText.textContent = FINAL_WIN_SCORE;
  bestScoreText.textContent = bestScore;
  stageText.textContent = currentStage.label;
  updateStageCostume();
  updateLifeUI();
  renderRanking();
}

function getStageSpeed() {
  const width = game.clientWidth || 920;
  if (width < 380) return currentStage.speed * 0.72;
  if (width < 520) return currentStage.speed * 0.82;
  if (width < 720) return currentStage.speed * 0.9;
  return currentStage.speed;
}

function getAudioContext() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return null;
  if (!audioContext) audioContext = new AudioContext();
  return audioContext;
}

function playTone(frequency, startTime, duration, type = 'square', volume = 0.12) {
  const context = getAudioContext();
  if (!context) return;
  const oscillator = context.createOscillator();
  const gainNode = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startTime);
  gainNode.gain.setValueAtTime(volume, startTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  oscillator.connect(gainNode);
  gainNode.connect(context.destination);
  oscillator.start(startTime);
  oscillator.stop(startTime + duration);
}

function playJumpSound() {
  const context = getAudioContext();
  if (!context) return;
  const now = context.currentTime;
  playTone(420, now, 0.12, 'square', 0.12);
  playTone(760, now + 0.04, 0.08, 'square', 0.08);
}

function playWinSound() {
  const context = getAudioContext();
  if (!context) return;
  const now = context.currentTime;
  playTone(523, now, 0.14, 'triangle', 0.13);
  playTone(659, now + 0.13, 0.14, 'triangle', 0.13);
  playTone(784, now + 0.26, 0.18, 'triangle', 0.15);
  playTone(1046, now + 0.42, 0.28, 'triangle', 0.16);
}

function playLoseSound() {
  const context = getAudioContext();
  if (!context) return;
  const now = context.currentTime;
  playTone(220, now, 0.18, 'sawtooth', 0.13);
  playTone(165, now + 0.16, 0.22, 'sawtooth', 0.12);
  playTone(110, now + 0.36, 0.32, 'sawtooth', 0.12);
}

function playHealSound() {
  const context = getAudioContext();
  if (!context) return;
  const now = context.currentTime;
  playTone(660, now, 0.1, 'triangle', 0.1);
  playTone(880, now + 0.08, 0.16, 'triangle', 0.12);
}

function updateLifeUI() {
  lifeText.textContent = '♥'.repeat(life) + '♡'.repeat(MAX_LIFE - life);
}

function updateStageCostume() {
  player.classList.remove('stage-1', 'stage-2', 'stage-3');
  player.classList.add(`stage-${currentStage.level}`);
}

function showEffect(message) {
  effectText.textContent = message;
  effectText.classList.remove('hidden');
  setTimeout(() => effectText.classList.add('hidden'), 900);
}

function setInvincible(duration, showTimer = false) {
  isInvincible = true;
  player.classList.add('invincible');
  clearTimeout(invincibleTimer);
  clearInterval(invincibleCountdownTimer);

  if (showTimer) {
    invincibleEndTime = Date.now() + duration;
    updateInvincibleTimer();
    invincibleTimerText.classList.remove('hidden');
    invincibleCountdownTimer = setInterval(updateInvincibleTimer, 100);
  } else {
    invincibleTimerText.classList.add('hidden');
  }

  invincibleTimer = setTimeout(() => {
    isInvincible = false;
    player.classList.remove('invincible');
    clearInterval(invincibleCountdownTimer);
    invincibleTimerText.classList.add('hidden');
  }, duration);
}

function updateInvincibleTimer() {
  const remainTime = Math.max(0, invincibleEndTime - Date.now());
  invincibleTimerText.textContent = `무적 ${(remainTime / 1000).toFixed(1)}초`;

  if (remainTime <= 0) {
    clearInterval(invincibleCountdownTimer);
    invincibleTimerText.classList.add('hidden');
  }
}

function clearInvincible() {
  isInvincible = false;
  player.classList.remove('invincible');
  clearTimeout(invincibleTimer);
  clearInterval(invincibleCountdownTimer);
  invincibleTimerText.classList.add('hidden');
  pausedInvincibleRemainTime = 0;
}

function decideMedkitSpawnScores() {
  const goalScore = currentStage.goalScore;
  const minGap = 4;
  const candidates = [];

  for (let scorePoint = 3; scorePoint <= goalScore - 3; scorePoint += 1) {
    candidates.push(scorePoint);
  }

  medkitSpawnScores = [];

  while (medkitSpawnScores.length < MAX_MEDKIT_PER_STAGE && candidates.length > 0) {
    const randomIndex = Math.floor(Math.random() * candidates.length);
    const selectedScore = candidates.splice(randomIndex, 1)[0];
    const isTooClose = medkitSpawnScores.some((savedScore) => Math.abs(savedScore - selectedScore) < minGap);

    if (!isTooClose) {
      medkitSpawnScores.push(selectedScore);
    }
  }

  medkitSpawnScores.sort((a, b) => a - b);
  medkitSpawnIndex = 0;
}

function startGame() {
  isPlaying = true;
  isPaused = false;
  isJumping = false;
  isHoldingJump = false;
  holdTime = 0;
  playerY = PLAYER_GROUND_BOTTOM;
  playerVelocityY = 0;
  score = 0;
  life = MAX_LIFE;
  currentStage = STAGES[0];
  obstacleSpeed = getStageSpeed();
  hasScoredCurrentObstacle = false;
  isRankSavedThisRound = false;
  currentResult = '패배';
  medkitSpawnIndex = 0;
  medkitCollectedCountThisStage = 0;
  isMedkitActive = false;
  decideMedkitSpawnScores();
  clearInvincible();

  updatePlayerPosition();
  updateLifeUI();
  updateStageCostume();
  scoreText.textContent = score;
  stageText.textContent = currentStage.label;
  goalScoreText.textContent = currentStage.goalScore;
  gameStatusText.textContent = '진행 중';
  rankMessage.textContent = '';
  loseRankMessage.textContent = '';
  nicknameInput.value = '';
  loseNicknameInput.value = '';
  nicknameInput.disabled = false;
  loseNicknameInput.disabled = false;
  startPanel.classList.add('hidden');
  gameOverPanel.classList.add('hidden');
  stageClearPanel.classList.add('hidden');
  winPanel.classList.add('hidden');
  pausePanel.classList.add('hidden');
  pauseButton.textContent = '일시정지';
  medkit.classList.add('hidden');
  effectText.classList.add('hidden');

  cancelAnimationFrame(animationFrameId);
  resetObstaclePosition();
  lastFrameTime = performance.now();
  animationFrameId = requestAnimationFrame(gameLoop);
}

function gameLoop(currentTime) {
  if (!isPlaying || isPaused) return;

  const deltaTime = Math.min((currentTime - lastFrameTime) / 1000, 0.033);
  lastFrameTime = currentTime;

  updateJump(deltaTime);

  obstacleX -= obstacleSpeed * deltaTime;
  obstacle.style.transform = `translateX(${obstacleX}px)`;

  if (isMedkitActive) {
    medkitX -= obstacleSpeed * deltaTime;
    medkit.style.transform = `translateX(${medkitX}px)`;
    if (medkitX < -60) hideMedkit();
  }

  checkGameState();

  if (isPlaying && obstacleX < -obstacle.offsetWidth - 10) {
    resetObstaclePosition();
    hasScoredCurrentObstacle = false;
  }

  animationFrameId = requestAnimationFrame(gameLoop);
}

function updateJump(deltaTime) {
  if (!isJumping) return;

  if (isHoldingJump && holdTime < MAX_HOLD_TIME) {
    playerVelocityY += HOLD_BOOST_POWER * deltaTime;
    holdTime += deltaTime;
  }

  playerVelocityY -= GRAVITY * deltaTime;
  playerY += playerVelocityY * deltaTime;

  if (playerY <= PLAYER_GROUND_BOTTOM) {
    playerY = PLAYER_GROUND_BOTTOM;
    playerVelocityY = 0;
    isJumping = false;
    isHoldingJump = false;
    holdTime = 0;
  }

  updatePlayerPosition();
}

function updatePlayerPosition() {
  player.style.bottom = `${playerY}px`;
}

function getRandomObstacleHeight() {
  return OBSTACLE_HEIGHTS[Math.floor(Math.random() * OBSTACLE_HEIGHTS.length)];
}

function resetObstaclePosition() {
  const gameWidth = game.clientWidth;
  obstacleX = gameWidth + OBSTACLE_START_OFFSET;
  obstacle.style.height = `${getRandomObstacleHeight()}px`;
  obstacle.style.transform = `translateX(${obstacleX}px)`;

  const nextMedkitScore = medkitSpawnScores[medkitSpawnIndex];
  if (!isMedkitActive && nextMedkitScore !== undefined && score >= nextMedkitScore) {
    spawnMedkit();
  }
}

function spawnMedkit() {
  medkitSpawnIndex += 1;
  isMedkitActive = true;
  medkitX = game.clientWidth + OBSTACLE_START_OFFSET + 140 + Math.floor(Math.random() * 220);
  medkit.style.bottom = `${135 + Math.floor(Math.random() * 85)}px`;
  medkit.style.transform = `translateX(${medkitX}px)`;
  medkit.classList.remove('hidden');
}

function hideMedkit() {
  isMedkitActive = false;
  medkit.classList.add('hidden');
}

function jump() {
  if (!isPlaying || isPaused || isJumping) return;
  isJumping = true;
  isHoldingJump = true;
  holdTime = 0;
  playerVelocityY = BASE_JUMP_VELOCITY;
  playJumpSound();
}

function stopHoldingJump() {
  isHoldingJump = false;
}

function getNextStage() {
  return STAGES.find((stage) => stage.level === currentStage.level + 1) || null;
}

function clearCurrentStage() {
  const nextStage = getNextStage();
  if (!nextStage) {
    winGame();
    return;
  }

  isPlaying = false;
  stopGameLoop();
  saveBestScore();
  playWinSound();

  gameStatusText.textContent = `${currentStage.label} 클리어`;
  stageClearTitle.textContent = `${currentStage.label} 클리어`;
  stageClearMessage.textContent = `${nextStage.label}로 이동합니다. 점수는 0점부터 다시 시작하고 목표 점수는 ${nextStage.goalScore}점입니다.`;
  stageClearPanel.classList.remove('hidden');
}

function startNextStage() {
  const nextStage = getNextStage();
  if (!nextStage) return;

  currentStage = nextStage;
  obstacleSpeed = getStageSpeed();
  score = 0;
  life = MAX_LIFE;
  playerY = PLAYER_GROUND_BOTTOM;
  playerVelocityY = 0;
  isJumping = false;
  isHoldingJump = false;
  hasScoredCurrentObstacle = false;
  medkitSpawnIndex = 0;
  medkitCollectedCountThisStage = 0;
  isMedkitActive = false;
  decideMedkitSpawnScores();
  clearInvincible();
  isPlaying = true;
  isPaused = false;
  pausePanel.classList.add('hidden');
  pauseButton.textContent = '일시정지';

  updatePlayerPosition();
  updateLifeUI();
  updateStageCostume();
  scoreText.textContent = score;
  stageText.textContent = currentStage.label;
  goalScoreText.textContent = currentStage.goalScore;
  gameStatusText.textContent = `${currentStage.label} 진행 중`;
  stageClearPanel.classList.add('hidden');
  medkit.classList.add('hidden');

  resetObstaclePosition();
  lastFrameTime = performance.now();
  animationFrameId = requestAnimationFrame(gameLoop);
}

function addObstacleScore() {
  score += OBSTACLE_SCORE;
  scoreText.textContent = score;
  if (score >= currentStage.goalScore) clearCurrentStage();
}

function checkGameState() {
  const playerBox = player.getBoundingClientRect();
  const obstacleBox = obstacle.getBoundingClientRect();

  const isCollidingObstacle =
    playerBox.left < obstacleBox.right &&
    playerBox.right > obstacleBox.left &&
    playerBox.bottom > obstacleBox.top &&
    playerBox.top < obstacleBox.bottom;

  if (isCollidingObstacle) {
    handleObstacleHit();
    return;
  }

  if (isMedkitActive) {
    const medkitBox = medkit.getBoundingClientRect();
    const isCollidingMedkit =
      playerBox.left < medkitBox.right &&
      playerBox.right > medkitBox.left &&
      playerBox.bottom > medkitBox.top &&
      playerBox.top < medkitBox.bottom;

    if (isCollidingMedkit) collectMedkit();
  }

  const passedObstacle = obstacleBox.right < playerBox.left;
  if (passedObstacle && !hasScoredCurrentObstacle) {
    hasScoredCurrentObstacle = true;
    addObstacleScore();
  }
}

function handleObstacleHit() {
  if (isInvincible) {
    resetObstaclePosition();
    hasScoredCurrentObstacle = false;
    return;
  }

  life -= 1;
  updateLifeUI();
  showEffect('하트 -1');
  setInvincible(DAMAGE_INVINCIBLE_TIME);
  resetObstaclePosition();
  hasScoredCurrentObstacle = false;

  if (life <= 0) endGame();
}

function collectMedkit() {
  if (!isMedkitActive) return;
  medkitCollectedCountThisStage += 1;
  hideMedkit();
  playHealSound();

  if (life < MAX_LIFE) {
    life += 1;
    updateLifeUI();
    showEffect(`하트 +1 (${medkitCollectedCountThisStage}/${MAX_MEDKIT_PER_STAGE})`);
    return;
  }

  setInvincible(MEDKIT_INVINCIBLE_TIME, true);
  showEffect('5초 무적!');
}

function pauseGame() {
  if (!isPlaying || isPaused) return;
  isPaused = true;
  stopHoldingJump();
  stopGameLoop();
  gameStatusText.textContent = '일시정지';
  pauseButton.textContent = '계속하기';
  pausePanel.classList.remove('hidden');

  if (isInvincible && invincibleEndTime > 0) {
    pausedInvincibleRemainTime = Math.max(0, invincibleEndTime - Date.now());
    clearTimeout(invincibleTimer);
    clearInterval(invincibleCountdownTimer);
  }
}

function resumeGame() {
  if (!isPlaying || !isPaused) return;
  isPaused = false;
  gameStatusText.textContent = `${currentStage.label} 진행 중`;
  pauseButton.textContent = '일시정지';
  pausePanel.classList.add('hidden');

  if (isInvincible && pausedInvincibleRemainTime > 0 && !invincibleTimerText.classList.contains('hidden')) {
    invincibleEndTime = Date.now() + pausedInvincibleRemainTime;
    updateInvincibleTimer();
    invincibleCountdownTimer = setInterval(updateInvincibleTimer, 100);
    invincibleTimer = setTimeout(() => {
      isInvincible = false;
      player.classList.remove('invincible');
      clearInterval(invincibleCountdownTimer);
      invincibleTimerText.classList.add('hidden');
      pausedInvincibleRemainTime = 0;
    }, pausedInvincibleRemainTime);
  }

  lastFrameTime = performance.now();
  animationFrameId = requestAnimationFrame(gameLoop);
}

function togglePause() {
  if (!isPlaying) return;
  if (isPaused) resumeGame();
  else pauseGame();
}

function stopGameLoop() {
  cancelAnimationFrame(animationFrameId);
  animationFrameId = null;
}

function saveBestScore() {
  if (score > bestScore) {
    bestScore = score;
    localStorage.setItem(BEST_SCORE_KEY, bestScore);
    bestScoreText.textContent = bestScore;
  }
}

function getRanking() {
  const savedRanking = localStorage.getItem(RANKING_KEY);
  if (!savedRanking) return [];
  try {
    return JSON.parse(savedRanking);
  } catch (error) {
    return [];
  }
}

function saveRanking(ranking) {
  localStorage.setItem(RANKING_KEY, JSON.stringify(ranking));
}

function addRanking(nickname) {
  const ranking = getRanking();
  ranking.push({
    nickname,
    score,
    result: currentResult,
    stage: currentStage.label,
    date: new Date().toLocaleDateString('ko-KR')
  });

  ranking.sort((a, b) => {
    const aStage = Number(String(a.stage || '').replace(/[^0-9]/g, '')) || 0;
    const bStage = Number(String(b.stage || '').replace(/[^0-9]/g, '')) || 0;
    if (bStage !== aStage) return bStage - aStage;
    if (b.score !== a.score) return b.score - a.score;
    if (a.result === b.result) return 0;
    return a.result === '승리' ? -1 : 1;
  });

  saveRanking(ranking.slice(0, 10));
  renderRanking();
}

function renderRanking() {
  const ranking = getRanking();
  rankingList.innerHTML = '';

  if (ranking.length === 0) {
    rankingList.innerHTML = '<li class="empty-rank">아직 등록된 기록이 없습니다.</li>';
    return;
  }

  ranking.forEach((rank) => {
    const li = document.createElement('li');
    const result = rank.result || '기록';
    const stage = rank.stage || '';
    li.innerHTML = `<strong>${rank.nickname}</strong> - ${rank.score}점 <span class="rank-result">${result}</span> <span class="rank-stage">${stage}</span> <span class="rank-date">${rank.date}</span>`;
    rankingList.appendChild(li);
  });
}

function saveCurrentRank(inputElement, messageElement) {
  if (isRankSavedThisRound) {
    messageElement.textContent = '이미 이번 기록을 등록했습니다.';
    return;
  }

  const nickname = inputElement.value.trim();
  if (nickname.length === 0) {
    messageElement.textContent = '닉네임을 입력해주세요.';
    return;
  }

  addRanking(nickname);
  isRankSavedThisRound = true;
  nicknameInput.disabled = true;
  loseNicknameInput.disabled = true;
  messageElement.textContent = '랭킹에 등록했습니다.';
}

function endGame() {
  if (!isPlaying) return;
  isPlaying = false;
  currentResult = '패배';
  gameStatusText.textContent = '게임 오버';
  finalScoreText.textContent = score;
  playLoseSound();
  stopGameLoop();
  saveBestScore();
  pausePanel.classList.add('hidden');
  pauseButton.textContent = '일시정지';
  gameOverPanel.classList.remove('hidden');
  loseNicknameInput.focus();
}

function winGame() {
  if (!isPlaying) return;
  isPlaying = false;
  currentResult = '승리';
  gameStatusText.textContent = '최종 승리';
  winScoreText.textContent = FINAL_WIN_SCORE;
  playWinSound();
  stopGameLoop();
  saveBestScore();
  pausePanel.classList.add('hidden');
  pauseButton.textContent = '일시정지';
  winPanel.classList.remove('hidden');
  nicknameInput.focus();
}

startButton.addEventListener('click', (event) => {
  event.stopPropagation();
  startGame();
});

restartButton.addEventListener('click', (event) => {
  event.stopPropagation();
  startGame();
});

nextStageButton.addEventListener('click', (event) => {
  event.stopPropagation();
  startNextStage();
});

pauseButton.addEventListener('click', (event) => {
  event.stopPropagation();
  togglePause();
});

resumeButton.addEventListener('click', (event) => {
  event.stopPropagation();
  resumeGame();
});

winRestartButton.addEventListener('click', (event) => {
  event.stopPropagation();
  startGame();
});

rankForm.addEventListener('submit', (event) => {
  event.preventDefault();
  event.stopPropagation();
  saveCurrentRank(nicknameInput, rankMessage);
});

loseRankForm.addEventListener('submit', (event) => {
  event.preventDefault();
  event.stopPropagation();
  saveCurrentRank(loseNicknameInput, loseRankMessage);
});

clearRankButton.addEventListener('click', () => {
  localStorage.removeItem(RANKING_KEY);
  renderRanking();
});

game.addEventListener('mousedown', (event) => {
  if (event.target.closest('button, input, label')) return;
  jump();
});

game.addEventListener('mouseup', stopHoldingJump);
game.addEventListener('mouseleave', stopHoldingJump);
game.addEventListener('touchstart', (event) => {
  if (event.target.closest('button, input, label')) return;
  event.preventDefault();
  jump();
}, { passive: false });
game.addEventListener('touchend', stopHoldingJump);
game.addEventListener('touchcancel', stopHoldingJump);

window.addEventListener('resize', () => {
  obstacleSpeed = getStageSpeed();
});

document.addEventListener('keydown', (event) => {
  if (event.code === 'KeyP' || event.code === 'Escape') {
    event.preventDefault();
    togglePause();
    return;
  }

  if (event.code === 'Space' || event.code === 'ArrowUp') {
    event.preventDefault();
    if (isPaused) return;
    if (!isPlaying && !startPanel.classList.contains('hidden')) {
      startGame();
      return;
    }
    if (!event.repeat) jump();
  }
});

document.addEventListener('keyup', (event) => {
  if (event.code === 'Space' || event.code === 'ArrowUp') stopHoldingJump();
});

initScreen();
