const tenantDatabaseService = require('../services/tenantDatabaseService');
const geminiService = require('../services/geminiService');
const salesforceService = require('../services/salesforceService');
const metaArchitectService = require('../services/metaArchitectService');
const stateMachine = require('../state/stateMachine');

class ChatController {
  // Return list of all tenants registered
  async listTenants(req, res) {
    try {
      const tenants = tenantDatabaseService.getAllTenants();
      return res.json({ success: true, tenants: Object.values(tenants) });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  // Generate and register a brand new white-label agent via dynamic consulting answers
  async runConsultingProcess(req, res) {
    try {
      const consultingAnswers = req.body;
      if (!consultingAnswers.companyName || !consultingAnswers.businessArea) {
        return res.status(400).json({ success: false, error: 'Faltan campos mandatorios: companyName, businessArea.' });
      }

      // Generate full configuration
      const generatedConfig = await metaArchitectService.generateAgentConfig(consultingAnswers);

      // Save to Database
      await tenantDatabaseService.saveTenantConfig(generatedConfig.tenantId, generatedConfig);

      return res.json({
        success: true,
        tenantId: generatedConfig.tenantId,
        config: generatedConfig
      });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  // Return branding & layout specifications for the Widget
  async getTenantBranding(req, res) {
    try {
      const tenantId = req.query.tenantId || 'mi-empresa';
      const tenantConfig = await tenantDatabaseService.getTenantConfig(tenantId);
      
      return res.json({
        success: true,
        branding: {
          companyName: tenantConfig.companyName,
          primaryColor: tenantConfig.primaryColor,
          secondaryColor: tenantConfig.secondaryColor,
          logoUrl: tenantConfig.logoUrl,
          welcomeMessage: tenantConfig.welcomeMessage
        }
      });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  // Classify Sentiment & Urgency on-the-fly (Emotional AI)
  detectSentiment(message) {
    const text = message.toLowerCase();
    
    const frustrationKeywords = [
      'falla', 'error', 'no sirve', 'urgente', 'mal', 'no entiendo', 'tarda', 
      'pesimo', 'horrible', 'ayuda', 'molesto', 'frustrado', 'problema', 'queja'
    ];
    const positiveKeywords = [
      'gracias', 'excelente', 'perfecto', 'bien', 'genial', 'increible', 'súper', 'super', 'me gusta'
    ];

    if (frustrationKeywords.some(keyword => text.includes(keyword))) {
      return { label: 'FRUSTRACIÓN', responseTone: 'EMPATÍA & ASEGURACIÓN', color: 'bg-rose-500/10 text-rose-400 border-rose-500/20' };
    }
    if (positiveKeywords.some(keyword => text.includes(keyword))) {
      return { label: 'SATISFECHO', responseTone: 'AGRADECIMIENTO', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
    }
    return { label: 'CONSULTA', responseTone: 'PROFESIONAL / INFORMATIVO', color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' };
  }

  // Main chat endpoint simulating multi-agent pipeline collaboration (Grok Bot Teammates Style)
  async handleChat(req, res) {
    try {
      const { sessionId, message, tenantId } = req.body;
      if (!sessionId || !message || !tenantId) {
        return res.status(400).json({ success: false, error: 'Faltan parámetros obligatorios: sessionId, message, tenantId.' });
      }

      // 1. Get CMS Config from Tenant Database
      const tenantConfig = await tenantDatabaseService.getTenantConfig(tenantId);

      // 2. Resolve/Create Session in Customer State Machine
      let sessionState = stateMachine.getSession(sessionId, tenantId);

      // 3. Classify User Sentiment (Emotional AI)
      const sentiment = this.detectSentiment(message);

      // Save user prompt in session history with emotional metadata
      stateMachine.addMessage(sessionId, 'user', message);
      stateMachine.updateSession(sessionId, { lastSentiment: sentiment });

      // Determine active specialist based on phase/intent
      let activeSpecialist = 'Sales Outbound Bot';
      let delegationTask = 'Investigar cuenta de prospección y cotizar tarifas.';
      if (sessionState.phase === 'New Customer') {
        activeSpecialist = 'Talent & Onboarding Scout';
        delegationTask = 'Validar entrega de RFC y consistencia de documentos cargados.';
      } else if (sessionState.phase === 'Active Customer') {
        activeSpecialist = 'Operations Manager Bot';
        delegationTask = 'Rastrear estatus de folio operativo y resolver tickets de mesa de control.';
      }

      // 4. Generate Multi-Agent Teammate Collaboration Logs (Back-Channel chat)
      const collaborationLogs = [
        {
          from: 'Chief of Staff',
          to: activeSpecialist,
          message: `Mensaje del cliente recibido: "${message}". Inicia protocolo de análisis transversal. Tarea asignada: ${delegationTask}`
        },
        {
          from: activeSpecialist,
          to: 'Chief of Staff',
          message: `Contexto acumulado analizado correctamente. Iniciando ejecución de lógica interna de la máquina de estados en fase [${sessionState.phase}].`
        }
      ];

      // 5. Process with Gemini Service
      const geminiResult = await geminiService.sendMessage(
        tenantConfig,
        sessionState,
        message,
        sessionState.history
      );

      let reply = geminiResult.reply;
      const functionCalls = geminiResult.functionCalls || [];

      // 6. Handle any triggered function calls and log collaboration actions
      for (const call of functionCalls) {
        console.log(`[Function Calling] Executing tool: ${call.name} with args:`, call.args);
        
        if (call.name === 'createLead') {
          await salesforceService.createLead(tenantId, {
            name: call.args.name,
            email: call.args.email,
            phone: call.args.phone
          });
          stateMachine.updateSession(sessionId, {
            name: call.args.name,
            email: call.args.email
          });
          collaborationLogs.push({
            from: 'Sales Outbound Bot',
            to: 'Chief of Staff',
            message: `Lead comercial registrado exitosamente en Salesforce CRM. ID sincronizado. Asignando fase de Onboarding.`
          });
        }
        
        else if (call.name === 'submitOnboardingDocument') {
          console.log(`[Onboarding] Document submitted for ${sessionId}: ${call.args.documentType}`);
          await salesforceService.updateOpportunityStage(tenantId, sessionState.email || 'cliente@ejemplo.com', 'Closed Won / Onboarding Completed');
          collaborationLogs.push({
            from: 'Talent & Onboarding Scout',
            to: 'Chief of Staff',
            message: `Documento oficial [${call.args.documentType}] recibido, validado y cargado en el expediente de Salesforce.`
          });
        }
        
        else if (call.name === 'createSupportCase') {
          await salesforceService.createCase(tenantId, {
            email: sessionState.email || 'soporte-cliente@ejemplo.com',
            subject: call.args.subject,
            description: call.args.description
          });
          collaborationLogs.push({
            from: 'Operations Manager Bot',
            to: 'Chief of Staff',
            message: `Caso de soporte técnico abierto de emergencia. ID de ticket generado. Petición turnada a Mesa de Control.`
          });
        }
        
        else if (call.name === 'transitionState') {
          stateMachine.updateSession(sessionId, { phase: call.args.nextPhase });
          collaborationLogs.push({
            from: 'Chief of Staff',
            to: 'Teammates',
            message: `Fase del Journey actualizada de forma transversal. Nueva fase activa: [${call.args.nextPhase}]`
          });
        }
      }

      collaborationLogs.push({
        from: 'Chief of Staff',
        to: 'Customer',
        message: `Sintetizando respuesta final en base al tono de marca ajustado (${tenantConfig.toneOfVoice}). Entregando mensaje.`
      });

      // Add assistant response to session history
      stateMachine.addMessage(sessionId, 'assistant', reply, functionCalls);

      // Get updated session status
      const updatedSession = stateMachine.getSession(sessionId, tenantId);

      return res.json({
        success: true,
        reply,
        phase: updatedSession.phase,
        sentiment: sentiment.label,
        responseTone: sentiment.responseTone,
        executedTools: functionCalls.map(c => c.name),
        collaborationLogs
      });
    } catch (error) {
      console.error('[ChatController Error]:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }
}

module.exports = new ChatController();
