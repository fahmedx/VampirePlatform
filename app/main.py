import json
import os
from pathlib import Path
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from app.models.room import Player, PlayerRole
from app.services.room_manager import manager
from app.services.dice_engine import execute_v5_roll, execute_rouse_check

BASE_DIR = Path(__file__).resolve().parent

app = FastAPI(title="Vampire Platform V5", description="Mesa Virtual e Rolador de Dados para Vampiro: A Máscara")

app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))

@app.get("/", response_class=HTMLResponse)
async def get_index(request: Request):
    return templates.TemplateResponse(request=request, name="index.html")

@app.websocket("/ws/{room_code}/{player_id}")
async def websocket_endpoint(websocket: WebSocket, room_code: str, player_id: str):
    code = room_code.upper().strip()
    # Wait for the initial handshake containing player profile data
    await websocket.accept()
    
    current_player: Player = None
    try:
        init_data_raw = await websocket.receive_text()
        init_data = json.loads(init_data_raw)
        
        player_name = init_data.get("name", "Neófito")
        clan = init_data.get("clan", "Caitiff")
        role = PlayerRole(init_data.get("role", "player"))
        hunger = int(init_data.get("hunger", 1))
        
        current_player = Player(
            id=player_id,
            name=player_name,
            clan=clan,
            role=role,
            hunger=hunger
        )
        
        room = manager.get_or_create_room(code)
        current_player.is_online = True
        room.players[player_id] = current_player
        if current_player.role == PlayerRole.NARRATOR:
            room.narrator_id = player_id
            
        manager.rooms[code][player_id] = websocket
        
        # Send back confirmation & room state & history
        await websocket.send_text(json.dumps({
            "type": "INIT_SUCCESS",
            "data": {
                "player": current_player.model_dump(),
                "room": room.model_dump(),
                "history": [r.model_dump() for r in manager.roll_histories.get(code, [])[-30:]]
            }
        }))
        
        # Broadcast player joined to room
        await manager.broadcast_room_state(code)

        # Message loop
        while True:
            raw_msg = await websocket.receive_text()
            payload = json.loads(raw_msg)
            action = payload.get("action")
            
            if action == "ROLL":
                pool = int(payload.get("pool", 5))
                difficulty = int(payload.get("difficulty", 1))
                title = payload.get("title", "Rolagem de Parada")
                is_secret = bool(payload.get("is_secret", False))
                is_secret_diff = bool(payload.get("is_secret_diff", False))

                # Se a sala estiver com Dificuldade Secreta ativada pelo Narrador
                if room.secret_difficulty_active:
                    difficulty = room.secret_difficulty
                    is_secret_diff = True
                
                # Fetch fresh player data
                p = room.players.get(player_id, current_player)
                roll_result = execute_v5_roll(
                    player_id=p.id,
                    player_name=p.name,
                    player_clan=p.clan,
                    room_code=code,
                    pool=pool,
                    hunger=p.hunger,
                    difficulty=difficulty,
                    title=title,
                    is_secret=is_secret,
                    is_secret_diff=is_secret_diff
                )
                await manager.broadcast_roll(code, roll_result)

            elif action == "SET_SECRET_DIFFICULTY":
                p = room.players.get(player_id, current_player)
                if p.role == PlayerRole.NARRATOR:
                    diff = int(payload.get("difficulty", 3))
                    active = bool(payload.get("active", False))
                    manager.set_room_secret_difficulty(code, diff, active)
                    await manager.broadcast_room_state(code)

            elif action == "ROUSE_CHECK":
                p = room.players.get(player_id, current_player)
                purpose = payload.get("purpose", "Teste de Sangue (Rouse Check)")
                roll_result, new_hunger = execute_rouse_check(
                    player_id=p.id,
                    player_name=p.name,
                    player_clan=p.clan,
                    room_code=code,
                    current_hunger=p.hunger,
                    purpose=purpose
                )
                p.hunger = new_hunger
                await manager.broadcast_roll(code, roll_result)
                await manager.broadcast_room_state(code)

            elif action == "UPDATE_HUNGER":
                new_hunger = int(payload.get("hunger", 1))
                manager.update_player_hunger(code, player_id, new_hunger)
                await manager.broadcast_room_state(code)

            elif action == "NARRATOR_SET_HUNGER":
                # Apenas o Narrador pode alterar a fome de outros jogadores
                sender = room.players.get(player_id, current_player)
                if sender.role == PlayerRole.NARRATOR:
                    target_id = payload.get("target_player_id")
                    new_hunger = int(payload.get("hunger", 1))
                    manager.update_player_hunger(code, target_id, new_hunger)
                    await manager.broadcast_room_state(code)
                
            elif action == "UPDATE_STATS":
                p = room.players.get(player_id)
                if p:
                    if "health_damage" in payload:
                        p.health_damage = int(payload["health_damage"])
                    if "willpower_damage" in payload:
                        p.willpower_damage = int(payload["willpower_damage"])
                    await manager.broadcast_room_state(code)

    except WebSocketDisconnect:
        manager.disconnect(code, player_id)
        await manager.broadcast_room_state(code)
    except Exception as e:
        manager.disconnect(code, player_id)
