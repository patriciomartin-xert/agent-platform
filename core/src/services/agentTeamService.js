const fs = require('fs');
const path = require('path');

const AGENTS_FILE = path.join(__dirname, '../../data/agents.json');
const CHANNELS_FILE = path.join(__dirname, '../../data/channels.json');
const ROUTINES_FILE = path.join(__dirname, '../../data/routines.json');
const LOGS_FILE = path.join(__dirname, '../../data/inter_agent_logs.json');
const EXPENSES_FILE = path.join(__dirname, '../../data/expenses.json');
const PLUGINS_FILE = path.join(__dirname, '../../data/plugins.json');

class AgentTeamService {
  constructor() {
    this.broadcaster = null;
    this.initCronRunner();
  }

  setBroadcaster(fn) {
    this.broadcaster = fn;
  }

  broadcast(event, payload) {
    if (this.broadcaster) {
      this.broadcaster({ event, ...payload });
    }
  }

  // --- Helpers for JSON files ---
  _readJson(filePath, defaultValue) {
    try {
      if (!fs.existsSync(filePath)) return defaultValue;
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    } catch (err) {
      console.error(`[AgentTeamService] Error reading ${filePath}:`, err.message);
      return defaultValue;
    }
  }

  _writeJson(filePath, data) {
    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
      console.error(`[AgentTeamService] Error writing ${filePath}:`, err.message);
    }
  }

  // --- Agents Management ---
  getAllAgents() {
    return this._readJson(AGENTS_FILE, {});
  }

  getAgent(agentId) {
    const agents = this.getAllAgents();
    return agents[agentId] || null;
  }

  createAgent({
    name,
    role,
    avatar,
    avatarEmoji,
    channelId,
    department,
    reportsTo,
    isCoordinator,
    jobDescription,
    tags,
    tools,
    plugins,
    computerUrl,
    computerType
  }) {
    const agents = this.getAllAgents();
    const id = name.toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || `agent-${Date.now()}`;

    const newAgent = {
      id,
      name,
      role: role || 'Especialista Autónomo',
      avatar: avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${id}`,
      avatarEmoji: avatarEmoji || '🤖',
      tags: tags || ['Operativo'],
      isCoordinator: isCoordinator === true || isCoordinator === 'true',
      isPinned: isCoordinator === true || isCoordinator === 'true',
      channelId: channelId || 'direccion',
      department: department || 'Dirección General',
      reportsTo: reportsTo && reportsTo !== 'none' ? reportsTo : null,
      status: 'online',
      jobDescription: jobDescription || `Eres ${name}, especialista asignado a ${role}. Cumples tus tareas con autonomía, utilizas tus herramientas autorizadas y reportas a tu responsable directo.`,
      computer: {
        currentUrl: computerUrl || 'https://dashboard.opalo.ai',
        type: computerType || 'browser',
        title: `${name} - Espacio de Trabajo`,
        activeTab: computerType || 'web'
      },
      tools: tools || ['browser', 'file_reader'],
      plugins: plugins || [],
      history: [
        {
          role: 'assistant',
          content: `Hola. He sido incorporado formalmente al organigrama como **${name}** (${role}). Estoy listo para operar con autonomía en el departamento de **${department || 'General'}**.`,
          timestamp: new Date().toISOString()
        }
      ]
    };

    agents[id] = newAgent;
    this._writeJson(AGENTS_FILE, agents);
    this.broadcast('agent_created', { agent: newAgent });
    return newAgent;
  }

  updateAgent(agentId, updates) {
    const agents = this.getAllAgents();
    if (!agents[agentId]) return null;
    agents[agentId] = { ...agents[agentId], ...updates };
    this._writeJson(AGENTS_FILE, agents);
    this.broadcast('agent_updated', { agent: agents[agentId] });
    return agents[agentId];
  }

  updateAgentHierarchy(agentId, reportsTo) {
    const agents = this.getAllAgents();
    if (!agents[agentId]) return null;
    agents[agentId].reportsTo = (reportsTo && reportsTo !== 'none') ? reportsTo : null;
    this._writeJson(AGENTS_FILE, agents);
    this.broadcast('hierarchy_updated', { agentId, reportsTo: agents[agentId].reportsTo });
    return agents[agentId];
  }

  deleteAgent(agentId) {
    const agents = this.getAllAgents();
    if (!agents[agentId]) return false;
    delete agents[agentId];
    
    // Also reassign subordinate agents whose reportsTo was this deleted agent
    Object.values(agents).forEach(ag => {
      if (ag.reportsTo === agentId) {
        ag.reportsTo = null;
      }
    });

    this._writeJson(AGENTS_FILE, agents);
    this.broadcast('agent_deleted', { agentId });
    return true;
  }

  addMessage(agentId, role, content, meta = {}) {
    const agents = this.getAllAgents();
    if (!agents[agentId]) return null;

    const message = {
      role,
      content,
      timestamp: new Date().toISOString(),
      ...meta
    };

    if (!agents[agentId].history) agents[agentId].history = [];
    agents[agentId].history.push(message);
    this._writeJson(AGENTS_FILE, agents);
    this.broadcast('new_agent_message', { agentId, message });
    return message;
  }

  // --- Plugins & Integrations Hub ---
  getAllPlugins() {
    return this._readJson(PLUGINS_FILE, []);
  }

  updatePlugin(pluginId, updates) {
    const plugins = this.getAllPlugins();
    const idx = plugins.findIndex(p => p.id === pluginId);
    if (idx === -1) return null;

    plugins[idx] = { ...plugins[idx], ...updates };
    this._writeJson(PLUGINS_FILE, plugins);
    this.broadcast('plugin_updated', { plugin: plugins[idx] });
    return plugins[idx];
  }

  toggleAgentPlugin(agentId, pluginId) {
    const agents = this.getAllAgents();
    const plugins = this.getAllPlugins();
    const agent = agents[agentId];
    const plugin = plugins.find(p => p.id === pluginId);

    if (!agent || !plugin) return false;

    if (!agent.plugins) agent.plugins = [];
    const hasPlugin = agent.plugins.includes(pluginId);

    if (hasPlugin) {
      agent.plugins = agent.plugins.filter(p => p !== pluginId);
      plugin.assignedAgents = (plugin.assignedAgents || []).filter(a => a !== agentId);
    } else {
      agent.plugins.push(pluginId);
      if (!plugin.assignedAgents) plugin.assignedAgents = [];
      if (!plugin.assignedAgents.includes(agentId)) {
        plugin.assignedAgents.push(agentId);
      }
    }

    this._writeJson(AGENTS_FILE, agents);
    this._writeJson(PLUGINS_FILE, plugins);

    this.broadcast('agent_updated', { agent });
    this.broadcast('plugin_updated', { plugin });
    return { agent, plugin };
  }

  // --- Channels / Departments ---
  getAllChannels() {
    return this._readJson(CHANNELS_FILE, []);
  }

  createChannel({ name, description, icon }) {
    const channels = this.getAllChannels();
    const id = name.toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const newChannel = {
      id,
      name,
      icon: icon || '🏢',
      description: description || ''
    };

    channels.push(newChannel);
    this._writeJson(CHANNELS_FILE, channels);
    this.broadcast('channel_created', { channel: newChannel });
    return newChannel;
  }

  // --- Routines / Cron Jobs ---
  getAllRoutines() {
    return this._readJson(ROUTINES_FILE, []);
  }

  createRoutine({ agentId, title, schedule, scheduleLabel, instruction }) {
    const routines = this.getAllRoutines();
    const id = `routine-${Date.now()}`;
    const newRoutine = {
      id,
      agentId,
      title,
      schedule: schedule || '0 9 * * *',
      scheduleLabel: scheduleLabel || 'Cada día a las 9:00 AM',
      instruction,
      enabled: true,
      lastRun: null,
      nextRun: new Date(Date.now() + 86400000).toISOString(),
      lastOutput: null
    };

    routines.push(newRoutine);
    this._writeJson(ROUTINES_FILE, routines);
    this.broadcast('routine_created', { routine: newRoutine });
    return newRoutine;
  }

  executeRoutine(routineId) {
    const routines = this.getAllRoutines();
    const routine = routines.find(r => r.id === routineId);
    if (!routine) return null;

    const agent = this.getAgent(routine.agentId);
    const now = new Date().toISOString();

    const output = `⚡ Tarea programada ejecutada con éxito: "${routine.title}". Parámetros analizados y reportados al supervisor jerárquico.`;

    routine.lastRun = now;
    routine.lastOutput = output;
    this._writeJson(ROUTINES_FILE, routines);

    // Add to agent history
    this.addMessage(routine.agentId, 'assistant', output, { isRoutineExecution: true, routineTitle: routine.title });

    // Report to supervisor if defined
    if (agent && agent.reportsTo) {
      this.sendInterAgentMessage(
        routine.agentId,
        agent.reportsTo,
        `He completado la rutina autónoma programada: "${routine.title}". Resultados archivados en mi espacio de trabajo.`,
        'routine_report'
      );
    }

    this.broadcast('routine_executed', { routine, output });
    return { routine, output };
  }

  // --- Inter-Agent Communication Logs ---
  getInterAgentLogs() {
    return this._readJson(LOGS_FILE, []);
  }

  sendInterAgentMessage(fromAgentId, toAgentId, content, type = 'report') {
    const logs = this.getInterAgentLogs();
    const fromAgent = this.getAgent(fromAgentId);
    const toAgent = this.getAgent(toAgentId);

    const logEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      fromAgentId,
      fromName: fromAgent ? fromAgent.name : fromAgentId,
      toAgentId,
      toName: toAgent ? toAgent.name : toAgentId,
      type,
      timestamp: new Date().toISOString(),
      content,
      status: 'delivered'
    };

    logs.unshift(logEntry);
    this._writeJson(LOGS_FILE, logs);

    // Add visible note in toAgent's history
    this.addMessage(toAgentId, 'assistant', `💬 **Mensaje interno de ${logEntry.fromName}**:\n> "${content}"`, { isInterAgent: true });

    this.broadcast('inter_agent_message', { log: logEntry });
    return logEntry;
  }

  // --- Expenses & Sheets ---
  getAllExpenses() {
    return this._readJson(EXPENSES_FILE, []);
  }

  registerExpense({ proveedor, cif, concepto, categoria, subtotal, iva, total }) {
    const expenses = this.getAllExpenses();
    const newExpense = {
      id: `exp-${Date.now()}`,
      fecha: new Date().toISOString().split('T')[0],
      proveedor: proveedor || 'Proveedor General',
      cif: cif || 'B-' + Math.floor(10000000 + Math.random() * 90000000),
      concepto: concepto || 'Gasto empresarial',
      categoria: categoria || 'Operaciones',
      subtotal: parseFloat(subtotal) || 0,
      iva: parseFloat(iva) || 0,
      total: parseFloat(total) || 0,
      estado: 'Contabilizado en Excel'
    };

    expenses.unshift(newExpense);
    this._writeJson(EXPENSES_FILE, expenses);
    this.broadcast('expense_registered', { expense: newExpense });
    return newExpense;
  }

  initCronRunner() {
    setInterval(() => {
      // In production runs scheduled cron triggers
    }, 60000);
  }
}

module.exports = new AgentTeamService();
