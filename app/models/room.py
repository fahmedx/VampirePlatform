from pydantic import BaseModel, Field
from typing import Dict, List, Optional
from enum import Enum

class PlayerRole(str, Enum):
    PLAYER = "player"
    NARRATOR = "narrator"

class Player(BaseModel):
    id: str
    name: str
    clan: str = "Caitiff"
    role: PlayerRole = PlayerRole.PLAYER
    hunger: int = Field(default=1, ge=0, le=5)
    health_max: int = 7
    health_damage: int = 0
    willpower_max: int = 5
    willpower_damage: int = 0
    is_online: bool = True

class RoomState(BaseModel):
    code: str
    name: str
    players: Dict[str, Player] = {}
    narrator_id: Optional[str] = None
    secret_difficulty: int = 3
    secret_difficulty_active: bool = False
