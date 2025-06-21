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
        this.debug = false;
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
        this.chatOpen = false;
        this.unreadMessages = 0;
        this.opponentInfo = null;
        this.recentEmojis = JSON.parse(localStorage.getItem('recentEmojis') || '[]');

        this.chatSettings = JSON.parse(localStorage.getItem('chatSettings') || JSON.stringify({
            soundEnabled: true,
            enterToSend: true
        }));
        this.replyingTo = null;

        this.showLoadingOverlay();
        this.initializeSocket();
        this.setupEventListeners();
        this.applyTheme();
        this.showAudioPrompt();
        this.initializeEmojis();

        console.log('TicTacToeGame initialized');

        setTimeout(() => {
            this.checkElements();
        }, 1000);
    }

    
    debugLog(message, data = null) {
        if (this.debug) {
            console.log(`[DEBUG] ${message}`, data || '');
        }
    }

    logPlayerInfo() {
        console.log('=== PLAYER INFO DEBUG ===');
        console.log('Socket ID:', this.socket?.id);
        console.log('Player Info:', this.playerInfo);
        console.log('Game State Players:', this.gameState?.players);

        if (this.gameState?.players) {
            const players = Object.values(this.gameState.players);
            console.log('🔍 All players details:');
            players.forEach((player, index) => {
                const isCurrentPlayer = player.id === this.socket.id;
                console.log(`Player ${index + 1}:`, {
                    id: player.id,
                    name: player.name,
                    symbol: player.symbol,
                    isCurrentPlayer: isCurrentPlayer,
                    socketIdMatch: player.id === this.socket.id
                });
            });

            const expectedOpponent = players.find(p => p.id !== this.socket.id);
            console.log('🎯 Expected opponent should be:', expectedOpponent);
        }
        console.log('========================');
    }


    checkElements() {
        const requiredElements = [
            'chatFloatBtn', 'chatCloseBtn', 'chatSendBtn',
            'emojiBtn', 'emojiToggle', 'chatSettings',
            'attachBtn', 'chatInput', 'emojiPicker'
        ];

        const missingElements = [];

        requiredElements.forEach(id => {
            if (!document.getElementById(id)) {
                missingElements.push(id);
            }
        });

        if (missingElements.length > 0) {
            console.error('Missing required elements:', missingElements);
            this.showNotification('Some chat features may not work properly', 'warning');
        } else {
            console.log('All required elements found');
        }

        return missingElements.length === 0;
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
            console.log('🔌 Connected to server');
            console.log('🆔 My Socket ID:', this.socket.id);
            this.hideLoadingOverlay();
            this.showScreen('menuScreen');
            this.showNotification('Connected to server!', 'success', false);
            this.playerInfo.id = this.socket.id; // Store socket ID
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
                id: this.socket.id,
                name: data.player_name,
                symbol: data.symbol,
                roomId: data.room_id
            };
            this.gameState = data.game_state;
            this.showWaitingScreen(data.room_id, data.game_state.grid_size);
            this.showNotification(`Room ${data.room_id} created!`, 'success');
        });

        this.socket.on('room_joined', (data) => {
            console.log('🏠 Room joined:', data);
            console.log('🆔 My Socket ID at join:', this.socket.id);

            this.hideLoadingOverlay();
            this.playerInfo = {
                id: this.socket.id,
                name: data.player_name,
                symbol: data.symbol,
                roomId: data.room_id
            };
            this.gameState = data.game_state;

            console.log('🎮 Updated player info:', this.playerInfo);
            console.log('🎮 Game state:', this.gameState);

            this.showNotification(`Joined room ${data.room_id}!`, 'success');

            setTimeout(() => {
                console.log('🔄 Updating opponent info after room join...');
                this.updateOpponentInfo();
            }, 500);
        });

        this.socket.on('player_joined', (data) => {
            console.log('👥 Player joined:', data);
            this.showNotification(`${data.player_name} joined the game!`, 'info');

            if (data.game_state) {
                this.gameState = data.game_state;
                console.log('🔄 Updated game state from player_joined:', this.gameState);
            }

            setTimeout(() => {
                console.log('🔄 Updating opponent info after player joined...');
                this.updateOpponentInfo();
            }, 300);
        });

        this.socket.on('game_start', (gameState) => {
            console.log('🎮 Game started with state:', gameState);

            this.gameState = gameState;
            this.showGameScreen();
            this.showNotification('Game started!', 'success');

            setTimeout(() => {
                console.log('🔄 Updating opponent info after game start...');
                this.updateOpponentInfo();
            }, 500);
        });

        this.socket.on('move_made', (data) => {
            if (data.game_state) {
                this.gameState = data.game_state;
            }

            if (data.symbol === 'X') {
                this.audioManager.play('click_x');
            } else {
                this.audioManager.play('click_o');
            }

            this.updateGameBoard(data);
            this.updateTurnIndicator(data.current_turn);
            this.showNotification(`${data.player_name} played ${data.symbol}`, 'info', false);
        });

        // Chat listeners
        this.socket.on('chat_message', (data) => {
            console.log('Received chat message:', data);
            this.addChatMessage(data);

            if (!this.chatOpen) {
                this.unreadMessages++;
                this.updateChatBadge();
                this.showChatNotification(data);
                if (this.chatSettings.soundEnabled) {
                    this.audioManager.play('notification');
                }
            }
        });

        this.socket.on('player_typing', (data) => {
            console.log('Player typing:', data);
            this.showTypingIndicator(data.player_name);
        });

        this.socket.on('player_stopped_typing', () => {
            console.log('Player stopped typing');
            this.hideTypingIndicator();
        });

        this.socket.on('message_reaction', (data) => {
            this.addMessageReaction(data);
        });

        this.socket.on('player_status_update', (data) => {
            this.updateOpponentStatus(data);
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

        // Chat event listeners
        document.getElementById('chatFloatBtn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleChat();
        });

        document.getElementById('chatCloseBtn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.closeChat();
        });

        document.getElementById('chatSendBtn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.sendChatMessage();
        });

        document.querySelectorAll('.quick-action').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.sendQuickAction(btn.dataset.action);
                this.hideQuickActions();
            });
        });

        const emojiBtn = document.getElementById('emojiBtn');
        const emojiToggle = document.getElementById('emojiToggle');

        if (emojiBtn) {
            emojiBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                console.log('Emoji button clicked');
                this.toggleEmojiPicker();
            });
        }

        if (emojiToggle) {
            emojiToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                console.log('Emoji toggle clicked');
                this.toggleEmojiPicker();
            });
        }

        // Settings button functionality
        const chatSettings = document.getElementById('chatSettings');
        if (chatSettings) {
            chatSettings.addEventListener('click', (e) => {
                e.stopPropagation();
                console.log('Settings clicked');
                this.toggleChatSettings();
            });
        }

        // chat input handling
        const chatInput = document.getElementById('chatInput');
        if (chatInput) {
            chatInput.addEventListener('input', (e) => {
                this.handleInputChange(e);
                this.updateCharCount();
            });

            chatInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey && this.chatSettings.enterToSend) {
                    e.preventDefault();
                    this.sendChatMessage();
                }
            });

            chatInput.addEventListener('input', () => {
                this.autoResizeTextarea(chatInput);
            });
        }

        // Quick actions
        const attachBtn = document.getElementById('attachBtn');
        if (attachBtn) {
            attachBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleQuickActions();
            });
        }

        // Reply cancel
        const cancelReply = document.getElementById('cancelReply');
        if (cancelReply) {
            cancelReply.addEventListener('click', () => {
                this.cancelReply();
            });
        }

        // Global click handler
        document.addEventListener('click', (e) => {
            try {
                // Close emoji picker
                if (!e.target.closest('.emoji-picker') &&
                    !e.target.closest('#emojiBtn') &&
                    !e.target.closest('#emojiToggle')) {
                    this.hideEmojiPicker();
                }

                // Close quick actions
                if (!e.target.closest('.quick-actions-menu') &&
                    !e.target.closest('#attachBtn')) {
                    this.hideQuickActions();
                }

                // Close context menu
                if (!e.target.closest('.message-context-menu')) {
                    this.hideContextMenu();
                }

                // Close settings menu
                if (!e.target.closest('.chat-settings-menu') &&
                    !e.target.closest('#chatSettings')) {
                    this.hideChatSettings();
                }
            } catch (error) {
                console.log('Error in global click handler:', error);
            }
        });

        // Typing indicators
        let typingTimer;
        if (chatInput) {
            chatInput.addEventListener('input', () => {
                if (this.playerInfo.roomId && chatInput.value.trim()) {
                    this.socket.emit('typing', { room_id: this.playerInfo.roomId });

                    clearTimeout(typingTimer);
                    typingTimer = setTimeout(() => {
                        this.socket.emit('stop_typing', { room_id: this.playerInfo.roomId });
                    }, 1500);
                }
            });
        }

        this.updateGridSizeDisplay(3);
    }


    toggleChatSettings() {
        console.log('Toggling chat settings');

        // Hide other menus first
        this.hideEmojiPicker();
        this.hideQuickActions();
        this.hideContextMenu();

        let settingsMenu = document.getElementById('chatSettingsMenu');

        if (!settingsMenu) {
            this.createChatSettingsMenu();
            settingsMenu = document.getElementById('chatSettingsMenu');
        }

        const isActive = settingsMenu.classList.contains('active');

        if (isActive) {
            this.hideChatSettings();
        } else {
            this.showChatSettings();
        }
    }

    // Create Chat Settings Menu
    createChatSettingsMenu() {
        console.log('Creating chat settings menu');
        const chatHeader = document.querySelector('.chat-header');

        const settingsMenu = document.createElement('div');
        settingsMenu.id = 'chatSettingsMenu';
        settingsMenu.className = 'chat-settings-menu';
        settingsMenu.innerHTML = `
            <div class="settings-item">
                <span>Enter to Send</span>
                <label class="toggle-switch">
                    <input type="checkbox" id="enterToSendToggle" ${this.chatSettings.enterToSend ? 'checked' : ''}>
                    <span class="toggle-slider"></span>
                </label>
            </div>
            <div class="settings-item">
                <span>Sound Notifications</span>
                <label class="toggle-switch">
                    <input type="checkbox" id="soundNotificationsToggle" ${this.chatSettings.soundEnabled ? 'checked' : ''}>
                    <span class="toggle-slider"></span>
                </label>
            </div>
            <div class="settings-item">
                <span>Clear Chat History</span>
                <button class="clear-chat-btn">
                    <i class="fas fa-trash"></i>
                    Clear
                </button>
            </div>
        `;

        chatHeader.appendChild(settingsMenu);

        // Event listeners for settings
        setTimeout(() => {
            document.getElementById('enterToSendToggle').addEventListener('change', (e) => {
                this.chatSettings.enterToSend = e.target.checked;
                localStorage.setItem('chatSettings', JSON.stringify(this.chatSettings));
                this.showNotification(e.target.checked ? 'Enter to send enabled' : 'Enter to send disabled', 'info');
            });

            document.getElementById('soundNotificationsToggle').addEventListener('change', (e) => {
                this.chatSettings.soundEnabled = e.target.checked;
                localStorage.setItem('chatSettings', JSON.stringify(this.chatSettings));
                this.showNotification(e.target.checked ? 'Sound notifications enabled' : 'Sound notifications disabled', 'info');
            });

            settingsMenu.querySelector('.clear-chat-btn').addEventListener('click', () => {
                this.clearChatHistory();
                this.hideChatSettings();
                this.showNotification('Chat history cleared', 'success');
            });
        }, 100);
    }

    // Chat Settings Menu
    showChatSettings() {
        console.log('Showing chat settings');
        const settingsMenu = document.getElementById('chatSettingsMenu');
        if (settingsMenu) {
            settingsMenu.classList.add('active');
        }
    }

    hideChatSettings() {
        const settingsMenu = document.getElementById('chatSettingsMenu');
        if (settingsMenu) {
            settingsMenu.classList.remove('active');
        }
    }

    hideContextMenu() {
        const contextMenu = document.getElementById('messageContextMenu');
        if (contextMenu) {
            contextMenu.classList.remove('active');
        }
    }

    hideContextMenus() {
        this.hideContextMenu();
        this.hideEmojiPicker();
        this.hideQuickActions();
        this.hideChatSettings();
    }

    clearChatHistory() {
        const chatMessages = document.getElementById('chatMessages');
        chatMessages.innerHTML = `
            <div class="chat-welcome">
                <div class="welcome-icon">
                    <i class="fas fa-comments"></i>
                </div>
                <h4>Start Chatting!</h4>
                <p>Send a message to begin the conversation</p>
            </div>
        `;
    }


    // Chat Methods
    toggleChat() {
        const chatPanel = document.getElementById('chatPanel');
        const chatBtn = document.getElementById('chatFloatBtn');

        this.chatOpen = !this.chatOpen;

        if (this.chatOpen) {
            chatPanel.classList.add('active');
            chatBtn.style.transform = 'scale(0.9)';
            this.unreadMessages = 0;
            this.updateChatBadge();
            this.updateOpponentInfo();

            // Focus on input with slight delay
            setTimeout(() => {
                document.getElementById('chatInput').focus();
            }, 300);
        } else {
            chatPanel.classList.remove('active');
            chatBtn.style.transform = 'scale(1)';
            this.hideContextMenus();
        }
    }

    closeChat() {
        this.chatOpen = false;
        document.getElementById('chatPanel').classList.remove('active');
        document.getElementById('chatFloatBtn').style.transform = 'scale(1)';
        this.hideContextMenus();
    }

    sendChatMessage() {
        const input = document.getElementById('chatInput');
        const message = input.value.trim();

        if (!message || !this.playerInfo.roomId) return;

        const messageData = {
            room_id: this.playerInfo.roomId,
            message: message,
            type: 'text'
        };

        // Add reply data if replying
        if (this.replyingTo) {
            messageData.reply_to = this.replyingTo;
        }

        this.socket.emit('chat_message', messageData);

        input.value = '';
        this.updateCharCount();
        this.autoResizeTextarea(input);
        this.cancelReply();

        this.socket.emit('stop_typing', { room_id: this.playerInfo.roomId });
    }

    addChatMessage(data) {
        console.log('Adding chat message with data:', data);

        const chatMessages = document.getElementById('chatMessages');
        const messageElement = document.createElement('div');

        // Remove welcome message if it exists
        const welcomeMsg = chatMessages.querySelector('.chat-welcome');
        if (welcomeMsg) {
            welcomeMsg.remove();
        }

        const isOwnMessage = data.player_id === this.playerInfo.id;
        const isSystemMessage = data.type === 'system';

        console.log('Message info:', {
            isOwnMessage,
            currentPlayerId: this.playerInfo.id,
            messagePlayerId: data.player_id,
            playerName: data.player_name
        });

        messageElement.className = `chat-message ${isOwnMessage ? 'own' : 'other'}${isSystemMessage ? ' system' : ''}`;
        messageElement.setAttribute('data-message-id', data.message_id || Date.now());

        if (isSystemMessage) {
            messageElement.innerHTML = `
                <div class="message-bubble">
                    <p class="message-content">${data.message}</p>
                </div>
            `;
        } else {
            const timestamp = new Date(data.timestamp * 1000).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
            });

            let replyHtml = '';
            if (data.reply_to) {
                replyHtml = `
                    <div class="message-reply">
                        <div class="reply-author">${data.reply_to.author}</div>
                        <div class="reply-text">${data.reply_to.message.substring(0, 50)}${data.reply_to.message.length > 50 ? '...' : ''}</div>
                    </div>
                `;
            }

            // Show sender name only for other player's messages
            let senderNameHtml = '';
            if (!isOwnMessage) {
                senderNameHtml = `<div class="message-sender">${data.player_name}</div>`;
            }

            messageElement.innerHTML = `
                <div class="message-bubble">
                    ${senderNameHtml}
                    ${replyHtml}
                    <p class="message-content">${this.parseMessageContent(data.message)}</p>
                </div>
                <div class="message-info">
                    <span class="message-time">${timestamp}</span>
                    ${isOwnMessage ? `
                        <div class="message-status">
                            <i class="fas fa-check" title="Sent"></i>
                        </div>
                    ` : ''}
                </div>
                <div class="message-reactions" data-message-id="${data.message_id || Date.now()}"></div>
                
                <!-- Message Actions -->
                <div class="message-actions">
                    <button class="message-action-btn reply-btn" title="Reply">
                        <i class="fas fa-reply"></i>
                    </button>
                    <button class="message-action-btn more-btn" title="More">
                        <i class="fas fa-ellipsis-v"></i>
                    </button>
                </div>
            `;

            this.setupMessageHandlers(messageElement, data, isSystemMessage);
        }

        chatMessages.appendChild(messageElement);
        this.scrollToBottom();

        // Play sound for other player's messages
        if (!isOwnMessage && !isSystemMessage && this.chatSettings.soundEnabled) {
            this.audioManager.play('notification');
        }
    }



    setupMessageHandlers(messageElement, data, isSystemMessage) {
        if (isSystemMessage) return;

        // Hover functionality for message actions
        messageElement.addEventListener('mouseenter', () => {
            const actions = messageElement.querySelector('.message-actions');
            if (actions) actions.classList.add('visible');
        });

        messageElement.addEventListener('mouseleave', () => {
            const actions = messageElement.querySelector('.message-actions');
            if (actions) actions.classList.remove('visible');
        });

        // Reply button functionality
        const replyBtn = messageElement.querySelector('.reply-btn');
        if (replyBtn) {
            replyBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.startReply(data);
            });
        }

        // More button (three dots) functionality
        const moreBtn = messageElement.querySelector('.more-btn');
        if (moreBtn) {
            moreBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showMessageContextMenu(e, messageElement, data);
            });
        }

        // Context menu on right-click
        messageElement.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.showMessageContextMenu(e, messageElement, data);
        });

        // Mobile long press
        let touchTimer;
        messageElement.addEventListener('touchstart', (e) => {
            touchTimer = setTimeout(() => {
                this.showMessageContextMenu(e, messageElement, data);
            }, 500);
        });

        messageElement.addEventListener('touchend', () => {
            clearTimeout(touchTimer);
        });

        // Swipe to reply (mobile)
        this.addSwipeToReply(messageElement, data);
    }

    // Swipe to reply functionality
    addSwipeToReply(messageElement, messageData) {
        let startX, startY, currentX, currentY;
        let isSwiping = false;
        let swipeThreshold = 50; // minimum swipe distance

        messageElement.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            isSwiping = false;
        });

        messageElement.addEventListener('touchmove', (e) => {
            if (!startX || !startY) return;

            currentX = e.touches[0].clientX;
            currentY = e.touches[0].clientY;

            const diffX = startX - currentX;
            const diffY = startY - currentY;

            // Only consider horizontal swipes
            if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 10) {
                isSwiping = true;
                e.preventDefault();

                // Add visual feedback for swipe
                if (diffX > 0 && diffX < 100) { // Swipe left
                    messageElement.style.transform = `translateX(-${Math.min(diffX, 80)}px)`;
                    messageElement.style.opacity = 1 - (diffX / 200);
                }
            }
        });

        messageElement.addEventListener('touchend', (e) => {
            if (isSwiping) {
                const diffX = startX - currentX;

                if (diffX > swipeThreshold) {
                    // Swipe left to reply
                    this.startReply(messageData);
                    this.showSwipeReplyFeedback();
                }

                // Reset position
                messageElement.style.transform = '';
                messageElement.style.opacity = '';
            }

            startX = null;
            startY = null;
            isSwiping = false;
        });
    }

    showSwipeReplyFeedback() {
        const chatMessages = document.getElementById('chatMessages');
        const feedback = document.createElement('div');
        feedback.className = 'swipe-feedback';
        feedback.innerHTML = '<i class="fas fa-reply"></i> Reply';

        chatMessages.appendChild(feedback);

        setTimeout(() => {
            feedback.remove();
        }, 1000);
    }

    parseMessageContent(message) {
        // Convert emojis and format text
        let parsed = this.escapeHtml(message);

        // Convert :emoji: format to actual emojis
        parsed = parsed.replace(/:([a-zA-Z0-9_]+):/g, (match, name) => {
            const emoji = this.getEmojiByName(name);
            return emoji || match;
        });

        // Convert URLs to links
        parsed = parsed.replace(
            /(https?:\/\/[^\s]+)/g,
            '<a href="$1" target="_blank" rel="noopener">$1</a>'
        );

        return parsed;
    }

    showTypingIndicator(playerName) {
        const chatMessages = document.getElementById('chatMessages');

        // Remove existing typing indicator first
        this.hideTypingIndicator();

        const typingElement = document.createElement('div');
        typingElement.className = 'chat-typing-indicator';
        typingElement.id = 'typingIndicator';
        typingElement.innerHTML = `
            <div class="typing-content">
                <span class="typing-text">${playerName} is typing</span>
                <div class="typing-dots">
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                </div>
            </div>
        `;

        chatMessages.appendChild(typingElement);
        this.scrollToBottom();
    }

    hideTypingIndicator() {
        const typingIndicator = document.getElementById('typingIndicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }

    updateChatBadge() {
        const badge = document.getElementById('chatBadge');

        if (this.unreadMessages > 0) {
            badge.textContent = this.unreadMessages > 99 ? '99+' : this.unreadMessages;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    }

    showChatNotification(data) {
        if (data.type === 'system') return;

        const notification = document.createElement('div');
        notification.className = 'chat-notification';
        notification.innerHTML = `
            <div class="notification-avatar">
                <i class="fas fa-user"></i>
            </div>
            <div class="notification-content">
                <div class="notification-sender">${data.player_name}</div>
                <div class="notification-message">${data.message.substring(0, 50)}${data.message.length > 50 ? '...' : ''}</div>
            </div>
        `;

        document.body.appendChild(notification);

        // Animate in
        setTimeout(() => notification.classList.add('show'), 100);

        // Remove after 4 seconds
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => document.body.removeChild(notification), 300);
        }, 4000);
    }

    // Emoji System
    initializeEmojis() {
        console.log('Initializing emojis');
        this.emojiCategories = {
            recent: this.recentEmojis,
            smileys: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔'],
            gestures: ['👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '👇', '☝️', '👍', '👎', '👊', '✊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏'],
            activities: ['🎮', '🕹️', '🎯', '🎲', '🃏', '🎭', '🎨', '🏆', '🏅', '🥇', '🥈', '🥉', '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🏓', '🏸', '🏒'],
            objects: ['📱', '💻', '⌨️', '🖥️', '🖨️', '🖱️', '📷', '📸', '📻', '🎙️', '⏰', '🕰️', '⏳', '⌛', '💡', '🔦', '🕯️', '📡', '🔋', '🔌']
        };

        this.populateEmojiGrid('recent');
    }

    toggleEmojiPicker() {
        console.log('Toggling emoji picker');
        const emojiPicker = document.getElementById('emojiPicker');
        const isActive = emojiPicker.classList.contains('active');

        // Hide other menus
        this.hideQuickActions();
        this.hideContextMenu();
        this.hideChatSettings();

        if (isActive) {
            this.hideEmojiPicker();
        } else {
            this.showEmojiPicker();
        }
    }

    showEmojiPicker() {
        console.log('Showing emoji picker');
        const emojiPicker = document.getElementById('emojiPicker');

        // Hide other menus first
        this.hideQuickActions();
        this.hideContextMenu();
        this.hideChatSettings();

        emojiPicker.classList.add('active');

        // Ensure emojis are populated
        if (!this.emojiCategories) {
            this.initializeEmojis();
        }

        this.populateEmojiGrid('recent');
        this.setupEmojiListeners();

        // Ensure emoji picker stays within chat panel bounds
        setTimeout(() => {
            const chatPanel = document.getElementById('chatPanel');
            const emojiRect = emojiPicker.getBoundingClientRect();
            const panelRect = chatPanel.getBoundingClientRect();

            // Adjust position if overflowing
            if (emojiRect.top < panelRect.top) {
                emojiPicker.style.bottom = '70px';
                emojiPicker.style.top = 'auto';
            }
        }, 50);
    }

    hideEmojiPicker() {
        const emojiPicker = document.getElementById('emojiPicker');
        if (emojiPicker) {
            emojiPicker.classList.remove('active');
        }
    }

    setupEmojiListeners() {
        // Remove old listeners
        document.querySelectorAll('.emoji-category').forEach(btn => {
            btn.replaceWith(btn.cloneNode(true));
        });

        // New listeners
        document.querySelectorAll('.emoji-category').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.populateEmojiGrid(btn.dataset.category);
            });
        });
    }

    populateEmojiGrid(category) {
        console.log('Populating emoji grid for category:', category);
        const emojiGrid = document.getElementById('emojiGrid');
        const emojis = this.emojiCategories[category] || [];

        // Update active category
        document.querySelectorAll('.emoji-category').forEach(btn => btn.classList.remove('active'));
        const activeBtn = document.querySelector(`[data-category="${category}"]`);
        if (activeBtn) {
            activeBtn.classList.add('active');
        }

        emojiGrid.innerHTML = '';

        if (emojis.length === 0 && category === 'recent') {
            emojiGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-secondary); font-size: 0.9rem; padding: 20px;">No recent emojis</div>';
            return;
        }

        emojis.forEach(emoji => {
            const emojiBtn = document.createElement('button');
            emojiBtn.className = 'emoji-item';
            emojiBtn.textContent = emoji;
            emojiBtn.title = emoji;
            emojiBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.insertEmoji(emoji);
            });
            emojiGrid.appendChild(emojiBtn);
        });

        this.setupEmojiListeners();
    }

    insertEmoji(emoji) {
        console.log('Inserting emoji:', emoji);
        const input = document.getElementById('chatInput');
        if (!input) return;

        const start = input.selectionStart;
        const end = input.selectionEnd;
        const text = input.value;

        input.value = text.substring(0, start) + emoji + text.substring(end);
        input.selectionStart = input.selectionEnd = start + emoji.length;
        input.focus();

        // Add to recent emojis
        this.addToRecentEmojis(emoji);
        this.updateCharCount();
        this.autoResizeTextarea(input);
        this.hideEmojiPicker();
    }

    addToRecentEmojis(emoji) {
        this.recentEmojis = this.recentEmojis.filter(e => e !== emoji);
        this.recentEmojis.unshift(emoji);
        this.recentEmojis = this.recentEmojis.slice(0, 32);
        localStorage.setItem('recentEmojis', JSON.stringify(this.recentEmojis));
        this.emojiCategories.recent = this.recentEmojis;
    }

    // Quick Actions
    toggleQuickActions() {
        const quickActionsMenu = document.getElementById('quickActionsMenu');
        const isActive = quickActionsMenu.classList.contains('active');

        this.hideEmojiPicker();
        this.hideContextMenu();

        if (isActive) {
            this.hideQuickActions();
        } else {
            this.showQuickActions();
        }
    }

    showQuickActions() {
        const quickActionsMenu = document.getElementById('quickActionsMenu');
        quickActionsMenu.classList.add('active');
    }

    hideQuickActions() {
        document.getElementById('quickActionsMenu').classList.remove('active');
    }

    sendQuickAction(action) {
        const messages = {
            gg: 'Good game! 🎮',
            gl: 'Good luck! ⭐',
            nice: 'Nice move! 👍',
            thinking: 'Let me think... 🤔'
        };

        const message = messages[action];
        if (message && this.playerInfo.roomId) {
            this.socket.emit('chat_message', {
                room_id: this.playerInfo.roomId,
                message: message,
                type: 'quick_action'
            });
        }
    }

    // Message Context Menu
    showMessageContextMenu(event, messageElement, messageData) {
        const contextMenu = document.getElementById('messageContextMenu');

        // Position the menu
        const rect = document.getElementById('chatPanel').getBoundingClientRect();
        const x = Math.min(event.clientX - rect.left, rect.width - 150);
        const y = Math.min(event.clientY - rect.top, rect.height - 120);

        contextMenu.style.left = x + 'px';
        contextMenu.style.top = y + 'px';
        contextMenu.classList.add('active');

        // Remove old listeners
        const oldItems = contextMenu.querySelectorAll('.context-menu-item');
        oldItems.forEach(item => item.replaceWith(item.cloneNode(true)));

        // New event listeners
        document.querySelectorAll('.context-menu-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                this.handleContextMenuAction(item.dataset.action, messageElement, messageData);
                this.hideContextMenu();
            });
        });
    }

    handleContextMenuAction(action, messageElement, messageData) {
        switch (action) {
            case 'copy':
                navigator.clipboard.writeText(messageData.message).then(() => {
                    this.showNotification('Message copied to clipboard', 'success');
                });
                break;
            case 'reply':
                this.startReply(messageData);
                break;
            case 'react':
                // NOTE By Bismaya: For now, let's just show a notification. I am gonna add later
                this.showNotification('Reactions coming soon!', 'info');
                break;
        }
    }

    startReply(messageData) {
        this.replyingTo = {
            id: messageData.message_id || Date.now(),
            author: messageData.player_name,
            message: messageData.message
        };

        const replyPreview = document.getElementById('replyPreview');
        document.getElementById('replyToName').textContent = messageData.player_name;
        document.getElementById('replyMessage').textContent = messageData.message.substring(0, 50) + (messageData.message.length > 50 ? '...' : '');

        replyPreview.style.display = 'flex';
        document.getElementById('chatInput').focus();
    }

    cancelReply() {
        this.replyingTo = null;
        document.getElementById('replyPreview').style.display = 'none';
    }

    // Utility Functions
    autoResizeTextarea(textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 80) + 'px';
    }

    updateCharCount() {
        const input = document.getElementById('chatInput');
        const counter = document.getElementById('charCount');
        const count = input.value.length;
        counter.textContent = `${count}/500`;

        if (count > 450) {
            counter.style.color = 'var(--error-color)';
        } else {
            counter.style.color = 'var(--text-secondary)';
        }
    }

    handleInputChange(event) {
        const sendBtn = document.getElementById('chatSendBtn');
        sendBtn.disabled = !event.target.value.trim();
    }

    scrollToBottom() {
        const chatMessages = document.getElementById('chatMessages');
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    findOpponent() {
        if (!this.gameState || !this.gameState.players) {
            console.log('❌ No game state or players available');
            return null;
        }

        // Using Object.entries to get both player ID (key) and player data (value)
        const playersEntries = Object.entries(this.gameState.players);
        console.log('🔍 Looking for opponent among players:', playersEntries);
        console.log('🔍 Current player identifiers:', {
            socketId: this.socket.id,
            playerInfoId: this.playerInfo.id,
            playerName: this.playerInfo.name
        });

        const currentSocketId = this.socket.id;

        // Find opponent by checking the key (player ID) from entries
        const opponentEntry = playersEntries.find(([playerId, playerData]) => {
            console.log(`🔍 Checking player: Key=${playerId}, Name=${playerData.name}, Symbol=${playerData.symbol}`);
            console.log(`🔍 Is this current player? ${playerId === currentSocketId}`);
            return playerId !== currentSocketId; // Use the key (player ID) for comparison
        });

        if (opponentEntry && playersEntries.length === 2) {
            const [opponentId, opponentData] = opponentEntry;
            // Ensure the opponent data has the ID property
            const opponent = {
                ...opponentData,
                id: opponentId // ... bla bla bla
            };
            console.log('✅ Found opponent:', opponent);
            return opponent;
        }

        console.log('❌ No opponent found or waiting for second player');
        return null;
    }


    updateOpponentInfo() {
        // this.logPlayerInfo(); // Uncomment if you want to log player info

        const opponent = this.findOpponent();

        if (opponent) {
            const opponentNameEl = document.getElementById('opponentName');
            const lastSeenEl = document.getElementById('lastSeen');
            const onlineIndicatorEl = document.getElementById('onlineIndicator');
            const avatarEl = document.getElementById('opponentAvatar');

            if (opponentNameEl) {
                opponentNameEl.textContent = opponent.name || 'Opponent';
                console.log('✅ Updated chat header to show opponent:', opponent.name);
            }

            if (lastSeenEl) {
                lastSeenEl.textContent = 'Online';
                lastSeenEl.style.color = '#34c759';
            }

            if (onlineIndicatorEl) {
                onlineIndicatorEl.classList.add('visible');
            }

            if (avatarEl && opponent.name) {
                avatarEl.textContent = opponent.name.charAt(0).toUpperCase();
                avatarEl.style.color = 'white';
                avatarEl.style.fontSize = '1.1rem';
                avatarEl.style.fontWeight = '600';
            } else if (avatarEl) {
                avatarEl.innerHTML = '<i class="fas fa-user"></i>';
                avatarEl.style.color = 'white';
            }

            console.log('✅ Successfully updated opponent info in chat header');
            console.log(`✅ Chat header should now show: "${opponent.name}"`);
        } else {
            console.log('❌ No opponent found, showing default state');

            const opponentNameEl = document.getElementById('opponentName');
            const lastSeenEl = document.getElementById('lastSeen');
            const onlineIndicatorEl = document.getElementById('onlineIndicator');
            const avatarEl = document.getElementById('opponentAvatar');

            if (opponentNameEl) opponentNameEl.textContent = 'Waiting for opponent...';
            if (lastSeenEl) {
                lastSeenEl.textContent = 'Offline';
                lastSeenEl.style.color = 'var(--text-secondary)';
            }
            if (onlineIndicatorEl) onlineIndicatorEl.classList.remove('visible');
            if (avatarEl) {
                avatarEl.innerHTML = '<i class="fas fa-user"></i>';
                avatarEl.style.color = 'white';
            }
        }
    }

    updateOpponentStatus(data) {
        if (data.player_id !== this.playerInfo.id) {
            document.getElementById('lastSeen').textContent = data.status === 'online' ? 'Online' : `Last seen ${data.last_seen}`;
            document.getElementById('onlineIndicator').style.display = data.status === 'online' ? 'block' : 'none';
        }
    }

    // Add system message when game events happen
    addSystemMessage(message) {
        this.addChatMessage({
            type: 'system',
            message: message,
            timestamp: Date.now() / 1000
        });
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

        // Fix chat initialization
        this.updateOpponentInfo();
        this.addSystemMessage('🎮 Game started! May the best player win!');

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
            this.addSystemMessage("🤝 It's a draw! Well played both!");
        } else if (data.winner === this.playerInfo.symbol) {
            this.audioManager.play('win');
            this.addSystemMessage('🏆 Congratulations! You won this round!');
        } else {
            this.audioManager.play('loss');
            this.addSystemMessage('💪 Good effort! Better luck next time!');
        }

        // Highlight winning line if exists
        if (data.winning_line) {
            data.winning_line.forEach(position => {
                const cell = document.querySelectorAll('.game-cell')[position];
                cell.classList.add('winning');
            });
        }

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

        // Reset chat
        this.chatOpen = false;
        this.unreadMessages = 0;
        this.updateChatBadge();
        this.closeChat();
        document.getElementById('chatMessages').innerHTML = `
            <div class="chat-welcome">
                <div class="welcome-icon">
                    <i class="fas fa-comments"></i>
                </div>
                <h4>Start Chatting!</h4>
                <p>Send a message to begin the conversation</p>
            </div>
        `;

        this.hideGameOverModal();
        this.showScreen('menuScreen');
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    getEmojiByName(name) {
        // Simple emoji name mapping
        const emojiMap = {
            'smile': '😊',
            'laugh': '😂',
            'heart': '❤️',
            'thumbsup': '👍',
            'fire': '🔥',
            'game': '🎮'
        };
        return emojiMap[name.toLowerCase()];
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

const chatNotificationCSS = `
.chat-notification {
    position: fixed;
    top: 80px;
    right: 30px;
    background: var(--surface-color);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    padding: 12px 16px;
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
    display: flex;
    align-items: center;
    gap: 12px;
    max-width: 300px;
    transform: translateX(100%);
    opacity: 0;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    z-index: 1000;
}

.chat-notification.show {
    transform: translateX(0);
    opacity: 1;
}

.notification-avatar {
    width: 40px;
    height: 40px;
    background: linear-gradient(135deg, #0088cc, #00a8e6);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 1rem;
    flex-shrink: 0;
}

.notification-content {
    flex: 1;
    min-width: 0;
}

.notification-sender {
    font-weight: 600;
    font-size: 0.9rem;
    color: var(--text-primary);
    margin-bottom: 2px;
}

.notification-message {
    font-size: 0.8rem;
    color: var(--text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
`;

const style = document.createElement('style');
style.textContent += chatNotificationCSS;
document.head.appendChild(style);

document.addEventListener('DOMContentLoaded', () => {
    new TicTacToeGame();
});