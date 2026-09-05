/* =========================================================================
   chatbot.js — chat overlay (slides up over the dashboard, never navigates)
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

function openChatbot(chatId) {
  const overlay = document.getElementById('chatbotOverlay');
  overlay.classList.add('open');
  activeChatId = chatId;

  const thread = document.getElementById('chatThread');
  const emptyState = document.getElementById('chatEmptyState');
  thread.innerHTML = '';

  if (chatId) {
    const chat = getChats().find(c => c.id === chatId);
    if (chat && chat.messages.length) {
      emptyState.classList.add('hidden');
      chat.messages.forEach(m => appendBubble(m.sender, m.text, false));
    } else {
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

function sendChatMessage(text) {
  const emptyState = document.getElementById('chatEmptyState');
  emptyState.classList.add('hidden');

  // Create (or reuse) a chat record so this shows up in History.
  const chats = getChats();
  let chat = chats.find(c => c.id === activeChatId);
  if (!chat) {
    chat = { id: 'c' + Date.now(), title: text.slice(0, 40), messages: [] };
    chats.unshift(chat);
    activeChatId = chat.id;
  }

  chat.messages.push({ sender: 'user', text });
  appendBubble('user', text, true);
  saveChats(chats);
  if (typeof renderHistoryList === 'function') renderHistoryList(); // refresh the sidebar's History list

  const thread = document.getElementById('chatThread');
  thread.scrollTop = thread.scrollHeight;

  setTimeout(() => {
    const reply = "Got it! (This is a placeholder response — AI backend not connected yet.)";
    const freshChats = getChats();
    const c = freshChats.find(c => c.id === activeChatId);
    c.messages.push({ sender: 'bot', text: reply });
    saveChats(freshChats);
    appendBubble('bot', reply, true);
    thread.scrollTop = thread.scrollHeight;
  }, 700);
}

function appendBubble(sender, text, animate) {
  const thread = document.getElementById('chatThread');
  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble ' + (sender === 'user' ? 'from-user' : 'from-bot');
  if (animate) bubble.classList.add('enter');
  bubble.textContent = text;
  thread.appendChild(bubble);
}

