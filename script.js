// Get elements
const companyInput = document.getElementById('companyInput');
const analyzeBtn = document.getElementById('analyzeBtn');
const messagesArea = document.getElementById('messagesArea');
const chatInput = document.getElementById('chatInput');
const sendMsgBtn = document.getElementById('sendMsgBtn');

let currentRequestId = null;
let isAgentActive = false;
let pollInterval = null;

// Add message to chat
function addMessageToChat(text, sender = 'agent') {
    const placeholder = messagesArea.querySelector('.disabled-chat-placeholder');
    if (placeholder) placeholder.remove();

    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender === 'user' ? 'user' : 'agent'}`;
    const avatarIcon = sender === 'user' ? '<i class="fas fa-user"></i>' : '<i class="fas fa-robot"></i>';
    messageDiv.innerHTML = `
<div class="avatar">${avatarIcon}</div>
<div class="bubble">${text.replace(/\n/g, '<br>')}</div>
    `;
    messagesArea.appendChild(messageDiv);
    messagesArea.scrollTop = messagesArea.scrollHeight;
}

// Reset chat
function resetChatUI() {
    messagesArea.innerHTML = `<div class="disabled-chat-placeholder">
<i class="fas fa-microphone-alt"></i>
<p>🔍 Enter a company/product/URL and click <strong>Analyze</strong><br> to activate the AI customer support agent.</p>
</div>`;
    chatInput.disabled = true;
    sendMsgBtn.disabled = true;
    isAgentActive = false;
    if (pollInterval) clearInterval(pollInterval);
}

// Activate agent
function activateAgent() {
    chatInput.disabled = false;
    sendMsgBtn.disabled = false;
    isAgentActive = true;
    addMessageToChat("✅ Analysis complete! I'm now ready to answer your questions. How can I help you?");
    chatInput.focus();
}

// Poll for status
function pollStatus(requestId) {
    if (pollInterval) clearInterval(pollInterval);
    pollInterval = setInterval(async () => {
        try {
            const res = await fetch(`/api/status?id=${requestId}`);
            const data = await res.json();
            if (data.status === 'ready') {
                clearInterval(pollInterval);
                activateAgent();
            }
        } catch (err) {
            console.error('Poll error', err);
        }
    }, 2000);
}

// Handle analyze button
async function handleAnalyze() {
    const query = companyInput.value.trim();
    if (!query) {
        alert("Please enter a product name, company, or URL.");
        return;
    }

    analyzeBtn.innerHTML = '<i class="fas fa-spinner loading-spinner"></i> Analyzing...';
    analyzeBtn.disabled = true;
    resetChatUI();

    try {
        const response = await fetch('/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);

        currentRequestId = data.requestId;
        addMessageToChat(`🔍 Researching ${data.company}... This may take a moment.`);
        pollStatus(currentRequestId);
    } catch (error) {
        console.error(error);
        addMessageToChat(`❌ Failed: ${error.message}. Please try again.`);
        analyzeBtn.innerHTML = 'Analyze <i class="fas fa-arrow-right"></i>';
        analyzeBtn.disabled = false;
    } finally {
        analyzeBtn.innerHTML = 'Analyze <i class="fas fa-arrow-right"></i>';
        analyzeBtn.disabled = false;
    }
}

// Send message
async function sendUserMessage() {
    if (!isAgentActive) {
        addMessageToChat("Agent not ready. Please wait for analysis.", 'agent');
        return;
    }
    const userText = chatInput.value.trim();
    if (userText === "") return;

    addMessageToChat(userText, 'user');
    chatInput.value = "";

    // Simple response (you can replace with real AI later)
    setTimeout(() => {
        addMessageToChat("Thanks for your question! I'm processing your request. (This is a demo response - connect n8n for real answers!)", 'agent');
    }, 500);
}

// Event listeners
analyzeBtn.addEventListener('click', handleAnalyze);
sendMsgBtn.addEventListener('click', sendUserMessage);
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter'&& !chatInput.disabled && isAgentActive) sendUserMessage();
});

resetChatUI();
