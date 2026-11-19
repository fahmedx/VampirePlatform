import json
from typing import Dict, List, Optional, Set
from fastapi import WebSocket
from app.models.room import Player, RoomState, PlayerRole
from app.models.dice import RollResponse, RollOutcome

class ConnectionManager:
    def __init__(self):
        # room_code -> Dict[player_id, WebSocket]
        self.rooms: Dict[str, Dict[str, WebSocket]] = {}
        # room_code -> RoomState
        self.room_states: Dict[str, RoomState] = {}
        # room_code -> List[RollResponse]
        self.roll_histories: Dict[str, List[RollResponse]] = {}

    def get_or_create_room(self, room_code: str, room_name: str = "Mesa de Vampiro V5") -> RoomState:
        code = room_code.upper().strip()
        if code not in self.room_states:
            self.room_states[code] = RoomState(code=code, name=room_name)
            self.rooms[code] = {}
            self.roll_histories[code] = []
        return self.room_states[code]

    async def connect(self, room_code: str, player: Player, websocket: WebSocket):
        await websocket.accept()
        code = room_code.upper().strip()
        room = self.get_or_create_room(code)
        
        # Add or update player
        player.is_online = True
        room.players[player.id] = player
        if player.role == PlayerRole.NARRATOR:
            room.narrator_id = player.id

        self.rooms[code][player.id] = websocket
        
        # Broadcast updated room state
        await self.broadcast_room_state(code)

    def disconnect(self, room_code: str, player_id: str):
        code = room_code.upper().strip()
        if code in self.rooms and player_id in self.rooms[code]:
            del self.rooms[code][player_id]
        if code in self.room_states and player_id in self.room_states[code].players:
            self.room_states[code].players[player_id].is_online = False

    async def broadcast_room_state(self, room_code: str):
        code = room_code.upper().strip()
        if code not in self.room_states:
            return
        state = self.room_states[code]
        msg = {
            "type": "ROOM_STATE",
            "data": state.model_dump()
        }
        await self.broadcast(code, msg)

    async def broadcast_roll(self, room_code: str, roll: RollResponse):
        code = room_code.upper().strip()
        if code not in self.roll_histories:
            self.roll_histories[code] = []
        self.roll_histories[code].append(roll)
        
        room = self.room_states.get(code)
        narrator_id = room.narrator_id if room else None

        # Helper to check if a connection belongs to a narrator
        def is_narrator(pid: str) -> bool:
            if pid == narrator_id:
                return True
            if room and pid in room.players:
                return room.players[pid].role == PlayerRole.NARRATOR
            return False

        # 1. Rolagem 100% Secreta (Torre do Narrador) -> Visível APENAS para narradores
        if roll.is_secret:
            full_msg = {
                "type": "NEW_ROLL",
                "data": roll.model_dump()
            }
            # Mensagem ofuscada para todos os jogadores normais (inclusive quem rolou)
            masked_roll = roll.model_copy()
            masked_roll.normal_dice = []
            masked_roll.hunger_dice = []
            masked_roll.total_successes = 0
            masked_roll.outcome = RollOutcome.SECRET_TOWER
            
            for pid, ws in list(self.rooms.get(code, {}).items()):
                try:
                    if is_narrator(pid):
                        await ws.send_text(json.dumps(full_msg))
                    else:
                        if pid == roll.player_id:
                            masked_roll.details = "🔒 Sua rolagem foi enviada em segredo exclusivamente para o Narrador."
                        else:
                            masked_roll.details = f"🔒 {roll.player_name} enviou uma rolagem secreta para o Narrador."
                        masked_msg = {
                            "type": "NEW_ROLL",
                            "data": masked_roll.model_dump()
                        }
                        await ws.send_text(json.dumps(masked_msg))
                except Exception:
                    pass

        # 2. Dificuldade Secreta -> Jogadores veem os dados e sucessos, mas NÃO veem a dificuldade nem se deu certo/falhou
        elif roll.is_secret_diff:
            full_msg = {
                "type": "NEW_ROLL",
                "data": roll.model_dump()
            }
            # Versão para jogadores comuns
            player_view_roll = roll.model_copy()
            player_view_roll.difficulty = -1
            player_view_roll.outcome = RollOutcome.SECRET_DIFFICULTY
            player_view_roll.passed = False
            player_view_roll.margin = 0
            player_view_roll.details = "🎯 Dificuldade Secreta definida pelo Narrador. Apenas o Narrador sabe o resultado da ação!"

            player_msg = {
                "type": "NEW_ROLL",
                "data": player_view_roll.model_dump()
            }

            for pid, ws in list(self.rooms.get(code, {}).items()):
                try:
                    if is_narrator(pid):
                        await ws.send_text(json.dumps(full_msg))
                    else:
                        await ws.send_text(json.dumps(player_msg))
                except Exception:
                    pass

        # 3. Rolagem Pública padrão
        else:
            msg = {
                "type": "NEW_ROLL",
                "data": roll.model_dump()
            }
            await self.broadcast(code, msg)

    async def broadcast(self, room_code: str, data: dict):
        code = room_code.upper().strip()
        if code not in self.rooms:
            return
        payload = json.dumps(data)
        to_remove = []
        for pid, ws in self.rooms[code].items():
            try:
                await ws.send_text(payload)
            except Exception:
                to_remove.append(pid)
        for pid in to_remove:
            self.disconnect(code, pid)

    def update_player_hunger(self, room_code: str, player_id: str, hunger: int) -> Optional[Player]:
        code = room_code.upper().strip()
        if code in self.room_states and player_id in self.room_states[code].players:
            player = self.room_states[code].players[player_id]
            player.hunger = max(0, min(5, hunger))
            return player
        return None

    def set_room_secret_difficulty(self, room_code: str, difficulty: int, active: bool):
        code = room_code.upper().strip()
        if code in self.room_states:
            self.room_states[code].secret_difficulty = max(0, int(difficulty))
            self.room_states[code].secret_difficulty_active = active

manager = ConnectionManager()
