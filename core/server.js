const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const path = require('path');
const config = require('./src/config/config');
const chatController = require('./src/controllers/chatController');
const stateMachine = require('./src/state/stateMachine');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Serve static dashboard files
app.use(express.static(path.join(__dirname, '../dashboard')));

// API Routes
app.get('/api/config', (req, res) => chatController.getTenantBranding(req, res));
app.post('/api/chat', (req, res) => chatController.handleChat(req, res));
app.get('/api/tenants', (req, res) => chatController.listTenants(req, res));
app.post('/api/meta/consult', (req, res) => chatController.runConsultingProcess(req, res));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Manage active WebSocket monitor clients
const monitors = new Set();

wss.on('connection', (ws) => {
  console.log('[WebSocket] Live Monitor Console Connected.');
  monitors.add(ws);

  // Send current active sessions and initial state on connection
  ws.send(JSON.stringify({
    event: 'initial_state',
    sessions: Object.values(stateMachine.sessions).map(s => ({
      sessionId: s.sessionId,
      tenantId: s.tenantId,
      phase: s.phase,
      name: s.name,
      email: s.email,
      lastSentiment: s.lastSentiment,
      historyCount: s.history.length,
      updatedAt: s.updatedAt
    }))
  }));

  ws.on('close', () => {
    console.log('[WebSocket] Live Monitor Console Disconnected.');
    monitors.delete(ws);
  });
});

// Configure StateMachine to broadcast events through our WebSocket connections
stateMachine.setBroadcaster((data) => {
  const payload = JSON.stringify(data);
  for (const monitor of monitors) {
    if (monitor.readyState === WebSocket.OPEN) {
      monitor.send(payload);
    }
  }
});

// Start listening
server.listen(config.PORT, () => {
  console.log(`=============================================================`);
  console.log(`🚀 OmniJourney Studio SaaS Factory active on port ${config.PORT}`);
  console.log(`🔗 API Config: http://localhost:${config.PORT}/api/config`);
  console.log(`📊 Studio Console: Open c:/Users/Patricio Martin/Documents/ANTIGRAVITY/Proyectos Eirs/AGENT PLATFORM/dashboard/index.html`);
  console.log(`=============================================================`);
});
