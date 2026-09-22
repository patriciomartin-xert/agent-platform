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

  // Create an agent manually
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

  // Delete an agent
  async deleteAgent(req, res) {
    try {
      const ok = agentTeamService.deleteAgent(req.params.id);
      return res.json({ success: ok });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // Get channels
  async getChannels(req, res) {
    try {
      const channels = agentTeamService.getAllChannels();
      return res.json({ success: true, channels });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // Create channel
  async createChannel(req, res) {
    try {
      const newChannel = agentTeamService.createChannel(req.body);
      return res.json({ success: true, channel: newChannel });
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

  // Execute a routine on-demand
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

  // Get expenses / sheet rows
  async getExpenses(req, res) {
    try {
      const expenses = agentTeamService.getAllExpenses();
      return res.json({ success: true, expenses });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // Main Grok Bot chat endpoint
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
}

module.exports = new GrokBotController();
