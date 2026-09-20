const host = window.host;

// Stable currency map (mirrors Schale.FlatData.CurrencyTypes) so the Accounts page can render balances regardless of how enum dict keys are serialized.
export const CURRENCIES = [
  [1, 'Gold', '信用积分'], [2, 'GemPaid', '付费青辉石'], [3, 'GemBonus', '免费青辉石'], [4, 'Gem', '青辉石'], [5, 'ActionPoint', 'AP'],
  [6, 'AcademyTicket', '日程券'], [7, 'ArenaTicket', '战术对抗赛挑战券'], [8, 'RaidTicket', '总力战挑战券'],
  [9, 'WeekDungeonChaserATicket', '悬赏通缉（街区战）挑战券'], [10, 'WeekDungeonFindGiftTicket', '信用回收挑战券'], [11, 'WeekDungeonBloodTicket', '据点防御挑战券'],
  [12, 'WeekDungeonChaserBTicket', '悬赏通缉（野外战）挑战券'], [13, 'WeekDungeonChaserCTicket', '悬赏通缉（室内战）挑战券'],
  [14, 'SchoolDungeonATicket', '学院交流会（崔尼蒂）挑战券'], [15, 'SchoolDungeonBTicket', '学院交流会（歌赫娜）挑战券'], [16, 'SchoolDungeonCTicket', '学院交流会（千禧年）挑战券'],
  [17, 'TimeAttackDungeonTicket', '综合战术考试挑战券'], [18, 'MasterCoin', '熟练证书'],
  [19, 'WorldRaidTicketA', '联合行动挑战券'], [20, 'WorldRaidTicketB', '联合行动挑战券 ω'], [21, 'WorldRaidTicketC', '联合行动挑战券 ψ'],
  [22, 'ChaserTotalTicket', '悬赏通缉票券'], [23, 'SchoolDungeonTotalTicket', '学院交流会票券'],
  [24, 'EliminateTicketA', '大决战（轻装甲）票券'], [25, 'EliminateTicketB', '大决战（重装甲）票券'], [26, 'EliminateTicketC', '大决战（特殊装甲）票券'], [27, 'EliminateTicketD', '大决战（弹力装甲）票券'],
];
export const CURRENCY_ID = Object.fromEntries(CURRENCIES.map(([id, name]) => [name, id]));
export const CURRENCY_NAME = Object.fromEntries(CURRENCIES.map(([id, , label]) => [id, label]));
export const PRIMARY_CURRENCIES = [4, 1, 5, 7, 8, 18]; // Gem, Gold, AP, Arena, Raid, MasterCoin

let apiPort = 5000;

async function refreshBase() {
  try {
    const cfg = await host.configRead();
    const p = cfg?.data?.ServerConfiguration?.HostPort;
    if (p) apiPort = parseInt(p, 10) || 5000;
  } catch { /* keep default */ }
  return apiPort;
}
function base() { return `http://127.0.0.1:${apiPort}`; }

async function req(method, pathname, body, { timeout = 12000 } = {}) {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(base() + pathname, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!res.ok) {
      const msg = (data && (data.error || data.Message || data.title)) || `HTTP ${res.status}`;
      throw new Error(msg);
    }
    return data;
  } finally {
    clearTimeout(tid);
  }
}

export const api = {
  refreshBase,
  port: () => apiPort,
  get: (p, opts) => req('GET', p, null, opts),
  post: (p, body, opts) => req('POST', p, body, opts),

  hostPort: () => `127.0.0.1:${apiPort}`,

  async health() {
    try { const r = await req('GET', '/health', null, { timeout: 1800 }); return r?.status === 'ok'; }
    catch { return false; }
  },

  // Two-stage probe so the UI never lies about being "online":
  //   live  = the web host answers /health (process is up / port bound)
  //   ready = /api/admin/status answers - that handler hits the DB, so a 200 means the server is genuinely able to serve, not just listening.
  async probe() {
    let live = false;
    try { const r = await req('GET', '/health', null, { timeout: 1500 }); live = r?.status === 'ok'; }
    catch { return { live: false, ready: false, status: null }; }
    if (!live) return { live: false, ready: false, status: null };
    try {
      const status = await req('GET', '/api/admin/status', null, { timeout: 2500 });
      return { live: true, ready: true, status };
    } catch {
      return { live: true, ready: false, status: null };
    }
  },

  status: () => req('GET', '/api/admin/status'),
  accounts: () => req('GET', '/api/admin/accounts'),
  accountDetail: (id) => req('GET', `/api/admin/account/${id}/detail`),
  accountCreate: (b) => req('POST', '/api/admin/account/create', b),
  accountUpdate: (b) => req('POST', '/api/admin/account/update', b),
  accountDelete: (id) => req('POST', '/api/admin/account/delete', { serverId: id }),
  selectedAccount: () => req('GET', '/api/admin/account/selected'),
  selectAccount: (id) => req('POST', '/api/admin/account/select', { serverId: id }),
  currencies: (id) => req('GET', `/api/admin/account/${id}/currencies`),
  setCurrency: (b) => req('POST', '/api/admin/currency/set', b),

  items: (id) => req('GET', `/api/admin/account/${id}/items`),
  giveItem: (b) => req('POST', '/api/admin/items/give', b),
  removeItem: (b) => req('POST', '/api/admin/items/remove', b),
  characters: (id) => req('GET', `/api/admin/account/${id}/characters`),

  mails: (id) => req('GET', `/api/admin/account/${id}/mails`),
  sendMail: (b) => req('POST', '/api/admin/mail/send', b),
  deleteMail: (b) => req('POST', '/api/admin/mail/delete', b),

  command: (uid, command) => req('POST', '/api/admin/command', { uid, command }),

  staticItems: (q) => req('GET', `/api/admin/static/items?limit=400&search=${encodeURIComponent(q || '')}`),
  staticCharacters: (q) => req('GET', `/api/admin/static/characters?limit=600&search=${encodeURIComponent(q || '')}`),
  staticEquipment: (q) => req('GET', `/api/admin/static/equipment?limit=400&search=${encodeURIComponent(q || '')}`),
  staticCurrencies: () => req('GET', '/api/admin/static/currencies'),
  parcelTypes: () => req('GET', '/api/admin/meta/parceltypes'),

  gachaConfig: () => req('GET', '/api/admin/gacha/config'),
  setGachaConfig: (b) => req('POST', '/api/admin/gacha/config', b),
  gachaBanners: () => req('GET', '/api/admin/gacha/banners'),
  eventSeasons: (uid) => req('GET', `/api/admin/events/seasons${uid ? `?uid=${uid}` : ''}`),

  // the import rewrites three 300MB ExcelDB copies and takes a backup of each the first time, so it gets a much longer leash than a normal admin call
  modsCharacters: () => req('GET', '/api/admin/mods/characters'),
  modsInspect: (zipPath) => req('POST', '/api/admin/mods/characters/inspect', { zipPath }, { timeout: 30000 }),
  modsImport: (b) => req('POST', '/api/admin/mods/characters/import', b, { timeout: 300000 }),
  modsCharacter: (id) => req('GET', `/api/admin/mods/characters/${id}`),
  modsUpdate: (id, b) => req('POST', `/api/admin/mods/characters/${id}/update`, b, { timeout: 120000 }),
  modsRemove: (id) => req('POST', `/api/admin/mods/characters/${id}/remove`, null, { timeout: 120000 }),

  notice: () => req('GET', '/api/admin/notice'),
  setNotice: (b) => req('POST', '/api/admin/notice', b),
  eventSchedule: () => req('GET', '/api/admin/events/schedule'),
  setEventSchedule: (b) => req('POST', '/api/admin/events/schedule', b),
  eventUnlocks: (id, uid) => req('GET', `/api/admin/events/${id}/unlocks${uid ? `?uid=${uid}` : ''}`),
  eventUnlock: (b) => req('POST', '/api/admin/events/unlock', b),
};

function makeStore(initial) {
  let state = initial;
  const subs = new Set();
  return {
    get: () => state,
    set(patch) { state = { ...state, ...patch }; subs.forEach((f) => f(state)); },
    subscribe(f) { subs.add(f); return () => subs.delete(f); },
  };
}

export const store = makeStore({
  procServer: 'stopped',   // process lifecycle state from main
  procMitm: 'stopped',
  serverPid: null,         // pid of the server child we spawned (if any)
  serverStartedAt: null,   // epoch ms the server child was spawned, null if we did not spawn it
  serverGraceMs: null,     // how long it gets to answer before silence is a symptom, null for a source run
  online: false,           // server is READY (db-backed /api/admin/status answered)
  live: false,             // web host answered /health but may not be ready yet
  status: null,            // /api/admin/status payload
  lastCheckedTs: 0,        // epoch ms of the last completed probe
  probeTarget: '127.0.0.1:5000',
  accounts: [],            // [{serverId,nickname,level,...}]
  targetId: null,          // selected account
});

export async function reloadAccounts() {
  try {
    const list = await api.accounts();
    store.set({ accounts: list || [] });
    const cur = store.get().targetId;
    if ((!cur || !list.some((a) => a.serverId === cur)) && list.length) {
      store.set({ targetId: list[0].serverId });
    }
    return list;
  } catch {
    store.set({ accounts: [] });
    return [];
  }
}

export function targetAccount() {
  const s = store.get();
  return s.accounts.find((a) => a.serverId === s.targetId) || null;
}
