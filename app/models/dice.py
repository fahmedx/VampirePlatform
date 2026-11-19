from pydantic import BaseModel, Field
from typing import List, Optional
from enum import Enum

class DieType(str, Enum):
    NORMAL = "normal"
    HUNGER = "hunger"

class DieResult(BaseModel):
    value: int
    die_type: DieType
    is_success: bool = False
    is_crit: bool = False
    is_bestial_one: bool = False

class RollType(str, Enum):
    REGULAR = "regular"
    ROUSE = "rouse"

class RollOutcome(str, Enum):
    MESSY_CRITICAL = "CRÍTICO BESTIAL"
    CRITICAL_WIN = "SUCESSO CRÍTICO"
    WIN = "SUCESSO"
    FAILURE = "FALHA"
    BESTIAL_FAILURE = "FALHA BESTIAL"
    SECRET_TOWER = "TORRE SECRETA"
    SECRET_DIFFICULTY = "DIFICULDADE SECRETA"

class RollResponse(BaseModel):
    id: str
    player_id: str
    player_name: str
    player_clan: str
    room_code: str
    timestamp: str
    roll_type: RollType = RollType.REGULAR
    title: str = "Rolagem de Dados"
    
    pool: int
    hunger: int
    difficulty: int
    is_secret: bool = False  # Torre de Dados do Narrador
    is_secret_diff: bool = False  # Dificuldade definida em segredo pelo Narrador
    
    normal_dice: List[DieResult] = []
    hunger_dice: List[DieResult] = []
    
    total_successes: int = 0
    margin: int = 0
    passed: bool = False
    outcome: RollOutcome
    
    details: str = ""
