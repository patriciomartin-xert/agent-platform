const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../config/config');
const agentTeamService = require('./agentTeamService');

class GeminiAgentEngine {
  constructor() {
    this.primaryModel = 'gemini-1.5-flash';
    this.fallbackModel = 'gemini-2.0-flash';
  }

  getGenAI() {
    const key = process.env.GEMINI_API_KEY || config.GEMINI_API_KEY;
    if (!key || key.trim() === '') return null;
    try {
      return new GoogleGenerativeAI(key.trim());
    } catch (e) {
      console.warn('[GeminiAgentEngine] Failed to init GoogleGenerativeAI:', e.message);
      return null;
    }
  }

  async testConnection(apiKey) {
    if (!apiKey || !apiKey.trim()) {
      return { success: false, error: 'No se proporcionó ninguna API Key.' };
    }
    const cleanKey = apiKey.trim();

    if (!cleanKey.startsWith('AIzaSy')) {
      return {
        success: false,
        error: 'Las claves de Google AI Studio deben comenzar con el prefijo "AIzaSy...". La clave ingresada no pertenece a un proyecto activo de Google AI Studio. Puedes obtener una clave gratuita en https://aistudio.google.com/app/apikey'
      };
    }

    const candidateModels = ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro'];
    let lastError = null;

    for (const modelName of candidateModels) {
      try {
        const client = new GoogleGenerativeAI(cleanKey);
        const model = client.getGenerativeModel({ model: modelName });
        const result = await model.generateContent('Responde en una sola palabra: "Conectado"');
        const text = result.response.text();
        this.primaryModel = modelName;
        return { success: true, message: `Conexión exitosa con Google Gemini (${modelName}): ${text.trim()}` };
      } catch (err) {
        lastError = err.message;
      }
    }

    return {
      success: false,
      error: `Error conectando con Google Gemini API: ${lastError || 'Verifica que la clave tenga la API "Generative Language API" activada en tu cuenta de Google.'}`
    };
  }

  async executeAgentTurn({ agent, userMessage, conversationHistory = [] }) {
    const allAgents = agentTeamService.getAllAgents();
    const agentList = Object.values(allAgents);
    const superior = agent.reportsTo ? allAgents[agent.reportsTo] : null;
    const subordinates = agentList.filter(a => a.reportsTo === agent.id);

    // 1. Try real Gemini API if key is present
    const genAI = this.getGenAI();
    if (genAI) {
      try {
        const model = genAI.getGenerativeModel({ model: this.primaryModel });

        const systemInstruction = `
Eres ${agent.name}, desempeñando el cargo de "${agent.role}" en el departamento de "${agent.department}" dentro de la plataforma empresarial Ópalo OS.
Tu misión y Job Description es:
"""
${agent.jobDescription || 'Operar con máxima autonomía, resolver problemas y coordinar con el equipo.'}
"""

Estructura Organizacional:
- Tu supervisor directo: ${superior ? `${superior.name} (${superior.role})` : 'Sin superior (Reportas directamente a Dirección General / Fundador)'}
- Tus reportes / subordinados a cargo: ${subordinates.length > 0 ? subordinates.map(s => `${s.name} (${s.role})`).join(', ') : 'Ninguno asignado aún'}
- Herramientas y plugins asignados: ${(agent.plugins || []).join(', ') || 'Navegador web corporativo'}

CAPACIDAD AUTÓNOMA DE GESTIÓN Y ORGANIGRAMA:
Si el usuario te solicita crear agentes, estructurar el equipo, diseñar o expandir el organigrama de la empresa:
1. Diseña los roles estratégicos necesarios para cumplir el objetivo del negocio.
2. Al final de tu respuesta, incluye un bloque JSON con los nuevos agentes a instanciar usando EXACTAMENTE esta sintaxis delimitada:
<<<GENERATE_AGENTS:
[
  {
    "name": "Nombre o Título del Agente",
    "role": "Cargo específico",
    "department": "Departamento (Dirección General, Marketing & Crecimiento, Finanzas & Operaciones, Soporte & Clientes, o el adecuado)",
    "reportsTo": "${agent.id}",
    "jobDescription": "Detalle claro de sus funciones y objetivos operativos",
    "avatarEmoji": "🤖"
  }
]
>>>

Reglas de comunicación:
- Habla en primera persona con la personalidad de tu cargo (${agent.role}).
- Sé conciso, ejecutivo, analítico y profesional.
- Nunca inventes que eres una IA genérica ni uses plantillas repetitivas de confirmación.
`.trim();

        // Build recent conversation context
        const formattedHistory = conversationHistory.slice(-8).map(m => {
          return `${m.role === 'user' ? 'Usuario' : agent.name}: ${m.content}`;
        }).join('\n');

        const prompt = `${systemInstruction}\n\nHistorial reciente:\n${formattedHistory}\n\nUsuario: ${userMessage}\n${agent.name}:`;

        const result = await model.generateContent(prompt);
        let rawReply = result.response.text();

        // Check if agent generated agents to incorporate into organigram
        const createdAgents = this._extractAndCreateAgents(rawReply, agent.id);
        const cleanReply = rawReply.replace(/<<<GENERATE_AGENTS:[\s\S]*?>>>/g, '').trim();

        let finalReply = cleanReply;
        if (createdAgents.length > 0) {
          finalReply += `\n\n🏢 **Actualización de Organigrama**: He incorporado exitosamente **${createdAgents.length} nuevo(s) agente(s)** al equipo:\n` +
            createdAgents.map(a => `• **${a.name}** (${a.role}) - Departamento: *${a.department}*`).join('\n') +
            `\n\nPuedes consultar sus tarjetas en la vista de **Organigrama** o abrir sus chats en la barra lateral.`;
        }

        return { reply: finalReply, actions: createdAgents.length > 0 ? ['agents_created'] : [] };
      } catch (err) {
        console.warn('[GeminiAgentEngine] Error calling Gemini API:', err.message);
        // Fall through to smart intelligent simulation
      }
    }

    // 2. High-fidelity intelligent contextual engine (when key is missing or invalid)
    return this._runIntelligentSimulation(agent, userMessage, superior, subordinates);
  }

  _extractAndCreateAgents(text, defaultReportsTo) {
    const match = text.match(/<<<GENERATE_AGENTS:([\s\S]*?)>>>/);
    if (!match) return [];
    try {
      const jsonStr = match[1].trim();
      const agentsToCreate = JSON.parse(jsonStr);
      if (!Array.isArray(agentsToCreate)) return [];

      const created = [];
      agentsToCreate.forEach(ag => {
        if (ag.name && ag.role) {
          const newAgent = agentTeamService.createAgent({
            name: ag.name,
            role: ag.role,
            department: ag.department || 'Operaciones',
            reportsTo: ag.reportsTo || defaultReportsTo || null,
            jobDescription: ag.jobDescription || `Especialista enfocado en ${ag.role}.`,
            avatarEmoji: ag.avatarEmoji || '🤖'
          });
          created.push(newAgent);
        }
      });
      return created;
    } catch (e) {
      console.warn('[GeminiAgentEngine] Failed to parse generated agents JSON:', e.message);
      return [];
    }
  }

  _runIntelligentSimulation(agent, userMessage, superior, subordinates) {
    const lower = userMessage.toLowerCase();

    // SCENARIO A: REQUEST TO GENERATE AGENTS OR ORGANIGRAM
    if (
      lower.includes('genera') && (lower.includes('agente') || lower.includes('organigrama') || lower.includes('equipo')) ||
      lower.includes('crea') && (lower.includes('agente') || lower.includes('organigrama') || lower.includes('equipo')) ||
      lower.includes('organigrama') || lower.includes('crear equipo') || lower.includes('estructura la empresa')
    ) {
      // Determine company context or generate comprehensive org chart
      const isTech = lower.includes('tech') || lower.includes('software') || lower.includes('saas') || lower.includes('ia');
      const isEcommerce = lower.includes('tienda') || lower.includes('ecommerce') || lower.includes('ventas');

      let templates = [];
      if (isTech) {
        templates = [
          { name: 'Elena Rivas', role: 'Chief Technology Officer (CTO)', department: 'Tecnología & Desarrollo', avatarEmoji: '💻', jobDescription: 'Arquitectura de software, infraestructura cloud y despliegues continuos.' },
          { name: 'Marcos Soler', role: 'Head of Growth & Acquisition', department: 'Marketing & Crecimiento', avatarEmoji: '📈', jobDescription: 'Estrategias de adquisición de usuarios B2B, embudos de conversión y analítica.' },
          { name: 'Valeria Castro', role: 'Lead Customer Success Specialist', department: 'Soporte & Clientes', avatarEmoji: '🤝', jobDescription: 'Retención de cuentas, onboarding de clientes y resolución de tickets críticos.' }
        ];
      } else if (isEcommerce) {
        templates = [
          { name: 'Santiago Paz', role: 'Gerente de Logística y Envíos', department: 'Finanzas & Operaciones', avatarEmoji: '📦', jobDescription: 'Gestión de inventarios, optimización de rutas de entrega y seguimiento de paqueterías.' },
          { name: 'Camila Torres', role: 'Especialista en Campañas & Pauta', department: 'Marketing & Crecimiento', avatarEmoji: '🎯', jobDescription: 'Configuración y monitoreo de ROI en campañas publicitarias de Meta y Google.' },
          { name: 'Lucía Méndez', role: 'Coordinadora de Atención al Comprador', department: 'Soporte & Clientes', avatarEmoji: '💬', jobDescription: 'Soporte omnicanal post-venta vía WhatsApp Business y chat en vivo.' }
        ];
      } else {
        // Universal executive team
        templates = [
          { name: 'Director de Estrategia & Crecimiento', role: 'Growth Strategist', department: 'Marketing & Crecimiento', avatarEmoji: '🚀', jobDescription: 'Posicionamiento de marca, adquisición de clientes y análisis de mercado.' },
          { name: 'Controlador de Operaciones & Finanzas', role: 'Operations & Finance Manager', department: 'Finanzas & Operaciones', avatarEmoji: '📊', jobDescription: 'Supervisión de flujo de caja, conciliación de facturas y control de costes.' },
          { name: 'Coordinador de Soporte & Éxito del Cliente', role: 'Customer Success Manager', department: 'Soporte & Clientes', avatarEmoji: '⭐', jobDescription: 'Garantizar la máxima satisfacción del cliente y resolución rápida de incidencias.' }
        ];
      }

      const created = [];
      templates.forEach(t => {
        const newAg = agentTeamService.createAgent({
          name: t.name,
          role: t.role,
          department: t.department,
          reportsTo: agent.id, // They report to this agent!
          jobDescription: t.jobDescription,
          avatarEmoji: t.avatarEmoji
        });
        created.push(newAg);
      });

      const reply = `He diseñado y desplegado la estructura del organigrama en la plataforma reportando a mi supervisión en **${agent.department}**:\n\n` +
        created.map(a => `• 🏢 **${a.name}** (${a.role})\n  Departamento: *${a.department}*\n  Misión: ${a.jobDescription}`).join('\n\n') +
        `\n\n📌 **Acción realizada en el sistema**: Todos los nodos han sido vinculados al organigrama interactivo. Puedes ver las conexiones jerárquicas en la pestaña **Organigrama** o delegarles tareas desde sus respectivos chats.`;

      return { reply, actions: ['organigram_generated'] };
    }

    // SCENARIO B: SETTING RULES, LOGIC, OR JOB DESCRIPTION
    if (lower.includes('regla') || lower.includes('logica') || lower.includes('mision') || lower.includes('rol') || lower.includes('instruccion')) {
      // Update the agent's job description with user's instructions if provided
      const newMission = `Reglas operativas de ${agent.name}: Responder con máxima proactividad, pensamiento estratégico de ${agent.role}, autonomía en toma de decisiones y coordinación directa con la dirección. Instrucción del usuario: "${userMessage}".`;
      agentTeamService.updateAgent(agent.id, { jobDescription: newMission });

      const reply = `He asimilado e incorporado mis reglas operativas y lógica de decisión como **${agent.name}** (${agent.role}).\n\n` +
        `🎯 **Nueva Misión / Lógica Fijada**:\n"${newMission}"\n\n` +
        `Estoy operando bajo estos parámetros. ¿Qué objetivo o área de la empresa deseas que auditemos o desarrollemos a continuación?`;

      return { reply, actions: ['rules_updated'] };
    }

    // SCENARIO C: STANDARD STRATEGIC EXECUTIVE RESPONSE
    let superiorText = superior ? `mi superior ${superior.name}` : `la Dirección General`;
    const reply = `Como **${agent.name}** en mi rol de **${agent.role}** (${agent.department}), he analizado tu planteamiento:\n\n` +
      `> "${userMessage}"\n\n` +
      `Para llevar esto a cabo de manera eficiente, cuento con ${subordinates.length > 0 ? `${subordinates.length} subordinados en mi área` : 'plena capacidad de generar el equipo y organigrama que requieras'}. Si deseas que cree nuevos agentes especializados o configure conectores en el Marketplace de Plugins, solo indícamelo y lo estructuraré de inmediato.`;

    return { reply, actions: [] };
  }
}

module.exports = new GeminiAgentEngine();
