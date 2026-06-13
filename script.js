const INITIAL_SEEDS = 5;
let board = Array(14).fill(INITIAL_SEEDS);
let scores = { p1: 0, p2: 0 };
let currentPlayer = 1; 
let gameMode = "PVP"; 
let currentLevel = 1; 
let isAnimating = false;
let gameStateHistory = null;

// Initialisation du contexte Audio (Web Audio API)
let audioCtx = null;
function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

// Générateur de sons synthétiques réalistes
function playSound(type) {
    try {
        initAudio();
        if (!audioCtx) return;

        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        const now = audioCtx.currentTime;

        if (type === 'sow') {
            // Son d'une graine de bois tombant dans une coupelle creuse
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(180, now);
            osc.frequency.exponentialRampToValueAtTime(80, now + 0.08);
            gainNode.gain.setValueAtTime(0.4, now);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
            osc.start(now);
            osc.stop(now + 0.08);
        } else if (type === 'capture') {
            // Son cristallin de capture
            osc.type = 'sine';
            osc.frequency.setValueAtTime(520, now);
            osc.frequency.exponentialRampToValueAtTime(840, now + 0.25);
            gainNode.gain.setValueAtTime(0.5, now);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
            osc.start(now);
            osc.stop(now + 0.25);
        }
    } catch (e) {
        console.log("Audio non supporté ou bloqué par le navigateur", e);
    }
}

// Sélections DOM
const mainMenu = document.getElementById('main-menu');
const gameScreen = document.getElementById('game-screen');
const menuHome = document.getElementById('menu-home');
const menuRules = document.getElementById('menu-rules');
const menuLevels = document.getElementById('menu-levels');
const levelsGrid = document.getElementById('levels-grid');
const animationLayer = document.getElementById('animation-layer');
const pitsElements = document.querySelectorAll('.pit');
const scoreP1Element = document.getElementById('score-p1');
const scoreP2Element = document.getElementById('score-p2');
const turnIndicator = document.getElementById('turn-indicator');

// Liens de Navigation Menu
document.getElementById('btn-goto-rules').onclick = () => { menuHome.classList.add('hidden'); menuRules.classList.remove('hidden'); };
document.getElementById('btn-back-home').onclick = () => { menuRules.classList.add('hidden'); menuHome.classList.remove('hidden'); };
document.getElementById('btn-mode-pvp').onclick = () => { initAudio(); launchGame("PVP"); };
document.getElementById('btn-mode-ai').onclick = () => { initAudio(); openLevelsMenu(); };
document.getElementById('btn-levels-back').onclick = () => { menuLevels.classList.add('hidden'); menuHome.classList.remove('hidden'); };
document.getElementById('btn-quit').onclick = quitGame;
document.getElementById('btn-undo').onclick = undoLastMove;

function getMaxUnlockedLevel() {
    const saved = localStorage.getItem('songo_max_level');
    return saved ? parseInt(saved) : 1;
}

function saveMaxUnlockedLevel(level) {
    localStorage.setItem('songo_max_level', level);
}

function openLevelsMenu() {
    menuHome.classList.add('hidden');
    menuLevels.classList.remove('hidden');
    renderLevelsGrid();
}

function renderLevelsGrid() {
    levelsGrid.innerHTML = '';
    const maxUnlocked = getMaxUnlockedLevel();

    for (let i = 1; i <= 35; i++) {
        const lvlBox = document.createElement('div');
        lvlBox.className = 'level-item';
        lvlBox.textContent = i;

        if (i > maxUnlocked) {
            lvlBox.classList.add('locked');
        } else {
            if (i === maxUnlocked) lvlBox.classList.add('current');
            lvlBox.onclick = () => {
                currentLevel = i;
                menuLevels.classList.add('hidden');
                launchGame("AI");
            };
        }
        levelsGrid.appendChild(lvlBox);
    }
}

function launchGame(mode) {
    gameMode = mode;
    document.getElementById('p2-name').textContent = mode === "PVP" ? "JOUEUR 2" : `MACHINE (Lvl ${currentLevel})`;
    document.getElementById('p2-avatar').textContent = mode === "PVP" ? "👥" : "🤖";
    document.getElementById('game-mode-title').textContent = mode === "PVP" ? "SONGO - 2 JOUEURS" : `SONGO - NIVEAU ${currentLevel}`;
    
    mainMenu.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    initGame();
}

function quitGame() {
    if (confirm("Voulez-vous vraiment abandonner la partie en cours ?")) {
        gameScreen.classList.add('hidden');
        isAnimating = false; 
        if (gameMode === "AI") {
            openLevelsMenu();
        } else {
            mainMenu.classList.remove('hidden');
            menuHome.classList.remove('hidden');
        }
    }
}

function initGame() {
    board = Array(14).fill(INITIAL_SEEDS);
    scores = { p1: 0, p2: 0 };
    currentPlayer = 1;
    isAnimating = false;
    gameStateHistory = null;
    updateUI();
    setupHoverEvents();
}

function isBelongsToCurrentPlayer(index) {
    return (currentPlayer === 1 && index >= 0 && index <= 6) || (currentPlayer === 2 && index >= 7 && index <= 13);
}

// ANIMATION BALISTIQUE ET ORGANIQUE DES GRAINES
function animateSeedTraversal(fromIdx, toIdx) {
    return new Promise(resolve => {
        const fromPit = document.getElementById(`pit-${fromIdx}`);
        const toPit = document.getElementById(`pit-${toIdx}`);
        
        const rectFrom = fromPit.getBoundingClientRect();
        const rectTo = toPit.getBoundingClientRect();

        const seedElement = document.createElement('div');
        seedElement.className = 'moving-seed';
        
        const startX = rectFrom.left + rectFrom.width / 2 - 6;
        const startY = rectFrom.top + rectFrom.height / 2 - 6;
        const endX = rectTo.left + rectTo.width / 2 - 6;
        const endY = rectTo.top + rectTo.height / 2 - 6;

        seedElement.style.left = `${startX}px`;
        seedElement.style.top = `${startY}px`;
        animationLayer.appendChild(seedElement);

        // Forcer le reflow CSS
        seedElement.getBoundingClientRect();

        // Ajout d'une trajectoire courbe personnalisée via des variables CSS
        const midX = (startX + endX) / 2;
        const midY = Math.min(startY, endY) - 80; // Crée un effet de parabole/arc vers le haut

        seedElement.style.transform = `translate(${endX - startX}px, ${endY - startY}px)`;
        
        // Simulation d'une courbe physique fluide
        seedElement.animate([
            { left: `${startX}px`, top: `${startY}px`, transform: 'scale(1)' },
            { left: `${midX}px`, top: `${midY}px`, transform: 'scale(1.4)' },
            { left: `${endX}px`, top: `${endY}px`, transform: 'scale(1)' }
        ], {
            duration: 280,
            easing: 'cubic-bezier(0.25, 1, 0.5, 1)'
        });

        setTimeout(() => {
            seedElement.remove();
            playSound('sow');
            resolve();
        }, 260);
    });
}

function simulateMove(startIndex) {
    let tempBoard = [...board];
    let seedsToSow = tempBoard[startIndex];
    if (seedsToSow === 0) return { path: [], captures: [], totalScore: 0 };
    
    tempBoard[startIndex] = 0;
    let path = [];
    let currentIndex = startIndex;

    while (seedsToSow > 0) {
        currentIndex = (currentIndex + 1) % 14;
        tempBoard[currentIndex]++;
        seedsToSow--;
        path.push(currentIndex);
    }

    let captures = [];
    let totalScore = 0;
    let checkIndex = currentIndex;
    
    if (!isBelongsToCurrentPlayer(checkIndex)) {
        while (!isBelongsToCurrentPlayer(checkIndex)) {
            let count = tempBoard[checkIndex];
            if (count === 2 || count === 3 || count === 4) {
                captures.push({ index: checkIndex, seedsCaptured: count });
                totalScore += count;
                tempBoard[checkIndex] = 0;
                checkIndex = (checkIndex - 1 + 14) % 14;
            } else { break; }
        }
    }
    return { path, captures, totalScore };
}

function updateUI() {
    scoreP1Element.textContent = scores.p1;
    scoreP2Element.textContent = scores.p2;
    turnIndicator.textContent = currentPlayer === 1 ? "Tour : Joueur 1 (Vous)" : (gameMode === "PVP" ? "Tour : Joueur 2" : "Tour : Machine...");
    turnIndicator.style.backgroundColor = currentPlayer === 1 ? "#2d6a4f" : "#8c521f";

    const undoBtn = document.getElementById('btn-undo');
    if (undoBtn) {
        undoBtn.disabled = !(gameStateHistory && !isAnimating);
    }

    pitsElements.forEach(pit => {
        const index = parseInt(pit.getAttribute('data-index'));
        const container = pit.querySelector('.seeds-container');
        container.innerHTML = '';

        // Organisation spatiale naturelle circulaire ou empilée au lieu du pur désordre de l'ancien code
        for (let i = 0; i < board[index]; i++) {
            const s = document.createElement('div');
            s.className = 'seed';
            // Algorithme de positionnement en rosette
            const angle = i * (Math.PI * 2 / Math.min(board[index], 6));
            const radius = i > 5 ? 12 : 6;
            const offsetX = Math.cos(angle) * radius + (Math.random() * 3 - 1.5);
            const offsetY = Math.sin(angle) * radius + (Math.random() * 3 - 1.5);
            s.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
            container.appendChild(s);
        }

        pit.classList.remove('playable', 'disabled', 'sow-target', 'capture-target');
        const b = pit.querySelector('.capture-badge');
        if (b) b.remove();

        if (!isAnimating) {
            if (isBelongsToCurrentPlayer(index) && board[index] > 0) pit.classList.add('playable');
            else pit.classList.add('disabled');
        } else {
            pit.classList.add('disabled');
        }
    });
}

function setupHoverEvents() {
    pitsElements.forEach(pit => {
        // Remplacement par des clones pour nettoyer d'anciens listeners accumulés
        const newPit = pit.cloneNode(true);
        pit.parentNode.replaceChild(newPit, pit);
    });

    // Ré-assigner la liste après nettoyage du DOM
    const freshPits = document.querySelectorAll('.pit');

    freshPits.forEach(pit => {
        pit.addEventListener('mouseenter', () => {
            if (isAnimating || (gameMode === "AI" && currentPlayer === 2)) return;
            const index = parseInt(pit.getAttribute('data-index'));
            
            if (isBelongsToCurrentPlayer(index) && board[index] > 0) {
                const sim = simulateMove(index);
                sim.path.forEach(idx => document.getElementById(`pit-${idx}`).classList.add('sow-target'));
                sim.captures.forEach(cap => {
                    const target = document.getElementById(`pit-${cap.index}`);
                    if(target) {
                        target.classList.add('capture-target');
                        const badge = document.createElement('div');
                        badge.className = 'capture-badge';
                        badge.innerHTML = `⚔️ +${cap.seedsCaptured}`;
                        target.appendChild(badge);
                    }
                });
            }
        });

        pit.addEventListener('mouseleave', () => {
            document.querySelectorAll('.pit').forEach(p => {
                p.classList.remove('sow-target', 'capture-target');
                const badge = p.querySelector('.capture-badge');
                if (badge) badge.remove();
            });
        });

        pit.addEventListener('click', () => {
            if (isAnimating || (gameMode === "AI" && currentPlayer === 2)) return;
            const index = parseInt(pit.getAttribute('data-index'));
            if (isBelongsToCurrentPlayer(index) && board[index] > 0) {
                playTurn(index);
            }
        });
    });
}

async function playTurn(startIndex) {
    if (isAnimating) return;
    if (!isBelongsToCurrentPlayer(startIndex) || board[startIndex] === 0) return;

    gameStateHistory = {
        board: [...board],
        scores: { ...scores },
        currentPlayer: currentPlayer
    };

    isAnimating = true;
    const sim = simulateMove(startIndex);
    board[startIndex] = 0;
    updateUI();

    let currentIndex = startIndex;
    
    // Processus de distribution graine par graine synchrone avec l'UI
    for (let i = 0; i < sim.path.length; i++) {
        let nextIndex = sim.path[i];
        await animateSeedTraversal(currentIndex, nextIndex);
        board[nextIndex]++;
        currentIndex = nextIndex;
        updateUI();
    }

    // Gestion synchrone des rafles/captures
    if (sim.captures.length > 0) {
        setTimeout(() => { playSound('capture'); }, 100);
        sim.captures.forEach(cap => {
            if (currentPlayer === 1) scores.p1 += cap.seedsCaptured;
            else scores.p2 += cap.scores || cap.seedsCaptured;
            board[cap.index] = 0;
        });
    }

    currentPlayer = currentPlayer === 1 ? 2 : 1;
    isAnimating = false;
    updateUI();

    // Re-calculer les évènements de survol après modification structurelle
    const gameEnded = checkGameOver();
    
    if (!gameEnded && gameMode === "AI" && currentPlayer === 2) {
        setTimeout(makeAiMove, 600);
    }
}

function makeAiMove() {
    if(isAnimating || currentPlayer === 1) return;
    let legalMoves = [];
    for (let i = 7; i <= 13; i++) { if (board[i] > 0) legalMoves.push(i); }
    if (legalMoves.length === 0) { checkGameOver(); return; }

    let errorChance = Math.max(0, 100 - (currentLevel * 3));
    let chosenMove = legalMoves[0];

    if (Math.random() * 100 < errorChance && legalMoves.length > 1) {
        chosenMove = legalMoves[Math.floor(Math.random() * legalMoves.length)];
    } else {
        let maxCapture = -1;
        legalMoves.forEach(idx => {
            let sim = simulateMove(idx);
            let score = sim.totalScore;
            if (currentLevel > 20) {
                let opponentSim = simulateMove((idx + 1) % 14);
                score -= (opponentSim.totalScore * 0.5); 
            }
            if (score > maxCapture) {
                maxCapture = score;
                chosenMove = idx;
            }
        });
    }

    playTurn(chosenMove);
}

function undoLastMove() {
    if (isAnimating || !gameStateHistory) return;
    board = [...gameStateHistory.board];
    scores = { ...gameStateHistory.scores };
    currentPlayer = gameStateHistory.currentPlayer;
    gameStateHistory = null;
    updateUI();
}

// RESOLUTION DU BUG DE REGENERATION DE FIN DE PARTIE
function checkGameOver() {
    let p1Moves = board.slice(0, 7).some(s => s > 0);
    let p2Moves = board.slice(7, 14).some(s => s > 0);

    if ((currentPlayer === 1 && !p1Moves) || (currentPlayer === 2 && !p2Moves)) {
        // Collecte finale
        for (let i = 0; i < 14; i++) {
            if (i <= 6) scores.p1 += board[i];
            else scores.p2 += board[i];
            board[i] = 0;
        }
        updateUI();

        setTimeout(() => {
            if (scores.p1 > scores.p2) {
                if (gameMode === "AI") {
                    let maxUnlocked = getMaxUnlockedLevel();
                    if (currentLevel === maxUnlocked && maxUnlocked < 35) {
                        saveMaxUnlockedLevel(maxUnlocked + 1);
                        alert(`Félicitations ! Vous avez vaincu le Niveau ${currentLevel}.\nLe Niveau ${currentLevel + 1} est débloqué ! 🎉`);
                    } else if (currentLevel === 35) {
                        alert("Incroyable ! Vous avez battu le niveau ultime ! Vous êtes un Maître Suprême du Songo ! 🏆");
                    } else {
                        alert(`Victoire ! Niveau ${currentLevel} à nouveau maîtrisé.`);
                    }
                } else {
                    alert("Fin de match ! Le Joueur 1 triomphe ! 👑");
                }
            } else if (scores.p2 > scores.p1) {
                alert(`Défaite ! La machine remporte ce round. Ajustez vos tactiques pour le Niveau ${currentLevel}. 🤖`);
            } else {
                alert("Égalité parfaite ! Une confrontation légendaire. 🤝");
            }

            // REGENERATION SECURISEE : Reset impératif de l'état d'animation et redirection nette
            isAnimating = false; 
            gameScreen.classList.add('hidden');
            
            if (gameMode === "AI") {
                openLevelsMenu();
            } else {
                mainMenu.classList.remove('hidden');
                menuHome.classList.remove('hidden');
            }
        }, 300);

        return true;
    }
    return false;
}