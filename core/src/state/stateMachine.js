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
            content: "¿Tienen promociones para autos nuevos? Estoy buscando opciones de pago.",
            timestamp: new Date(Date.now() - 3600000).toISOString()
          },
          {
            role: "assistant",
            content: "¡Hola, Gabriel! Sí, tenemos promociones espectaculares para autos nuevos este mes con tasas de interés preferenciales desde el 9.9% y opciones de enganche diferido. ¿Qué tipo de modelo o segmento estás buscando para tu negocio o uso personal?",
            timestamp: new Date(Date.now() - 3500000).toISOString()
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
            content: "Me interesa avanzar con el financiamiento del auto familiar, ¿cuáles son los siguientes pasos?",
            timestamp: new Date(Date.now() - 7200000).toISOString()
          },
          {
            role: "assistant",
            content: "Hola Ezequiel. ¡Excelente elección! Para poder dar de alta tu expediente comercial y procesar la aprobación crediticia de tu unidad, el equipo de Onboarding requiere que cargues tu identificación oficial, tu RFC y un comprobante de domicilio no mayor a 3 meses. ¿Tienes estos documentos a la mano?",
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
            content: "Hola, ¿me podrían confirmar si mi unidad ya pasó el control de calidad de la mesa de control aduanal? La fecha de entrega era hoy.",
            timestamp: new Date(Date.now() - 10800000).toISOString()
          },
          {
            role: "assistant",
            content: "Hola Franco. Sí, tu unidad familiar ya fue autorizada y liberada por la mesa de control aduanal esta mañana. Tu expediente está 100% aprobado. En este momento el transportista está programando la ruta de entrega. ¿Te gustaría que te enviemos el link de rastreo satelital por WhatsApp?",
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
