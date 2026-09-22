"""
Validator Agent (QA & Loop Prevention Gate):
Verifies that the executed step satisfied its acceptance criteria,
prevents infinite loops and state oscillation, and decides whether to proceed, retry, or replan.
"""

import json
from typing import Dict, Any, List
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
from langchain_core.language_models.chat_models import BaseChatModel
from backend.app.orchestration.state import AgentState, ValidationResult

VALIDATOR_SYSTEM_PROMPT = """Eres el VALIDADOR DE CALIDAD Y GUARDIÁN DE BUCLES (QA Gate) de un sistema autónomo.
Tu función es auditar con criterio implacable si el resultado obtenido cumple los criterios de éxito
y evitar que el sistema caiga en bucles infinitos o alucinaciones.

REGLAS DE AUDITORÍA:
1. Compara estrictamente el resultado de la herramienta con los 'acceptance_criteria' del paso actual.
2. Si el resultado indica error, timeout o selector no encontrado, debes marcar is_valid = false.
3. Si la acción se repitió de forma idéntica en el historial reciente, marca loop_detected = true y eleva cycle_risk_score.
4. Evalúa si el OBJETIVO GENERAL ya está resuelto satisfactoriamente (is_goal_achieved = true).

Responde en formato JSON estricto:
{
  "is_valid": true,
  "is_goal_achieved": false,
  "loop_detected": false,
  "cycle_risk_score": 0.1,
  "feedback": "El DOM cargó satisfactoriamente y el elemento objetivo está presente."
}
"""


def _detect_repetition_cycle(action_history: List[Dict[str, Any]]) -> bool:
    """
    Deterministic check: triggers if the exact same tool and args were invoked 3 times in the last 4 actions.
    """
    if len(action_history) < 3:
        return False

    last_action = action_history[-1]
    matches = sum(
        1 for act in action_history[-4:]
        if act.get("tool") == last_action.get("tool") and act.get("args") == last_action.get("args")
    )
    return matches >= 3


async def validator_node(state: AgentState, llm: BaseChatModel) -> Dict[str, Any]:
    """
    Executes the Validator turn, issuing a quality audit and loop prevention evaluation.
    """
    plan = state.get("plan", [])
    step_idx = state.get("current_step_index", 0)
    last_result = state.get("execution_result", {})
    action_history = state.get("action_history", [])
    retry_count = state.get("retry_count", 0)

    active_step = plan[step_idx] if step_idx < len(plan) else {}
    deterministic_loop = _detect_repetition_cycle(action_history)

    prompt_context = (
        f"OBJETIVO GLOBAL: {state.get('task_objective')}\n\n"
        f"PASO AUDITADO ({active_step.get('id', 'N/A')}):\n"
        f"Descripción: {active_step.get('description')}\n"
        f"Criterios esperados: {active_step.get('acceptance_criteria')}\n\n"
        f"RESULTADO REAL DE LA EJECUCIÓN:\n{json.dumps(last_result, indent=2)}\n\n"
        f"HISTORIAL RECIENTE DE ACCIONES ({len(action_history)} registradas):\n{json.dumps(action_history[-4:], indent=2)}\n"
        f"DETECCIÓN DETERMINISTA DE BUCLE: {deterministic_loop}\n"
    )

    messages = [
        SystemMessage(content=VALIDATOR_SYSTEM_PROMPT),
        HumanMessage(content=prompt_context)
    ]

    response = await llm.ainvoke(messages)
    content = response.content

    cleaned_content = content
    if "```json" in content:
        cleaned_content = content.split("```json")[1].split("```")[0].strip()
    elif "```" in content:
        cleaned_content = content.split("```")[1].split("```")[0].strip()

    try:
        parsed = json.loads(cleaned_content)
        val_result = ValidationResult(**parsed)
    except Exception:
        # Fallback conservative audit
        is_success = last_result.get("status") == "success"
        val_result = ValidationResult(
            is_valid=is_success,
            is_goal_achieved=False,
            loop_detected=deterministic_loop,
            cycle_risk_score=0.9 if deterministic_loop else 0.2,
            feedback="Validación heurística basada en código de retorno de la herramienta."
        )

    # Force loop detection if deterministic algorithm flagged repetition
    if deterministic_loop:
        val_result.loop_detected = True
        val_result.is_valid = False
        val_result.cycle_risk_score = 1.0
        val_result.feedback = "Bucle infinito detectado: Se ejecutó la misma acción idéntica 3 veces consecutivas."

    new_retry_count = retry_count + 1 if not val_result.is_valid else 0
    new_step_idx = step_idx + 1 if val_result.is_valid else step_idx

    status_icon = "✅" if val_result.is_valid else "❌"
    log_msg = f"{status_icon} [Validador] Paso {step_idx + 1}: {val_result.feedback}"

    return {
        "validation": val_result.model_dump(),
        "current_step_index": new_step_idx,
        "retry_count": new_retry_count,
        "messages": [AIMessage(content=log_msg)]
    }
