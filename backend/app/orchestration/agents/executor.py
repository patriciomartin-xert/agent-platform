"""
Executor Agent: Responsible for selecting tools, preparing parameter payloads,
and classifying actions as critical (requiring Human-In-The-Loop approval) or safe.
"""

import json
from typing import Dict, Any, List
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
from langchain_core.language_models.chat_models import BaseChatModel
from backend.app.orchestration.state import AgentState, ActionPayload

CRITICAL_TOOLS = {
    "execute_bash",
    "delete_file",
    "write_file",
    "submit_payment_form",
    "browser_fill_payment",
    "deploy_service"
}

EXECUTOR_SYSTEM_PROMPT = """Eres el EJECUTOR TÉCNICO de un sistema multiagente de grado de producción.
Tu función es materializar el paso actual del plan seleccionando la herramienta exacta y los parámetros necesarios.

CATÁLOGO DE HERRAMIENTAS DISPONIBLES EN SANDBOX:
1. browser_navigate(url: str): Carga una URL en el navegador Playwright aislado.
2. browser_click(selector: str): Hace clic en un elemento DOM resuelto.
3. browser_type(selector: str, text: str): Escribe texto en un campo interactivo.
4. browser_extract_dom(simplified: bool): Extrae la jerarquía DOM simplificada y árbol de accesibilidad.
5. browser_screenshot(): Captura el viewport actual en Base64.
6. file_read(path: str): Lee un archivo dentro de /workspace.
7. file_write(path: str, content: str): Escribe un archivo dentro de /workspace (CRÍTICO).
8. execute_bash(command: str): Ejecuta un comando en el contenedor aislado (CRÍTICO).

REGLAS DE SEGURIDAD ESTRICTAS:
- Nunca inventes rutas fuera de /workspace.
- Toda acción que modifique el sistema de archivos, ejecute comandos de terminal o realice envíos de formularios financieros es CRÍTICA.

Responde ÚNICAMENTE en formato JSON:
{
  "tool_name": "browser_navigate",
  "tool_args": {"url": "https://example.com"},
  "reasoning": "Se requiere navegar a la web para verificar los datos solicitados en el paso 1."
}
"""


async def executor_node(state: AgentState, llm: BaseChatModel) -> Dict[str, Any]:
    """
    Executes the Executor turn. Determines the concrete tool invocation for the active subtask.
    """
    plan = state.get("plan", [])
    step_idx = state.get("current_step_index", 0)

    if step_idx >= len(plan):
        # All planned steps are already executed
        return {
            "pending_action": None,
            "messages": [AIMessage(content="Todas las subtareas del plan fueron procesadas.")]
        }

    active_step = plan[step_idx]
    last_result = state.get("execution_result")

    prompt_context = (
        f"PASO ACTUAL A EJECUTAR ({active_step.get('id')}):\n"
        f"Descripción: {active_step.get('description')}\n"
        f"Herramienta sugerida: {active_step.get('tool_required')}\n"
        f"Criterios de aceptación: {active_step.get('acceptance_criteria')}\n\n"
    )

    if last_result:
        prompt_context += f"RESULTADO DE LA ÚLTIMA ACCIÓN PREVIA:\n{json.dumps(last_result, indent=2)}\n"

    messages = [
        SystemMessage(content=EXECUTOR_SYSTEM_PROMPT),
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
        tool_name = parsed.get("tool_name", "browser_extract_dom")
        tool_args = parsed.get("tool_args", {})
        reasoning = parsed.get("reasoning", "")
    except Exception:
        tool_name = active_step.get("tool_required") or "browser_extract_dom"
        tool_args = {}
        reasoning = f"Ejecución directa del paso: {active_step.get('description')}"

    is_critical = tool_name in CRITICAL_TOOLS

    action_payload = ActionPayload(
        tool_name=tool_name,
        tool_args=tool_args,
        reasoning=reasoning,
        is_critical=is_critical,
        requires_approval=is_critical
    ).model_dump()

    # Append to action history ring buffer for loop tracking
    action_history = list(state.get("action_history", []))
    action_history.append({"tool": tool_name, "args": tool_args})
    if len(action_history) > 10:
        action_history = action_history[-10:]

    return {
        "pending_action": action_payload,
        "action_history": action_history,
        "messages": [
            AIMessage(
                content=f"⚙️ [Ejecutor] Herramienta preparada: `{tool_name}` (Crítica: {is_critical}). Razón: {reasoning}"
            )
        ]
    }
