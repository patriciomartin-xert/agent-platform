const agentTeamService = require('./agentTeamService');
const geminiService = require('./geminiService');
const config = require('../config/config');

class GrokOrchestratorService {
  async processAgentMessage({ agentId, message, attachment = null }) {
    const agent = agentTeamService.getAgent(agentId);
    if (!agent) throw new Error(`Agent ${agentId} not found`);

    const lower = message.toLowerCase();
    const cleanText = lower.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    // =========================================================================
    // SCENARIO 1: BRIEFING UPLOAD & TEAM PROPOSAL (El Jefazo)
    // =========================================================================
    if (agent.isCoordinator && (lower.includes('briefing') || lower.includes('soloemprendo') || lower.includes('equipo de tres') || lower.includes('sugerencias de un equipo'))) {
      const reply = `He analizado detenidamente el **briefing de Solo Emprendo** y tu enfoque en formación práctica y másters de Inteligencia Artificial para profesionales.\n\nPara operar este proyecto al máximo nivel sin que tengas que encargarte de tareas manuales, te propongo un equipo de **tres trabajadores autónomos**:\n\n1. 📱 **La Dinamizadora**: Community Manager encargada de interactuar y moderar el grupo de Telegram de tus alumnos.\n2. 🔍 **El Investigador**: Analista que monitorea Twitter/X para extraer las 3 principales novedades de IA aplicada a empresas.\n3. ✍️ **El Copy**: Especialista en copywriting para transformar tendencias en publicaciones de LinkedIn con tu propio tono.\n\n¿Te parece bien esta estructura de equipo para proceder a crearlos y asignarles su job description?`;
      agentTeamService.addMessage(agentId, 'assistant', reply, { type: 'team_proposal' });
      return { reply, actions: ['team_proposed'] };
    }

    // =========================================================================
    // SCENARIO 2: APPROVAL & AUTONOMOUS AGENT CREATION (El Jefazo creates team)
    // =========================================================================
    if (agent.isCoordinator && (lower.includes('crea') || lower.includes('si') || lower.includes('crealos') || lower.includes('adelante')) && (lower.includes('dinamizadora') || lower.includes('investigador') || lower.includes('copy'))) {
      // Create or ensure the 3 agents exist
      agentTeamService.createAgent({
        name: 'La Dinamizadora',
        role: 'Community Manager de Telegram',
        avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=dinamizadora-telegram',
        avatarEmoji: '📱',
        channelId: 'solo-emprendo',
        tags: ['Telegram', 'Comunidad'],
        jobDescription: 'Community Manager para interacción y dinamización en Telegram de Solo Emprendo.',
        computerUrl: 'https://web.telegram.org/k/#@soloemprendo',
        computerType: 'telegram'
      });

      agentTeamService.createAgent({
        name: 'El Investigador',
        role: 'Analista de Tendencias IA en Twitter/X',
        avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=investigador-tech',
        avatarEmoji: '🔍',
        channelId: 'solo-emprendo',
        tags: ['Twitter/X', 'Research'],
        jobDescription: 'Monitoreo de Twitter/X para extraer píldoras breves de novedades de IA aplicada a empresas.',
        computerUrl: 'https://x.com/trends/ai',
        computerType: 'twitter'
      });

      agentTeamService.createAgent({
        name: 'El Copy',
        role: 'Redactor de Contenidos & Redes Sociales',
        avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=copywriter-pen',
        avatarEmoji: '✍️',
        channelId: 'solo-emprendo',
        tags: ['Copywriting', 'LinkedIn'],
        jobDescription: 'Redacción de posts de LinkedIn adaptados al tono y estilo de José.',
        computerUrl: 'https://linkedin.com/in/soloemprendo',
        computerType: 'browser'
      });

      // Send inter-agent briefings from El Jefazo to the new workers
      agentTeamService.sendInterAgentMessage('el-jefazo', 'la-dinamizadora', 'Te he asignado el rol de Community Manager de Telegram para Solo Emprendo. Espera a que José se presente antes de interactuar.', 'delegation');
      agentTeamService.sendInterAgentMessage('el-jefazo', 'el-investigador', 'Tu función es monitorear Twitter/X y entregar resúmenes de 3 píldoras de IA aplicada directamente a mí.', 'delegation');
      agentTeamService.sendInterAgentMessage('el-jefazo', 'el-copy', 'Estarás a cargo del contenido para redes sociales y LinkedIn con la identidad de marca de José.', 'delegation');

      const reply = `¡Perfecto, José! Ya he creado en tiempo real a los 3 trabajadores en el canal **Solo Emprendo**:\n\n* **La Dinamizadora** (Telegram)\n* **El Investigador** (Twitter/X)\n* **El Copy** (LinkedIn)\n\nLes he asignado su *job description*, avatares y accesos iniciales. Ya aparecen disponibles en tu barra lateral izquierda. Les he indicado que esperen a que te presentes formalmente.`;
      agentTeamService.addMessage(agentId, 'assistant', reply, { type: 'team_created' });
      return { reply, actions: ['agents_created'] };
    }

    // =========================================================================
    // SCENARIO 3: CREATING JOAQUÍN THE ADMINISTRATIVE BOT
    // =========================================================================
    if (lower.includes('joaquin') || (lower.includes('administrativo') && lower.includes('crea'))) {
      const joaquin = agentTeamService.createAgent({
        name: 'Joaquín',
        role: 'Administrativo de Gastos & Facturas',
        avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=joaquin-cuadros',
        avatarEmoji: '👔',
        channelId: 'personal',
        tags: ['Administración', 'Facturas', 'Google Sheets'],
        jobDescription: 'Administrativo muy metódico y serio de camisa de cuadros. Procesa tickets de gastos, facturas e IVA en hojas de cálculo.',
        computerUrl: 'https://docs.google.com/spreadsheets/d/gastos-soloemprendo',
        computerType: 'sheets'
      });

      const reply = `He creado a **Joaquín**, tu administrativo de camisa de cuadros en la sección **Personal & Gastos**. Está configurado con acceso a su hoja de cálculo de gastos y listo para recibir cualquier ticket o factura para contabilizarla de inmediato.`;
      agentTeamService.addMessage(agentId, 'assistant', reply, { type: 'joaquin_created' });
      return { reply, actions: ['joaquin_created'] };
    }

    // =========================================================================
    // SCENARIO 4: CRON JOB / ROUTINE CREATION ("Hazlo todos los días a las 9 am")
    // =========================================================================
    if (cleanText.includes('cada dia') || cleanText.includes('todos los dias') || cleanText.includes('9 de la manana') || cleanText.includes('9 am') || cleanText.includes('rutina')) {
      const routine = agentTeamService.createRoutine({
        agentId: agent.id,
        title: 'Briefing Diario de IA Aplicada',
        schedule: '0 9 * * *',
        scheduleLabel: 'Cada día a las 9:00 AM',
        instruction: 'Rastrear Twitter/X en busca de tendencias de IA aplicada a empresas y generar un reporte de 3 píldoras clave.'
      });

      const reply = `✅ **Rutina Autónoma Creada (Cron Job)**:\n\n* **Nombre:** Briefing Diario de IA Aplicada\n* **Frecuencia:** Cada día a las 9:00 AM\n* **Acción:** Rastrear Twitter/X, extraer 3 píldoras clave de IA para empresas y reportar automáticamente al Jefazo.\n\nYa está programado en mi pestaña de **Rutinas** en el panel derecho. Ya no tendrás que pedírmelo manualmente; cada mañana a las 9:00 tendrás tu briefing listo.`;
      agentTeamService.addMessage(agentId, 'assistant', reply, { type: 'routine_created', routineId: routine.id });
      return { reply, actions: ['routine_created'] };
    }

    // =========================================================================
    // SCENARIO 5: EXPENSE TICKET OCR & EXCEL SHEETS REGISTRATION (Joaquín)
    // =========================================================================
    if (agent.id === 'joaquin-admin' || lower.includes('ticket') || lower.includes('gasto') || lower.includes('factura') || attachment === 'ticket') {
      const newExpense = agentTeamService.registerExpense({
        proveedor: 'Restaurante Mesón Don José',
        cif: 'B-84920111',
        concepto: 'Comida de trabajo con ponente de IA',
        categoria: 'Hostelería',
        subtotal: 58.00,
        iva: 12.18,
        total: 70.18
      });

      const reply = `🧾 **Ticket Extraído y Procesado**:\n\n* **Proveedor:** Restaurante Mesón Don José\n* **CIF:** B-84920111\n* **Fecha:** ${newExpense.fecha}\n* **Categoría:** Hostelería (Gasto Empresarial)\n* **Base Imponible:** 58.00€\n* **IVA (21%):** 12.18€\n* **Total:** **70.18€**\n\n✅ He añadido esta nueva fila a tu hoja de cálculo **Control de Gastos & Facturas 2026.xlsx** en mi pantalla de la derecha. Puedes verificar la tabla y descargarla cuando gustes.`;
      agentTeamService.addMessage(agentId, 'assistant', reply, { type: 'expense_registered', expense: newExpense });
      return { reply, actions: ['expense_registered'] };
    }

    // =========================================================================
    // SCENARIO 6: REPORTING TO "EL JEFAZO" (Hierarchical management)
    // =========================================================================
    if (lower.includes('reporta al jefazo') || lower.includes('reporta') || lower.includes('10 sobre 10') || lower.includes('10/10')) {
      const reportContent = `Primer brief entregado a José con valoración 10/10. Formato fijado en 3 píldoras ejecutivas de IA empresarial sin listas infinitas. Conector de Twitter/X activo.`;
      agentTeamService.sendInterAgentMessage(agent.id, 'el-jefazo', reportContent, 'report');

      const reply = `He enviado el reporte formal a **El Jefazo** confirmando la entrega del briefing calificado con 10/10. Ahora puedes consultar la conversación en el chat del Jefazo para supervisar todo el flujo de trabajo inter-departamental.`;
      agentTeamService.addMessage(agentId, 'assistant', reply, { type: 'report_sent' });
      return { reply, actions: ['report_sent'] };
    }

    // =========================================================================
    // SCENARIO 7: INVESTIGADOR AI TRENDS (3 Pills)
    // =========================================================================
    if (agent.id === 'el-investigador' && (lower.includes('investiga') || lower.includes('novedades') || lower.includes('pildoras') || lower.includes('que ha pasado') || lower.includes('tendencias'))) {
      const reply = `Aquí tienes las **3 píldoras clave** de novedades en IA aplicada a empresas sin listas infinitas:\n\n1. 🚀 **OpenAI Astra & GPT-6**: Anunciados nuevos modelos de razonamiento con capacidad de usar el ordenador y ejecutar herramientas del navegador autónomamente.\n2. 🎙️ **Voice Workspace**: Plataformas como Grok Bot y ElevenLabs consolidan la interacción de voz y audio natural como estándar en flujos de trabajo.\n3. ⚙️ **Fable 5.1 & Agentes Persistentes**: Auge de sistemas multi-agente persistentes que se coordinan 24/7 mediante rutinas cron sin intervención manual.\n\n¿Quieres que le reporte este avance al Jefazo o que programe una rutina para enviártelo cada mañana a las 9:00?`;
      agentTeamService.addMessage(agentId, 'assistant', reply, { type: 'briefing_delivered' });
      return { reply, actions: ['briefing_delivered'] };
    }

    // =========================================================================
    // SCENARIO 8: GENERAL GEMINI OR ROLE-BASED FALLBACK
    // =========================================================================
    try {
      if (config.GEMINI_API_KEY) {
        const geminiReply = await geminiService.sendMessage({
          message: `Eres el agente '${agent.name}' con el rol '${agent.role}' y job description: '${agent.jobDescription}'. Responde en primera persona con profesionalismo, concisión y proactividad.\n\nMensaje del usuario: ${message}`
        });
        if (geminiReply && geminiReply.reply) {
          agentTeamService.addMessage(agentId, 'assistant', geminiReply.reply);
          return { reply: geminiReply.reply, actions: [] };
        }
      }
    } catch (e) {
      console.warn('[GrokOrchestrator] Gemini error, using fallback:', e.message);
    }

    const defaultReply = `Entendido, José. Como **${agent.name}** (${agent.role}), estoy procesando tu solicitud: "${message}". He actualizado mi pantalla de trabajo y estoy listo para continuar coordinando tareas con el equipo.`;
    agentTeamService.addMessage(agentId, 'assistant', defaultReply);
    return { reply: defaultReply, actions: [] };
  }
}

module.exports = new GrokOrchestratorService();
