const CLIENT_ID = "1453017552551936000";
const DASH_KEY = "fr1ev-dashboard-state-v2";

const state = {
  token: localStorage.getItem("fr1evDiscordToken") || "",
  apiBase: "",
  apiOnline: false,
  user: null,
  isOwner: false,
  guilds: [],
  selectedGuildId: "",
  overview: null,
};

const els = {
  loginBtn: document.querySelector("#loginBtn"),
  logoutBtn: document.querySelector("#logoutBtn"),
  apiBase: document.querySelector("#apiBase"),
  saveApi: document.querySelector("#saveApi"),
  testApi: document.querySelector("#testApi"),
  loadGuilds: document.querySelector("#loadGuilds"),
  reloadOverview: document.querySelector("#reloadOverview"),
  sessionState: document.querySelector("#sessionState"),
  apiState: document.querySelector("#apiState"),
  guildState: document.querySelector("#guildState"),
  memberState: document.querySelector("#memberState"),
  userBox: document.querySelector("#userBox"),
  guildList: document.querySelector("#guildList"),
  guildSearch: document.querySelector("#guildSearch"),
  ownerBanner: document.querySelector("#ownerBanner"),
  selectedName: document.querySelector("#selectedName"),
  channelCount: document.querySelector("#channelCount"),
  roleCount: document.querySelector("#roleCount"),
  automodState: document.querySelector("#automodState"),
  logBox: document.querySelector("#logBox"),
  modUserId: document.querySelector("#modUserId"),
  modReason: document.querySelector("#modReason"),
  modDuration: document.querySelector("#modDuration"),
  amEnabled: document.querySelector("#amEnabled"),
  amSpam: document.querySelector("#amSpam"),
  amInvites: document.querySelector("#amInvites"),
  amLinks: document.querySelector("#amLinks"),
  amMentions: document.querySelector("#amMentions"),
  amTimeout: document.querySelector("#amTimeout"),
  amWords: document.querySelector("#amWords"),
  saveAutomod: document.querySelector("#saveAutomod"),
  roleUserId: document.querySelector("#roleUserId"),
  roleSelect: document.querySelector("#roleSelect"),
  addRole: document.querySelector("#addRole"),
  removeRole: document.querySelector("#removeRole"),
  channelSelect: document.querySelector("#channelSelect"),
  announceColor: document.querySelector("#announceColor"),
  announceEmbed: document.querySelector("#announceEmbed"),
  announceMessage: document.querySelector("#announceMessage"),
  sendAnnouncement: document.querySelector("#sendAnnouncement"),
};

let lastLogMessage = "";
let lastLogAt = 0;

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(DASH_KEY) || "{}");
    state.apiBase = saved.apiBase || defaultApiBase();
    state.selectedGuildId = saved.selectedGuildId || "";
  } catch {
    state.apiBase = defaultApiBase();
  }
  els.apiBase.value = state.apiBase;
}

function defaultApiBase() {
  if (location.hostname === "127.0.0.1" || location.hostname === "localhost") {
    return location.origin;
  }
  return "";
}

function saveState() {
  localStorage.setItem(DASH_KEY, JSON.stringify({
    apiBase: state.apiBase,
    selectedGuildId: state.selectedGuildId,
  }));
}

function redirectUri() {
  if (location.hostname === "127.0.0.1" || location.hostname === "localhost") {
    return new URL("/callback.html", location.origin).toString();
  }
  return new URL("/fr1ev-security/callback.html", location.origin).toString();
}

function loginUrl() {
  const url = new URL("https://discord.com/oauth2/authorize");
  url.searchParams.set("client_id", CLIENT_ID);
  url.searchParams.set("redirect_uri", redirectUri());
  url.searchParams.set("response_type", "token");
  // "guilds" is the Discord OAuth permission that asks to know what servers you are in.
  url.searchParams.set("scope", "identify guilds");
  url.searchParams.set("prompt", "consent");
  return url.toString();
}

function parseToken() {
  if (!location.hash.includes("access_token")) return;
  const params = new URLSearchParams(location.hash.slice(1));
  const token = params.get("access_token");
  if (token) {
    state.token = token;
    localStorage.setItem("fr1evDiscordToken", token);
  }
  history.replaceState({}, document.title, location.pathname + location.search);
}

function log(message, once = false) {
  const now = Date.now();
  if (once && message === lastLogMessage && now - lastLogAt < 15000) {
    return;
  }
  lastLogMessage = message;
  lastLogAt = now;
  const stamp = new Date().toLocaleTimeString();
  els.logBox.textContent = `[${stamp}] ${message}\n${els.logBox.textContent}`.trim();
}

function cleanApiBase() {
  return state.apiBase.replace(/\/+$/, "");
}

async function api(path, options = {}) {
  if (!state.token) throw new Error("Login with Discord first.");
  if (!state.apiBase) throw new Error("Paste your Bot API URL, press Save API, then Test.");
  return requestJson(`${cleanApiBase()}${path}`, {
    ...options,
    headers: {
      "Authorization": `Bearer ${state.token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
}

async function publicApi(path) {
  if (!state.apiBase) throw new Error("Paste your Bot API URL, press Save API, then Test.");
  return requestJson(`${cleanApiBase()}${path}`);
}

async function requestJson(url, options = {}) {
  let res;
  try {
    res = await fetch(url, options);
  } catch (error) {
    const friendly = new Error(apiFetchHelp(error));
    friendly.status = 0;
    throw friendly;
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) {
    const error = new Error(data.error || `HTTP ${res.status}`);
    error.status = res.status;
    throw error;
  }
  return data;
}

function apiFetchHelp(error) {
  if (location.protocol === "https:" && state.apiBase.startsWith("http://")) {
    return "Bot API blocked by the browser. GitHub Pages needs an HTTPS tunnel URL, or open the local dashboard at http://127.0.0.1:8080/dashboard/.";
  }
  if (/Failed to fetch/i.test(error.message || "")) {
    return "Bot API is not reachable. Restart the bot, then press Test. If you are using GitHub Pages, paste an HTTPS tunnel URL.";
  }
  return error.message || "Bot API request failed.";
}

function renderSession() {
  els.sessionState.textContent = state.token ? "Logged in" : "Offline";
  els.apiState.textContent = state.apiOnline ? "Online" : (state.apiBase ? "Not tested" : "Not set");
  els.loginBtn.classList.toggle("hidden", Boolean(state.token));
  els.logoutBtn.classList.toggle("hidden", !state.token);
  els.guildState.textContent = selectedGuild()?.name || "None";
  els.memberState.textContent = state.overview?.member_count || "-";
  els.ownerBanner.classList.toggle("hidden", !state.isOwner);
  document.querySelectorAll(".owner-only").forEach((item) => {
    item.classList.toggle("hidden", !state.isOwner);
  });
}

async function ensureApiOnline(showSuccess = false) {
  if (!state.apiBase) {
    state.apiOnline = false;
    renderSession();
    log("Paste your Bot API URL, press Save API, then Test.", true);
    return false;
  }

  try {
    const data = await publicApi("/health");
    state.apiOnline = true;
    renderSession();
    if (showSuccess) {
      log(`API online: ${data.bot || "bot ready"}.`);
    }
    return true;
  } catch (error) {
    state.apiOnline = false;
    renderSession();
    log(error.message, true);
    return false;
  }
}

function selectedGuild() {
  return state.guilds.find(guild => guild.id === state.selectedGuildId) || null;
}

function renderGuilds() {
  const query = (els.guildSearch.value || "").trim().toLowerCase();
  const guilds = query
    ? state.guilds.filter(guild => `${guild.name} ${guild.id}`.toLowerCase().includes(query))
    : state.guilds;

  if (!state.guilds.length) {
    els.guildList.innerHTML = `<div class="user-box">No servers loaded. Login with Discord and approve the permission to know what servers you are in.</div>`;
    return;
  }

  if (!guilds.length) {
    els.guildList.innerHTML = `<div class="user-box">No servers match that search.</div>`;
    return;
  }

  els.guildList.innerHTML = guilds.map(guild => `
    <button class="guild-btn ${guild.id === state.selectedGuildId ? "active" : ""} ${guild.manageable === false ? "locked" : ""}" data-guild="${guild.id}" type="button">
      <strong>${guild.name}</strong>
      <span class="guild-meta">
        <small>${guild.id}</small>
        <small class="server-state">${serverStateText(guild)}</small>
        ${guild.owner_unlock ? `<small class="owner-pill">Owner unlock</small>` : ``}
      </span>
    </button>
  `).join("");
  document.querySelectorAll("[data-guild]").forEach(button => {
    button.addEventListener("click", async () => {
      const guild = state.guilds.find(item => item.id === button.dataset.guild);
      if (guild && guild.manageable === false) {
        if (!guild.bot_in_server) {
          log(`${guild.name}: invite the bot before managing this server.`);
        } else if (!guild.can_manage) {
          log(`${guild.name}: you need Manage Server or Administrator.`);
        }
        return;
      }
      state.selectedGuildId = button.dataset.guild;
      saveState();
      renderSession();
      renderGuilds();
      await loadOverview();
    });
  });
}

function serverStateText(guild) {
  if (guild.owner_unlock) return "Unlocked";
  if (guild.manageable) return "Ready";
  if (!guild.bot_in_server) return "Bot not in server";
  if (!guild.can_manage) return "No manage perms";
  return "Locked";
}

function renderOverview() {
  const guild = selectedGuild();
  els.selectedName.textContent = guild ? guild.name : "No server selected";
  els.guildState.textContent = guild ? guild.name : "None";

  if (!state.overview) {
    els.channelCount.textContent = "-";
    els.roleCount.textContent = "-";
    els.automodState.textContent = "-";
    els.roleSelect.innerHTML = "";
    els.channelSelect.innerHTML = "";
    return;
  }

  els.memberState.textContent = state.overview.member_count || "-";
  els.channelCount.textContent = state.overview.channels.length;
  els.roleCount.textContent = state.overview.roles.length;
  els.automodState.textContent = state.overview.automod?.enabled ? "On" : "Off";
  els.roleSelect.innerHTML = state.overview.roles.map(role => `<option value="${role.id}">${role.name}</option>`).join("");
  els.channelSelect.innerHTML = state.overview.channels.map(channel => `<option value="${channel.id}">#${channel.name}</option>`).join("");
  fillAutomod(state.overview.automod || {});
}

function fillAutomod(automod) {
  els.amEnabled.checked = Boolean(automod.enabled);
  els.amSpam.checked = Boolean(automod.spam_filter);
  els.amInvites.checked = Boolean(automod.invite_block);
  els.amLinks.checked = Boolean(automod.link_block);
  els.amMentions.value = automod.mention_limit ?? 8;
  els.amTimeout.value = automod.spam_timeout_seconds ?? 60;
  els.amWords.value = Array.isArray(automod.blocked_words) ? automod.blocked_words.join(", ") : "";
}

async function loadMe() {
  if (!state.token) {
    els.userBox.textContent = "Login to load your manageable servers.";
    renderSession();
    return;
  }
  if (!state.apiOnline && !(await ensureApiOnline(false))) {
    els.userBox.textContent = "Logged in with Discord. Connect or start the Bot API to load servers.";
    return;
  }
  try {
    const data = await api("/api/me");
    state.user = data.user;
    state.isOwner = Boolean(data.is_owner);
    els.userBox.innerHTML = `<strong>${state.user.username}</strong><br><span>${state.user.id}${state.isOwner ? " - Owner unlock" : ""}</span>`;
    log(`Logged in as ${state.user.username}.`);
  } catch (error) {
    log(error.message);
    if (error.status === 401 || /expired|missing discord access token/i.test(error.message)) {
      state.token = "";
      state.isOwner = false;
      localStorage.removeItem("fr1evDiscordToken");
      els.userBox.textContent = "Discord login expired. Login again.";
    } else {
      els.userBox.textContent = "Logged in with Discord. Connect or start the Bot API to load servers.";
    }
  }
  renderSession();
}

async function loadGuilds() {
  if (!state.apiOnline && !(await ensureApiOnline(false))) {
    return;
  }
  try {
    const data = await api("/api/guilds");
    state.guilds = data.guilds || [];
    state.isOwner = state.isOwner || Boolean(data.owner_unlock);
    const selectableGuilds = state.guilds.filter(guild => guild.manageable !== false);
    if (!state.selectedGuildId && selectableGuilds.length) state.selectedGuildId = selectableGuilds[0].id;
    if (!state.guilds.some(guild => guild.id === state.selectedGuildId)) state.selectedGuildId = selectableGuilds[0]?.id || "";
    if (selectedGuild()?.manageable === false) state.selectedGuildId = selectableGuilds[0]?.id || "";
    saveState();
    renderGuilds();
    renderSession();
    await loadOverview();
    log(`Loaded ${state.guilds.length} servers.`);
  } catch (error) {
    log(error.message);
  }
}

async function loadOverview() {
  if (!state.selectedGuildId) {
    state.overview = null;
    renderOverview();
    return;
  }
  try {
    const data = await api(`/api/guilds/${state.selectedGuildId}/overview`);
    state.overview = data.guild;
    renderOverview();
    renderSession();
    log(`Loaded ${state.overview.name}.`);
  } catch (error) {
    log(error.message);
  }
}

async function moderation(action) {
  try {
    const data = await api(`/api/guilds/${state.selectedGuildId}/moderation`, {
      method: "POST",
      body: JSON.stringify({
        action,
        user_id: els.modUserId.value,
        reason: els.modReason.value,
        duration_minutes: Number(els.modDuration.value || 10),
      }),
    });
    log(data.message || `${action} complete.`);
  } catch (error) {
    log(error.message);
  }
}

async function saveAutomod() {
  try {
    const data = await api(`/api/guilds/${state.selectedGuildId}/automod`, {
      method: "POST",
      body: JSON.stringify({
        enabled: els.amEnabled.checked,
        spam_filter: els.amSpam.checked,
        invite_block: els.amInvites.checked,
        link_block: els.amLinks.checked,
        mention_limit: Number(els.amMentions.value || 0),
        spam_timeout_seconds: Number(els.amTimeout.value || 0),
        blocked_words: els.amWords.value.split(",").map(word => word.trim()).filter(Boolean),
      }),
    });
    state.overview.automod = data.automod;
    renderOverview();
    log("Automod saved.");
  } catch (error) {
    log(error.message);
  }
}

async function role(action) {
  try {
    const data = await api(`/api/guilds/${state.selectedGuildId}/role`, {
      method: "POST",
      body: JSON.stringify({
        action,
        user_id: els.roleUserId.value,
        role_id: els.roleSelect.value,
      }),
    });
    log(data.message || `Role ${action} complete.`);
  } catch (error) {
    log(error.message);
  }
}

async function announce() {
  if (!state.isOwner) {
    log("Announcements are owner only.");
    return;
  }
  try {
    const data = await api(`/api/guilds/${state.selectedGuildId}/announce`, {
      method: "POST",
      body: JSON.stringify({
        channel_id: els.channelSelect.value,
        message: els.announceMessage.value,
        embed: els.announceEmbed.checked,
        color: els.announceColor.value,
      }),
    });
    log(data.message || "Announcement sent.");
  } catch (error) {
    log(error.message);
  }
}

function setupEvents() {
  els.loginBtn.addEventListener("click", () => location.href = loginUrl());
  els.logoutBtn.addEventListener("click", () => {
    state.token = "";
    state.user = null;
    state.isOwner = false;
    state.guilds = [];
    state.overview = null;
    localStorage.removeItem("fr1evDiscordToken");
    renderSession();
    renderGuilds();
    renderOverview();
    log("Logged out.");
  });
  els.saveApi.addEventListener("click", () => {
    state.apiBase = els.apiBase.value.trim();
    state.apiOnline = false;
    saveState();
    renderSession();
    log("API URL saved.");
  });
  els.testApi.addEventListener("click", async () => {
    state.apiBase = els.apiBase.value.trim();
    saveState();
    const ok = await ensureApiOnline(true);
    if (ok && state.token) {
      await loadMe();
      await loadGuilds();
    }
  });
  els.loadGuilds.addEventListener("click", loadGuilds);
  els.reloadOverview.addEventListener("click", loadOverview);
  els.guildSearch.addEventListener("input", renderGuilds);
  document.querySelectorAll("[data-mod-action]").forEach(button => {
    button.addEventListener("click", () => moderation(button.dataset.modAction));
  });
  els.saveAutomod.addEventListener("click", saveAutomod);
  els.addRole.addEventListener("click", () => role("add"));
  els.removeRole.addEventListener("click", () => role("remove"));
  els.sendAnnouncement.addEventListener("click", announce);
}

loadState();
parseToken();
setupEvents();
renderSession();
renderGuilds();
renderOverview();
bootstrap();

async function bootstrap() {
  if (!state.token) {
    log("Login with Discord to load your servers.", true);
    return;
  }
  const ok = await ensureApiOnline(false);
  if (!ok) {
    els.userBox.textContent = "Logged in with Discord. Connect or start the Bot API to load servers.";
    return;
  }
  await loadMe();
  await loadGuilds();
}
