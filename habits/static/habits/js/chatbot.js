/* =========================================================================
   chatbot.js — chat overlay (slides up over the dashboard, never navigates)
   -------------------------------------------------------------------------
   Messages are persisted server-side via ChatSession/ChatMessage (see
   views.py: list_chats, chat_detail, chatbot_message). This file just
   drives the UI and talks to those endpoints through apiFetch().
   ========================================================================= */

let activeChatId = null;

document.addEventListener('DOMContentLoaded', () => {
  const overlay = document.getElementById('chatbotOverlay');
  if (!overlay) return;

  const dashboardBar = document.getElementById('askAnythingBar');
  const chatInput = document.getElementById('chatInput');
  const closeBtn = document.getElementById('closeChatBtn');

  dashboardBar.addEventListener('click', () => openChatbot(null));

  closeBtn.addEventListener('click', closeChatbot);

  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && chatInput.value.trim()) {
      sendChatMessage(chatInput.value.trim());
      chatInput.value = '';
    }
  });
});

async function openChatbot(chatId) {
  const overlay = document.getElementById('chatbotOverlay');
  overlay.classList.add('open');
  activeChatId = chatId;

  const thread = document.getElementById('chatThread');
  const emptyState = document.getElementById('chatEmptyState');
  thread.innerHTML = '';

  if (chatId) {
    try {
      const chat = await apiFetch(`/api/chats/${chatId}/`);
      if (chat.messages && chat.messages.length) {
        emptyState.classList.add('hidden');
        chat.messages.forEach(m => appendBubble(m.sender, m.text, false));
      } else {
        emptyState.classList.remove('hidden');
      }
    } catch (err) {
      console.error('Failed to load chat', err);
      emptyState.classList.remove('hidden');
    }
  } else {
    emptyState.classList.remove('hidden');
  }

  document.getElementById('chatInput').focus();
}

function closeChatbot() {
  document.getElementById('chatbotOverlay').classList.remove('open');
}

async function sendChatMessage(text) {
  const emptyState = document.getElementById('chatEmptyState');
  emptyState.classList.add('hidden');
  appendBubble('user', text, true);

  const thread = document.getElementById('chatThread');
  thread.scrollTop = thread.scrollHeight;

  try {
    const payload = { message: text };
    if (activeChatId) payload.chat_id = activeChatId;

    const result = await apiFetch('/api/chat/', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const isNewChat = !activeChatId;
    activeChatId = result.chat_id;

    appendBubble('bot', result.reply, true);
    thread.scrollTop = thread.scrollHeight;

    if (isNewChat && typeof refreshHistoryList === 'function') {
      refreshHistoryList(); // new chat now shows up in the sidebar's History list
    }
  } catch (err) {
    console.error('Failed to send message', err);
    appendBubble('bot', 'Sorry, something went wrong sending that.', true);
  }
}

function appendBubble(sender, text, animate) {
  const thread = document.getElementById('chatThread');
  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble ' + (sender === 'user' ? 'from-user' : 'from-bot');
  if (animate) bubble.classList.add('enter');
  bubble.textContent = text;
  thread.appendChild(bubble);
}
