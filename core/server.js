const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const path = require('path');
const config = require('./src/config/config');
const chatController = require('./src/controllers/chatController');
const grokBotController = require('./src/controllers/grokBotController');
const stateMachine = require('./src/state/stateMachine');
const agentTeamService = require('./src/services/agentTeamService');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Serve static dashboard files
app.use(express.static(path.join(__dirname, '../dashboard')));

// Legacy & Tenant Routes
app.get('/api/config', (req, res) => chatController.getTenantBranding(req, res));
app.post('/api/chat', (req, res) => chatController.handleChat(req, res));
app.get('/api/tenants', (req, res) => chatController.listTenants(req, res));
app.post('/api/meta/consult', (req, res) => chatController.runConsultingProcess(req, res));

// Grok Bot Persistent Multi-Agent API Routes
app.get('/api/grok/agents', (req, res) => grokBotController.getAgents(req, res));
app.post('/api/grok/agents', (req, res) => grokBotController.createAgent(req, res));
app.patch('/api/grok/agents/:id', (req, res) => grokBotController.updateAgent(req, res));
app.post('/api/grok/agents/:id', (req, res) => grokBotController.updateAgent(req, res));
app.patch('/api/grok/agents/:id/hierarchy', (req, res) => grokBotController.updateHierarchy(req, res));
app.post('/api/grok/agents/:id/hierarchy', (req, res) => grokBotController.updateHierarchy(req, res));
app.post('/api/grok/agents/:id/toggle-plugin', (req, res) => grokBotController.toggleAgentPlugin(req, res));
app.delete('/api/grok/agents/:id', (req, res) => grokBotController.deleteAgent(req, res));

app.get('/api/grok/plugins', (req, res) => grokBotController.getPlugins(req, res));
app.patch('/api/grok/plugins/:id', (req, res) => grokBotController.updatePlugin(req, res));

app.get('/api/grok/channels', (req, res) => grokBotController.getChannels(req, res));
app.post('/api/grok/channels', (req, res) => grokBotController.createChannel(req, res));

app.get('/api/grok/routines', (req, res) => grokBotController.getRoutines(req, res));
app.post('/api/grok/routines', (req, res) => grokBotController.createRoutine(req, res));
app.post('/api/grok/routines/:id/run', (req, res) => grokBotController.executeRoutine(req, res));

app.get('/api/grok/inter-agent-logs', (req, res) => grokBotController.getInterAgentLogs(req, res));
app.get('/api/grok/expenses', (req, res) => grokBotController.getExpenses(req, res));
app.post('/api/grok/chat', (req, res) => grokBotController.handleChat(req, res));

// AI Engine Configuration & Test routes
app.get('/api/grok/config/ai', (req, res) => grokBotController.getAiConfig(req, res));
app.post('/api/grok/config/ai', (req, res) => grokBotController.updateAiConfig(req, res));
app.post('/api/grok/config/ai/test', (req, res) => grokBotController.testAiConnection(req, res));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Manage active WebSocket monitor clients
const monitors = new Set();

wss.on('connection', (ws) => {
  console.log('[WebSocket] Grok Bot Live Client Connected.');
  monitors.add(ws);

  // Send initial state with agents, channels, and routines
  ws.send(JSON.stringify({
    event: 'grok_initial_state',
    agents: Object.values(agentTeamService.getAllAgents()),
    channels: agentTeamService.getAllChannels(),
    routines: agentTeamService.getAllRoutines(),
    expenses: agentTeamService.getAllExpenses(),
    plugins: agentTeamService.getAllPlugins(),
    interAgentLogs: agentTeamService.getInterAgentLogs()
  }));

  ws.on('close', () => {
    console.log('[WebSocket] Grok Bot Client Disconnected.');
    monitors.delete(ws);
  });
});

// Broadcast helper
const broadcastToAll = (payload) => {
  const json = JSON.stringify(payload);
  for (const client of monitors) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(json);
    }
  }
};

// Hook up stateMachine broadcaster
stateMachine.setBroadcaster(broadcastToAll);

// Hook up agentTeamService broadcaster
agentTeamService.setBroadcaster(broadcastToAll);

// Start listening
server.listen(config.PORT, () => {
  console.log(`=============================================================`);
  console.log(`🚀 Grok Bot Persistent Multi-Agent OS active on port ${config.PORT}`);
  console.log(`🔗 Agents API: http://localhost:${config.PORT}/api/grok/agents`);
  console.log(`📊 Desktop App: http://localhost:${config.PORT}`);
  console.log(`=============================================================`);
});
