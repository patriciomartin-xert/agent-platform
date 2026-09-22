"""
State definitions for Grok Bot Enterprise Multi-Agent Orchestration.
Uses typing.TypedDict with LangGraph annotation reducers and Pydantic validation models.
"""

from typing import Annotated, Sequence, List, Dict, Any, Optional, Literal
from typing_extensions import TypedDict
from pydantic import BaseModel, Field
from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages


class SubTask(BaseModel):
    id: str = Field(..., description="Unique step identifier (e.g. step-1)")
    description: str = Field(..., description="Actionable description of the subtask")
    tool_required: Optional[str] = Field(None, description="Suggested tool name (e.g., 'browser_navigate')")
    status: Literal["pending", "in_progress", "completed", "failed"] = "pending"
    acceptance_criteria: str = Field(..., description="Verifiable condition for success")


class ActionPayload(BaseModel):
    tool_name: str
    tool_args: Dict[str, Any]
    reasoning: str
    is_critical: bool = False
    requires_approval: bool = False


class ValidationResult(BaseModel):
    is_valid: bool
    is_goal_achieved: bool
    loop_detected: bool = False
    feedback: str
    cycle_risk_score: float = 0.0  # 0.0 to 1.0


class AgentState(TypedDict):
    """
    Complete state preserved in PostgreSQL/Checkpointer across all multi-agent turns.
    """
    # 1. Message history with append reducer
    messages: Annotated[Sequence[BaseMessage], add_messages]

    # 2. Planning and task tracking
    task_objective: str
    plan: List[Dict[str, Any]]
    current_step_index: int

    # 3. Execution & Tool Interception (MCP/Playwright)
    pending_action: Optional[Dict[str, Any]]
    human_approval: Optional[Dict[str, Any]] # {"approved": bool, "feedback": str}
    execution_result: Optional[Dict[str, Any]]

    # 4. Validation & Infinite Loop Prevention
    validation: Optional[Dict[str, Any]]
    action_history: List[Dict[str, Any]] # Ring buffer to detect oscillation/cycles
    retry_count: int

    # 5. Metadata & Session identifiers
    thread_id: str
    user_id: str
    error: Optional[str]
