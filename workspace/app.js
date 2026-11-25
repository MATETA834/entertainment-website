
const $ = (selector) => document.querySelector(selector);

const STORAGE_KEY = "nova-workspace-v1";

const tools = [
  { id: "writing", icon: "✎", name: "Writing Studio",
    description: "Draft emails, articles, stories and professional documents." },
  { id: "coding", icon: "</>", name: "Coding Assistant",
    description: "Create, explain and debug HTML, CSS and JavaScript." },
  { id: "research", icon: "⌕", name: "Research",
    description: "Explore a topic and organize research notes." },
  { id: "translation", icon: "文", name: "Translation",
    description: "Translate text between different languages." },
  { id: "learning", icon: "◇", name: "Learning Assistant",
    description: "Understand concepts and practice new skills." },
  { id: "images", icon: "▧", name: "Image Studio",
    description: "Prepare image prompts for your creative projects." }
];

const toolById = Object.fromEntries(tools.map(t => [t.id, t]));

let state = loadState();
let currentPage = "chat";
let toastTimer;

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.chats)) {
      return {
        chats: saved.chats,
        activeId: saved.activeId || null,
        dark: Boolean(saved.dark),
        projects: Array.isArray(saved.projects) ? saved.projects : []
      };
    }
  } catch (error) {
    console.warn("Could not load saved workspace.", error);
  }

  return { chats: [], activeId: null, dark: false, projects: [] };
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    showToast("Browser storage is full or unavailable.");
  }
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}

function makeId() {
  return Date.now().toString(36) +
    Math.random().toString(36).slice(2, 8);
}

function activeChat() {
  return state.chats.find(chat => chat.id === state.activeId);
}

function createChat() {
  const chat = {
    id: makeId(),
    title: "New conversation",
    messages: [],
    updatedAt: Date.now()
  };

  state.chats.unshift(chat);
  state.activeId = chat.id;
  saveState();
  currentPage = "chat";
  closeSidebar();
  render();
  $("#messageInput")?.focus();
}

function openChat(id) {
  if (!state.chats.some(chat => chat.id === id)) return;
  state.activeId = id;
  currentPage = "chat";
  closeSidebar();
  saveState();
  render();
}

function renderHistory() {
  const container = $("#historyList");
  const recent = [...state.chats]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 12);

  container.innerHTML = recent.length
    ? recent.map(chat => `
        <button class="history-entry" data-chat-id="${escapeHTML(chat.id)}"
          title="${escapeHTML(chat.title)}">
          ${escapeHTML(chat.title)}
        </button>
      `).join("")
    : '<p class="nav-label">Your chats will appear here</p>';
}

function navigate(page) {
  currentPage = page;
  closeSidebar();
  render();
}

function render() {
  document.body.classList.toggle("dark", state.dark);
  $("#pageCrumb").textContent = {
    chat: "AI Chat",
    explore: "Explore tools",
    projects: "Projects",
    files: "My files",
    settings: "Settings",
    help: "Help center"
  }[currentPage] || "Workspace";

  document.querySelectorAll("[data-page]").forEach(button => {
    button.classList.toggle(
      "active", button.dataset.page === currentPage
    );
  });

  renderHistory();

  const page = $("#pageContent");

  if (currentPage === "chat") page.innerHTML = renderChat();
  else if (currentPage === "explore") page.innerHTML = renderExplore();
  else if (currentPage === "projects") page.innerHTML = renderProjects();
  else if (currentPage === "files") page.innerHTML = renderFiles();
  else if (currentPage === "settings") page.innerHTML = renderSettings();
  else if (currentPage === "help") page.innerHTML = renderHelp();

  if (currentPage === "chat") {
    renderMessages();
  }
}

function renderChat() {
  return `
    <div class="chat-page">
      <div id="chatMessages" class="chat-messages"></div>
      <div class="composer-wrap">
        <form class="composer" id="chatForm">
          <textarea id="messageInput" rows="1"
            aria-label="Message the AI"
            placeholder="Message Nova AI..."></textarea>
          <button class="send-btn" id="sendButton" type="submit"
            aria-label="Send message">↑</button>
        </form>
        <p class="disclaimer">
          Demo mode: responses are examples, not live AI answers.
          Connect an AI backend before using this with real users.
        </p>
      </div>
    </div>
  `;
}

function renderMessages() {
  const container = $("#chatMessages");
  if (!container) return;

  const chat = activeChat();

  if (!chat || chat.messages.length === 0) {
    container.innerHTML = `
      <div class="welcome">
        <div class="welcome-mark">✳</div>
        <h1>What can I help you with?</h1>
        <p>Think, create, learn and get things done with Nova AI.</p>
        <div class="suggestions">
          <button class="suggestion" data-prompt="Help me write a professional email">
            <strong>✎ Write something</strong>
            Draft an email or document
          </button>
          <button class="suggestion" data-prompt="Help me build a website using HTML, CSS and JavaScript">
            <strong>⌘ Build with code</strong>
            Create or debug a website
          </button>
          <button class="suggestion" data-prompt="Explain an interesting topic in simple language">
            <strong>◇ Learn something</strong>
            Understand a new concept
          </button>
          <button class="suggestion" data-prompt="Help me plan a new creative project">
            <strong>✧ Explore an idea</strong>
            Turn an idea into a plan
          </button>
        </div>
      </div>
    `;
    return;
  }

  container.innerHTML = chat.messages.map((message, index) => {
    const isUser = message.role === "user";

    return `
      <div class="message ${isUser ? "user" : "assistant"}">
        ${isUser ? "" : '<div class="message-avatar">✳</div>'}
        <div class="message-body">
          <div>${escapeHTML(message.text).replace(/\n/g, "<br>")}</div>
          ${isUser ? "" : `
            <div class="message-actions">
              <button data-copy-index="${index}">Copy</button>
            </div>
          `}
        </div>
      </div>
    `;
  }).join("");

  container.scrollTop = container.scrollHeight;
}

function demoResponse(text) {
  const lower = text.toLowerCase();

  if (lower.includes("html") || lower.includes("website") ||
      lower.includes("javascript") || lower.includes("code")) {
    return `Let's work on your coding task.\n\n1. Describe what you want to build.\n2. Create the HTML structure.\n3. Add CSS for the design.\n4. Add JavaScript for interactions.\n5. Test everything in your browser.\n\nThis is a demonstration response. Connect your AI backend to receive real answers and generated code.`;
  }

  if (lower.includes("email") || lower.includes("write") ||
      lower.includes("article")) {
    return `Let's create your content step by step.\n\nFirst, identify your audience, the main message, and the tone you want. Then we can prepare a draft and revise it to fit your needs.\n\nDemo mode is active, so this is a sample response rather than a live AI-generated draft.`;
  }

  if (lower.includes("translate") || lower.includes("translation")) {
    return `I can help you plan a translation task. Choose the source language and the language you want to translate into, then provide the text.\n\nLive translation requires a connected AI service.`;
  }

  return `Thanks for your message!\n\nYour workspace is working, but the AI connection has not been configured yet. This sample response confirms that messages can be sent and displayed.\n\nNext, connect your backend API to enable real AI answers. Keep your API key on the server, never in this browser code.`;
}

async function sendMessage(text) {
  const cleanText = text.trim();
  if (!cleanText) return;

  if (!activeChat()) {
    const chat = {
      id: makeId(),
      title: cleanText.slice(0, 42),
      messages: [],
      updatedAt: Date.now()
    };
    state.chats.unshift(chat);
    state.activeId = chat.id;
  }

  const chat = activeChat();
  chat.messages.push({ role: "user", text: cleanText });
  if (chat.messages.length === 1) {
    chat.title = cleanText.slice(0, 42);
  }
  chat.updatedAt = Date.now();

  saveState();
  renderHistory();
  renderMessages();

  const input = $("#messageInput");
  if (input) input.value = "";

  // Temporary demonstration reply. Replace this with a backend
  // request when the AI API is configured.
  const reply = demoResponse(cleanText);

  chat.messages.push({ role: "assistant", text: reply });
  chat.updatedAt = Date.now();
  saveState();
  renderMessages();
  renderHistory();
}

function renderExplore() {
  return `
    <div class="page-heading">
      <h1>Explore tools</h1>
      <p>Choose a tool to get started with your next task.</p>
    </div>
    <div class="tool-grid">
      ${tools.map(tool => `
        <button class="tool-card" data-tool="${tool.id}">
          <div class="tool-icon">${tool.icon}</div>
          <h3>${tool.name}</h3>
          <p>${tool.description}</p>
        </button>
      `).join("")}
    </div>
  `;
}

function renderProjects() {
  return `
    <div class="page-heading">
      <h1>Your projects</h1>
      <p>Keep related ideas and tasks organized in one place.</p>
    </div>
    <div class="panel">
      <h2>Create a project</h2>
      <p>Give your project a name to get started.</p>
      <form id="projectForm">
        <div class="field">
          <label for="projectName">Project name</label>
          <input id="projectName" maxlength="80" required
            placeholder="e.g. My business website">
        </div>
        <button class="primary-btn" type="submit">Create project</button>
      </form>
    </div>
    <div id="projectList">
      ${state.projects.length ? state.projects.map(project => `
        <div class="panel">
          <h2>${escapeHTML(project.name)}</h2>
          <p>Created ${new Date(project.createdAt).toLocaleDateString()}</p>
        </div>
      `).join("") : `
        <div class="empty-state">
          <div class="empty-icon">▦</div>
          <h2>No projects yet</h2>
          <p>Create your first project above to get started.</p>
        </div>
      `}
    </div>
  `;
}

function renderFiles() {
  return `
    <div class="page-heading">
      <h1>My files</h1>
      <p>Prepare to manage documents for your AI tasks.</p>
    </div>
    <div class="panel">
      <div class="empty-state">
        <div class="empty-icon">▤</div>
        <h2>Document tools are coming next</h2>
        <p>This starter workspace does not upload or analyze files yet.
        We will add file selection, upload validation and backend processing
        in a later step.</p>
        <button class="primary-btn" data-page="explore">Explore tools</button>
      </div>
    </div>
  `;
}

function renderSettings() {
  return `
    <div class="page-heading">
      <h1>Settings</h1>
      <p>Customize your workspace preferences.</p>
    </div>
    <div class="panel">
      <h2>Appearance</h2>
      <p>Choose how Nova AI looks on your device.</p>
      <button class="secondary-btn" id="settingsTheme">
        Switch to ${state.dark ? "light" : "dark"} mode
      </button>
    </div>
    <div class="panel">
      <h2>Conversation data</h2>
      <p>Chats are currently stored in this browser only.
      They are not synced between devices or user accounts.</p>
      <button class="secondary-btn" id="exportChats">Export chats</button>
      <button class="secondary-btn" id="clearChats">Clear all chats</button>
    </div>
  `;
}

function renderHelp() {
  return `
    <div class="page-heading">
      <h1>Help center</h1>
      <p>Get familiar with your workspace.</p>
    </div>
    <div class="panel">
      <h2>How do I start a conversation?</h2>
      <p>Select New chat, type your message and press the arrow button.
      Demo replies are enabled until the AI backend is connected.</p>
    </div>
    <div class="panel">
      <h2>Where are my conversations stored?</h2>
      <p>This starter version saves chat data in local browser storage.
      Clearing browser data may remove those conversations.</p>
    </div>
    <div class="panel">
      <h2>How do I connect real AI?</h2>
      <p>Configure a server-side endpoint that calls your chosen AI provider.
      Keep credentials out of frontend code.</p>
    </div>
  `;
}

function closeSidebar() {
  $("#sidebar").classList.remove("open");
}

function exportChats() {
  const data = JSON.stringify(state.chats, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "nova-chat-history.json";
  link.click();
  URL.revokeObjectURL(url);
  showToast("Chat export prepared.");
}

// Global click handling for navigation and workspace controls.
document.addEventListener("click", event => {
  const pageButton = event.target.closest("[data-page]");
  if (pageButton) {
    navigate(pageButton.dataset.page);
    return;
  }

  const navButton = event.target.closest(".nav-item[data-page]");
  if (navButton) {
    navigate(navButton.dataset.page);
    return;
  }

  const historyButton = event.target.closest("[data-chat-id]");
  if (historyButton) {
    openChat(historyButton.dataset.chatId);
    return;
  }

  const promptButton = event.target.closest("[data-prompt]");
  if (promptButton) {
    const input = $("#messageInput");
    if (input) {
      input.value = promptButton.dataset.prompt;
      input.focus();
    }
    return;
  }

  const toolButton = event.target.closest("[data-tool]");
  if (toolButton) {
    const tool = toolById[toolButton.dataset.tool];
    if (!tool) return;

    createChat();
    const input = $("#messageInput");
    if (input) {
      input.value = `Help me use ${tool.name}. ${tool.description}`;
      input.focus();
    }
    showToast(`${tool.name} selected. Send a message to continue.`);
    return;
  }

  const copyButton = event.target.closest("[data-copy-index]");
  if (copyButton) {
    const message = activeChat()?.messages[
      Number(copyButton.dataset.copyIndex)
    ];
    if (message && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(message.text)
        .then(() => showToast("Message copied."))
        .catch(() => showToast("Copy was not available."));
    } else {
      showToast("Copy is not supported in this browser context.");
    }
  }
});

document.addEventListener("submit", event => {
  if (event.target.id === "chatForm") {
    event.preventDefault();
    sendMessage($("#messageInput")?.value || "");
  }

  if (event.target.id === "projectForm") {
    event.preventDefault();
    const input = $("#projectName");
    const name = input.value.trim();
    if (!name) return;

    state.projects.unshift({
      id: makeId(),
      name,
      createdAt: Date.now()
    });
    saveState();
    render();
    showToast("Project created.");
  }
});

document.addEventListener("click", event => {
  if (event.target.closest("#newChat") ||
      event.target.closest("#topNewChat")) {
    createChat();
  }

  if (event.target.closest("#menuToggle")) {
    $("#sidebar").classList.toggle("open");
  }

  if (event.target.closest("#themeToggle") ||
      event.target.closest("#settingsTheme")) {
    state.dark = !state.dark;
    saveState();
    render();
  }

  if (event.target.closest("#exportChats")) {
    exportChats();
  }

  if (event.target.closest("#clearChats")) {
    if (confirm("Delete all saved conversations in this browser?")) {
      state.chats = [];
      state.activeId = null;
      saveState();
      render();
      showToast("Conversations cleared.");
    }
  }
});

document.addEventListener("keydown", event => {
  if ((event.ctrlKey || event.metaKey) &&
      event.key.toLowerCase() === "k") {
    event.preventDefault();
    createChat();
  }

  if (event.key === "Escape") closeSidebar();
});

render();
