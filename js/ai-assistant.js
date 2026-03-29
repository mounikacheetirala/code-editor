// AI Assistant Module - Complete Working Version
let aiChatOpen = false;
let aiPanel = null;

// Initialize AI Assistant
function initAIAssistant() {
    console.log('Initializing AI Assistant...');
    
    // Check if button already exists
    if (document.getElementById('ai-assistant-btn')) {
        console.log('AI button already exists');
        return;
    }
    
    // Create AI button
    const aiButton = document.createElement('button');
    aiButton.id = 'ai-assistant-btn';
    aiButton.innerHTML = '<i class="fas fa-robot"></i> AI Assistant';
    aiButton.className = 'ai-assistant-btn';
    aiButton.style.background = '#6f42c1';
    aiButton.style.marginLeft = '8px';
    aiButton.onclick = toggleAIChat;
    
    // Add to toolbar
    const toolbarRight = document.querySelector('.toolbar-right');
    if (toolbarRight) {
        toolbarRight.appendChild(aiButton);
        console.log('AI button added to toolbar');
    } else {
        console.log('Toolbar not found, retrying...');
        setTimeout(initAIAssistant, 1000);
        return;
    }
    
    // Create AI chat panel
    createAIChatPanel();
}

// Create AI chat panel
function createAIChatPanel() {
    // Check if panel already exists
    if (document.getElementById('ai-chat-panel')) {
        return;
    }
    
    aiPanel = document.createElement('div');
    aiPanel.id = 'ai-chat-panel';
    aiPanel.className = 'ai-chat-panel';
    aiPanel.style.display = 'none';
    aiPanel.innerHTML = `
        <div class="ai-chat-header">
            <h3><i class="fas fa-robot"></i> AI Coding Assistant</h3>
            <button id="close-ai-chat"><i class="fas fa-times"></i></button>
        </div>
        <div class="ai-chat-messages" id="ai-chat-messages">
            <div class="ai-message bot">
                <i class="fas fa-robot"></i>
                <div class="message-content">
                    Hello! I'm your AI coding assistant. I can help you with:
                    <ul style="margin-top: 8px; margin-left: 20px;">
                        <li>Code explanation</li>
                        <li>Bug fixing</li>
                        <li>Code optimization</li>
                        <li>Learning new concepts</li>
                    </ul>
                    <strong>Try asking me:</strong><br>
                    • "Explain my code"<br>
                    • "Find bugs"<br>
                    • "Optimize this code"<br>
                    • "How do I write a function?"
                </div>
            </div>
        </div>
        <div class="ai-chat-input-container">
            <textarea id="ai-chat-input" placeholder="Ask me anything about your code..." rows="3"></textarea>
            <div class="ai-chat-actions">
                <button id="explain-code-btn"><i class="fas fa-book"></i> Explain</button>
                <button id="fix-code-btn"><i class="fas fa-bug"></i> Fix Bugs</button>
                <button id="optimize-code-btn"><i class="fas fa-rocket"></i> Optimize</button>
                <button id="send-ai-message" style="background: #0e639c;"><i class="fas fa-paper-plane"></i> Send</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(aiPanel);
    console.log('AI chat panel created');
    
    // Add event listeners
    document.getElementById('close-ai-chat')?.addEventListener('click', toggleAIChat);
    document.getElementById('send-ai-message')?.addEventListener('click', sendAIMessage);
    document.getElementById('explain-code-btn')?.addEventListener('click', () => askAI('explain'));
    document.getElementById('fix-code-btn')?.addEventListener('click', () => askAI('fix'));
    document.getElementById('optimize-code-btn')?.addEventListener('click', () => askAI('optimize'));
    
    // Enter key to send
    const aiInput = document.getElementById('ai-chat-input');
    if (aiInput) {
        aiInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendAIMessage();
            }
        });
    }
}

// Toggle AI chat panel
function toggleAIChat() {
    const panel = document.getElementById('ai-chat-panel');
    if (panel) {
        const isVisible = panel.style.display === 'flex';
        panel.style.display = isVisible ? 'none' : 'flex';
        aiChatOpen = !isVisible;
        
        // Focus input when opening
        if (!isVisible) {
            setTimeout(() => {
                const input = document.getElementById('ai-chat-input');
                if (input) input.focus();
            }, 100);
        }
    }
}

// Quick ask AI
async function askAI(action) {
    const code = editor?.getValue() || '';
    const language = document.getElementById('language-selector')?.value || 'javascript';
    let prompt = '';
    
    switch(action) {
        case 'explain':
            prompt = `Please explain this ${language} code in simple terms:\n\n${code}`;
            break;
        case 'fix':
            prompt = `Please analyze this ${language} code for bugs and suggest fixes:\n\n${code}`;
            break;
        case 'optimize':
            prompt = `Please suggest optimizations for this ${language} code:\n\n${code}`;
            break;
    }
    
    const aiInput = document.getElementById('ai-chat-input');
    if (aiInput) {
        aiInput.value = prompt;
    }
    
    // Open panel if closed
    const panel = document.getElementById('ai-chat-panel');
    if (panel && panel.style.display !== 'flex') {
        panel.style.display = 'flex';
    }
    
    await sendAIMessage();
}

// Send message to AI
async function sendAIMessage() {
    const input = document.getElementById('ai-chat-input');
    const message = input?.value.trim();
    
    if (!message) {
        showNotification('Please enter a message', 'info');
        return;
    }
    
    // Add user message to chat
    addAIMessage(message, 'user');
    if (input) input.value = '';
    
    // Show typing indicator
    showAITyping();
    
    const code = editor?.getValue() || '';
    const language = document.getElementById('language-selector')?.value || 'javascript';
    
    try {
        const response = await fetch('http://localhost:5000/api/ai-assist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt: message,
                code: code,
                language: language
            })
        });
        
        const data = await response.json();
        hideAITyping();
        
        if (data.success) {
            addAIMessage(data.response, 'bot');
        } else {
            addAIMessage("I'm having trouble connecting. Please try again later.", 'bot error');
        }
    } catch (error) {
        console.error('AI error:', error);
        hideAITyping();
        addAIMessage("Network error. Please check if backend server is running on port 5000", 'bot error');
    }
}

// Add message to chat
function addAIMessage(message, sender) {
    const container = document.getElementById('ai-chat-messages');
    if (!container) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `ai-message ${sender}`;
    
    const icon = sender === 'bot' ? '<i class="fas fa-robot"></i>' : '<i class="fas fa-user"></i>';
    
    messageDiv.innerHTML = `
        ${icon}
        <div class="message-content">${formatAIMessage(escapeHtml(message))}</div>
    `;
    
    container.appendChild(messageDiv);
    container.scrollTop = container.scrollHeight;
}

// Format AI message with markdown
function formatAIMessage(message) {
    // Convert code blocks
    let formatted = message.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
        return `<pre><code class="language-${lang}">${code}</code></pre>`;
    });
    
    // Convert inline code
    formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Convert bold
    formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    
    // Convert line breaks
    formatted = formatted.replace(/\n/g, '<br>');
    
    // Convert bullet points
    formatted = formatted.replace(/•/g, '•');
    
    return formatted;
}

// Show typing indicator
function showAITyping() {
    const container = document.getElementById('ai-chat-messages');
    if (!container) return;
    
    // Remove existing typing indicator
    hideAITyping();
    
    const typingDiv = document.createElement('div');
    typingDiv.id = 'ai-typing';
    typingDiv.className = 'ai-message bot typing';
    typingDiv.innerHTML = `
        <i class="fas fa-robot"></i>
        <div class="message-content">
            <span class="typing-dots">Thinking<span class="dot">.</span><span class="dot">.</span><span class="dot">.</span></span>
        </div>
    `;
    container.appendChild(typingDiv);
    container.scrollTop = container.scrollHeight;
}

// Hide typing indicator
function hideAITyping() {
    const typing = document.getElementById('ai-typing');
    if (typing) typing.remove();
}

// Helper function to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Show notification
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.innerHTML = `
        <div style="background: ${type === 'success' ? '#2ea043' : type === 'error' ? '#f85149' : '#0e639c'}; 
                    color: white; padding: 12px 20px; border-radius: 8px; 
                    position: fixed; bottom: 20px; right: 20px; z-index: 10000;
                    animation: slideIn 0.3s ease;">
            ${escapeHtml(message)}
        </div>
    `;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
}

// Add typing animation CSS
const aiStyles = document.createElement('style');
aiStyles.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    .typing-dots {
        display: inline-flex;
        align-items: center;
        gap: 2px;
    }
    
    .dot {
        animation: dotPulse 1.4s infinite;
    }
    
    .dot:nth-child(2) { animation-delay: 0.2s; }
    .dot:nth-child(3) { animation-delay: 0.4s; }
    
    @keyframes dotPulse {
        0%, 60%, 100% { opacity: 0.3; }
        30% { opacity: 1; }
    }
`;
document.head.appendChild(aiStyles);

console.log('AI Assistant module loaded');