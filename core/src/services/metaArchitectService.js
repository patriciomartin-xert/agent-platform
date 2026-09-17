const config = require('../config/config');

class MetaArchitectService {
  async generateAgentConfig(consultingAnswers) {
    const {
      companyName,
      businessArea,
      welcomeMessage,
      faqsInput,
      onboardingDocs,
      crmTool,
      primaryColor,
      toneSelect
    } = consultingAnswers;

    const tenantId = companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    // Default branding
    const hexColor = primaryColor || '#4F46E5';
    const toneOfVoice = toneSelect || 'Empático, servicial y resolutivo.';
    const welcome = welcomeMessage || `¡Hola! Bienvenido al canal inteligente de ${companyName}. ¿En qué te asisto hoy?`;

    // FAQs list parsing
    const parsedFaqs = [];
    if (faqsInput && faqsInput.trim()) {
      const lines = faqsInput.split('\n');
      for (const line of lines) {
        if (line.includes('|')) {
          const parts = line.split('|');
          parsedFaqs.push({ question: parts[0].trim(), answer: parts[1].trim() });
        }
      }
    }
    // Fallback standard FAQs
    if (parsedFaqs.length === 0) {
      parsedFaqs.push(
        { question: '¿Cuáles son los costos?', answer: `Varían según el servicio de ${businessArea}. Solicita una cotización enviando tus datos.` },
        { question: '¿Cómo funciona?', answer: `Te registramos como prospecto, completas tu onboarding de documentos y activamos tu cuenta para soporte continuo.` }
      );
    }

    const docList = onboardingDocs ? onboardingDocs.split(',').map(d => d.trim()) : ['Identificacion Oficial', 'RFC'];

    // 1. If Gemini key is present, generate high-fidelity config using AI
    if (config.GEMINI_API_KEY) {
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

      const prompt = `
Eres un Arquitecto de Soluciones de IA Experto (Meta-Agent). Tu tarea es sintetizar una configuración completa para un agente de IA transversal (Kavak-Style) basado en la siguiente información de consultoría de una empresa:

Nombre de la Empresa: ${companyName}
Giro del Negocio: ${businessArea}
Tono de voz: ${toneOfVoice}
CRM / Integraciones: ${crmTool}
Documentos para Onboarding: ${docList.join(', ')}

Genera una respuesta en formato JSON puro. No incluyas explicaciones ni marcas de markdown como \`\`\`json. El JSON debe cumplir exactamente con esta estructura:
{
  "rules": {
    "stages": {
      "Prospect": {
        "name": "Nombre de etapa de ventas adaptado a esta empresa",
        "goals": ["Meta 1", "Meta 2"],
        "prompt_instructions": "Instrucción de comportamiento específica de ventas para esta empresa"
      },
      "New Customer": {
        "name": "Nombre de etapa de onboarding adaptado a esta empresa",
        "goals": ["Meta 1", "Meta 2"],
        "prompt_instructions": "Instrucción de comportamiento específica de onboarding para esta empresa"
      },
      "Active Customer": {
        "name": "Nombre de etapa de soporte adaptado a esta empresa",
        "goals": ["Meta 1", "Meta 2"],
        "prompt_instructions": "Instrucción de comportamiento específica de soporte para esta empresa"
      }
    }
  }
}
`;

      try {
        const result = await model.generateContent({ contents: [{ role: 'user', parts: [{ text: prompt }] }] });
        const text = result.response.text().trim();
        // Remove potential markdown code blocks
        const jsonString = text.replace(/```json|```/g, '').trim();
        const aiRules = JSON.parse(jsonString);

        return {
          tenantId,
          companyName,
          primaryColor: hexColor,
          secondaryColor: '#1E293B',
          logoUrl: 'https://cdn-icons-png.flaticon.com/512/4712/4712035.png',
          toneOfVoice,
          welcomeMessage: welcome,
          faqs: parsedFaqs,
          rules: aiRules.rules,
          config: {
            features: {
              salesforce_sync: true,
              document_uploads: true,
              dashboard_telemetry: true
            },
            allowed_documents: docList
          }
        };
      } catch (err) {
        console.error('[MetaArchitectService] AI Generation failed, falling back to rule-based engine:', err);
      }
    }

    // 2. Rule-based custom config synthesizer for Mock Mode
    console.log('[MetaArchitectService] Generating config using deterministic business rule-based synthesis engine.');
    return {
      tenantId,
      companyName,
      primaryColor: hexColor,
      secondaryColor: '#1E293B',
      logoUrl: 'https://cdn-icons-png.flaticon.com/512/4712/4712035.png',
      toneOfVoice,
      welcomeMessage: welcome,
      faqs: parsedFaqs,
      rules: {
        stages: {
          Prospect: {
            name: `Descubrimiento & Cotización (${companyName})`,
            goals: [`Presentar ventajas de ${businessArea}`, "Estimar tarifas iniciales", "Guardar prospecto"],
            prompt_instructions: `Habla en tono ${toneOfVoice}. Posiciónanos como el mejor proveedor de ${businessArea}. Consigue que compartan su nombre e email para agendar demo.`
          },
          "New Customer": {
            name: `Onboarding & Configuración (${companyName})`,
            goals: docList.map(doc => `Solicitar y archivar ${doc}`),
            prompt_instructions: `Asiste al nuevo usuario en la configuración inicial. Solicita los documentos indispensables: ${docList.join(', ')}.`
          },
          "Active Customer": {
            name: `Centro de Operaciones y Soporte (${companyName})`,
            goals: ["Resolver dudas operativas", `Levantar tickets en ${crmTool}`],
            prompt_instructions: `Resuelve incidencias técnicas de forma ágil y transparente. Si hay una falla grave de soporte, regístrala.`
          }
        }
      },
      config: {
        features: {
          salesforce_sync: true,
          document_uploads: true,
          dashboard_telemetry: true
        },
        allowed_documents: docList
      }
    };
  }
}

module.exports = new MetaArchitectService();
