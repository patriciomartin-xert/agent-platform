const fs = require('fs');
const path = require('path');
const config = require('../config/config');

// In-memory simulated sheets DB for mock mode
const mockSheetsDatabase = {
  'mi-empresa': {
    branding: {
      tenantId: 'mi-empresa',
      companyName: 'Pilot Logistics Corp',
      primaryColor: '#004B87',
      secondaryColor: '#FF6B35',
      logoUrl: 'https://cdn-icons-png.flaticon.com/512/2850/2850555.png',
      toneOfVoice: 'Empático, formal, altamente profesional y de negocios.',
      welcomeMessage: '¡Hola! Bienvenido al canal inteligente de Pilot Logistics Corp. ¿En qué podemos ayudarte hoy?'
    },
    faqs: [
      { question: '¿Qué servicios ofrecen?', answer: 'Ofrecemos transporte marítimo, aéreo, consolidación de carga y despachos aduaneros.' },
      { question: '¿Cuáles son las tarifas base?', answer: 'La tarifa base para carga consolidada nacional inicia en $150 USD por metro cúbico.' },
      { question: '¿Cómo rastreo mi envío?', answer: 'Puedes rastrearlo a través de nuestra consola de operaciones usando tu ID de guía único.' }
    ]
  },
  'clinica-dental': {
    branding: {
      tenantId: 'clinica-dental',
      companyName: 'DentisSmile',
      primaryColor: '#14B8A6',
      secondaryColor: '#F43F5E',
      logoUrl: 'https://cdn-icons-png.flaticon.com/512/3467/3467831.png',
      toneOfVoice: 'Cálido, amigable, tranquilizador y muy claro.',
      welcomeMessage: '¡Hola! Bienvenido a DentisSmile. Estamos aquí para cuidar de tu sonrisa. ¿Deseas agendar una cita de valoración?'
    },
    faqs: [
      { question: '¿Cuál es el horario de atención?', answer: 'Atendemos de Lunes a Viernes de 8:00 AM a 8:00 PM, y Sábados de 9:00 AM a 2:00 PM.' },
      { question: '¿Aceptan seguros de gastos médicos?', answer: 'Sí, trabajamos con MetLife, AXA, Seguros Monterrey y GNP.' },
      { question: '¿Tienen financiamiento?', answer: 'Sí, ofrecemos hasta 12 meses sin intereses en tratamientos de ortodoncia e implantes.' }
    ]
  }
};

class SheetsService {
  async getTenantConfig(tenantId) {
    if (config.IS_MOCK_SHEETS) {
      const data = mockSheetsDatabase[tenantId] || mockSheetsDatabase['mi-empresa'];
      // Try reading rules files if available in agents-repo
      try {
        const repoPath = path.join(__dirname, '..', '..', '..', 'agents-repo', tenantId);
        if (fs.existsSync(repoPath)) {
          const rules = JSON.parse(fs.readFileSync(path.join(repoPath, 'rules.json'), 'utf8'));
          const configJson = JSON.parse(fs.readFileSync(path.join(repoPath, 'config.json'), 'utf8'));
          return {
            ...data.branding,
            faqs: data.faqs,
            rules,
            config: configJson
          };
        }
      } catch (err) {
        // Fallback silently to mock properties
      }
      return {
        ...data.branding,
        faqs: data.faqs
      };
    }

    // Dynamic Google Sheet API logic here
    // In production, you would authenticate using config.GOOGLE_SERVICE_ACCOUNT_KEY
    // and read specific sheet cells for colors, logos, and sheet tables for FAQs.
    console.log(`[Sheets API] Fetching dynamic sheet data for tenant: ${tenantId}`);
    return mockSheetsDatabase[tenantId] || mockSheetsDatabase['mi-empresa'];
  }
}

module.exports = new SheetsService();
