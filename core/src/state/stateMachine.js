class StateMachine {
  constructor() {
    this.sessions = {};
    this.wsBroadcaster = null;
  }

  setBroadcaster(broadcasterFn) {
    this.wsBroadcaster = broadcasterFn;
  }

  // Get or initialize session
  getSession(sessionId, tenantId) {
    if (!this.sessions[sessionId]) {
      this.sessions[sessionId] = {
        sessionId,
        tenantId,
        phase: 'Prospect', // Starts at Sales/Prospect stage
        name: '',
        email: '',
        history: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      this.notifyMonitor(this.sessions[sessionId], 'session_created');
    }
    return this.sessions[sessionId];
  }

  // Update session phase or details
  updateSession(sessionId, updates) {
    if (this.sessions[sessionId]) {
      const prevPhase = this.sessions[sessionId].phase;
      this.sessions[sessionId] = {
        ...this.sessions[sessionId],
        ...updates,
        updatedAt: new Date().toISOString()
      };

      if (updates.phase && updates.phase !== prevPhase) {
        console.log(`[StateMachine] Session ${sessionId} transitioned: ${prevPhase} -> ${updates.phase}`);
        this.notifyMonitor(this.sessions[sessionId], 'state_transition', { prevPhase, nextPhase: updates.phase });
      } else {
        this.notifyMonitor(this.sessions[sessionId], 'session_updated');
      }
    }
    return this.sessions[sessionId];
  }

  // Append user/assistant message to thread history
  addMessage(sessionId, role, content, functionCalls = null) {
    const session = this.sessions[sessionId];
    if (session) {
      session.history.push({
        role,
        content,
        functionCalls,
        timestamp: new Date().toISOString()
      });
      // Limit history size to keep context lean
      if (session.history.length > 50) {
        session.history.shift();
      }
      this.notifyMonitor(session, 'new_message', { role, content, functionCalls });
    }
  }

  // Broadcast events to live connected monitors (WebSockets)
  notifyMonitor(session, eventType, details = {}) {
    if (this.wsBroadcaster) {
      this.wsBroadcaster({
        event: eventType,
        session: {
          sessionId: session.sessionId,
          tenantId: session.tenantId,
          phase: session.phase,
          name: session.name,
          email: session.email,
          historyCount: session.history.length,
          updatedAt: session.updatedAt
        },
        details
      });
    }
  }
}

module.exports = new StateMachine();
