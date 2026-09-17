# OmniJourney AI: Master Context & Architecture Blueprint

OmniJourney AI es una plataforma SaaS Marca Blanca (White-Label) diseñada para la gestión de **Agentes de IA Transversales para PyMEs (SMBs)**. A diferencia de los chatbots tradicionales que aíslan la comunicación en silos, OmniJourney AI unifica todo el ciclo de vida del cliente en un **único hilo conversacional** que adapta dinámicamente sus reglas de comportamiento, tono y herramientas según la etapa del Customer Journey en la que se encuentra el usuario.

## 🚀 Arquitectura del Proyecto

```
omnijourney-platform/
├── core/                              # Backend central (Express/Node.js + WebSockets)
│   ├── src/
│   │   ├── config/                    # Configuración de entorno y estados mock
│   │   ├── controllers/               # Control de chat y configuraciones de Tenants
│   │   ├── services/                  # Servicios (Gemini SDK, Sheets API, Salesforce API)
│   │   └── state/                     # Máquina de estados del Customer Journey
│   └── server.js                      # Servidor HTTP & WebSocket
├── dashboard/                         # Consola de control en tiempo real (Tailwind CSS)
│   ├── index.html                     # Tablero de telemetría y transcripción de chats
│   └── js/
│       └── widget.js                  # Widget de chat flotante White-Label embebible
├── agents-repo/                       # Repositorio estático de configuraciones
│   ├── template/                      # Esquemas base de estados y herramientas
│   └── mi-empresa/                    # Configuración del piloto corporativo
└── tools/                             # Scripts de automatización y pruebas
    ├── provision-client.js            # Script para dar de alta nuevos Tenants
    └── test-flows.js                  # Simulador de flujos de conversación
```

## 🧠 Máquina de Estados del Journey (Customer State Machine)

El motor central rastrea y actualiza la fase de relación con el cliente:
1. **Fase de Ventas & Prospección (Prospect)**: Captura interés, explica servicios y guarda prospectos (`createLead`) en Salesforce.
2. **Fase de Onboarding/Activación (New Customer)**: Solicita e identifica documentos oficiales del cliente (`submitOnboardingDocument`).
3. **Fase de Operaciones & Soporte (Active Customer)**: Resuelve consultas operativas y abre tickets de incidencia técnica (`createSupportCase`).

---

## 💻 Guía de Inicio Rápido

### 1. Instalación de dependencias
Entra al directorio del backend e instala las dependencias de Node.js:
```bash
cd core
npm install
```

### 2. Configurar el Entorno
Copia el archivo de ejemplo para crear tu configuración:
```bash
cp ../.env.example ../.env
```
*(Nota: Si dejas `GEMINI_API_KEY` vacío, el sistema activará automáticamente el **Modo Simulador de IA**, lo que te permite probar y demostrar todas las fases de la máquina de estados y las llamadas a funciones de Salesforce inmediatamente sin costo alguno).*

### 3. Lanzar el Servidor
Inicia la plataforma ejecutando:
```bash
npm start
```

### 4. Abrir la Consola de Monitoreo
Simplemente abre el archivo del panel de control en tu navegador preferido:
`dashboard/index.html`

Desde aquí podrás interactuar con el widget de chat flotante (marca blanca), cambiar de Tenants al vuelo para ver los cambios de branding instantáneos, y observar los flujos de transición del Customer Journey en tiempo real por WebSockets.
