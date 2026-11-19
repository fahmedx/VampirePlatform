// Vampire Platform V5 - Client Script

class VampireVTT {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.roomCode = null;
        this.player = {
            id: this.getOrCreatePlayerId(),
            name: '',
            clan: 'Tremere',
            role: 'player',
            hunger: 1
        };
        this.roomState = null;
        this.rollHistory = [];

        this.initDOM();
        this.bindEvents();
        this.loadSavedSession();
    }

    generateUniqueId() {
        if (window.crypto && typeof window.crypto.randomUUID === 'function') {
            return 'p_' + window.crypto.randomUUID().replace(/-/g, '').substring(0, 12);
        }
        return 'p_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
    }

    getOrCreatePlayerId() {
        return this.generateUniqueId();
    }

    initDOM() {
        // Sections
        this.lobbyScreen = document.getElementById('lobby-screen');
        this.gameBoard = document.getElementById('game-board');
        this.headerRoomInfo = document.getElementById('header-room-info');
        this.lobbyError = document.getElementById('lobby-error');
        this.lobbyErrorText = document.getElementById('lobby-error-text');

        // Header Elements
        this.roomBadge = document.getElementById('room-badge');
        this.playerHeaderName = document.getElementById('player-header-name');
        this.playerHeaderClan = document.getElementById('player-header-clan');
        this.playerRoleBadge = document.getElementById('player-role-badge');
        this.btnCopyCode = document.getElementById('btn-copy-code');
        this.btnLeaveRoom = document.getElementById('btn-leave-room');

        // Lobby inputs
        this.lobbyForm = document.getElementById('lobby-form');
        this.inputRoom = document.getElementById('input-room');
        this.btnRandomRoom = document.getElementById('btn-random-room');
        this.inputName = document.getElementById('input-name');
        this.inputClan = document.getElementById('input-clan');
        this.inputRole = document.getElementById('input-role');
        this.inputHunger = document.getElementById('input-hunger');
        this.hungerDisplayVal = document.getElementById('hunger-display-val');
        this.btnSubmitLobby = document.getElementById('btn-submit-lobby');
        this.btnSubmitLabel = document.getElementById('btn-submit-label');
        this.btnSubmitIcon = document.getElementById('btn-submit-icon');

        // Dashboard Elements
        this.sheetPlayerName = document.getElementById('sheet-player-name');
        this.sheetPlayerClan = document.getElementById('sheet-player-clan');
        this.sheetRoleBadge = document.getElementById('sheet-role-badge');
        this.hungerCounter = document.getElementById('hunger-counter');
        this.hungerDroplets = document.getElementById('hunger-droplets');
        this.hungerStatusMsg = document.getElementById('hunger-status-msg');
        this.btnHungerDec = document.getElementById('btn-hunger-dec');
        this.btnHungerInc = document.getElementById('btn-hunger-inc');
        this.btnRouseCheck = document.getElementById('btn-rouse-check');

        // Coterie Elements
        this.coterieList = document.getElementById('coterie-list');
        this.coterieCount = document.getElementById('coterie-count');

        // Roll Deck
        this.poolSlider = document.getElementById('pool-slider');
        this.poolInput = document.getElementById('pool-input');
        this.diffSlider = document.getElementById('diff-slider');
        this.diffInput = document.getElementById('diff-input');
        this.previewNormalCount = document.getElementById('preview-normal-count');
        this.previewHungerCount = document.getElementById('preview-hunger-count');
        this.checkboxSecret = document.getElementById('checkbox-secret');

        this.narratorSecretPanel = document.getElementById('narrator-secret-panel');
        this.narratorSecretDiffVal = document.getElementById('narrator-secret-diff-val');
        this.btnToggleSecretDiff = document.getElementById('btn-toggle-secret-diff');
        this.playerSecretDiffIndicator = document.getElementById('player-secret-diff-indicator');
        this.btnRoll = document.getElementById('btn-roll');

        // Roll Feed
        this.rollFeed = document.getElementById('roll-feed');
        this.feedEmptyState = document.getElementById('feed-empty-state');
        this.rollCountBadge = document.getElementById('roll-count-badge');
    }

    showError(msg) {
        if (this.lobbyError && this.lobbyErrorText) {
            this.lobbyErrorText.innerHTML = msg;
            this.lobbyError.classList.remove('hidden');
        } else {
            alert(msg);
        }
        this.resetSubmitButton();
    }

    clearError() {
        if (this.lobbyError) {
            this.lobbyError.classList.add('hidden');
        }
    }

    setLoadingState(loading) {
        if (!this.btnSubmitLobby) return;
        if (loading) {
            this.btnSubmitLobby.disabled = true;
            this.btnSubmitLobby.classList.add('opacity-75', 'cursor-not-allowed');
            if (this.btnSubmitLabel) this.btnSubmitLabel.textContent = 'CONECTANDO...';
            if (this.btnSubmitIcon) this.btnSubmitIcon.textContent = '⏳';
        } else {
            this.resetSubmitButton();
        }
    }

    resetSubmitButton() {
        if (!this.btnSubmitLobby) return;
        this.btnSubmitLobby.disabled = false;
        this.btnSubmitLobby.classList.remove('opacity-75', 'cursor-not-allowed');
        if (this.btnSubmitLabel) this.btnSubmitLabel.textContent = 'ENTRAR NA SESSÃO';
        if (this.btnSubmitIcon) this.btnSubmitIcon.textContent = '🩸';
    }

    bindEvents() {
        // Lobby
        this.lobbyForm.addEventListener('submit', (e) => this.handleJoin(e));
        this.btnRandomRoom.addEventListener('click', () => {
            const cities = ['ELYSIUM', 'CAMARILLA', 'SABBAT', 'ASYLUM', 'PRINCE', 'HAVEN'];
            const randCity = cities[Math.floor(Math.random() * cities.length)];
            const randNum = Math.floor(10 + Math.random() * 90);
            this.inputRoom.value = `${randCity}-${randNum}`;
        });

        this.inputHunger.addEventListener('input', (e) => {
            this.hungerDisplayVal.textContent = e.target.value;
        });

        this.btnCopyCode.addEventListener('click', () => {
            navigator.clipboard.writeText(this.roomCode);
            alert(`Código da sala "${this.roomCode}" copiado para a área de transferência!`);
        });

        this.btnLeaveRoom.addEventListener('click', () => this.leaveRoom());

        // Hunger controls
        this.btnHungerDec.addEventListener('click', () => this.changeHunger(-1));
        this.btnHungerInc.addEventListener('click', () => this.changeHunger(1));

        // Rouse Check
        this.btnRouseCheck.addEventListener('click', () => this.sendRouseCheck());

        // Sliders & Number inputs bidirectionally synced
        this.poolSlider.addEventListener('input', (e) => {
            if (this.poolInput) this.poolInput.value = e.target.value;
            this.updateDicePreview();
        });
        if (this.poolInput) {
            this.poolInput.addEventListener('input', (e) => {
                let val = Math.max(1, Math.min(30, parseInt(e.target.value, 10) || 1));
                this.poolSlider.value = Math.min(15, val);
                this.updateDicePreview();
            });
        }

        this.diffSlider.addEventListener('input', (e) => {
            if (this.diffInput) this.diffInput.value = e.target.value;
        });
        if (this.diffInput) {
            this.diffInput.addEventListener('input', (e) => {
                let val = Math.max(0, Math.min(15, parseInt(e.target.value, 10) || 0));
                this.diffSlider.value = Math.min(8, val);
            });
        }

        // Narrator Secret Difficulty Toggle
        if (this.btnToggleSecretDiff) {
            this.btnToggleSecretDiff.addEventListener('click', () => {
                const isActive = this.roomState && this.roomState.secret_difficulty_active;
                const diffVal = parseInt(this.narratorSecretDiffVal.value, 10) || 3;
                if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                    this.socket.send(JSON.stringify({
                        action: 'SET_SECRET_DIFFICULTY',
                        difficulty: diffVal,
                        active: !isActive
                    }));
                }
            });
        }

        // Roll Button
        this.btnRoll.addEventListener('click', () => this.sendPoolRoll());
    }

    loadSavedSession() {
        const savedRoom = sessionStorage.getItem('vampire_room') || localStorage.getItem('vampire_room');
        const savedClan = sessionStorage.getItem('vampire_clan');
        const savedRole = sessionStorage.getItem('vampire_role');

        if (savedRoom) this.inputRoom.value = savedRoom;
        if (savedClan) this.inputClan.value = savedClan;
        if (savedRole) this.inputRole.value = savedRole;
    }

    handleJoin(e) {
        e.preventDefault();
        this.roomCode = this.inputRoom.value.trim().toUpperCase() || 'ELYSIUM-01';
        this.player.name = this.inputName.value.trim() || 'Neófito';
        this.player.clan = this.inputClan.value;
        this.player.role = this.inputRole.value;
        this.player.hunger = parseInt(this.inputHunger.value, 10);

        // Always assign a guaranteed fresh, unique ID for this new player session!
        this.player.id = this.generateUniqueId();
        sessionStorage.setItem('vampire_player_id', this.player.id);

        // Save session per tab
        sessionStorage.setItem('vampire_room', this.roomCode);
        sessionStorage.setItem('vampire_name', this.player.name);
        sessionStorage.setItem('vampire_clan', this.player.clan);
        sessionStorage.setItem('vampire_role', this.player.role);

        // Save default room across tabs for convenience
        localStorage.setItem('vampire_room', this.roomCode);

        this.connectWebSocket();
    }

    connectWebSocket() {
        this.clearError();

        const host = window.location.host;
        if (window.location.protocol === 'file:' || !host) {
            this.showError('Você abriu o arquivo HTML diretamente no navegador (<code>file://</code>)!<br><br>Para a plataforma funcionar com WebSockets e comunicação em tempo real, acesse através de: <a href="http://localhost:8000" class="underline font-bold text-amber-300">http://localhost:8000</a> (com o servidor iniciado).');
            return;
        }

        this.setLoadingState(true);

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${host}/ws/${this.roomCode}/${this.player.id}`;

        const connectionTimeout = setTimeout(() => {
            if (!this.isConnected) {
                this.showError(`Tempo limite excedido tentando conectar a <code>${wsUrl}</code>.<br><br>👉 Verifique se o backend está executando no terminal com: <code>./run.sh</code>`);
                if (this.socket) this.socket.close();
            }
        }, 5000);

        try {
            this.socket = new WebSocket(wsUrl);
        } catch (e) {
            clearTimeout(connectionTimeout);
            this.showError(`Erro ao inicializar WebSocket: ${e.message}`);
            return;
        }

        this.socket.onopen = () => {
            clearTimeout(connectionTimeout);
            // Handshake with player profile
            this.socket.send(JSON.stringify({
                name: this.player.name,
                clan: this.player.clan,
                role: this.player.role,
                hunger: this.player.hunger
            }));
        };

        this.socket.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                this.handleServerMessage(message);
            } catch (err) {
                console.error("Erro ao decodificar JSON:", err);
            }
        };

        this.socket.onclose = (event) => {
            clearTimeout(connectionTimeout);
            this.setLoadingState(false);

            // Se o fechamento foi intencional (botão Sair), não exibir erro
            if (this._intentionalClose) {
                this._intentionalClose = false;
                return;
            }

            if (!this.isConnected) {
                this.showError(`Não foi possível conectar ao servidor WebSocket em <code>${wsUrl}</code>.<br><br>👉 Verifique se o servidor FastAPI está rodando na pasta <code>VampirePlatform</code> executando: <code>./run.sh</code>`);
            } else {
                console.warn('Conexão encerrada com o servidor.');
                this.isConnected = false;
                this.leaveRoom();
            }
            this.isConnected = false;
        };

        this.socket.onerror = (err) => {
            console.error('Erro de WebSocket:', err);
        };
    }

    handleServerMessage(msg) {
        switch (msg.type) {
            case 'INIT_SUCCESS':
                this.onInitSuccess(msg.data);
                break;
            case 'ROOM_STATE':
                this.onRoomStateUpdate(msg.data);
                break;
            case 'NEW_ROLL':
                this.onNewRoll(msg.data);
                break;
            default:
                console.log('Mensagem desconhecida:', msg);
        }
    }

    onInitSuccess(data) {
        this.isConnected = true;
        this.setLoadingState(false);
        this.clearError();

        this.lobbyScreen.classList.add('hidden');
        this.gameBoard.classList.remove('hidden');
        this.headerRoomInfo.classList.remove('hidden');
        this.headerRoomInfo.classList.add('flex');

        this.roomBadge.textContent = this.roomCode;
        this.playerHeaderName.textContent = this.player.name;
        this.playerHeaderClan.textContent = `(${this.player.clan})`;
        this.playerRoleBadge.textContent = this.player.role === 'narrator' ? 'Narrador' : 'Jogador';
        if (this.player.role === 'narrator') {
            this.playerRoleBadge.className = 'px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-900/60 text-amber-200 border border-amber-700/50';
        }

        this.sheetPlayerName.textContent = this.player.name;
        this.sheetPlayerClan.textContent = `Clã ${this.player.clan}`;
        this.sheetRoleBadge.textContent = this.player.role === 'narrator' ? 'Narrador' : 'Jogador';

        this.updateHungerUI();

        // Render previous rolls
        if (data.history && data.history.length > 0) {
            this.rollHistory = data.history;
            this.renderHistory();
        }

        if (data.room) {
            this.onRoomStateUpdate(data.room);
        }
    }

    getBloodDroplets(hunger) {
        const h = Math.max(0, Math.min(5, parseInt(hunger, 10) || 0));
        let html = '';
        for (let i = 1; i <= 5; i++) {
            if (i <= h) {
                html += '<span class="text-red-500 drop-shadow-[0_0_3px_rgba(239,68,68,0.9)]">🩸</span>';
            } else {
                html += '<span class="opacity-20 grayscale">🩸</span>';
            }
        }
        return html;
    }

    onRoomStateUpdate(roomState) {
        this.roomState = roomState;
        const allPlayers = Object.values(roomState.players || {});
        // Only active/online players
        const onlinePlayers = allPlayers.filter(p => p.is_online);
        this.coterieCount.textContent = onlinePlayers.length;

        // Sync local hunger if changed externally (e.g. by narrator or rouse check)
        if (roomState.players && roomState.players[this.player.id]) {
            const serverHunger = roomState.players[this.player.id].hunger;
            if (serverHunger !== this.player.hunger) {
                this.player.hunger = serverHunger;
                this.updateHungerUI();
            }
        }

        // Narrator Secret Difficulty Panel / Player Indicator
        const isUserNarrator = this.player.role === 'narrator';
        if (isUserNarrator && this.narratorSecretPanel) {
            this.narratorSecretPanel.classList.remove('hidden');
            if (roomState.secret_difficulty_active) {
                this.btnToggleSecretDiff.className = 'px-3 py-1 rounded text-xs font-bold uppercase tracking-wider transition bg-amber-600 hover:bg-amber-500 text-black border border-amber-400 shadow-md animate-pulse';
                this.btnToggleSecretDiff.textContent = 'Ativa (Desativar)';
                if (this.narratorSecretDiffVal) this.narratorSecretDiffVal.value = roomState.secret_difficulty;
            } else {
                this.btnToggleSecretDiff.className = 'px-3 py-1 rounded text-xs font-bold uppercase tracking-wider transition bg-stone-800 hover:bg-stone-700 text-stone-300 border border-stone-600';
                this.btnToggleSecretDiff.textContent = 'Ativar na Mesa';
            }
        } else if (this.narratorSecretPanel) {
            this.narratorSecretPanel.classList.add('hidden');
        }

        if (!isUserNarrator && this.playerSecretDiffIndicator) {
            if (roomState.secret_difficulty_active) {
                this.playerSecretDiffIndicator.classList.remove('hidden');
            } else {
                this.playerSecretDiffIndicator.classList.add('hidden');
            }
        }

        // Render Coterie roster (Narrators first, then online players)
        this.coterieList.innerHTML = '';
        onlinePlayers
            .sort((a, b) => (b.role === 'narrator') - (a.role === 'narrator'))
            .forEach(p => {
                const isMe = p.id === this.player.id;
                const isNarrator = p.role === 'narrator';
                const canControlHunger = isUserNarrator && !isNarrator; // Narrador pode controlar fome de jogadores

                const card = document.createElement('div');
                card.className = `p-2.5 rounded-lg border text-xs transition ${
                    isMe ? 'bg-red-950/30 border-red-800/60 shadow-sm' : 'bg-black/40 border-stone-800/50'
                }`;

                card.innerHTML = `
                    <div class="flex items-center justify-between">
                        <div>
                            <div class="flex items-center space-x-1.5 flex-wrap">
                                <span class="font-semibold text-gray-200">${p.name}</span>
                                ${isMe ? '<span class="text-[9px] bg-red-900/60 text-red-200 border border-red-700/50 px-1 rounded font-bold">Você</span>' : ''}
                                ${isNarrator ? '<span class="text-[9px] bg-amber-950 text-amber-300 border border-amber-800/50 px-1 rounded font-bold">Mestre</span>' : ''}
                            </div>
                            <span class="text-[10px] text-vampire-gold">${p.clan}</span>
                        </div>
                        <div class="flex items-center space-x-1.5">
                            ${canControlHunger ? `
                                <button data-pid="${p.id}" data-delta="-1" class="btn-narrator-hunger w-5 h-5 rounded bg-stone-900 border border-stone-700 hover:bg-red-900/60 hover:border-red-600 text-stone-300 font-bold flex items-center justify-center transition text-xs leading-none">-</button>
                            ` : ''}
                            <span class="text-xs select-none inline-flex items-center" title="Fome: ${p.hunger}">${this.getBloodDroplets(p.hunger)}</span>
                            ${canControlHunger ? `
                                <button data-pid="${p.id}" data-delta="1" class="btn-narrator-hunger w-5 h-5 rounded bg-stone-900 border border-stone-700 hover:bg-red-900/60 hover:border-red-600 text-stone-300 font-bold flex items-center justify-center transition text-xs leading-none">+</button>
                            ` : ''}
                        </div>
                    </div>
                    ${canControlHunger ? `
                    <div class="mt-1.5 flex items-center space-x-1 justify-end">
                        <span class="text-[10px] text-stone-500">Fome:</span>
                        ${[0,1,2,3,4,5].map(val => `
                            <button data-pid="${p.id}" data-hunger="${val}" class="btn-narrator-set-hunger w-5 h-5 rounded text-[10px] font-mono font-bold border transition ${
                                p.hunger === val
                                    ? 'bg-red-700 border-red-500 text-white shadow'
                                    : 'bg-stone-900 border-stone-700 text-stone-400 hover:bg-red-900/50 hover:border-red-600'
                            }">${val}</button>
                        `).join('')}
                    </div>
                    ` : ''}
                `;

                // Bind narrator hunger controls
                if (canControlHunger) {
                    card.querySelectorAll('.btn-narrator-hunger').forEach(btn => {
                        btn.addEventListener('click', () => {
                            const pid = btn.dataset.pid;
                            const delta = parseInt(btn.dataset.delta, 10);
                            const target = roomState.players[pid];
                            if (target) {
                                const newH = Math.max(0, Math.min(5, target.hunger + delta));
                                this.narratorSetHunger(pid, newH);
                            }
                        });
                    });
                    card.querySelectorAll('.btn-narrator-set-hunger').forEach(btn => {
                        btn.addEventListener('click', () => {
                            const pid = btn.dataset.pid;
                            const hunger = parseInt(btn.dataset.hunger, 10);
                            this.narratorSetHunger(pid, hunger);
                        });
                    });
                }

                this.coterieList.appendChild(card);
            });
    }

    updateHungerUI() {
        this.hungerCounter.textContent = this.player.hunger;
        if (this.playerHeaderName) {
            this.playerHeaderName.innerHTML = `${this.player.name} <span class="ml-1 text-xs select-none">${this.getBloodDroplets(this.player.hunger)}</span>`;
        }
        
        // Generate droplets
        this.hungerDroplets.innerHTML = '';
        for (let i = 1; i <= 5; i++) {
            const drop = document.createElement('span');
            drop.className = `droplet-btn text-2xl select-none ${
                i <= this.player.hunger ? 'text-red-600 drop-shadow-[0_0_8px_rgba(220,38,38,0.8)]' : 'text-stone-700 opacity-40'
            }`;
            drop.textContent = '🩸';
            drop.title = `Definir Fome como ${i}`;
            drop.addEventListener('click', () => {
                this.setHunger(i);
            });
            this.hungerDroplets.appendChild(drop);
        }

        // Status description
        const messages = [
            "Plenamente saciado. Nenhuma fome perturba seus sentidos.",
            "A Besta murmura sob a pele... uma leve sede.",
            "A sede se torna persistente. Os sentidos ficam afiados.",
            "Fome voraz! O cheiro de sangue vivo é quase irresistível.",
            "Desespero! A Besta bate na porta da sua mente.",
            "FOME MÁXIMA! À beira de um terrível Frenesi de Fome!"
        ];
        this.hungerStatusMsg.textContent = messages[this.player.hunger] || messages[0];

        this.updateDicePreview();
    }

    changeHunger(delta) {
        const newHunger = Math.max(0, Math.min(5, this.player.hunger + delta));
        this.setHunger(newHunger);
    }

    setHunger(val) {
        this.player.hunger = val;
        this.updateHungerUI();
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({
                action: 'UPDATE_HUNGER',
                hunger: this.player.hunger
            }));
        }
    }

    narratorSetHunger(targetPlayerId, hunger) {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
        this.socket.send(JSON.stringify({
            action: 'NARRATOR_SET_HUNGER',
            target_player_id: targetPlayerId,
            hunger: hunger
        }));
    }

    updateDicePreview() {
        const pool = parseInt(this.poolInput ? this.poolInput.value : this.poolSlider.value, 10) || 1;
        const hungerCount = Math.min(this.player.hunger, pool);
        const normalCount = Math.max(0, pool - hungerCount);

        this.previewNormalCount.textContent = normalCount;
        this.previewHungerCount.textContent = hungerCount;
    }

    sendPoolRoll() {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;

        const pool = parseInt(this.poolInput ? this.poolInput.value : this.poolSlider.value, 10) || 1;
        const diff = parseInt(this.diffInput ? this.diffInput.value : this.diffSlider.value, 10) || 1;
        const isSecret = this.checkboxSecret ? this.checkboxSecret.checked : false;
        // is_secret_diff is controlled by the narrator panel (server-side state)
        const isSecretDiff = !!(this.roomState && this.roomState.secret_difficulty_active);

        this.socket.send(JSON.stringify({
            action: 'ROLL',
            pool: pool,
            difficulty: diff,
            title: 'Rolagem de Parada',
            is_secret: isSecret,
            is_secret_diff: isSecretDiff
        }));
    }

    sendRouseCheck() {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;

        this.socket.send(JSON.stringify({
            action: 'ROUSE_CHECK',
            purpose: 'Teste de Sangue (Rouse Check)'
        }));
    }

    onNewRoll(rollData) {
        this.rollHistory.unshift(rollData);
        if (this.feedEmptyState) {
            this.feedEmptyState.remove();
            this.feedEmptyState = null;
        }
        this.rollCountBadge.textContent = `${this.rollHistory.length} rolagens`;

        const card = this.createRollCard(rollData);
        card.classList.add('opacity-0', 'transform', '-translate-y-2');
        this.rollFeed.prepend(card);

        // Animate in
        requestAnimationFrame(() => {
            card.classList.remove('opacity-0', '-translate-y-2');
            card.classList.add('transition', 'duration-300');
        });
    }

    renderHistory() {
        this.rollFeed.innerHTML = '';
        this.rollCountBadge.textContent = `${this.rollHistory.length} rolagens`;
        this.rollHistory.forEach(roll => {
            const card = this.createRollCard(roll);
            this.rollFeed.appendChild(card);
        });
    }

    createRollCard(roll) {
        const card = document.createElement('div');
        
        let outcomeBg = 'border-stone-800 bg-black/40';
        let outcomeBadge = 'bg-stone-800 text-stone-300';
        let outcomeIcon = '🎲';

        if (roll.outcome === 'DIFICULDADE SECRETA') {
            outcomeBg = 'border-amber-600/70 bg-amber-950/20';
            outcomeBadge = 'bg-amber-950 text-amber-300 border border-amber-600 font-bold';
            outcomeIcon = '🎯❓';
        } else if (roll.outcome === 'TORRE SECRETA') {
            outcomeBg = 'border-stone-700 bg-black/60';
            outcomeBadge = 'bg-stone-900 text-stone-300 border border-stone-600 font-bold';
            outcomeIcon = '🔒';
        } else if (roll.outcome === 'CRÍTICO BESTIAL') {
            outcomeBg = 'border-red-600 bg-red-950/30 animate-blood-pulse';
            outcomeBadge = 'bg-red-900 text-red-100 border border-red-500 font-bold';
            outcomeIcon = '😈🩸';
        } else if (roll.outcome === 'SUCESSO CRÍTICO') {
            outcomeBg = 'border-amber-500/80 bg-amber-950/20';
            outcomeBadge = 'bg-amber-900 text-amber-200 border border-amber-500 font-bold';
            outcomeIcon = '💥✨';
        } else if (roll.outcome === 'SUCESSO') {
            outcomeBg = 'border-emerald-800/70 bg-emerald-950/15';
            outcomeBadge = 'bg-emerald-950 text-emerald-200 border border-emerald-700/60';
            outcomeIcon = '✅';
        } else if (roll.outcome === 'FALHA BESTIAL') {
            outcomeBg = 'border-rose-900 bg-red-950/40';
            outcomeBadge = 'bg-rose-950 text-rose-200 border border-rose-600 font-bold';
            outcomeIcon = '☠️';
        } else if (roll.outcome === 'FALHA') {
            outcomeBg = 'border-stone-800 bg-stone-900/30';
            outcomeBadge = 'bg-stone-900 text-stone-400 border border-stone-700';
            outcomeIcon = '❌';
        }

        const isSecret = roll.is_secret;
        const isRouse = roll.roll_type === 'rouse';
        const isSecretDiff = roll.is_secret_diff;

        let diffSubtitle = '';
        if (!isRouse) {
            if (isSecretDiff) {
                if (roll.difficulty < 0) {
                    diffSubtitle = `Parada: ${roll.pool} dados • 🎯 Dificuldade: ??? (Secreta)`;
                } else {
                    diffSubtitle = `Parada: ${roll.pool} dados • 🎯 Dificuldade: ${roll.difficulty} (Oculta dos Jogadores)`;
                }
            } else {
                diffSubtitle = `Parada: ${roll.pool} dados • Dificuldade: ${roll.difficulty}`;
            }
        }

        // Render Dice list
        let diceHtml = '';
        if (roll.normal_dice && roll.normal_dice.length > 0) {
            roll.normal_dice.forEach(d => {
                let extraClass = '';
                let subtext = '';
                if (d.is_crit) {
                    extraClass = 'die-crit';
                    subtext = '<span class="die-subtext text-amber-300">CRIT</span>';
                } else if (d.is_success) {
                    extraClass = 'die-success';
                    subtext = '<span class="die-subtext text-stone-400">SUC</span>';
                }
                diceHtml += `
                    <div class="die-box die-normal ${extraClass}">
                        <span>${d.value}</span>
                        ${subtext}
                    </div>
                `;
            });
        }

        if (roll.hunger_dice && roll.hunger_dice.length > 0) {
            roll.hunger_dice.forEach(d => {
                let extraClass = '';
                let subtext = '';
                if (d.is_crit) {
                    extraClass = 'die-crit';
                    subtext = '<span class="die-subtext text-red-200">BESTA</span>';
                } else if (d.is_bestial_one) {
                    extraClass = 'die-bestial-one';
                    subtext = '<span class="die-subtext text-rose-400">1☠️</span>';
                } else if (d.is_success) {
                    extraClass = 'die-success';
                    subtext = '<span class="die-subtext text-red-300">SUC</span>';
                }
                diceHtml += `
                    <div class="die-box die-hunger ${extraClass}">
                        <span>${d.value}</span>
                        ${subtext}
                    </div>
                `;
            });
        }

        card.className = `p-4 rounded-xl border ${outcomeBg} transition shadow-md`;
        card.innerHTML = `
            <div class="flex items-center justify-between border-b border-stone-800/60 pb-2.5 mb-3">
                <div class="flex items-center space-x-2">
                    <span class="font-bold text-sm text-gray-200">${roll.player_name}</span>
                    <span class="text-[10px] text-vampire-gold uppercase">(${roll.player_clan})</span>
                    ${isSecret ? '<span class="text-[10px] bg-red-950/80 text-red-300 border border-red-800/40 px-1.5 py-0.5 rounded font-mono">🔒 TORRE DO NARRADOR</span>' : ''}
                    ${isSecretDiff ? '<span class="text-[10px] bg-amber-950/80 text-amber-300 border border-amber-800/40 px-1.5 py-0.5 rounded font-mono">🎯 DIF. SECRETA</span>' : ''}
                </div>
                <span class="text-[10px] font-mono text-stone-500">${roll.timestamp}</span>
            </div>

            <div class="flex items-center justify-between mb-3">
                <div>
                    <h5 class="text-xs font-semibold text-stone-300 uppercase tracking-wide">${roll.title}</h5>
                    ${!isRouse ? `<span class="text-[11px] text-stone-500">${diffSubtitle}</span>` : ''}
                </div>
                <div class="flex items-center space-x-2">
                    <span class="px-2.5 py-1 rounded text-xs uppercase tracking-wider ${outcomeBadge} flex items-center space-x-1">
                        <span>${outcomeIcon}</span>
                        <span>${roll.outcome}</span>
                    </span>
                </div>
            </div>

            <!-- Dados Rolados -->
            <div class="flex flex-wrap gap-2 mb-3">
                ${diceHtml}
            </div>

            <!-- Resumo e Detalhes -->
            <div class="bg-black/30 rounded-lg p-2.5 text-xs border border-stone-800/40 flex items-center justify-between">
                <span class="text-stone-300 italic">${roll.details}</span>
                ${!isRouse ? `<span class="font-mono font-bold text-vampire-gold text-sm ml-2 whitespace-nowrap">${roll.total_successes} Sucessos</span>` : ''}
            </div>
        `;

        return card;
    }

    leaveRoom() {
        this.isConnected = false;
        this._intentionalClose = true;  // Sinaliza que o fechamento é intencional
        this.resetSubmitButton();
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
        // Clear active session ID for this tab so next join is completely fresh
        sessionStorage.removeItem('vampire_player_id');
        this.player.id = this.generateUniqueId();

        this.gameBoard.classList.add('hidden');
        this.headerRoomInfo.classList.add('hidden');
        this.headerRoomInfo.classList.remove('flex');
        this.lobbyScreen.classList.remove('hidden');
    }
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
    window.vtt = new VampireVTT();
});
