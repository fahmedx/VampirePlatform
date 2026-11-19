import random
import uuid
from datetime import datetime
from typing import List, Tuple
from app.models.dice import DieType, DieResult, RollType, RollOutcome, RollResponse

def roll_single_die() -> int:
    return random.randint(1, 10)

def evaluate_die(val: int, die_type: DieType) -> DieResult:
    is_success = val >= 6
    is_crit = val == 10
    is_bestial_one = (die_type == DieType.HUNGER and val == 1)
    return DieResult(
        value=val,
        die_type=die_type,
        is_success=is_success,
        is_crit=is_crit,
        is_bestial_one=is_bestial_one
    )

def execute_v5_roll(
    player_id: str,
    player_name: str,
    player_clan: str,
    room_code: str,
    pool: int,
    hunger: int,
    difficulty: int = 1,
    title: str = "Rolagem de Parada",
    is_secret: bool = False,
    is_secret_diff: bool = False
) -> RollResponse:
    pool = max(1, int(pool))
    hunger = max(0, min(5, int(hunger)))
    difficulty = max(0, int(difficulty))
    
    hunger_count = min(hunger, pool)
    normal_count = max(0, pool - hunger_count)
    
    normal_dice_results: List[DieResult] = [
        evaluate_die(roll_single_die(), DieType.NORMAL) for _ in range(normal_count)
    ]
    hunger_dice_results: List[DieResult] = [
        evaluate_die(roll_single_die(), DieType.HUNGER) for _ in range(hunger_count)
    ]
    
    # Base successes from each die >= 6
    base_successes = sum(1 for d in normal_dice_results if d.is_success) + \
                     sum(1 for d in hunger_dice_results if d.is_success)
                     
    normal_crits = sum(1 for d in normal_dice_results if d.is_crit)
    hunger_crits = sum(1 for d in hunger_dice_results if d.is_crit)
    total_crits = normal_crits + hunger_crits
    
    # Pairs of 10s add +2 successes each
    crit_pairs = total_crits // 2
    extra_crit_successes = crit_pairs * 2
    total_successes = base_successes + extra_crit_successes
    
    passed = total_successes >= difficulty
    margin = total_successes - difficulty
    
    hunger_ones = sum(1 for d in hunger_dice_results if d.is_bestial_one)
    
    # Determine V5 outcome
    if passed:
        if crit_pairs > 0:
            if hunger_crits > 0:
                outcome = RollOutcome.MESSY_CRITICAL
                details = "A Besta se alimentou do seu triunfo! O sucesso foi alcançado, mas de forma violenta ou descontrolada."
            else:
                outcome = RollOutcome.CRITICAL_WIN
                details = "Triunfo absoluto! A precisão e maestria do vampiro brilharam perfeitamente."
        else:
            outcome = RollOutcome.WIN
            details = f"Sucesso alcançado com margem de {margin}."
    else:
        if hunger_ones > 0:
            outcome = RollOutcome.BESTIAL_FAILURE
            details = "A Besta assumiu o controle na sua falha! Prepare-se para uma compulsão ou frenesi."
        else:
            outcome = RollOutcome.FAILURE
            details = f"Falha no teste. Faltaram {abs(margin)} sucessos para atingir a dificuldade {difficulty}."

    return RollResponse(
        id=str(uuid.uuid4())[:8],
        player_id=player_id,
        player_name=player_name,
        player_clan=player_clan,
        room_code=room_code,
        timestamp=datetime.now().strftime("%H:%M:%S"),
        roll_type=RollType.REGULAR,
        title=title,
        pool=pool,
        hunger=hunger,
        difficulty=difficulty,
        is_secret=is_secret,
        is_secret_diff=is_secret_diff,
        normal_dice=normal_dice_results,
        hunger_dice=hunger_dice_results,
        total_successes=total_successes,
        margin=margin,
        passed=passed,
        outcome=outcome,
        details=details
    )

def execute_rouse_check(
    player_id: str,
    player_name: str,
    player_clan: str,
    room_code: str,
    current_hunger: int,
    purpose: str = "Despertar do Sangue / Teste de Sangue"
) -> Tuple[RollResponse, int]:
    val = roll_single_die()
    passed = val >= 6
    new_hunger = current_hunger
    
    die_res = evaluate_die(val, DieType.HUNGER)
    
    if passed:
        outcome = RollOutcome.WIN
        details = "Você saciou a sede do sangue místico. O nível de fome permanece inalterado! 🩸"
    else:
        outcome = RollOutcome.FAILURE
        if current_hunger < 5:
            new_hunger += 1
            details = f"O sangue exigiu seu tributo! Sua Fome aumentou para {new_hunger}."
        else:
            details = "Você já está em Fome 5! A Besta ruge desesperada. Risco iminente de Frenesi de Fome!"
            
    roll_resp = RollResponse(
        id=str(uuid.uuid4())[:8],
        player_id=player_id,
        player_name=player_name,
        player_clan=player_clan,
        room_code=room_code,
        timestamp=datetime.now().strftime("%H:%M:%S"),
        roll_type=RollType.ROUSE,
        title=purpose,
        pool=1,
        hunger=current_hunger,
        difficulty=1,
        is_secret=False,
        normal_dice=[],
        hunger_dice=[die_res],
        total_successes=1 if passed else 0,
        margin=0 if passed else -1,
        passed=passed,
        outcome=outcome,
        details=details
    )
    return roll_resp, new_hunger
