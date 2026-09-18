class StateMachine {
  constructor() {
    this.sessions = {
      "session-gabriel-scola": {
        sessionId: "session-gabriel-scola",
        tenantId: "mi-empresa",
        phase: "Prospect",
        name: "Gabriel Scola",
        email: "gabriel.scola@gmail.com",
        history: [
          {
            role: "user",
            content: "Hola, estoy buscando pantalones con protecciones. Vi las opciones de ILM, Foxkull, LS2 y Scoyco. ¿Cuál me recomiendan comprar y por qué?",
            timestamp: new Date(Date.now() - 3600000).toISOString()
          }
        ],
        createdAt: new Date(Date.now() - 7200000).toISOString(),
        updatedAt: new Date().toISOString()
      },
      "session-ezequiel-verrati": {
        sessionId: "session-ezequiel-verrati",
        tenantId: "mi-empresa",
        phase: "New Customer",
        name: "Ezequiel Verrati",
        email: "ezequiel.v@outlook.com",
        history: [
          {
            role: "user",
            content: "Me interesa avanzar con la compra de la chamarra LS2 de motociclismo, ¿cuáles son los siguientes pasos?",
            timestamp: new Date(Date.now() - 7200000).toISOString()
          },
          {
            role: "assistant",
            content: "Hola Ezequiel. ¡Excelente elección! Para poder dar de alta tu expediente de facturación de Opalo Moto Gear, el equipo de Onboarding requiere que cargues tu identificación oficial y tu RFC. ¿Los tienes a la mano?",
            timestamp: new Date(Date.now() - 7100000).toISOString()
          }
        ],
        createdAt: new Date(Date.now() - 14400000).toISOString(),
        updatedAt: new Date().toISOString()
      },
      "session-franco-martinez": {
        sessionId: "session-franco-martinez",
        tenantId: "mi-empresa",
        phase: "Active Customer",
        name: "Franco Martínez",
        email: "franco.mtz@yahoo.com",
        history: [
          {
            role: "user",
            content: "Hola, ¿me podrían confirmar si mi envío de las botas Scoyco ya fue liberado por la mensajería urgente? La fecha de entrega era hoy.",
            timestamp: new Date(Date.now() - 10800000).toISOString()
          },
          {
            role: "assistant",
            content: "Hola Franco. Sí, tus botas Scoyco ya fueron liberadas de bodega de tránsito esta mañana por DHL Express. El número de guía es DHL-MX-7701. El repartidor está en ruta de entrega y llegará a tu domicilio antes de las 3:00 PM de hoy.",
            timestamp: new Date(Date.now() - 10700000).toISOString()
          }
        ],
        createdAt: new Date(Date.now() - 21600000).toISOString(),
        updatedAt: new Date().toISOString()
      }
    };
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
