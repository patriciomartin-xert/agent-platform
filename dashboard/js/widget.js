(function () {
  class OmniJourneyWidget {
    constructor() {
      this.tenantId = 'mi-empresa';
      this.sessionId = null;
      this.config = null;
      this.isOpen = false;
      
      // Elements
      this.container = null;
      this.bubble = null;
      this.window = null;
      this.messageFeed = null;
      this.inputField = null;
      this.submitBtn = null;
      this.phaseLabel = null;
    }

    async init(tenantId = 'mi-empresa') {
      this.tenantId = tenantId;
      
      // Load or generate session UUID
      let storedSession = localStorage.getItem(`oj_session_${this.tenantId}`);
      if (!storedSession) {
        storedSession = `session_${Math.random().toString(36).substring(2, 15)}_${Date.now()}`;
        localStorage.setItem(`oj_session_${this.tenantId}`, storedSession);
      }
      this.sessionId = storedSession;

      // Clean up any existing widget DOM before loading a new tenant configuration
      const existing = document.getElementById('omnijourney-widget-container');
      if (existing) {
        existing.remove();
      }

      // Fetch white-label styling config from Sheet-CMS-Simulator Backend
      try {
        const response = await fetch(`/api/config?tenantId=${this.tenantId}`);
        const result = await response.json();
        if (result.success) {
          this.config = result.branding;
          this.render();
        }
      } catch (err) {
        console.error('[OmniJourney Widget] Failed to load brand config:', err);
      }
    }

    render() {
      const primaryColor = this.config.primaryColor || '#6366F1';
      
      // Create main widget wrapper
      this.container = document.createElement('div');
      this.container.id = 'omnijourney-widget-container';
      this.container.style.position = 'fixed';
      this.container.style.bottom = '24px';
      this.container.style.right = '24px';
      this.container.style.zIndex = '99999';
      this.container.style.fontFamily = 'system-ui, -apple-system, sans-serif';

      // 1. Floating Bubble Button
      this.bubble = document.createElement('button');
      this.bubble.style.width = '60px';
      this.bubble.style.height = '60px';
      this.bubble.style.borderRadius = '50%';
      this.bubble.style.backgroundColor = primaryColor;
      this.bubble.style.boxShadow = '0 10px 25px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -4px rgba(0, 0, 0, 0.3)';
      this.bubble.style.border = 'none';
      this.bubble.style.cursor = 'pointer';
      this.bubble.style.display = 'flex';
      this.bubble.style.alignItems = 'center';
      this.bubble.style.justifyContent = 'center';
      this.bubble.style.transition = 'transform 0.2s ease';
      this.bubble.innerHTML = `
        <svg style="width:28px; height:28px; fill:none; stroke:white; stroke-width:2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      `;
      this.bubble.onclick = () => this.toggleWindow();

      // 2. Chat Window Panel
      this.window = document.createElement('div');
      this.window.style.display = 'none';
      this.window.style.position = 'absolute';
      this.window.style.bottom = '76px';
      this.window.style.right = '0';
      this.window.style.width = '380px';
      this.window.style.height = '500px';
      this.window.style.borderRadius = '20px';
      this.window.style.backgroundColor = '#1e293b';
      this.window.style.border = '1px solid #334155';
      this.window.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.4)';
      this.window.style.overflow = 'hidden';
      this.window.style.flexDirection = 'column';

      // Chat Header
      const header = document.createElement('div');
      header.style.backgroundColor = primaryColor;
      header.style.padding = '16px';
      header.style.display = 'flex';
      header.style.alignItems = 'center';
      header.style.justifyContent = 'space-between';
      header.style.color = 'white';

      const headerLeft = document.createElement('div');
      headerLeft.style.display = 'flex';
      headerLeft.style.alignItems = 'center';
      headerLeft.style.gap = '12px';

      const logo = document.createElement('img');
      logo.src = this.config.logoUrl;
      logo.style.width = '36px';
      logo.style.height = '36px';
      logo.style.borderRadius = '8px';
      logo.style.backgroundColor = 'white';
      logo.style.padding = '2px';

      const headerTitleGroup = document.createElement('div');
      const headerTitle = document.createElement('div');
      headerTitle.innerText = this.config.companyName;
      headerTitle.style.fontWeight = 'bold';
      headerTitle.style.fontSize = '14px';

      this.phaseLabel = document.createElement('span');
      this.phaseLabel.innerText = 'VENTAS';
      this.phaseLabel.style.fontSize = '10px';
      this.phaseLabel.style.fontWeight = '800';
      this.phaseLabel.style.letterSpacing = '1px';
      this.phaseLabel.style.backgroundColor = 'rgba(255,255,255,0.2)';
      this.phaseLabel.style.padding = '2px 8px';
      this.phaseLabel.style.borderRadius = '10px';

      headerTitleGroup.appendChild(headerTitle);
      headerTitleGroup.appendChild(this.phaseLabel);

      headerLeft.appendChild(logo);
      headerLeft.appendChild(headerTitleGroup);

      const closeBtn = document.createElement('button');
      closeBtn.style.background = 'none';
      closeBtn.style.border = 'none';
      closeBtn.style.cursor = 'pointer';
      closeBtn.style.color = 'white';
      closeBtn.innerHTML = `
        <svg style="width:20px; height:20px; fill:none; stroke:currentColor; stroke-width:2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      `;
      closeBtn.onclick = () => this.toggleWindow();

      header.appendChild(headerLeft);
      header.appendChild(closeBtn);

      // Chat Message Feed
      this.messageFeed = document.createElement('div');
      this.messageFeed.style.flex = '1';
      this.messageFeed.style.padding = '16px';
      this.messageFeed.style.overflowY = 'auto';
      this.messageFeed.style.display = 'flex';
      this.messageFeed.style.flexDirection = 'column';
      this.messageFeed.style.gap = '12px';

      // Chat Input Form Footer
      const inputForm = document.createElement('form');
      inputForm.style.padding = '12px 16px';
      inputForm.style.borderTop = '1px solid #334155';
      inputForm.style.display = 'flex';
      inputForm.style.gap = '8px';
      inputForm.style.backgroundColor = '#0f172a';
      inputForm.onsubmit = (e) => {
        e.preventDefault();
        this.handleSend();
      };

      this.inputField = document.createElement('input');
      this.inputField.type = 'text';
      this.inputField.placeholder = 'Escribe un mensaje...';
      this.inputField.style.flex = '1';
      this.inputField.style.padding = '10px 14px';
      this.inputField.style.borderRadius = '24px';
      this.inputField.style.border = '1px solid #334155';
      this.inputField.style.backgroundColor = '#1e293b';
      this.inputField.style.color = 'white';
      this.inputField.style.fontSize = '14px';
      this.inputField.style.outline = 'none';

      this.submitBtn = document.createElement('button');
      this.submitBtn.type = 'submit';
      this.submitBtn.style.backgroundColor = primaryColor;
      this.submitBtn.style.border = 'none';
      this.submitBtn.style.width = '38px';
      this.submitBtn.style.height = '38px';
      this.submitBtn.style.borderRadius = '50%';
      this.submitBtn.style.cursor = 'pointer';
      this.submitBtn.style.display = 'flex';
      this.submitBtn.style.alignItems = 'center';
      this.submitBtn.style.justifyContent = 'center';
      this.submitBtn.innerHTML = `
        <svg style="width:18px; height:18px; fill:none; stroke:white; stroke-width:2; transform:rotate(45deg)" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
        </svg>
      `;

      inputForm.appendChild(this.inputField);
      inputForm.appendChild(this.submitBtn);

      this.window.appendChild(header);
      this.window.appendChild(this.messageFeed);
      this.window.appendChild(inputForm);

      this.container.appendChild(this.bubble);
      this.container.appendChild(this.window);

      document.body.appendChild(this.container);

      // Welcome initial message
      this.appendMessage('assistant', this.config.welcomeMessage);
    }

    toggleWindow() {
      this.isOpen = !this.isOpen;
      if (this.isOpen) {
        this.window.style.display = 'flex';
        this.bubble.style.transform = 'scale(0.8)';
        this.inputField.focus();
      } else {
        this.window.style.display = 'none';
        this.bubble.style.transform = 'scale(1)';
      }
    }

    appendMessage(role, content) {
      const isAssistant = role === 'assistant';
      const bubble = document.createElement('div');
      bubble.style.maxWidth = '80%';
      bubble.style.padding = '10px 14px';
      bubble.style.borderRadius = '16px';
      bubble.style.fontSize = '13.5px';
      bubble.style.lineHeight = '1.45';

      if (isAssistant) {
        bubble.style.alignSelf = 'flex-start';
        bubble.style.backgroundColor = '#334155';
        bubble.style.color = '#f1f5f9';
        bubble.style.borderBottomLeftRadius = '4px';
      } else {
        bubble.style.alignSelf = 'flex-end';
        bubble.style.backgroundColor = this.config.primaryColor || '#6366F1';
        bubble.style.color = 'white';
        bubble.style.borderBottomRightRadius = '4px';
      }

      bubble.innerText = content;
      this.messageFeed.appendChild(bubble);
      this.messageFeed.scrollTop = this.messageFeed.scrollHeight;
    }

    async handleSend() {
      const message = this.inputField.value.trim();
      if (!message) return;

      this.inputField.value = '';
      this.appendMessage('user', message);

      // Disable inputs during processing
      this.inputField.disabled = true;
      this.submitBtn.disabled = true;

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: this.sessionId,
            tenantId: this.tenantId,
            message: message
          })
        });

        const result = await response.json();
        if (result.success) {
          this.appendMessage('assistant', result.reply);
          
          // Update dynamic phase indicators in header
          this.updatePhaseBadge(result.phase);
        } else {
          this.appendMessage('assistant', 'Lo siento, ocurrió un error procesando tu mensaje.');
        }
      } catch (err) {
        this.appendMessage('assistant', 'Error de red al conectar con el servidor.');
      } finally {
        this.inputField.disabled = false;
        this.submitBtn.disabled = false;
        this.inputField.focus();
      }
    }

    updatePhaseBadge(phase) {
      let label = 'VENTAS';
      let color = '#EAB308'; // Yellow
      if (phase === 'New Customer') {
        label = 'ONBOARDING';
        color = '#3B82F6'; // Blue
      } else if (phase === 'Active Customer') {
        label = 'SOPORTE';
        color = '#10B981'; // Emerald
      }
      this.phaseLabel.innerText = label;
      this.phaseLabel.style.backgroundColor = color;
    }
  }

  // Bind to global window object
  window.OmniJourneyWidget = new OmniJourneyWidget();
  window.OmniJourneyWidget.init();
})();
