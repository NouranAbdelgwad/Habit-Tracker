/* =========================================================================
   chatbot.js — chat overlay (slides up over the dashboard, never navigates)
   -------------------------------------------------------------------------
   Messages are persisted server-side via ChatSession/ChatMessage (see
   views.py: list_chats, chat_detail, chatbot_message). This file just
   drives the UI and talks to those endpoints through apiFetch().
   ========================================================================= */

let activeChatId = null;
<<<<<<< HEAD
let chatPending = false;   // true while waiting for the bot's reply
let chatEpoch = 0;         // bumped whenever a different chat is opened
=======
>>>>>>> origin/main

document.addEventListener('DOMContentLoaded', () => {
  const overlay = document.getElementById('chatbotOverlay');
  if (!overlay) return;

  const dashboardBar = document.getElementById('askAnythingBar');
  const chatInput = document.getElementById('chatInput');
  const closeBtn = document.getElementById('closeChatBtn');

  dashboardBar.addEventListener('click', () => openChatbot(null));

  closeBtn.addEventListener('click', closeChatbot);

  chatInput.addEventListener('keydown', (e) => {
<<<<<<< HEAD
    // e.isComposing: don't send while an IME (e.g. Arabic/Japanese) is mid-composition
    if (e.key === 'Enter' && !e.isComposing && chatInput.value.trim() && !chatPending) {
=======
    if (e.key === 'Enter' && chatInput.value.trim()) {
>>>>>>> origin/main
      sendChatMessage(chatInput.value.trim());
      chatInput.value = '';
    }
  });
});

async function openChatbot(chatId) {
  const overlay = document.getElementById('chatbotOverlay');
  overlay.classList.add('open');
  activeChatId = chatId;
<<<<<<< HEAD
  chatEpoch++;
=======
>>>>>>> origin/main

  const thread = document.getElementById('chatThread');
  const emptyState = document.getElementById('chatEmptyState');
  thread.innerHTML = '';

  if (chatId) {
    try {
      const chat = await apiFetch(`/api/chats/${chatId}/`);
      if (chat.messages && chat.messages.length) {
        emptyState.classList.add('hidden');
        chat.messages.forEach(m => appendBubble(m.sender, m.text, false));
<<<<<<< HEAD
        scrollChatToBottom();
=======
>>>>>>> origin/main
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

<<<<<<< HEAD
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
=======
async function sendChatMessage(text) {
  const emptyState = document.getElementById('chatEmptyState');
  emptyState.classList.add('hidden');
  appendBubble('user', text, true);

  const thread = document.getElementById('chatThread');
  thread.scrollTop = thread.scrollHeight;
>>>>>>> origin/main

  try {
    const payload = { message: text };
    if (activeChatId) payload.chat_id = activeChatId;

    const result = await apiFetch('/api/chat/', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

<<<<<<< HEAD
    const isNewChat = !payload.chat_id;      // decided before the await
    const stillHere = epoch === chatEpoch;  // user hasn't switched to another chat
    if (stillHere) {
      activeChatId = result.chat_id;
      typing.remove();
      appendBubble('bot', result.reply, true);
    }
=======
    const isNewChat = !activeChatId;
    activeChatId = result.chat_id;

    appendBubble('bot', result.reply, true);
    thread.scrollTop = thread.scrollHeight;
>>>>>>> origin/main

    if (isNewChat && typeof refreshHistoryList === 'function') {
      refreshHistoryList(); // new chat now shows up in the sidebar's History list
    }
  } catch (err) {
    console.error('Failed to send message', err);
<<<<<<< HEAD
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
=======
    appendBubble('bot', 'Sorry, something went wrong sending that.', true);
>>>>>>> origin/main
  }
}

function appendBubble(sender, text, animate) {
  const thread = document.getElementById('chatThread');
  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble ' + (sender === 'user' ? 'from-user' : 'from-bot');
  if (animate) bubble.classList.add('enter');
  bubble.textContent = text;
  thread.appendChild(bubble);
<<<<<<< HEAD
  scrollChatToBottom();
  return bubble;
=======
>>>>>>> origin/main
}
