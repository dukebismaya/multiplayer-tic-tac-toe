// (C) 2025 Bismaya Jyoti Dalei All rights reserved.

class AudioManager {
    constructor() {
        this.sounds = {
            click_x: new Audio('assets/sfx/x_click_sfx.mp3'),
            click_o: new Audio('assets/sfx/o_click_sfx.mp3'),
            win: new Audio('assets/sfx/win_match_sfx.mp3'),
            loss: new Audio('assets/sfx/loss_match_sfx.mp3'),
            notification: new Audio('assets/sfx/notification_sfx.mp3')
        };

        Object.values(this.sounds).forEach(sound => {
            sound.volume = 0.7;
            sound.preload = 'auto';
        });

        this.enabled = localStorage.getItem('soundEnabled') !== 'false';
        this.audioInitialized = false;
        this.initializeAudioContext();
    }

    initializeAudioContext() {
        const initAudio = () => {
            if (this.audioInitialized) return;

            Object.values(this.sounds).forEach(sound => {
                sound.play().then(() => {
                    sound.pause();
                    sound.currentTime = 0;
                }).catch(() => {
                    // Ignore errors during initialization
                });
            });

            this.audioInitialized = true;
            console.log('Audio initialized successfully');

            document.removeEventListener('click', initAudio);
            document.removeEventListener('keydown', initAudio);
            document.removeEventListener('touchstart', initAudio);
        };

        document.addEventListener('click', initAudio);
        document.addEventListener('keydown', initAudio);
        document.addEventListener('touchstart', initAudio);
    }

    async play(soundName) {
        if (!this.enabled || !this.audioInitialized) return;

        const sound = this.sounds[soundName];
        if (sound) {
            try {
                sound.currentTime = 0;
                await sound.play();
            } catch (error) {
                console.log(`Sound play failed for ${soundName}:`, error.message);
            }
        }
    }

    toggle() {
        this.enabled = !this.enabled;
        localStorage.setItem('soundEnabled', this.enabled);
        return this.enabled;
    }

    setVolume(volume) {
        Object.values(this.sounds).forEach(sound => {
            sound.volume = Math.max(0, Math.min(1, volume));
        });
    }
}

class TicTacToeGame {
    constructor() {
        this.socket = null;
        this.gameState = null;
        this.currentScreen = 'menuScreen';
        this.playerInfo = {
            id: null,
            name: '',
            symbol: '',
            roomId: ''
        };
        this.theme = localStorage.getItem('theme') || 'light';
        this.audioManager = new AudioManager();

        this.showLoadingOverlay();
        this.initializeSocket();
        this.setupEventListeners();
        this.applyTheme();
        this.showAudioPrompt();
    }

    showAudioPrompt() {
        setTimeout(() => {
            this.showNotification('Click anywhere to enable sound effects', 'info');
        }, 2000);
    }

    initializeSocket() {
        this.socket = io(window.location.origin, {
            transports: ['polling', 'websocket'],
            upgrade: true,
            rememberUpgrade: true,
            timeout: 20000,
            forceNew: true
        });

        this.setupSocketListeners();
    }

    setupSocketListeners() {
        this.socket.on('connect', () => {
            console.log('Connected to server successfully');
            this.hideLoadingOverlay();
            this.showScreen('menuScreen');
            this.showNotification('Connected to server!', 'success', false);
        });

        this.socket.on('connect_error', (error) => {
            console.error('Connection failed:', error);
            this.hideLoadingOverlay();
            this.showNotification('Failed to connect to server. Please check if the server is running.', 'error');
        });

        this.socket.on('disconnect', (reason) => {
            console.log('Disconnected from server:', reason);
            this.showNotification('Connection lost: ' + reason, 'error');
        });

        this.socket.on('connected', (data) => {
            console.log('Received connected event:', data);
            this.playerInfo.id = data.client_id;
        });

        this.socket.on('room_created', (data) => {
            console.log('Room created:', data);
            this.hideLoadingOverlay();
            this.playerInfo = {
                ...this.playerInfo,
                name: data.player_name,
                symbol: data.symbol,
                roomId: data.room_id
            };
            this.gameState = data.game_state;
            this.showWaitingScreen(data.room_id, data.game_state.grid_size);
            this.showNotification(`Room ${data.room_id} created!`, 'success');
        });

        this.socket.on('room_joined', (data) => {
            console.log('Room joined:', data);
            this.hideLoadingOverlay();
            this.playerInfo = {
                ...this.playerInfo,
                name: data.player_name,
                symbol: data.symbol,
                roomId: data.room_id
            };
            this.gameState = data.game_state;
            this.showNotification(`Joined room ${data.room_id}!`, 'success');
        });

        this.socket.on('player_joined', (data) => {
            this.showNotification(`${data.player_name} joined the game!`, 'info');
        });

        this.socket.on('game_start', (gameState) => {
            this.gameState = gameState;
            this.showGameScreen();
            this.showNotification('Game started!', 'success');
        });

        this.socket.on('move_made', (data) => {
            if (data.game_state) {
                this.gameState = data.game_state;
            }

            // Play click sound based on symbol
            if (data.symbol === 'X') {
                this.audioManager.play('click_x');
            } else {
                this.audioManager.play('click_o');
            }

            this.updateGameBoard(data);
            this.updateTurnIndicator(data.current_turn);
            this.showNotification(`${data.player_name} played ${data.symbol}`, 'info', false);
        });

        this.socket.on('game_over', (data) => {
            this.handleGameOver(data);
        });

        this.socket.on('game_restarted', (data) => {
            this.gameState = data.game_state;

            // Symbol change handling
            if (data.symbol_changes && data.symbol_changes[this.playerInfo.id]) {
                const change = data.symbol_changes[this.playerInfo.id];
                if (change.old !== change.new) {
                    // Update player's symbol
                    this.playerInfo.symbol = change.new;

                    this.showSymbolSwapNotification(change.old, change.new, this.gameState.match_count);
                }
            }

            this.resetGameBoard();
            this.updateTurnIndicator(this.gameState.current_turn);
            this.updatePlayerInfo();
            this.updateScoreboard();
            this.hideGameOverModal();

            // Match number
            this.showNotification(`Match ${this.gameState.match_count + 1} started!`, 'info');
        });

        this.socket.on('session_terminated', (data) => {
            this.showNotification(data.message, 'warning');

            this.gameState = null;
            this.playerInfo.roomId = '';

            setTimeout(() => {
                this.backToMenu();
            }, 2000);
        });

        this.socket.on('left_room', (data) => {
            console.log('Successfully left room:', data.room_id);
        });

        this.socket.on('rooms_list', (data) => {
            this.updateRoomsList(data.rooms);
        });

        this.socket.on('error', (data) => {
            console.error('Socket error:', data);
            this.showNotification(data.message, 'error');
            this.hideLoadingOverlay();
        });
    }

    setupEventListeners() {
        // Theme toggle
        document.getElementById('themeToggle').addEventListener('click', () => {
            this.toggleTheme();
        });

        // Sound toggle button
        const soundToggle = document.getElementById('soundToggle');
        if (soundToggle) {
            soundToggle.addEventListener('click', () => {
                const enabled = this.audioManager.toggle();
                const icon = soundToggle.querySelector('i');
                icon.className = enabled ? 'fas fa-volume-up' : 'fas fa-volume-mute';
                this.showNotification(enabled ? 'Sound enabled' : 'Sound disabled', 'info');

                soundToggle.style.opacity = enabled ? '1' : '0.5';
            });

            const soundEnabled = this.audioManager.enabled;
            const icon = soundToggle.querySelector('i');
            icon.className = soundEnabled ? 'fas fa-volume-up' : 'fas fa-volume-mute';
            soundToggle.style.opacity = soundEnabled ? '1' : '0.5';
        }

        // Menu buttons
        document.getElementById('createRoomBtn').addEventListener('click', () => {
            this.showScreen('createRoomScreen');
        });

        document.getElementById('joinRoomBtn').addEventListener('click', () => {
            this.showScreen('joinRoomScreen');
        });

        document.getElementById('browseRoomsBtn').addEventListener('click', () => {
            this.showScreen('browseRoomsScreen');
            this.refreshRooms();
        });

        // Back buttons
        document.getElementById('backFromCreate').addEventListener('click', () => {
            this.showScreen('menuScreen');
        });

        document.getElementById('backFromJoin').addEventListener('click', () => {
            this.showScreen('menuScreen');
        });

        document.getElementById('backFromBrowse').addEventListener('click', () => {
            this.showScreen('menuScreen');
        });

        // Form submissions
        document.getElementById('createRoomForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.createRoom();
        });

        document.getElementById('joinRoomForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.joinRoom();
        });

        // Grid size slider
        const gridSizeSlider = document.getElementById('gridSizeSlider');
        gridSizeSlider.addEventListener('input', (e) => {
            this.updateGridSizeDisplay(e.target.value);
        });

        // Game controls
        document.getElementById('leaveGameBtn').addEventListener('click', () => {
            this.leaveGame();
        });

        document.getElementById('restartGameBtn').addEventListener('click', () => {
            this.restartGame();
        });

        document.getElementById('cancelWaiting').addEventListener('click', () => {
            this.cancelWaiting();
        });

        // Modal buttons
        document.getElementById('playAgainBtn').addEventListener('click', () => {
            this.restartGame();
        });

        document.getElementById('backToMenuBtn').addEventListener('click', () => {
            this.backToMenu();
        });

        // Refresh rooms
        document.getElementById('refreshRooms').addEventListener('click', () => {
            this.refreshRooms();
        });

        // Initialize grid size display
        this.updateGridSizeDisplay(3);
    }

    // Theme Management
    toggleTheme() {
        this.theme = this.theme === 'light' ? 'dark' : 'light';
        this.applyTheme();
        localStorage.setItem('theme', this.theme);
    }

    applyTheme() {
        document.documentElement.setAttribute('data-theme', this.theme);
        const themeIcon = document.querySelector('#themeToggle i');
        themeIcon.className = this.theme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
    }

    // Screen Management
    showScreen(screenId) {
        // Hide all screens
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });

        // Show target screen
        setTimeout(() => {
            document.getElementById(screenId).classList.add('active');
        }, 100);

        this.currentScreen = screenId;
    }

    // Grid Size Management
    updateGridSizeDisplay(size) {
        document.getElementById('gridSizeValue').textContent = size;
        document.getElementById('gridSizeValue2').textContent = size;
        this.updateGridPreview(parseInt(size));
    }

    updateGridPreview(size) {
        const preview = document.getElementById('gridPreview');
        preview.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
        preview.innerHTML = '';

        for (let i = 0; i < size * size; i++) {
            const cell = document.createElement('div');
            cell.className = 'grid-preview-cell';
            preview.appendChild(cell);
        }
    }

    // Room Management
    createRoom() {
        const playerName = document.getElementById('playerName').value.trim();
        const gridSize = parseInt(document.getElementById('gridSizeSlider').value);

        if (!playerName) {
            this.showNotification('Please enter your name', 'error');
            return;
        }

        console.log('Creating room with:', { playerName, gridSize });
        this.showLoadingOverlay();
        this.socket.emit('create_room', {
            player_name: playerName,
            grid_size: gridSize
        });
    }

    joinRoom() {
        const playerName = document.getElementById('joinPlayerName').value.trim();
        const roomCode = document.getElementById('roomCode').value.trim().toUpperCase();

        if (!playerName || !roomCode) {
            this.showNotification('Please fill in all fields', 'error');
            return;
        }

        this.showLoadingOverlay();
        this.socket.emit('join_room', {
            player_name: playerName,
            room_id: roomCode
        });
    }

    refreshRooms() {
        this.socket.emit('get_rooms');
    }

    updateRoomsList(rooms) {
        const roomsList = document.getElementById('roomsList');

        if (rooms.length === 0) {
            roomsList.innerHTML = `
                <div class="no-rooms">
                    <i class="fas fa-inbox"></i>
                    <p>No rooms available</p>
                </div>
            `;
            return;
        }

        roomsList.innerHTML = rooms.map(room => `
            <div class="room-item" data-room-id="${room.room_id}">
                <div class="room-info">
                    <h4>Room ${room.room_id}</h4>
                    <p>Host: ${room.host_name}</p>
                </div>
                <div class="room-meta">
                    <div>${room.grid_size}×${room.grid_size}</div>
                    <div>${this.formatTime(room.created_at)}</div>
                </div>
            </div>
        `).join('');

        document.querySelectorAll('.room-item').forEach(item => {
            item.addEventListener('click', () => {
                const roomId = item.dataset.roomId;
                const playerName = document.getElementById('browsePlayerName').value.trim();

                if (!playerName) {
                    this.showNotification('Please enter your name first', 'error');
                    return;
                }

                this.showLoadingOverlay();
                this.socket.emit('join_room', {
                    player_name: playerName,
                    room_id: roomId
                });
            });
        });
    }

    formatTime(timestamp) {
        const now = Date.now() / 1000;
        const diff = now - timestamp;

        if (diff < 60) return 'Just now';
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        return `${Math.floor(diff / 3600)}h ago`;
    }

    // Waiting Screen
    showWaitingScreen(roomId, gridSize) {
        document.getElementById('currentRoomCode').textContent = roomId;
        document.getElementById('currentGridSize').textContent = `${gridSize}×${gridSize}`;
        this.showScreen('waitingScreen');
    }

    cancelWaiting() {
        this.socket.emit('leave_room', { room_id: this.playerInfo.roomId });
        this.backToMenu();
    }

    // Game Screen
    showGameScreen() {
        this.initializeGameBoard();
        this.updatePlayerInfo();
        this.updateScoreboard();
        this.updateTurnIndicator(this.gameState.current_turn);
        document.getElementById('gameRoomCode').textContent = this.playerInfo.roomId;
        this.showScreen('gameScreen');
    }

    initializeGameBoard() {
        const gameBoard = document.getElementById('gameBoard');
        const gridSize = this.gameState.grid_size;

        gameBoard.className = `game-board size-${gridSize}`;
        gameBoard.innerHTML = '';

        for (let i = 0; i < gridSize * gridSize; i++) {
            const cell = document.createElement('div');
            cell.className = 'game-cell';
            cell.dataset.position = i;
            cell.addEventListener('click', () => this.makeMove(i));
            gameBoard.appendChild(cell);
        }
    }

    updateScoreboard() {
        if (!this.gameState || !this.gameState.session_scores || this.gameState.match_count === 0) {
            // Hide scoreboard if no matches played yet
            document.getElementById('scoreboard').style.display = 'none';
            return;
        }

        document.getElementById('scoreboard').style.display = 'block';

        const players = Object.entries(this.gameState.players);
        const currentPlayer = players.find(([id, _]) => id === this.playerInfo.id);
        const opponent = players.find(([id, _]) => id !== this.playerInfo.id);

        if (currentPlayer && opponent) {
            const currentScore = this.gameState.session_scores[currentPlayer[0]];
            const opponentScore = this.gameState.session_scores[opponent[0]];

            // Update score display
            document.getElementById('playerScore').innerHTML = `
                <div class="score-section">
                    <div class="score-header">${currentPlayer[1].name} (You)</div>
                    <div class="score-stats">
                        <span class="wins">${currentScore.wins}W</span>
                        <span class="losses">${currentScore.losses}L</span>
                        <span class="draws">${currentScore.draws}D</span>
                    </div>
                </div>
            `;

            document.getElementById('opponentScore').innerHTML = `
                <div class="score-section">
                    <div class="score-header">${opponent[1].name}</div>
                    <div class="score-stats">
                        <span class="wins">${opponentScore.wins}W</span>
                        <span class="losses">${opponentScore.losses}L</span>
                        <span class="draws">${opponentScore.draws}D</span>
                    </div>
                </div>
            `;

            // Update match counter
            document.getElementById('matchCounter').textContent = `Match ${this.gameState.match_count + 1}`;

            // Show session leader if exists
            const sessionLeader = this.gameState.session_leader;
            const leaderDisplay = document.getElementById('sessionLeader');

            if (sessionLeader && currentScore.wins !== opponentScore.wins) {
                leaderDisplay.style.display = 'block';
                const isCurrentPlayer = sessionLeader.player_id === this.playerInfo.id;
                leaderDisplay.innerHTML = `
                    <i class="fas fa-crown"></i>
                    ${isCurrentPlayer ? 'You are' : sessionLeader.player_name + ' is'} leading!
                `;
                leaderDisplay.className = `session-leader ${isCurrentPlayer ? 'leading' : 'opponent-leading'}`;
            } else {
                leaderDisplay.style.display = 'none';
            }
        }
    }

    updatePlayerInfo() {
        const player1Info = document.getElementById('player1Info');
        const player2Info = document.getElementById('player2Info');

        if (!this.gameState || !this.gameState.players) return;

        const players = Object.entries(this.gameState.players);
        const currentPlayer = players.find(([id, _]) => id === this.playerInfo.id);
        const opponent = players.find(([id, _]) => id !== this.playerInfo.id);

        if (currentPlayer && opponent) {
            // Update current player info
            player1Info.querySelector('.player-name').textContent = currentPlayer[1].name + ' (You)';
            player1Info.querySelector('.player-symbol').textContent = currentPlayer[1].symbol;
            player1Info.querySelector('.player-avatar').className = `player-avatar ${this.gameState.current_turn === currentPlayer[1].symbol ? 'active' : ''}`;

            // Update opponent info
            player2Info.querySelector('.player-name').textContent = opponent[1].name;
            player2Info.querySelector('.player-symbol').textContent = opponent[1].symbol;
            player2Info.querySelector('.player-avatar').className = `player-avatar ${this.gameState.current_turn === opponent[1].symbol ? 'active' : ''}`;
        }
    }

    updateTurnIndicator(currentTurn) {
        const turnIndicator = document.getElementById('turnIndicator');
        const player1Avatar = document.querySelector('#player1Info .player-avatar');
        const player2Avatar = document.querySelector('#player2Info .player-avatar');

        // Remove active states from both avatars
        player1Avatar.classList.remove('active');
        player2Avatar.classList.remove('active');

        if (currentTurn === this.playerInfo.symbol) {
            turnIndicator.innerHTML = '<span class="turn-text">Your Turn</span>';
            player1Avatar.classList.add('active');
            document.getElementById('player1Info').querySelector('.player-status').textContent = 'Your Turn';
            document.getElementById('player2Info').querySelector('.player-status').textContent = 'Waiting';
        } else {
            turnIndicator.innerHTML = '<span class="turn-text">Opponent\'s Turn</span>';
            player2Avatar.classList.add('active');
            document.getElementById('player1Info').querySelector('.player-status').textContent = 'Waiting';
            document.getElementById('player2Info').querySelector('.player-status').textContent = 'Playing';
        }
    }

    makeMove(position) {
        if (this.gameState.game_over) return;
        if (this.gameState.current_turn !== this.playerInfo.symbol) return;
        if (this.gameState.board[position] !== '') return;

        this.socket.emit('make_move', {
            room_id: this.playerInfo.roomId,
            position: position
        });
    }

    updateGameBoard(moveData) {
        const cells = document.querySelectorAll('.game-cell');
        const cell = cells[moveData.position];

        cell.textContent = moveData.symbol;
        cell.classList.add('filled', 'new-move');

        setTimeout(() => {
            cell.classList.remove('new-move');
        }, 500);
    }

    handleGameOver(data) {
        if (data.is_draw) {
            // No specific sound for draw currently, maybe play a neutral sound (I'll use later after getting feedback)
        } else if (data.winner === this.playerInfo.symbol) {
            this.audioManager.play('win');
        } else {
            this.audioManager.play('loss');
        }

        // Highlight winning line if exists
        if (data.winning_line) {
            data.winning_line.forEach(position => {
                const cell = document.querySelectorAll('.game-cell')[position];
                cell.classList.add('winning');
            });
        }

        // Update info after game over
        setTimeout(() => {
            this.updateScoreboard();
        }, 500);

        setTimeout(() => {
            this.showGameOverModal(data);
        }, 1000);

        document.getElementById('restartGameBtn').style.display = 'flex';
    }

    showGameOverModal(data) {
        const modal = document.getElementById('gameOverModal');
        const modalContent = modal.querySelector('.modal-content');

        let title, message, icon;

        let opponentName = 'your opponent';
        if (this.gameState && this.gameState.players) {
            const players = Object.entries(this.gameState.players);
            const opponent = players.find(([id, _]) => id !== this.playerInfo.id);
            if (opponent) {
                opponentName = opponent[1].name;
            }
        }

        if (data.is_draw) {
            title = "It's a Draw!";
            message = "Great game! Want to play again?";
            icon = "fas fa-handshake";
        } else if (data.winner === this.playerInfo.symbol) {
            title = "You Won!";
            message = `Congratulations! You beat ${opponentName}!`;
            icon = "fas fa-trophy";
        } else {
            title = "You Lost!";
            message = `${opponentName} won this round. Ready for revenge?`;
            icon = "fas fa-medal";
        }

        // Show session stats if multiple matches played
        let sessionStats = '';
        if (this.gameState && this.gameState.session_scores && this.gameState.match_count > 0) {
            const currentPlayerScore = this.gameState.session_scores[this.playerInfo.id];
            const totalMatches = currentPlayerScore.wins + currentPlayerScore.losses + currentPlayerScore.draws;
            const winRate = totalMatches > 0 ? Math.round((currentPlayerScore.wins / totalMatches) * 100) : 0;

            sessionStats = `
                <div class="session-stats">
                    <h4>Session Stats</h4>
                    <div class="stats-grid">
                        <div class="stat-item">
                            <span class="stat-value">${currentPlayerScore.wins}</span>
                            <span class="stat-label">Wins</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-value">${currentPlayerScore.losses}</span>
                            <span class="stat-label">Losses</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-value">${currentPlayerScore.draws}</span>
                            <span class="stat-label">Draws</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-value">${winRate}%</span>
                            <span class="stat-label">Win Rate</span>
                        </div>
                    </div>
                </div>
            `;
        }

        modalContent.innerHTML = `
            <div class="game-over-content">
                <i class="${icon} game-over-icon"></i>
                <h2>${title}</h2>
                <p>${message}</p>
                ${sessionStats}
                <div class="modal-buttons">
                    <button id="playAgainBtn" class="btn primary">
                        <i class="fas fa-redo"></i> Play Again
                    </button>
                    <button id="backToMenuBtn" class="btn secondary">
                        <i class="fas fa-home"></i> Main Menu
                    </button>
                </div>
            </div>
        `;

        document.getElementById('playAgainBtn').addEventListener('click', () => {
            this.restartGame();
        });

        document.getElementById('backToMenuBtn').addEventListener('click', () => {
            this.backToMenu();
        });

        modal.classList.add('active');
    }

    hideGameOverModal() {
        document.getElementById('gameOverModal').classList.remove('active');
        document.getElementById('restartGameBtn').style.display = 'none';
    }

    resetGameBoard() {
        const cells = document.querySelectorAll('.game-cell');
        cells.forEach(cell => {
            cell.textContent = '';
            cell.classList.remove('filled', 'winning');
        });
    }

    restartGame() {
        this.socket.emit('restart_game', {
            room_id: this.playerInfo.roomId
        });
    }

    leaveGame() {
        if (this.playerInfo.roomId) {
            this.socket.emit('leave_room', {
                room_id: this.playerInfo.roomId
            });
        }
        this.backToMenu();
    }

    backToMenu() {
        if (this.playerInfo.roomId) {
            this.socket.emit('leave_room', {
                room_id: this.playerInfo.roomId
            });
        }

        this.gameState = null;
        this.playerInfo = {
            id: this.playerInfo.id,
            name: '',
            symbol: '',
            roomId: ''
        };
        this.hideGameOverModal();
        this.showScreen('menuScreen');
    }

    // Utility functions

    showSymbolSwapNotification(oldSymbol, newSymbol, matchCount) {
        const container = document.getElementById('notifications');
        const notification = document.createElement('div');
        notification.className = 'notification symbol-swap';

        notification.innerHTML = `
            <div class="symbol-swap-content">
                <i class="fas fa-exchange-alt"></i>
                <div class="swap-text">
                    <strong>Symbols Swapped!</strong><br>
                    You are now <span class="symbol-highlight ${newSymbol.toLowerCase()}">${newSymbol}</span>
                    <small>(Match ${matchCount + 1})</small>
                </div>
            </div>
        `;

        container.appendChild(notification);

        this.audioManager.play('notification');

        // Auto remove after 5 seconds (longer for important info)
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-in forwards';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 5000);
    }

    showNotification(message, type = 'info', playSound = true) {
        // Play notification sound only if requested and audio is initialized
        if (playSound && this.audioManager.audioInitialized) {
            this.audioManager.play('notification');
        }

        const container = document.getElementById('notifications');
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;

        container.appendChild(notification);

        // Auto remove after 4 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-in forwards';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 4000);
    }

    showLoadingOverlay() {
        document.getElementById('loadingOverlay').classList.add('active');
    }

    hideLoadingOverlay() {
        document.getElementById('loadingOverlay').classList.remove('active');
    }
}

// Slide out animation
const slideOutKeyframes = `
@keyframes slideOut {
    to {
        transform: translateY(-20px);
        opacity: 0;
    }
}
`;

const style = document.createElement('style');
style.textContent = slideOutKeyframes;
document.head.appendChild(style);

document.addEventListener('DOMContentLoaded', () => {
    new TicTacToeGame();
});