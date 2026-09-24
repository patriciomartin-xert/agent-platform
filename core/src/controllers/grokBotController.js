const agentTeamService = require('../services/agentTeamService');
const grokOrchestratorService = require('../services/grokOrchestratorService');

class GrokBotController {
  // Get all agents
  async getAgents(req, res) {
    try {
      const agents = agentTeamService.getAllAgents();
      return res.json({ success: true, agents: Object.values(agents) });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // Create an agent from scratch
  async createAgent(req, res) {
    try {
      const newAgent = agentTeamService.createAgent(req.body);
      return res.json({ success: true, agent: newAgent });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // Update an agent
  async updateAgent(req, res) {
    try {
      const updated = agentTeamService.updateAgent(req.params.id, req.body);
      if (!updated) return res.status(404).json({ success: false, error: 'Agent not found' });
      return res.json({ success: true, agent: updated });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // Update organigram hierarchy link
  async updateHierarchy(req, res) {
    try {
      const { reportsTo } = req.body;
      const updated = agentTeamService.updateAgentHierarchy(req.params.id, reportsTo);
      if (!updated) return res.status(404).json({ success: false, error: 'Agent not found' });
      return res.json({ success: true, agent: updated });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // Delete an agent
  async deleteAgent(req, res) {
    try {
      const ok = agentTeamService.deleteAgent(req.params.id);
      return res.json({ success: ok });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // Get channels / departments
  async getChannels(req, res) {
    try {
      const channels = agentTeamService.getAllChannels();
      return res.json({ success: true, channels });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // Create channel / department
  async createChannel(req, res) {
    try {
      const newChannel = agentTeamService.createChannel(req.body);
      return res.json({ success: true, channel: newChannel });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // Plugins Hub endpoints
  async getPlugins(req, res) {
    try {
      const plugins = agentTeamService.getAllPlugins();
      return res.json({ success: true, plugins });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  async updatePlugin(req, res) {
    try {
      const updated = agentTeamService.updatePlugin(req.params.id, req.body);
      if (!updated) return res.status(404).json({ success: false, error: 'Plugin not found' });
      return res.json({ success: true, plugin: updated });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  async toggleAgentPlugin(req, res) {
    try {
      const { pluginId } = req.body;
      const result = agentTeamService.toggleAgentPlugin(req.params.id, pluginId);
      if (!result) return res.status(404).json({ success: false, error: 'Agent or Plugin not found' });
      return res.json({ success: true, ...result });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // Get routines
  async getRoutines(req, res) {
    try {
      const routines = agentTeamService.getAllRoutines();
      return res.json({ success: true, routines });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // Create routine
  async createRoutine(req, res) {
    try {
      const routine = agentTeamService.createRoutine(req.body);
      return res.json({ success: true, routine });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // Execute routine on demand
  async executeRoutine(req, res) {
    try {
      const result = agentTeamService.executeRoutine(req.params.id);
      if (!result) return res.status(404).json({ success: false, error: 'Routine not found' });
      return res.json({ success: true, ...result });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // Get inter-agent logs
  async getInterAgentLogs(req, res) {
    try {
      const logs = agentTeamService.getInterAgentLogs();
      return res.json({ success: true, logs });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // Get expenses
  async getExpenses(req, res) {
    try {
      const expenses = agentTeamService.getAllExpenses();
      return res.json({ success: true, expenses });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // Handle chat
  async handleChat(req, res) {
    try {
      const { agentId, message, attachment } = req.body;
      if (!agentId || !message) {
        return res.status(400).json({ success: false, error: 'agentId and message are required' });
      }

      const result = await grokOrchestratorService.processAgentMessage({
        agentId,
        message,
        attachment
      });

      return res.json({ success: true, ...result });
    } catch (err) {
      console.error('[GrokBotController] handleChat error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }
  // Get AI configuration status
  async getAiConfig(req, res) {
    try {
      const provider = (process.env.AI_PROVIDER || 'gemini').toLowerCase();
      let key = '';
      if (provider === 'gemini') key = process.env.GEMINI_API_KEY || '';
      else if (provider === 'openai') key = process.env.OPENAI_API_KEY || '';
      else if (provider === 'anthropic') key = process.env.ANTHROPIC_API_KEY || '';
      else if (provider === 'custom') key = process.env.CUSTOM_AI_API_KEY || '';

      const hasKey = key.trim().length > 0;
      const keyMasked = hasKey ? `${key.substring(0, 6)}...${key.substring(key.length - 4)}` : '';

      return res.json({
        success: true,
        hasKey,
        keyMasked,
        provider,
        model: process.env.CUSTOM_AI_MODEL || (provider === 'gemini' ? 'gemini-3.8-flash' : (provider === 'openai' ? 'gpt-4o-mini' : 'claude-3-5-haiku-20241022')),
        baseUrl: process.env.CUSTOM_AI_BASE_URL || ''
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // Update AI configuration (saves to .env and runtime)
  async updateAiConfig(req, res) {
    try {
      const { provider = 'gemini', apiKey, model, baseUrl } = req.body;
      if (!apiKey || !apiKey.trim()) {
        return res.status(400).json({ success: false, error: 'La API Key no puede estar vacía' });
      }

      const cleanKey = apiKey.trim();
      const cleanProvider = (provider || 'gemini').toLowerCase().trim();
      process.env.AI_PROVIDER = cleanProvider;

      if (cleanProvider === 'gemini') process.env.GEMINI_API_KEY = cleanKey;
      else if (cleanProvider === 'openai') process.env.OPENAI_API_KEY = cleanKey;
      else if (cleanProvider === 'anthropic') process.env.ANTHROPIC_API_KEY = cleanKey;
      else if (cleanProvider === 'custom') {
        process.env.CUSTOM_AI_API_KEY = cleanKey;
        if (baseUrl) process.env.CUSTOM_AI_BASE_URL = baseUrl.trim();
        if (model) process.env.CUSTOM_AI_MODEL = model.trim();
      }

      const fs = require('fs');
      const path = require('path');
      const port = process.env.PORT || 3005;

      const envLines = [
        `# Ópalo AI Platform Configuration`,
        `PORT=${port}`,
        `AI_PROVIDER=${cleanProvider}`
      ];
      if (process.env.GEMINI_API_KEY) envLines.push(`GEMINI_API_KEY=${process.env.GEMINI_API_KEY}`);
      if (process.env.OPENAI_API_KEY) envLines.push(`OPENAI_API_KEY=${process.env.OPENAI_API_KEY}`);
      if (process.env.ANTHROPIC_API_KEY) envLines.push(`ANTHROPIC_API_KEY=${process.env.ANTHROPIC_API_KEY}`);
      if (process.env.CUSTOM_AI_BASE_URL) envLines.push(`CUSTOM_AI_BASE_URL=${process.env.CUSTOM_AI_BASE_URL}`);
      if (process.env.CUSTOM_AI_API_KEY) envLines.push(`CUSTOM_AI_API_KEY=${process.env.CUSTOM_AI_API_KEY}`);
      if (process.env.CUSTOM_AI_MODEL) envLines.push(`CUSTOM_AI_MODEL=${process.env.CUSTOM_AI_MODEL}`);
      envLines.push('');

      const envContent = envLines.join('\n');
      const coreEnvPath = path.join(__dirname, '../../../core/.env');
      const rootEnvPath = path.join(__dirname, '../../../../.env');

      try { fs.writeFileSync(coreEnvPath, envContent, 'utf-8'); } catch (e) {}
      try { fs.writeFileSync(rootEnvPath, envContent, 'utf-8'); } catch (e) {}

      // Test connection immediately
      const geminiAgentEngine = require('../services/geminiAgentEngine');
      const testResult = await geminiAgentEngine.testConnection({
        provider: cleanProvider,
        apiKey: cleanKey,
        model,
        baseUrl
      });

      return res.json({
        success: true,
        saved: true,
        testResult,
        provider: cleanProvider,
        keyMasked: `${cleanKey.substring(0, 6)}...${cleanKey.substring(cleanKey.length - 4)}`
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // Test AI Connection
  async testAiConnection(req, res) {
    try {
      const geminiAgentEngine = require('../services/geminiAgentEngine');
      const { provider = 'gemini', apiKey, model, baseUrl } = req.body;
      const testResult = await geminiAgentEngine.testConnection({
        provider,
        apiKey,
        model,
        baseUrl
      });
      return res.json(testResult);
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }
}

module.exports = new GrokBotController();
