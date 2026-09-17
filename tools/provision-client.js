const fs = require('fs');
const path = require('path');

const tenantId = process.argv[2];
if (!tenantId) {
  console.log('Error: Debes proporcionar un ID de tenant. Ej: node provision-client.js barberia-express');
  process.exit(1);
}

const targetDir = path.join(__dirname, '../agents-repo', tenantId);

if (fs.existsSync(targetDir)) {
  console.log(`El Tenant "${tenantId}" ya existe.`);
  process.exit(0);
}

fs.mkdirSync(targetDir, { recursive: true });

const rulesTemplate = {
  stages: {
    Prospect: {
      name: `Ventas - ${tenantId}`,
      goals: ["Explicar precios", "Obtener correo de contacto"],
      prompt_instructions: "Sé muy cordial y enfocado en cerrar citas."
    },
    "New Customer": {
      name: `Onboarding - ${tenantId}`,
      goals: ["Solicitar comprobante de pago"],
      prompt_instructions: "Asiste en el registro de su primera compra."
    },
    "Active Customer": {
      name: `Soporte - ${tenantId}`,
      goals: ["Resolver dudas"],
      prompt_instructions: "Atiende con rapidez."
    }
  }
};

const configTemplate = {
  features: {
    salesforce_sync: true,
    document_uploads: true,
    dashboard_telemetry: true
  },
  allowed_documents: ["Identificacion", "Comprobante de Pago"]
};

fs.writeFileSync(path.join(targetDir, 'rules.json'), JSON.stringify(rulesTemplate, null, 2));
fs.writeFileSync(path.join(targetDir, 'config.json'), JSON.stringify(configTemplate, null, 2));

console.log(`===================================================`);
console.log(`✅ ¡Tenant "${tenantId}" aprovisionado con éxito!`);
console.log(`📂 Ruta: agents-repo/${tenantId}/`);
console.log(`👉 ¡Puedes agregarlo en el dashboard o consultarlo mediante la API!`);
console.log(`===================================================`);
