"""
FastAPI Backend Application with WebSocket Real-time Multi-Agent Streaming & HITL Controls.
"""

import os
import json
import asyncio
from typing import Dict, Any, List
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from backend.app.orchestration.graph import create_agent_graph
from langgraph.checkpoint.memory import MemorySaver

app = FastAPI(title="Grok Bot Enterprise Multi-Agent Backend", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Shared in-memory checkpointer & graph instance
memory_checkpointer = MemorySaver()
agent_graph = create_agent_graph(checkpointer=memory_checkpointer)

# Active WebSocket connections
active_connections: List[WebSocket] = []


@app.get("/health")
async def health_check():
    return {"status": "online", "system": "Grok Bot Multi-Agent Backend", "version": "1.0.0"}


@app.websocket("/ws/agent")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_connections.append(websocket)
    try:
        while True:
            raw_data = await websocket.receive_text()
            data = json.loads(raw_data)
            action = data.get("action")

            if action == "start_task":
                task_objective = data.get("objective", "Analizar sistema")
                thread_id = data.get("thread_id", "default-thread")

                config = {"configurable": {"thread_id": thread_id}}
                initial_state = {
                    "task_objective": task_objective,
                    "plan": [],
                    "current_step_index": 0,
                    "pending_action": None,
                    "human_approval": None,
                    "execution_result": None,
                    "validation": None,
                    "action_history": [],
                    "retry_count": 0,
                    "thread_id": thread_id,
                    "user_id": "user-1",
                    "messages": []
                }

                # Notify WS: Task started
                await websocket.send_json({
                    "type": "task_status",
                    "status": "started",
                    "objective": task_objective
                })

                # Stream graph execution
                async for event in agent_graph.astream(initial_state, config=config):
                    for node_name, node_output in event.items():
                        await websocket.send_json({
                            "type": "graph_node_step",
                            "node": node_name,
                            "output": node_output
                        })
                        await asyncio.sleep(0.3)

                # Check if graph paused at Human-In-The-Loop gate
                state = await agent_graph.aget_state(config)
                if state.next and "critical_action_approval_gate" in state.next:
                    pending_action = state.values.get("pending_action", {})
                    await websocket.send_json({
                        "type": "hitl_approval_required",
                        "node": "critical_action_approval_gate",
                        "pending_action": pending_action,
                        "thread_id": thread_id
                    })

            elif action == "submit_hitl_decision":
                thread_id = data.get("thread_id", "default-thread")
                approved = data.get("approved", False)
                feedback = data.get("feedback", "")

                config = {"configurable": {"thread_id": thread_id}}

                # Resume graph with decision
                await agent_graph.aupdate_state(
                    config,
                    {"human_approval": {"approved": approved, "feedback": feedback}}
                )

                await websocket.send_json({
                    "type": "hitl_decision_received",
                    "approved": approved,
                    "feedback": feedback
                })

                # Continue graph streaming after HITL approval/rejection
                async for event in agent_graph.astream(None, config=config):
                    for node_name, node_output in event.items():
                        await websocket.send_json({
                            "type": "graph_node_step",
                            "node": node_name,
                            "output": node_output
                        })
                        await asyncio.sleep(0.3)

    except WebSocketDisconnect:
        active_connections.remove(websocket)
    except Exception as e:
        print(f"[WebSocket Error]: {e}")
        if websocket in active_connections:
            active_connections.remove(websocket)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
