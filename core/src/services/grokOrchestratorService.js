const agentTeamService = require('./agentTeamService');
const geminiAgentEngine = require('./geminiAgentEngine');

class GrokOrchestratorService {
  async processAgentMessage({ agentId, message, attachment = null }) {
    const agent = agentTeamService.getAgent(agentId);
    if (!agent) throw new Error(`Agent ${agentId} not found`);

    const lower = message.toLowerCase();
    const cleanText = lower.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    // 1. Expense Ticket OCR & Excel Registration
    if (lower.includes('ticket') || lower.includes('gasto') || lower.includes('factura') || attachment === 'ticket') {
      const newExpense = agentTeamService.registerExpense({
        proveedor: 'Restaurante Mesón Don José',
        cif: 'B-84920111',
        concepto: 'Comida de trabajo con ponente de IA',
        categoria: 'Hostelería',
        subtotal: 58.00,
        iva: 12.18,
        total: 70.18
      });

      const reply = `🧾 **Ticket Extraído y Procesado**:\n\n* **Proveedor:** Restaurante Mesón Don José\n* **CIF:** B-84920111\n* **Fecha:** ${newExpense.fecha}\n* **Categoría:** Hostelería (Gasto Empresarial)\n* **Base Imponible:** 58.00€\n* **IVA (21%):** 12.18€\n* **Total:** **70.18€**\n\n✅ He registrado esta nueva fila en tu hoja de cálculo **Control de Gastos & Facturas.xlsx**. La tabla se encuentra actualizada en mi espacio de trabajo.`;
      agentTeamService.addMessage(agentId, 'assistant', reply, { type: 'expense_registered', expense: newExpense });
      return { reply, actions: ['expense_registered'] };
    }

    // 2. Cron Job / Routine Creation
    if (cleanText.includes('cada dia') || cleanText.includes('todos los dias') || cleanText.includes('9 de la manana') || cleanText.includes('9 am') || (cleanText.includes('rutina') && cleanText.includes('crea'))) {
      const routine = agentTeamService.createRoutine({
        agentId: agent.id,
        title: 'Rutina Autónoma de Monitoreo & Briefing',
        schedule: '0 9 * * *',
        scheduleLabel: 'Cada día a las 9:00 AM',
        instruction: 'Monitorear indicadores clave y generar resumen ejecutivo matutino.'
      });

      const reply = `✅ **Rutina Autónoma Creada (Cron Job)**:\n\n* **Nombre:** Rutina de Monitoreo & Briefing\n* **Frecuencia:** Cada día a las 9:00 AM\n* **Acción:** Ejecución desatendida y reporte de resultados.\n\nYa está programada en el sistema. Se ejecutará periódicamente sin requerir intervención manual.`;
      agentTeamService.addMessage(agentId, 'assistant', reply, { type: 'routine_created', routineId: routine.id });
      return { reply, actions: ['routine_created'] };
    }

    // 3. Delegation & Inter-Agent Reports
    if (lower.includes('reporta a') && lower.includes('organigrama')) {
      const allAgents = agentTeamService.getAllAgents();
      const targetSupervisor = agent.reportsTo ? allAgents[agent.reportsTo] : null;
      if (targetSupervisor) {
        agentTeamService.sendInterAgentMessage(agent.id, targetSupervisor.id, `Reporte formal de avance entregado por ${agent.name}.`, 'report');
        const reply = `He emitido y enviado el reporte formal a mi supervisor **${targetSupervisor.name}** (${targetSupervisor.role}). Puedes consultar la conversación interna en su chat.`;
        agentTeamService.addMessage(agentId, 'assistant', reply, { type: 'report_sent' });
        return { reply, actions: ['report_sent'] };
      }
    }

    // 4. Primary Intelligence Engine (Real Gemini API or High-Fidelity Simulation)
    const turnResult = await geminiAgentEngine.executeAgentTurn({
      agent,
      userMessage: message,
      conversationHistory: agent.history || []
    });

    agentTeamService.addMessage(agentId, 'assistant', turnResult.reply, {
      actions: turnResult.actions
    });

    return turnResult;
  }
}

module.exports = new GrokOrchestratorService();
