/* =========================================================================
   chatbot.js — chat overlay (slides up over the dashboard, never navigates)
   -------------------------------------------------------------------------
   Messages are persisted server-side via ChatSession/ChatMessage (see
   views.py: list_chats, chat_detail, chatbot_message). This file just
   drives the UI and talks to those endpoints through apiFetch().
   ========================================================================= */

let activeChatId = null;
let chatPending = false;   // true while waiting for the bot's reply
let chatEpoch = 0;         // bumped whenever a different chat is opened

document.addEventListener('DOMContentLoaded', () => {
  const overlay = document.getElementById('chatbotOverlay');
  if (!overlay) return;

  const dashboardBar = document.getElementById('askAnythingBar');
  const chatInput = document.getElementById('chatInput');
  const closeBtn = document.getElementById('closeChatBtn');

  dashboardBar.addEventListener('click', () => openChatbot(null));

  closeBtn.addEventListener('click', closeChatbot);

  chatInput.addEventListener('keydown', (e) => {
    // e.isComposing: don't send while an IME (e.g. Arabic/Japanese) is mid-composition
    if (e.key === 'Enter' && !e.isComposing && chatInput.value.trim() && !chatPending) {
      sendChatMessage(chatInput.value.trim());
      chatInput.value = '';
    }
  });
});

async function openChatbot(chatId) {
  const overlay = document.getElementById('chatbotOverlay');
  overlay.classList.add('open');
  activeChatId = chatId;
  chatEpoch++;

  const thread = document.getElementById('chatThread');
  const emptyState = document.getElementById('chatEmptyState');
  thread.innerHTML = '';

  if (chatId) {
    try {
      const chat = await apiFetch(`/api/chats/${chatId}/`);
      if (chat.messages && chat.messages.length) {
        emptyState.classList.add('hidden');
        chat.messages.forEach(m => appendBubble(m.sender, m.text, false));
        scrollChatToBottom();
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

function scrollChatToBottom() {
  // The scrolling element is .chat-body (it wraps the thread), not the thread.
  const body = document.querySelector('#chatbotOverlay .chat-body');
  if (body) body.scrollTop = body.scrollHeight;
}

function setChatPending(pending) {
  chatPending = pending;
  const input = document.getElementById('chatInput');
  input.disabled = pending;
  if (!pending) input.focus();
}

function showTyping() {
  const bubble = appendBubble('bot', '', true);
  bubble.classList.add('typing');
  bubble.setAttribute('aria-label', 'Coach is typing');
  bubble.innerHTML = '<span></span><span></span><span></span>';
  scrollChatToBottom();
  return bubble;
}

async function sendChatMessage(text) {
  if (chatPending) return;
  setChatPending(true);

  document.getElementById('chatEmptyState').classList.add('hidden');
  appendBubble('user', text, true);
  const typing = showTyping();
  const epoch = chatEpoch;

  try {
    const payload = { message: text };
    if (activeChatId) payload.chat_id = activeChatId;

    const result = await apiFetch('/api/chat/', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const isNewChat = !payload.chat_id;      // decided before the await
    const stillHere = epoch === chatEpoch;  // user hasn't switched to another chat
    if (stillHere) {
      activeChatId = result.chat_id;
      typing.remove();
      appendBubble('bot', result.reply, true);
    }

    if (isNewChat && typeof refreshHistoryList === 'function') {
      refreshHistoryList(); // new chat now shows up in the sidebar's History list
    }
  } catch (err) {
    console.error('Failed to send message', err);
    typing.remove();
    if (epoch === chatEpoch) {
      const msg = (err && err.data && err.data.error)
        ? err.data.error
        : 'Sorry, something went wrong sending that. Please try again.';
      appendBubble('bot', msg, true);
    }
  } finally {
    setChatPending(false);
    scrollChatToBottom();
  }
}

function appendBubble(sender, text, animate) {
  const thread = document.getElementById('chatThread');
  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble ' + (sender === 'user' ? 'from-user' : 'from-bot');
  if (animate) bubble.classList.add('enter');
  bubble.textContent = text;
  thread.appendChild(bubble);
  scrollChatToBottom();
  return bubble;
}
