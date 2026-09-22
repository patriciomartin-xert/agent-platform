"""
Planner Agent: Hierarchical task breakdown and deterministic DAG generation.
Analyzes user intentions, environment constraints, and validator feedback to formulate
or revise actionable subtask sequences.
"""

import json
from typing import Dict, Any, List
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
from langchain_core.language_models.chat_models import BaseChatModel
from backend.app.orchestration.state import AgentState, SubTask

PLANNER_SYSTEM_PROMPT = """Eres el PLANIFICADOR SENIOR de un sistema multiagente autónomo Always-On.
Tu misión exclusiva es analizar el objetivo final del usuario y generar un plan estructurado,
jerárquico y determinista de subtareas ejecutables.

REGLAS DE OPERACIÓN:
1. Divide el problema en pasos pequeños, atómicos y verificables.
2. Cada paso debe tener criterios de aceptación rigurosos (ej: 'El DOM contiene el selector #results con > 0 elementos').
3. Si recibes feedback de VALIDACIÓN indicando falla o bucle infinito, DEBES replanificar una estrategia alternativa radicalmente diferente.
4. NUNCA ejecutes código ni herramientas directamente; tu única salida es la lista de pasos ordenados.

Debes responder estrictamente en formato JSON con la siguiente estructura:
{
  "objective_analysis": "breve análisis del requerimiento",
  "steps": [
    {
      "id": "step-1",
      "description": "Navegar a la URL objetivo y esperar que cargue el DOM",
      "tool_required": "browser_navigate",
      "acceptance_criteria": "Página responde con código HTTP 200 y título válido"
    }
  ]
}
"""


async def planner_node(state: AgentState, llm: BaseChatModel) -> Dict[str, Any]:
    """
    Executes the Planner agent turn, synthesizing or adjusting the execution graph plan.
    """
    objective = state.get("task_objective") or ""
    current_plan = state.get("plan", [])
    validation = state.get("validation")
    retry_count = state.get("retry_count", 0)

    # Construct context for the planner
    prompt_context = f"OBJETIVO PRINCIPAL:\n{objective}\n\n"

    if current_plan:
        prompt_context += f"PLAN PREVIO:\n{json.dumps(current_plan, indent=2)}\n\n"

    if validation and not validation.get("is_valid", True):
        prompt_context += (
            f"ALERTA: El validador rechazó la ejecución anterior.\n"
            f"Feedback del Validador: {validation.get('feedback')}\n"
            f"Riesgo de bucle detectado: {validation.get('loop_detected', False)}\n"
            f"Reintentos agotados en este camino: {retry_count}.\n"
            f"POR FAVOR DISEÑA UN PLAN DE CONTINGENCIA ALTERNATIVO.\n"
        )

    messages = [
        SystemMessage(content=PLANNER_SYSTEM_PROMPT),
        HumanMessage(content=prompt_context)
    ]

    response = await llm.ainvoke(messages)
    content = response.content

    # Clean JSON markers if present
    cleaned_content = content
    if "```json" in content:
        cleaned_content = content.split("```json")[1].split("```")[0].strip()
    elif "```" in content:
        cleaned_content = content.split("```")[1].split("```")[0].strip()

    try:
        parsed = json.loads(cleaned_content)
        raw_steps = parsed.get("steps", [])
        validated_steps = [SubTask(**step).model_dump() for step in raw_steps]
    except Exception as e:
        # Fallback deterministic single-step plan on parsing anomaly
        validated_steps = [
            SubTask(
                id="step-1",
                description=f"Ejecutar objetivo directamente: {objective}",
                tool_required="browser_navigate",
                acceptance_criteria="Completar la acción solicitada por el usuario"
            ).model_dump()
        ]

    return {
        "plan": validated_steps,
        "current_step_index": 0,
        "retry_count": 0,
        "validation": None,
        "messages": [AIMessage(content=f"Plan estratégico generado con {len(validated_steps)} subtareas verificables.")]
    }
