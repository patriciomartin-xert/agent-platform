const { GoogleGenAI } = require('@google/generative-ai');
const config = require('../config/config');
const salesforceService = require('./salesforceService');

class GeminiService {
  constructor() {
    this.modelName = 'gemini-1.5-flash';
    if (config.GEMINI_API_KEY) {
      // In @google/generative-ai, we initialize with GoogleGenAI or GoogleGenerativeAI
      // Let's import GoogleGenerativeAI from the SDK safely
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      this.genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);
    }
  }

  // Generate dynamic system prompt for Gemini based on current state and tenant config
  buildSystemPrompt(tenantConfig, sessionState) {
    const { companyName, toneOfVoice, primaryColor, welcomeMessage } = tenantConfig;
    const { phase, name, email } = sessionState;

    // Compile FAQs
    const faqString = (tenantConfig.faqs || [])
      .map(f => `- Q: ${f.question}\n  A: ${f.answer}`)
      .join('\n');

    let phaseInstructions = '';
    if (phase === 'Prospect') {
      phaseInstructions = `
FASE ACTUAL: VENTAS Y PROSPECCIÓN (Prospect)
META DE ESTA FASE: Capturar el interés del usuario, explicar los servicios del catálogo, cotizar y obtener sus datos de contacto (Nombre, Email, Teléfono).
REGLAS:
1. Si el usuario muestra interés y te proporciona su nombre y correo, debes llamar a la función 'createLead'.
2. Al registrar los datos con éxito, puedes indicarle que está listo para avanzar a la fase de 'Onboarding' y llamar a la función 'transitionState' con la fase 'New Customer'.
3. Responde dudas usando únicamente la siguiente base de conocimientos (FAQs):
${faqString}
`;
    } else if (phase === 'New Customer') {
      phaseInstructions = `
FASE ACTUAL: ONBOARDING / ACTIVACIÓN (New Customer)
META DE ESTA FASE: Guiar al nuevo cliente en la configuración de su servicio. Solicitar que comparta o suba su documentación básica (como Identificación oficial o RFC/TaxID).
REGLAS:
1. Pídele al usuario que te indique el nombre de su documento y el contenido/url del mismo para registrarlo.
2. Cuando el usuario te describa o proporcione la información de su documento, llama a la función 'submitOnboardingDocument'.
3. Una vez subida toda la documentación, indícale que su cuenta ha sido activada y transiciona su estado a 'Active Customer' usando la función 'transitionState'.
`;
    } else {
      phaseInstructions = `
FASE ACTUAL: OPERACIONES Y SOPORTE (Active Customer)
META DE ESTA FASE: Resolver dudas del día a día, problemas técnicos o facturación.
REGLAS:
1. Si el usuario tiene una queja o problema técnico que no puedes resolver directamente con las FAQs, ofrécele crear un caso de soporte técnico llamando a la función 'createSupportCase'.
2. Mantén un tono servicial y rápido.
3. Responde dudas usando esta base de conocimientos:
${faqString}
`;
    }

    return `
Eres el Asistente de Journey Único (Kavak-Style) para la empresa "${companyName}".
Tu personalidad y tono de voz debe ser: ${toneOfVoice}.

INFORMACIÓN GENERAL DE LA EMPRESA:
- Marca/Color Primario: ${primaryColor}
- Mensaje de Bienvenida: ${welcomeMessage}

INSTRUCCIONES CLAVE DE DISEÑO:
- Mantén la conversación en un solo hilo. Conoces todo el historial del usuario.
- Adapta tu comportamiento dinámicamente según la fase de journey actual del usuario.

${phaseInstructions}
`;
  }

  // Get tool declarations for Gemini Function Calling
  getTools() {
    return [
      {
        functionDeclarations: [
          {
            name: 'createLead',
            description: 'Registra un prospecto interesado en Salesforce con su nombre, email y teléfono.',
            parameters: {
              type: 'OBJECT',
              properties: {
                name: { type: 'STRING', description: 'Nombre completo del cliente' },
                email: { type: 'STRING', description: 'Correo electrónico' },
                phone: { type: 'STRING', description: 'Número de teléfono (opcional)' }
              },
              required: ['name', 'email']
            }
          },
          {
            name: 'submitOnboardingDocument',
            description: 'Registra y valida un documento oficial cargado por el cliente durante el Onboarding.',
            parameters: {
              type: 'OBJECT',
              properties: {
                documentType: { type: 'STRING', description: 'Tipo de documento (ej: Identificación, RFC, Contrato)' },
                contentSummary: { type: 'STRING', description: 'Descripción o resumen de los datos del documento' }
              },
              required: ['documentType', 'contentSummary']
            }
          },
          {
            name: 'createSupportCase',
            description: 'Genera un ticket o caso de soporte en Salesforce para atención de soporte técnico.',
            parameters: {
              type: 'OBJECT',
              properties: {
                subject: { type: 'STRING', description: 'Asunto de la queja o reporte' },
                description: { type: 'STRING', description: 'Detalle de la falla o requerimiento' }
              },
              required: ['subject', 'description']
            }
          },
          {
            name: 'transitionState',
            description: 'Transiciona formalmente la etapa del Customer Journey del usuario.',
            parameters: {
              type: 'OBJECT',
              properties: {
                nextPhase: { type: 'STRING', enum: ['Prospect', 'New Customer', 'Active Customer'], description: 'Siguiente fase del journey' }
              },
              required: ['nextPhase']
            }
          }
        ]
      }
    ];
  }

  // Execute chat conversation
  async sendMessage(tenantConfig, sessionState, message, chatHistory = []) {
    const systemPrompt = this.buildSystemPrompt(tenantConfig, sessionState);

    // If Gemini key is missing, run simulated NLP agent
    if (!config.GEMINI_API_KEY) {
      return this.simulateAgent(tenantConfig, sessionState, message);
    }

    try {
      const model = this.genAI.getGenerativeModel({
        model: this.modelName,
        systemInstruction: systemPrompt,
        tools: this.getTools()
      });

      // Prepare history format
      const contents = [];
      chatHistory.forEach(msg => {
        contents.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }]
        });
      });
      contents.push({
        role: 'user',
        parts: [{ text: message }]
      });

      const result = await model.generateContent({ contents });
      const response = result.response;
      const text = response.text();
      const functionCalls = response.functionCalls || [];

      return {
        reply: text || 'Procesando...',
        functionCalls: functionCalls.map(call => ({
          name: call.name,
          args: call.args
        }))
      };
    } catch (error) {
      console.error('[Gemini API Error] Fallback to simulator due to:', error.message);
      return this.simulateAgent(tenantConfig, sessionState, message);
    }
  }

  // Robust simulated AI matching customer intent for zero-setup demo
  async simulateAgent(tenantConfig, sessionState, message) {
    const textLower = message.toLowerCase();
    const replyObj = {
      reply: '',
      functionCalls: []
    };

    if (sessionState.phase === 'Prospect') {
      if (textLower.includes('@') && (textLower.includes('correo') || textLower.includes('mail') || textLower.includes('llamo') || textLower.includes('registro') || textLower.includes('interes') || textLower.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/))) {
        // Detect prospective details
        const emailMatch = message.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/);
        const email = emailMatch ? emailMatch[0] : 'prospecto@ejemplo.com';
        const name = message.split(' ').slice(0, 3).join(' ') || 'Cliente Prospecto';
        
        replyObj.reply = `¡Excelente! He registrado tus datos como prospecto interesado en nuestro sistema. Permíteme transferirte a la fase de Onboarding para configurar tus credenciales y subir tus documentos.`;
        replyObj.functionCalls.push({
          name: 'createLead',
          args: { name, email, phone: '555-0199' }
        });
        replyObj.functionCalls.push({
          name: 'transitionState',
          args: { nextPhase: 'New Customer' }
        });
      } else if (textLower.includes('servicio') || textLower.includes('ofrecen') || textLower.includes('precio') || textLower.includes('tarifa')) {
        const faqAnswer = tenantConfig.faqs[0].answer;
        replyObj.reply = `Con gusto te comparto información sobre nuestros servicios. ${faqAnswer} Para darte de alta como cliente, facilítame tu nombre y correo electrónico por favor.`;
      } else {
        replyObj.reply = `Hola, soy el asistente automatizado de ${tenantConfig.companyName}. Estoy en modo simulación (sin API Key de Gemini activa). Cuéntame, ¿te interesaría conocer nuestros servicios? Por favor, compárteme tu nombre y correo para registrarte en Salesforce.`;
      }
    } else if (sessionState.phase === 'New Customer') {
      if (textLower.includes('archivo') || textLower.includes('documento') || textLower.includes('identificacion') || textLower.includes('rfc') || textLower.includes('pdf') || textLower.includes('subo')) {
        replyObj.reply = `¡Perfecto! He recibido tu documento correctamente y lo he guardado en el repositorio seguro. Tu cuenta ha sido activada. ¡Bienvenido oficialmente! Te transiciono a la etapa de Cliente Activo.`;
        replyObj.functionCalls.push({
          name: 'submitOnboardingDocument',
          args: { documentType: 'Identificacion Oficial', contentSummary: 'Contiene ID y firma digitalizada' }
        });
        replyObj.functionCalls.push({
          name: 'transitionState',
          args: { nextPhase: 'Active Customer' }
        });
      } else {
        replyObj.reply = `Actualmente estás en la fase de **Onboarding**. Necesitamos que nos compartas un documento de identificación o RFC para activar tu cuenta. Por favor, escribe algo como: "Aquí está mi identificación oficial en PDF" para registrar tu documento.`;
      }
    } else {
      // Active Customer
      if (textLower.includes('falla') || textLower.includes('soporte') || textLower.includes('problema') || textLower.includes('queja') || textLower.includes('ticket')) {
        replyObj.reply = `Lamento mucho que estés teniendo inconvenientes. He levantado un ticket de soporte técnico inmediato en Salesforce para que uno de nuestros ingenieros lo resuelva a la brevedad.`;
        replyObj.functionCalls.push({
          name: 'createSupportCase',
          args: { subject: 'Falla técnica reportada por chat', description: `Detalle del usuario: "${message}"` }
        });
      } else if (textLower.includes('tarifa') || textLower.includes('envio') || textLower.includes('precio') || textLower.includes('rastreo')) {
        replyObj.reply = `Claro, te asisto con gusto. Según nuestras políticas: ${tenantConfig.faqs[2].answer}`;
      } else {
        replyObj.reply = `Hola de nuevo. Estás en la etapa de **Cliente Activo**. Puedo ayudarte a resolver dudas operativas o levantar tickets de soporte. ¿En qué te asisto hoy?`;
      }
    }

    return replyObj;
  }
}

module.exports = new GeminiService();
