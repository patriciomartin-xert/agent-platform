"""
Stateful Graph Orchestration using LangGraph.
Implements the multi-agent cycle (Planner -> Executor -> Tool Gate -> Validator)
with native Human-In-The-Loop interruption and PostgreSQL/Memory checkpoint persistence.
"""

import os
from typing import Literal, Dict, Any, Optional
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_openai import ChatOpenAI
from langchain_anthropic import ChatAnthropic

from backend.app.orchestration.state import AgentState
from backend.app.orchestration.agents.planner import planner_node
from backend.app.orchestration.agents.executor import executor_node
from backend.app.orchestration.agents.validator import validator_node

MAX_RETRIES = 3


def get_default_llm() -> BaseChatModel:
    """
    Returns the primary LLM based on environment credentials, defaulting to Claude 3.5 Sonnet or GPT-4o.
    """
    if os.getenv("ANTHROPIC_API_KEY"):
        return ChatAnthropic(
            model_name="claude-3-5-sonnet-20241022",
            temperature=0.1,
            max_tokens=4096
        )
    elif os.getenv("OPENAI_API_KEY"):
        return ChatOpenAI(
            model_name="gpt-4o",
            temperature=0.1
        )
    else:
        # Fallback for offline development / mocking
        return ChatOpenAI(model_name="gpt-4o-mini", api_key="sk-mock-key")


# ------------------------------------------------------------------------------
# NODE WRAPPERS & TOOL DISPATCH
# ------------------------------------------------------------------------------

async def plan_step(state: AgentState) -> Dict[str, Any]:
    llm = get_default_llm()
    return await planner_node(state, llm)


async def execute_step(state: AgentState) -> Dict[str, Any]:
    llm = get_default_llm()
    return await executor_node(state, llm)


async def critical_action_approval_gate(state: AgentState) -> Dict[str, Any]:
    """
    Human-In-The-Loop Node:
    Execution is interrupted BEFORE this node via compile(interrupt_before=[...]).
    When resumed with human decision, this node ingests approval status into state.
    """
    approval = state.get("human_approval") or {"approved": False, "feedback": "Sin respuesta humana"}
    action = state.get("pending_action") or {}
    
    return {
        "messages": [{
            "role": "system",
            "content": f"🛡️ [HITL Gate] Decisión humana para `{action.get('tool_name')}`: "
                       f"{'APROBADA' if approval.get('approved') else 'RECHAZADA'}. "
                       f"Notas: {approval.get('feedback', '')}"
        }]
    }


async def tool_execution_node(state: AgentState) -> Dict[str, Any]:
    """
    Simulated or HTTP-dispatched tool execution in the isolated tools-server (Playwright / Sandbox).
    """
    action = state.get("pending_action", {})
    tool_name = action.get("tool_name", "unknown")
    tool_args = action.get("tool_args", {})

    # In production, dispatch via httpx to TOOLS_SERVER_URL (http://tools-server:8001/invoke)
    # Here providing clean structured execution result
    execution_result = {
        "status": "success",
        "tool": tool_name,
        "output": f"Ejecución exitosa de `{tool_name}` con parámetros: {tool_args}",
        "artifacts": {
            "screenshot_url": "/workspace/screenshots/latest.png" if "browser" in tool_name else None
        }
    }

    return {
        "execution_result": execution_result,
        "pending_action": None # Reset pending action after execution
    }


async def validate_step(state: AgentState) -> Dict[str, Any]:
    llm = get_default_llm()
    return await validator_node(state, llm)


# ------------------------------------------------------------------------------
# CONDITIONAL ROUTING FUNCTIONS (EDGES)
# ------------------------------------------------------------------------------

def route_after_executor(state: AgentState) -> Literal["critical_action_approval_gate", "tool_execution_node", "validate_step", "__end__"]:
    action = state.get("pending_action")
    if not action:
        # No pending action; evaluate completion
        return "__end__" if state.get("current_step_index", 0) >= len(state.get("plan", [])) else "validate_step"

    if action.get("is_critical") or action.get("requires_approval"):
        return "critical_action_approval_gate"

    return "tool_execution_node"


def route_after_approval(state: AgentState) -> Literal["tool_execution_node", "plan_step"]:
    approval = state.get("human_approval", {})
    if approval.get("approved", False):
        return "tool_execution_node"
    # If human rejected, send back to planner with feedback
    return "plan_step"


def route_after_validator(state: AgentState) -> Literal["plan_step", "execute_step", "__end__"]:
    validation = state.get("validation", {})
    retries = state.get("retry_count", 0)
    current_step = state.get("current_step_index", 0)
    plan = state.get("plan", [])

    # 1. Goal achieved or all plan steps completed successfully
    if validation.get("is_goal_achieved") or current_step >= len(plan):
        return "__end__"

    # 2. Infinite loop detected or retries exhausted -> Force Replanning
    if validation.get("loop_detected") or retries >= MAX_RETRIES:
        return "plan_step"

    # 3. Step was invalid but has retries left -> Retry execution of active step
    if not validation.get("is_valid"):
        return "execute_step"

    # 4. Step was valid -> Advance to execute next step in plan
    return "execute_step"


# ------------------------------------------------------------------------------
# GRAPH COMPILATION FACTORY
# ------------------------------------------------------------------------------

def create_agent_graph(checkpointer=None):
    """
    Constructs and compiles the complete multi-agent execution graph with Human-In-The-Loop.
    """
    if checkpointer is None:
        checkpointer = MemorySaver()

    builder = StateGraph(AgentState)

    # 1. Add Graph Nodes
    builder.add_node("plan_step", plan_step)
    builder.add_node("execute_step", execute_step)
    builder.add_node("critical_action_approval_gate", critical_action_approval_gate)
    builder.add_node("tool_execution_node", tool_execution_node)
    builder.add_node("validate_step", validate_step)

    # 2. Wire Graph Edges
    builder.add_edge(START, "plan_step")
    builder.add_edge("plan_step", "execute_step")

    builder.add_conditional_edges(
        "execute_step",
        route_after_executor,
        {
            "critical_action_approval_gate": "critical_action_approval_gate",
            "tool_execution_node": "tool_execution_node",
            "validate_step": "validate_step",
            "__end__": END
        }
    )

    builder.add_conditional_edges(
        "critical_action_approval_gate",
        route_after_approval,
        {
            "tool_execution_node": "tool_execution_node",
            "plan_step": "plan_step"
        }
    )

    builder.add_edge("tool_execution_node", "validate_step")

    builder.add_conditional_edges(
        "validate_step",
        route_after_validator,
        {
            "plan_step": "plan_step",
            "execute_step": "execute_step",
            "__end__": END
        }
    )

    # 3. Compile with Checkpointer & Human-In-The-Loop Interruption
    compiled_graph = builder.compile(
        checkpointer=checkpointer,
        interrupt_before=["critical_action_approval_gate"]
    )

    return compiled_graph
