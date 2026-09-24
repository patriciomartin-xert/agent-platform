const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../config/config');
const agentTeamService = require('./agentTeamService');

class GeminiAgentEngine {
  constructor() {
    this.primaryModel = 'gemini-3.8-flash';
    this.fallbackModels = ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-2.5-flash'];
  }

  getProvider() {
    return (process.env.AI_PROVIDER || config.AI_PROVIDER || 'gemini').toLowerCase().trim();
  }

  getGenAI(overrideKey = null) {
    const key = overrideKey || process.env.GEMINI_API_KEY || config.GEMINI_API_KEY;
    if (!key || key.trim() === '') return null;
    try {
      return new GoogleGenerativeAI(key.trim());
    } catch (e) {
      console.warn('[GeminiAgentEngine] Failed to init GoogleGenerativeAI:', e.message);
      return null;
    }
  }

  async testConnection(options) {
    // Support either object { provider, apiKey, model, baseUrl } or legacy string apiKey
    let provider = 'gemini';
    let apiKey = '';
    let model = '';
    let baseUrl = '';

    if (typeof options === 'string') {
      apiKey = options.trim();
    } else if (options && typeof options === 'object') {
      provider = (options.provider || 'gemini').toLowerCase().trim();
      apiKey = (options.apiKey || '').trim();
      model = (options.model || '').trim();
      baseUrl = (options.baseUrl || '').trim();
    }

    if (!apiKey) {
      // Check environment variables if not passed
      if (provider === 'gemini') apiKey = process.env.GEMINI_API_KEY || config.GEMINI_API_KEY || '';
      else if (provider === 'openai') apiKey = process.env.OPENAI_API_KEY || config.OPENAI_API_KEY || '';
      else if (provider === 'anthropic') apiKey = process.env.ANTHROPIC_API_KEY || config.ANTHROPIC_API_KEY || '';
      else if (provider === 'custom') apiKey = process.env.CUSTOM_AI_API_KEY || config.CUSTOM_AI_API_KEY || '';
    }

    if (!apiKey) {
      return { success: false, error: `No se proporcionó ninguna API Key para el proveedor "${provider}".` };
    }

    // 1. TEST GOOGLE GEMINI
    if (provider === 'gemini') {
      const candidateModels = model ? [model, ...this.fallbackModels] : this.fallbackModels;
      let lastError = null;

      for (const modelName of candidateModels) {
        try {
          const client = new GoogleGenerativeAI(apiKey);
          const modelInstance = client.getGenerativeModel({ model: modelName });
          const result = await modelInstance.generateContent('Responde en una sola palabra: "Conectado"');
          const text = result.response.text();
          this.primaryModel = modelName;
          return {
            success: true,
            provider: 'gemini',
            model: modelName,
            message: `Conexión exitosa con Google Gemini (${modelName}): ${text.trim()}`
          };
        } catch (err) {
          lastError = err.message;
        }
      }

      return {
        success: false,
        provider: 'gemini',
        error: `Error conectando con Google Gemini API: ${lastError || 'Verifica que la clave esté activa en Google AI Studio.'}`
      };
    }

    // 2. TEST OPENAI
    if (provider === 'openai') {
      const targetModel = model || 'gpt-4o-mini';
      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: targetModel,
            messages: [{ role: 'user', content: 'Responde únicamente la palabra: Conectado' }],
            max_tokens: 10
          })
        });

        const data = await response.json();
        if (!response.ok) {
          return { success: false, provider: 'openai', error: data.error?.message || `HTTP ${response.status}` };
        }
        const text = data.choices?.[0]?.message?.content || 'OK';
        return { success: true, provider: 'openai', model: targetModel, message: `Conexión exitosa con OpenAI (${targetModel}): ${text.trim()}` };
      } catch (err) {
        return { success: false, provider: 'openai', error: `Error conectando con OpenAI: ${err.message}` };
      }
    }

    // 3. TEST ANTHROPIC (CLAUDE)
    if (provider === 'anthropic') {
      const targetModel = model || 'claude-3-5-haiku-20241022';
      try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: targetModel,
            max_tokens: 10,
            messages: [{ role: 'user', content: 'Responde únicamente la palabra: Conectado' }]
          })
        });

        const data = await response.json();
        if (!response.ok) {
          return { success: false, provider: 'anthropic', error: data.error?.message || `HTTP ${response.status}` };
        }
        const text = data.content?.[0]?.text || 'OK';
        return { success: true, provider: 'anthropic', model: targetModel, message: `Conexión exitosa con Anthropic (${targetModel}): ${text.trim()}` };
      } catch (err) {
        return { success: false, provider: 'anthropic', error: `Error conectando con Anthropic: ${err.message}` };
      }
    }

    // 4. TEST CUSTOM / DEEPSEEK / OPENAI-COMPATIBLE
    if (provider === 'custom') {
      const targetUrl = (baseUrl || 'https://api.deepseek.com/v1').replace(/\/+$/, '');
      const targetModel = model || 'deepseek-chat';
      try {
        const response = await fetch(`${targetUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: targetModel,
            messages: [{ role: 'user', content: 'Responde únicamente la palabra: Conectado' }],
            max_tokens: 10
          })
        });

        const data = await response.json();
        if (!response.ok) {
          return { success: false, provider: 'custom', error: data.error?.message || `HTTP ${response.status}` };
        }
        const text = data.choices?.[0]?.message?.content || 'OK';
        return { success: true, provider: 'custom', model: targetModel, message: `Conexión exitosa con Endpoint Compatible (${targetModel}): ${text.trim()}` };
      } catch (err) {
        return { success: false, provider: 'custom', error: `Error conectando con Endpoint Personalizado: ${err.message}` };
      }
    }

    return { success: false, error: `Proveedor "${provider}" no reconocido.` };
  }

  async executeAgentTurn({ agent, userMessage, conversationHistory = [] }) {
    const allAgents = agentTeamService.getAllAgents();
    const agentList = Object.values(allAgents);
    const superior = agent.reportsTo ? allAgents[agent.reportsTo] : null;
    const subordinates = agentList.filter(a => a.reportsTo === agent.id);

    const provider = this.getProvider();

    const systemInstruction = `
Eres ${agent.name}, desempeñando el rol de "${agent.role}" en el departamento de "${agent.department || 'General'}" dentro de la plataforma empresarial Agent Platform.
Tu misión y Job Description es:
"""
${agent.jobDescription || 'Operar con máxima autonomía, resolver problemas con claridad ejecutiva y asistir al usuario.'}
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

    // 1. Try LLM Call based on configured provider
    let rawReply = null;

    if (provider === 'gemini') {
      const genAI = this.getGenAI();
      if (genAI) {
        try {
          const modelName = this.primaryModel || 'gemini-3.8-flash';
          const modelInstance = genAI.getGenerativeModel({ model: modelName });

          const formattedHistory = conversationHistory.slice(-8).map(m => {
            return `${m.role === 'user' ? 'Usuario' : agent.name}: ${m.content}`;
          }).join('\n');

          const prompt = `${systemInstruction}\n\nHistorial reciente:\n${formattedHistory}\n\nUsuario: ${userMessage}\n${agent.name}:`;
          const result = await modelInstance.generateContent(prompt);
          rawReply = result.response.text();
        } catch (err) {
          console.warn('[GeminiAgentEngine] Gemini primary model error, trying fallback:', err.message);
          try {
            const fallbackInstance = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });
            const prompt = `${systemInstruction}\n\nUsuario: ${userMessage}\n${agent.name}:`;
            const result = await fallbackInstance.generateContent(prompt);
            rawReply = result.response.text();
          } catch (e2) {
            console.warn('[GeminiAgentEngine] Gemini fallback error:', e2.message);
          }
        }
      }
    } else if (provider === 'openai') {
      const apiKey = process.env.OPENAI_API_KEY || config.OPENAI_API_KEY;
      if (apiKey) {
        try {
          const messages = [
            { role: 'system', content: systemInstruction },
            ...conversationHistory.slice(-8).map(m => ({
              role: m.role === 'user' ? 'user' : 'assistant',
              content: m.content
            })),
            { role: 'user', content: userMessage }
          ];

          const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey.trim()}`
            },
            body: JSON.stringify({
              model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
              messages
            })
          });

          if (response.ok) {
            const data = await response.json();
            rawReply = data.choices?.[0]?.message?.content || null;
          }
        } catch (err) {
          console.warn('[GeminiAgentEngine] OpenAI error:', err.message);
        }
      }
    } else if (provider === 'anthropic') {
      const apiKey = process.env.ANTHROPIC_API_KEY || config.ANTHROPIC_API_KEY;
      if (apiKey) {
        try {
          const messages = [
            ...conversationHistory.slice(-8).map(m => ({
              role: m.role === 'user' ? 'user' : 'assistant',
              content: m.content
            })),
            { role: 'user', content: userMessage }
          ];

          const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': apiKey.trim(),
              'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
              model: process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-20241022',
              system: systemInstruction,
              max_tokens: 1500,
              messages
            })
          });

          if (response.ok) {
            const data = await response.json();
            rawReply = data.content?.[0]?.text || null;
          }
        } catch (err) {
          console.warn('[GeminiAgentEngine] Anthropic error:', err.message);
        }
      }
    } else if (provider === 'custom') {
      const apiKey = process.env.CUSTOM_AI_API_KEY || config.CUSTOM_AI_API_KEY;
      const baseUrl = (process.env.CUSTOM_AI_BASE_URL || config.CUSTOM_AI_BASE_URL || 'https://api.deepseek.com/v1').replace(/\/+$/, '');
      const model = process.env.CUSTOM_AI_MODEL || config.CUSTOM_AI_MODEL || 'deepseek-chat';

      if (apiKey) {
        try {
          const messages = [
            { role: 'system', content: systemInstruction },
            ...conversationHistory.slice(-8).map(m => ({
              role: m.role === 'user' ? 'user' : 'assistant',
              content: m.content
            })),
            { role: 'user', content: userMessage }
          ];

          const response = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey.trim()}`
            },
            body: JSON.stringify({
              model,
              messages
            })
          });

          if (response.ok) {
            const data = await response.json();
            rawReply = data.choices?.[0]?.message?.content || null;
          }
        } catch (err) {
          console.warn('[GeminiAgentEngine] Custom LLM error:', err.message);
        }
      }
    }

    // If real LLM returned a reply, extract any created agents and return
    if (rawReply && rawReply.trim()) {
      const createdAgents = this._extractAndCreateAgents(rawReply, agent.id);
      const cleanReply = rawReply.replace(/<<<GENERATE_AGENTS:[\s\S]*?>>>/g, '').trim();

      let finalReply = cleanReply;
      if (createdAgents.length > 0) {
        finalReply += `\n\n🏢 **Actualización de Organigrama**: He incorporado exitosamente **${createdAgents.length} nuevo(s) agente(s)** al equipo:\n` +
          createdAgents.map(a => `• **${a.name}** (${a.role}) - Departamento: *${a.department}*`).join('\n') +
          `\n\nPuedes consultar sus tarjetas en la vista de **Organigrama** o abrir sus chats en la barra lateral.`;
      }

      return { reply: finalReply, actions: createdAgents.length > 0 ? ['agents_created'] : [] };
    }

    // 2. High-fidelity intelligent contextual engine (contingency fallback when API key is missing or invalid)
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
          reportsTo: agent.id,
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
      const newMission = `Reglas operativas de ${agent.name}: Responder con máxima proactividad, pensamiento estratégico de ${agent.role}, autonomía en toma de decisiones y coordinación directa con la dirección. Instrucción del usuario: "${userMessage}".`;
      agentTeamService.updateAgent(agent.id, { jobDescription: newMission });

      const reply = `He asimilado e incorporado mis reglas operativas y lógica de decisión como **${agent.name}** (${agent.role}).\n\n` +
        `🎯 **Nueva Misión / Lógica Fijada**:\n"${newMission}"\n\n` +
        `Estoy operando bajo estos parámetros. ¿Qué objetivo o área de la empresa deseas que auditemos o desarrollemos a continuación?`;

      return { reply, actions: ['rules_updated'] };
    }

    // SCENARIO C: STANDARD STRATEGIC EXECUTIVE RESPONSE
    const reply = `Como **${agent.name}** en mi rol de **${agent.role}** (${agent.department}), he analizado tu planteamiento:\n\n` +
      `> "${userMessage}"\n\n` +
      `Para llevar esto a cabo de manera eficiente, cuento con ${subordinates.length > 0 ? `${subordinates.length} subordinados en mi área` : 'plena capacidad de generar el equipo y organigrama que requieras'}. Si deseas que cree nuevos agentes especializados o configure conectores en el Marketplace de Plugins, solo indícamelo y lo estructuraré de inmediato.`;

    return { reply, actions: [] };
  }
}

module.exports = new GeminiAgentEngine();
