const http = require('http');

const sessionId = `test_flow_${Math.floor(Math.random() * 10000)}`;
const tenantId = 'mi-empresa';

const prompts = [
  { desc: "Preguntar sobre servicios y precios", msg: "Hola, ¿qué servicios ofrecen y cuáles son sus tarifas base?" },
  { desc: "Compartir datos de contacto para registro", msg: "Me interesa bastante, me llamo Patricio Martín y mi correo es patricio@ejemplo.com" },
  { desc: "Subir documento en etapa Onboarding", msg: "Aquí está mi Identificación Oficial en formato PDF para activar mi cuenta" },
  { desc: "Reportar una incidencia como Cliente Activo", msg: "Hola, tengo un problema técnico con la guía de rastreo que no se actualiza" }
];

function sendChat(message) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ sessionId, tenantId, message });
    
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/chat',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => resolve(JSON.parse(body)));
    });

    req.on('error', (err) => reject(err));
    req.write(data);
    req.end();
  });
}

async function runTest() {
  console.log(`=============================================================`);
  console.log(`🧪 Iniciando simulación de Customer Journey para el ID: ${sessionId}`);
  console.log(`=============================================================`);

  for (let i = 0; i < prompts.length; i++) {
    const step = prompts[i];
    console.log(`\n[Paso ${i + 1}] ${step.desc}`);
    console.log(`👤 Usuario: "${step.msg}"`);
    
    try {
      const res = await sendChat(step.msg);
      if (res.success) {
        console.log(`🤖 Agente: "${res.reply}"`);
        console.log(`⚙️  Fase Resultante: ${res.phase}`);
        if (res.executedTools && res.executedTools.length > 0) {
          console.log(`🛠️  Herramientas Ejecutadas: [${res.executedTools.join(', ')}]`);
        }
      } else {
        console.log(`❌ Error:`, res.error);
      }
    } catch (err) {
      console.log(`❌ Error de conexión (¿está el servidor encendido?):`, err.message);
      break;
    }
    
    // Brief sleep between steps
    await new Promise(r => setTimeout(resolve => r(), 1500));
  }
  console.log(`\n=============================================================`);
  console.log(`✅ Simulación completada.`);
  console.log(`=============================================================`);
}

// Check if running directly
runTest();
