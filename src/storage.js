export const INDEX_KEY = 'mo-workspaces-index';

export const getWsIndex = () => JSON.parse(localStorage.getItem(INDEX_KEY) || '[]');
export const saveWsIndex = (idx) => localStorage.setItem(INDEX_KEY, JSON.stringify(idx));

const getWsDataKey = (id) => `mo-ws-data-${id}`;

export const loadWsData = (id) => {
  try {
    const raw = localStorage.getItem(getWsDataKey(id));
    if (raw) return JSON.parse(raw);
  } catch(e) {}
  return null;
};

export const saveWsData = (id, nodes, edges) => {
  if (!id) return;
  localStorage.setItem(getWsDataKey(id), JSON.stringify({ nodes, edges }));
  // Update the nodeCount implicitly
  const idx = getWsIndex();
  const ws = idx.find(x => x.id === id);
  if (ws && nodes) {
    ws.nodeCount = nodes.length;
    ws.updatedAt = Date.now();
    saveWsIndex(idx);
  }
};

export const deleteWsData = (id) => {
  localStorage.removeItem(getWsDataKey(id));
  const idx = getWsIndex().filter(x => x.id !== id);
  saveWsIndex(idx);
  return idx;
};

export const createWs = (name) => {
  const id = `ws_${Date.now()}`;
  const colors = ['#6366f1', '#ec4899', '#14b8a6', '#f59e0b', '#be83fa'];
  const newWs = { 
    id, 
    name, 
    nodeCount: 1, 
    color: colors[Math.floor(Math.random() * colors.length)], 
    updatedAt: Date.now() 
  };
  const idx = getWsIndex();
  idx.unshift(newWs);
  saveWsIndex(idx);
  return id;
};

export const SETTINGS_KEY = 'mo-settings';
export const getSettings = () => JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{"aiModel": "gemini-1.5-flash"}');
export const saveSettings = (settings) => localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));

export const migrateOldDataIfNeeded = () => {
  const old = localStorage.getItem('mind-organizer-data');
  if (old) {
    let idx = getWsIndex();
    const migratedId = `ws_${Date.now()}_migrated`;
    idx.unshift({ id: migratedId, name: 'Legacy Map', nodeCount: 0, color: '#ec4899', updatedAt: Date.now() });
    localStorage.setItem(`mo-ws-data-${migratedId}`, old);
    localStorage.removeItem('mind-organizer-data');
    saveWsIndex(idx);
  }
};
