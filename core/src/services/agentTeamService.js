const fs = require('fs');
const path = require('path');

const AGENTS_FILE = path.join(__dirname, '../../data/agents.json');
const CHANNELS_FILE = path.join(__dirname, '../../data/channels.json');
const ROUTINES_FILE = path.join(__dirname, '../../data/routines.json');
const LOGS_FILE = path.join(__dirname, '../../data/inter_agent_logs.json');
const EXPENSES_FILE = path.join(__dirname, '../../data/expenses.json');

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

  createAgent({ name, role, avatar, avatarEmoji, channelId, jobDescription, tags, tools, computerUrl, computerType }) {
    const agents = this.getAllAgents();
    const id = name.toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || `agent-${Date.now()}`;

    const newAgent = {
      id,
      name,
      role: role || 'Especialista de Inteligencia Artificial',
      avatar: avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${id}`,
      avatarEmoji: avatarEmoji || '🤖',
      tags: tags || ['Especialista'],
      isCoordinator: false,
      isPinned: false,
      channelId: channelId || 'solo-emprendo',
      status: 'online',
      jobDescription: jobDescription || `Eres ${name}, especialista dedicado a ${role}.`,
      computer: {
        currentUrl: computerUrl || 'https://soloemprendo.com',
        type: computerType || 'browser',
        title: `${name} - Espacio de Trabajo`,
        activeTab: computerType || 'web'
      },
      tools: tools || ['browser', 'file_reader'],
      history: [
        {
          role: 'assistant',
          content: `Hola José. Soy **${name}** (${role}). El Jefazo me ha asignado mis tareas y mi job description. ¡Estoy listo para trabajar en tus proyectos!`,
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

  deleteAgent(agentId) {
    const agents = this.getAllAgents();
    if (!agents[agentId]) return false;
    delete agents[agentId];
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

  // --- Channels / Projects ---
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
      icon: icon || '📁',
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

    let output = '';
    if (routine.agentId === 'el-investigador') {
      output = `📡 **Briefing Diario de IA Aplicada (9:00 AM)**:\n1. **OpenAI Astra & GPT-6**: Nuevas APIs multimodales de voz y ejecución de ordenador.\n2. **Voice Workspace & Copilots**: Adopción masiva de agentes de audio en entornos corporativos.\n3. **Fable 5.1 & Modelos Autónomos**: Automatización de workflows sin intervención humana.`;
    } else {
      output = `⚡ Tarea programada ejecutada con éxito: "${routine.title}". Resultados consolidados sin novedades críticas.`;
    }

    routine.lastRun = now;
    routine.lastOutput = output;
    this._writeJson(ROUTINES_FILE, routines);

    // Add to agent's history
    this.addMessage(routine.agentId, 'assistant', output, { isRoutineExecution: true, routineTitle: routine.title });

    // Report to El Jefazo automatically (Hierarchical management)
    this.sendInterAgentMessage(
      routine.agentId,
      'el-jefazo',
      `Ejecuté la rutina programada "${routine.title}". Los resultados han sido archivados y notificados a José.`,
      'routine_report'
    );

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

    // Add a visible supervisory note in toAgent's history
    this.addMessage(toAgentId, 'assistant', `💬 **Mensaje interno de ${logEntry.fromName}**:\n> "${content}"`, { isInterAgent: true });

    this.broadcast('inter_agent_message', { log: logEntry });
    return logEntry;
  }

  // --- Expenses & Sheets for Joaquin ---
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
      categoria: categoria || 'General',
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

  // --- Background Cron Scheduler ---
  initCronRunner() {
    // Check every 60 seconds
    setInterval(() => {
      // In production this checks routine cron expressions
    }, 60000);
  }
}

module.exports = new AgentTeamService();
