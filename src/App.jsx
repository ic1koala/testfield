import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Home, LayoutGrid, Network, Settings,
  FolderOpen, Plus, X, ChevronRight,
  Trash2, Info, Palette, HelpCircle,
  Download, FileJson, Key, Sparkles, ExternalLink
} from 'lucide-react';
import { ReactFlowProvider } from '@xyflow/react';
import { MindMapCanvas } from './MindMapCanvas';

// ── Toast hook ────────────────────────────────────────────────────
function useToast() {
  const [toasts, setToasts] = useState([]);
  const add = useCallback((msg, type = '') => {
    const id = Date.now();
    setToasts((t) => [...t, { id, msg, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);
  return { toasts, add };
}

// ── Tabs config ───────────────────────────────────────────────────
const TABS = [
  { id: 'home',       label: 'Home',       Icon: Home },
  { id: 'workspaces', label: 'Workspaces', Icon: LayoutGrid },
  { id: 'map',        label: 'Map',        Icon: Network },
  { id: 'settings',   label: 'Settings',   Icon: Settings },
];

import { getWsIndex, createWs, deleteWsData, migrateOldDataIfNeeded, getSettings, saveSettings } from './storage';
import { getProvider } from './ai';

// =========================================================
//  HOME TAB
// =========================================================
function HomeTab({ onSwitchTab, workspaces, onSelectWorkspace, onCreateNew }) {
  return (
    <div className="settings-page">
      {/* Hero */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(99,102,241,0.2) 0%, rgba(139,92,246,0.2) 100%)',
        borderRadius: 'var(--radius-lg)',
        padding: '28px 24px',
        border: '0.5px solid rgba(159,167,255,0.15)',
        textAlign: 'center',
      }}
        className="animate-fade-in-up"
      >
        <div style={{ fontSize: 48, marginBottom: 12 }}>🧠</div>
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 24,
          fontWeight: 700,
          background: 'var(--gradient-primary)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: 8,
        }}>
          Mind Organizer
        </h1>
        <p style={{ color: 'var(--color-on-surface-variant)', fontSize: 14, lineHeight: 1.6, maxWidth: 280, margin: '0 auto' }}>
          Visualize ideas on an infinite canvas.
          Upload JSON mind maps or switch workspaces below.
        </p>
      </div>

      {/* Quick Actions */}
      <div>
        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-on-surface-variant)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>
          Quick Actions
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          {[
            { label: 'Create New', emoji: '✨', tab: 'map', action: onCreateNew },
            { label: 'Workspaces', emoji: '📂', tab: 'workspaces' },
            { label: 'Settings', emoji: '⚙️', tab: 'settings' },
          ].map(({ label, emoji, tab, action }) => (
            <button
              key={tab}
              id={`home-quick-${tab}`}
              onClick={() => {
                if (action) action();
                onSwitchTab(tab);
              }}
              style={{
                flex: 1,
                background: 'var(--color-surface-high)',
                border: '0.5px solid rgba(159,167,255,0.1)',
                borderRadius: 'var(--radius-md)',
                padding: '14px 8px',
                color: 'var(--color-on-surface)',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
                fontSize: 13,
                fontFamily: 'var(--font-body)',
                fontWeight: 500,
                transition: 'background 0.2s',
              }}
            >
              <span style={{ fontSize: 22 }}>{emoji}</span>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Recent workspaces preview */}
      <div>
        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-on-surface-variant)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>
          Recent Note
        </p>
        <div className="settings-card">
          {workspaces.slice(0, 3).map((ws) => (
            <div key={ws.id} className="settings-row" onClick={() => onSelectWorkspace(ws.id)}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: `${ws.color}22`,
                border: `1.5px solid ${ws.color}55`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16,
              }}>🧩</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{ws.name}</div>
                <div style={{ color: 'var(--color-on-surface-variant)', fontSize: 12 }}>{ws.nodeCount} nodes</div>
              </div>
              <ChevronRight size={16} color="var(--color-outline)" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// =========================================================
//  WORKSPACES TAB
// =========================================================
function WorkspacesTab({ workspaces, onSelectWorkspace, onDeleteWorkspace, onCreateWorkspace }) {
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');

  const addWs = () => {
    if (!newName.trim()) return;
    onCreateWorkspace(newName.trim());
    setNewName('');
    setShowAdd(false);
  };

  return (
    <div className="settings-page">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-on-surface-variant)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Workspaces
        </p>
        <button
          id="add-workspace-btn"
          onClick={() => setShowAdd(!showAdd)}
          style={{
            background: 'rgba(159,167,255,0.12)', border: 'none', borderRadius: 8,
            padding: '5px 12px', color: 'var(--color-primary)', fontSize: 13,
            fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
            fontFamily: 'var(--font-body)',
          }}
        >
          <Plus size={14} /> New
        </button>
      </div>

      {showAdd && (
        <div style={{
          background: 'var(--color-surface-high)',
          borderRadius: 'var(--radius-md)',
          padding: '14px',
          border: '0.5px solid rgba(159,167,255,0.15)',
          display: 'flex', gap: 10, alignItems: 'center',
        }} className="animate-fade-in-up">
          <input
            id="new-workspace-input"
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addWs()}
            placeholder="Workspace name…"
            autoFocus
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: 'var(--color-on-surface)', fontSize: 14, fontFamily: 'var(--font-body)',
            }}
          />
          <button onClick={addWs} style={{
            background: 'var(--gradient-primary)', border: 'none', borderRadius: 8,
            padding: '7px 14px', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            fontFamily: 'var(--font-body)',
          }}>
            Add
          </button>
        </div>
      )}

      <div className="settings-card">
        {workspaces.map((ws) => (
          <div key={ws.id} className="settings-row" onClick={() => onSelectWorkspace(ws.id)}>
            <div style={{
              width: 38, height: 38, borderRadius: 10,
              background: `${ws.color}22`,
              border: `1.5px solid ${ws.color}55`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18,
            }}>🧩</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{ws.name}</div>
              <div style={{ color: 'var(--color-on-surface-variant)', fontSize: 12 }}>{ws.nodeCount} nodes</div>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onDeleteWorkspace(ws.id); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
              aria-label={`Delete workspace ${ws.name}`}
            >
              <Trash2 size={15} color="var(--color-outline)" />
            </button>
          </div>
        ))}
        {workspaces.length === 0 && (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-on-surface-variant)', fontSize: 14 }}>
            No workspaces yet. Create one above.
          </div>
        )}
      </div>
    </div>
  );
}

// =========================================================
//  SETTINGS TAB
// =========================================================
function SettingsTab({ apiKey, setApiKey, aiModel, setAiModel }) {
  const provider = getProvider(apiKey);
  const rows = [
    { Icon: Palette,    label: 'Appearance',      sub: 'Dark mode — Indigo Nebula' },
    { Icon: Network,    label: 'AI Model',        sub: `Current: ${aiModel}` },
    { Icon: ExternalLink, label: 'Local App URL',   sub: 'http://localhost:5174' },
    { Icon: Info,       label: 'About',            sub: 'Mind Organizer v1.0' },
    { Icon: HelpCircle, label: 'Help & Feedback',  sub: 'Tips, FAQs, and support' },
  ];
  const models = [
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', desc: 'Latest experimental' },
    { id: 'gemini-2.0-flash', name: 'Gemini 2 Flash', desc: 'High speed (Next-gen)' },
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', desc: 'Stable & High Quota' },
    { id: 'gemini-1.5-flash-8b', name: 'Gemini 1.5 Flash 8B', desc: 'Very High Quota (Small but fast)' },
    { id: 'gemini-2.0-flash-lite', name: 'Gemini 2 Flash Lite', desc: 'Minimal latency' },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', desc: 'High Quality Reasoning' },
  ];

  return (
    <div className="settings-page">
      {/* Model Selection Card */}
      <div className="settings-card" style={{ marginBottom: 16 }}>
        <div style={{ padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
             <div style={{
              width: 34, height: 34, borderRadius: 9,
              background: 'rgba(99,102,241,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Network size={16} color="var(--color-primary)" />
            </div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Model Preference</div>
          </div>
          
          <select 
            value={aiModel}
            onChange={(e) => setAiModel(e.target.value)}
            style={{
              width: '100%',
              background: 'rgba(0,0,0,0.2)',
              border: '0.5px solid rgba(159,167,255,0.2)',
              borderRadius: 'var(--radius-sm)',
              padding: '10px 12px',
              color: 'var(--color-on-surface)',
              fontSize: 14,
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            {models.map(m => (
              <option key={m.id} value={m.id} style={{ background: '#1a1b26' }}>
                {m.name} ({m.desc})
              </option>
            ))}
          </select>
          <p style={{ color: 'var(--color-on-surface-variant)', fontSize: 11, marginTop: 8, lineHeight: 1.4 }}>
            Swap to 1.5 Flash if you hit rate limits with 2.5 Flash.
          </p>
        </div>
      </div>

      <div className="settings-card" style={{ marginBottom: 16 }}>
        <div style={{ padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 9,
              background: 'rgba(99,102,241,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Key size={16} color="var(--color-primary)" />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>AI API Key</div>
              <div style={{ color: 'var(--color-primary)', fontSize: 12, fontWeight: 600 }}>
                {provider !== 'Unknown' ? `✓ Detected: ${provider}` : 'Supported: Gemini, OpenAI, Claude'}
              </div>
            </div>
          </div>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Paste your API key here..."
            style={{
              width: '100%',
              background: 'rgba(0,0,0,0.2)',
              border: '0.5px solid rgba(159,167,255,0.2)',
              borderRadius: 'var(--radius-sm)',
              padding: '10px 12px',
              color: 'var(--color-on-surface)',
              fontSize: 14,
              fontFamily: 'monospace'
            }}
          />
          <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" style={{ fontSize: 11, color: 'var(--color-primary)', textDecoration: 'none', background: 'rgba(99,102,241,0.1)', padding: '4px 8px', borderRadius: 4 }}>
              Get Gemini Key
            </a>
            <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#10a37f', textDecoration: 'none', background: 'rgba(16,163,127,0.1)', padding: '4px 8px', borderRadius: 4 }}>
              Get OpenAI Key
            </a>
            <a href="https://console.anthropic.com/" target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#d97757', textDecoration: 'none', background: 'rgba(217,119,87,0.1)', padding: '4px 8px', borderRadius: 4 }}>
              Get Claude Key
            </a>
          </div>
          <p style={{ color: 'var(--color-on-surface-variant)', fontSize: 11, marginTop: 12, lineHeight: 1.4, marginBottom: 4 }}>
            Your key is safely stored only in your local browser cache. It is never sent anywhere except directly to the AI provider.
          </p>
        </div>
      </div>

      <div className="settings-card">
        {rows.map(({ Icon, label, sub }, i) => (
          <div key={i} className="settings-row">
            <div style={{
              width: 34, height: 34, borderRadius: 9,
              background: 'rgba(159,167,255,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon size={16} color="var(--color-primary)" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{label}</div>
              <div style={{ color: 'var(--color-on-surface-variant)', fontSize: 12 }}>{sub}</div>
            </div>
            <ChevronRight size={16} color="var(--color-outline)" />
          </div>
        ))}
      </div>

      {/* Usage Instructions */}
      <div className="settings-card" style={{ padding: '20px 16px', background: 'rgba(159,167,255,0.02)' }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: 'var(--color-primary)' }}>📖 How to Use / 操作方法</h3>
        <ul style={{ fontSize: 13, color: 'var(--color-on-surface-variant)', lineHeight: 1.6, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <li><strong>文字の変更</strong>: ノードの文字を<span style={{color: 'var(--color-on-surface)'}}>ダブルタップ（ダブルクリック）</span>すると直接テキストを編集できます。</li>
          <li><strong>ノードの追加・色変更</strong>: <span style={{color: 'var(--color-on-surface)'}}>背景（何もない場所）を長押し（右クリック）</span>すると新しいノードを追加できます。既存のノードの上で長押しすると、子ノード追加や色変更のメニューが出ます。</li>
          <li><strong>メモの追加</strong>: 各ノードの<span style={{color: 'var(--color-on-surface)'}}>左下の[+]ボタン</span>をタップするとメモを展開・記入できます。</li>
          <li><strong>子ノードの折りたたみ</strong>: ノードの<span style={{color: 'var(--color-on-surface)'}}>右端（&gt;マーク部分）</span>をタップすると、その先の子孫ノードを隠す/表示することができます。</li>
          <li><strong>画面の保存・整列</strong>: マップ画面右上のボタンから、<span style={{color: 'var(--color-on-surface)'}}>「Save PNG (画像保存)」</span>や<span style={{color: 'var(--color-on-surface)'}}>「Auto Align (自動整列)」</span>が可能です。</li>
          <li><strong>データ読み込み</strong>: ヘッダーの<span style={{color: 'var(--color-on-surface)'}}>フォルダアイコン</span>から、専用のJSONファイルを読み込むことができます（普段は自動でブラウザに保存されます）。</li>
        </ul>
      </div>

      <div style={{
        textAlign: 'center', color: 'var(--color-on-surface-variant)', fontSize: 12, marginTop: 8,
      }}>
        <p>Built with React Flow + Stitch · Indigo Nebula</p>
        <p style={{ marginTop: 4, opacity: 0.6 }}>v1.0.0</p>
      </div>
    </div>
  );
}

// =========================================================
//  ROOT APP
// =========================================================
export default function App() {
  const [activeTab, setActiveTab] = useState('map');
  const { toasts, add: addToast } = useToast();
  const fileInputRef = useRef(null);

  const [workspaces, setWorkspaces] = useState([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(null);
  
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('mo-api-key') || '');
  const [aiModel, setAiModel] = useState(() => getSettings().aiModel);

  useEffect(() => {
    localStorage.setItem('mo-api-key', apiKey);
  }, [apiKey]);

  useEffect(() => {
    saveSettings({ aiModel });
  }, [aiModel]);

  // Initialize workspaces from storage
  useEffect(() => {
    migrateOldDataIfNeeded();
    let idx = getWsIndex();
    if (idx.length === 0) {
      const id = createWs('My First Map');
      idx = getWsIndex();
    }
    setWorkspaces(idx);
    setActiveWorkspaceId(idx[0].id);
  }, []);

  // Subscribe to updates from MindMapCanvas
  useEffect(() => {
    const handleWsUpdate = () => {
      setWorkspaces(getWsIndex());
    };
    document.addEventListener('workspace-updated', handleWsUpdate);
    return () => document.removeEventListener('workspace-updated', handleWsUpdate);
  }, []);

  const handleCreateNew = useCallback((name = 'New Map') => {
    const id = createWs(name);
    setWorkspaces(getWsIndex());
    setActiveWorkspaceId(id);
    setActiveTab('map');
    addToast('✨ Created new map!', 'success');
  }, [addToast]);

  const handleSelectWorkspace = useCallback((id) => {
    setActiveWorkspaceId(id);
    setActiveTab('map');
  }, []);

  const handleDeleteWorkspace = useCallback((id) => {
    if (workspaces.length <= 1) {
      addToast('Cannot delete the last workspace', 'error');
      return;
    }
    deleteWsData(id);
    const newIdx = getWsIndex();
    setWorkspaces(newIdx);
    if (activeWorkspaceId === id) {
      setActiveWorkspaceId(newIdx[0].id);
    }
    addToast('Deleted workspace', 'info');
  }, [activeWorkspaceId, workspaces, addToast]);

  // Shared JSON upload trigger (header button → hidden input inside canvas)
  const triggerFileUpload = () => {
    const input = document.getElementById('json-upload-input');
    if (input) input.click();
  };

  const isMapTab = activeTab === 'map';

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: 'var(--color-bg)' }}>

      {/* ── Floating Header ─────────────────────────────────────── */}
      <header
        id="app-header"
        className="glass"
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0,
          height: 'var(--header-height)',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          paddingTop: 'env(safe-area-inset-top, 0)',
          boxShadow: 'var(--shadow-float)',
        }}
      >
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8,
            background: 'var(--gradient-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16,
            boxShadow: '0 0 12px rgba(99,102,241,0.4)',
          }}>🧠</div>
          <span style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 17,
            background: 'var(--gradient-primary)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            Mind Organizer
          </span>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8 }}>
          {/* Export JSON */}
          <button
            onClick={() => document.dispatchEvent(new CustomEvent('export-json'))}
            aria-label="Save JSON"
            title="Save JSON"
            style={{
              background: 'rgba(159,167,255,0.08)',
              border: '0.5px solid rgba(159,167,255,0.15)',
              borderRadius: 10,
              width: 38, height: 38,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background 0.2s',
              color: 'var(--color-primary)',
            }}
          >
            <FileJson size={17} />
          </button>

          {/* Export PNG */}
          <button
            onClick={() => document.dispatchEvent(new CustomEvent('export-png'))}
            aria-label="Save PNG"
            title="Save PNG"
            style={{
              background: 'rgba(159,167,255,0.08)',
              border: '0.5px solid rgba(159,167,255,0.15)',
              borderRadius: 10,
              width: 38, height: 38,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background 0.2s',
              color: 'var(--color-primary)',
            }}
          >
            <Download size={17} />
          </button>

          {/* Load JSON */}
          <button
            id="load-json-btn"
            onClick={triggerFileUpload}
            aria-label="Load JSON mind map"
            title="Load JSON"
            style={{
              background: 'rgba(159,167,255,0.1)',
              border: '0.5px solid rgba(159,167,255,0.3)', // Slightly stronger border for emphasis
              borderRadius: 10,
              width: 38, height: 38,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background 0.2s, box-shadow 0.2s',
              color: 'var(--color-primary)',
            }}
          >
            <FolderOpen size={17} />
          </button>
        </div>
      </header>

      {/* ── Main Content area ────────────────────────────────────── */}
      <main style={{ flex: 1, position: 'relative', paddingTop: 'var(--header-height)' }}>
        {/* Map tab — always mounted so React Flow state survives tab switches */}
        <div style={{
          position: 'absolute',
          inset: 0,
          display: isMapTab ? 'block' : 'none',
        }}>
          {activeWorkspaceId && (
            <ReactFlowProvider>
              <MindMapCanvas toast={addToast} activeWorkspaceId={activeWorkspaceId} apiKey={apiKey} aiModel={aiModel} />
            </ReactFlowProvider>
          )}
        </div>

        {/* Other tabs */}
        {!isMapTab && (
          <div style={{ position: 'absolute', inset: 0 }}>
            {activeTab === 'home' && (
              <HomeTab 
                onSwitchTab={setActiveTab} 
                workspaces={workspaces} 
                onSelectWorkspace={handleSelectWorkspace} 
                onCreateNew={() => handleCreateNew('New Map')} 
              />
            )}
            {activeTab === 'workspaces' && (
              <WorkspacesTab 
                workspaces={workspaces}
                onSelectWorkspace={handleSelectWorkspace}
                onDeleteWorkspace={handleDeleteWorkspace}
                onCreateWorkspace={handleCreateNew}
              />
            )}
            {activeTab === 'settings' && <SettingsTab apiKey={apiKey} setApiKey={setApiKey} aiModel={aiModel} setAiModel={setAiModel} />}
          </div>
        )}
      </main>

      {/* ── Bottom Navigation Bar ───────────────────────────────── */}
      <nav
        id="bottom-nav"
        style={{
          position: 'absolute',
          bottom: 0, left: 0, right: 0,
          height: 'var(--nav-height)',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          paddingBottom: 'env(safe-area-inset-bottom, 0)',
          background: 'rgba(13,13,24,0.82)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderTop: '0.5px solid rgba(159,167,255,0.09)',
          boxShadow: '0 -12px 40px rgba(0,0,0,0.4)',
        }}
      >
        {TABS.map(({ id, label, Icon }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              id={`nav-tab-${id}`}
              onClick={() => setActiveTab(id)}
              aria-label={`${label} tab`}
              aria-pressed={active}
              style={{
                flex: 1,
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                padding: '10px 0',
                transition: 'opacity 0.25s',
              }}
            >
              {/* Icon container */}
              <div
                style={{
                  position: 'relative',
                  width: 40, height: 32,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: 12,
                  background: active ? 'rgba(99,102,241,0.18)' : 'transparent',
                  transition: 'background 0.35s cubic-bezier(0.16,1,0.3,1)',
                }}
              >
                {active && (
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: 12,
                    boxShadow: '0 0 12px rgba(99,102,241,0.45)',
                    pointerEvents: 'none',
                  }} />
                )}
                <Icon
                  size={20}
                  color={active ? 'var(--color-primary)' : 'var(--color-outline)'}
                  strokeWidth={active ? 2.2 : 1.7}
                  style={{ transition: 'color 0.3s' }}
                />
              </div>
              {/* Label */}
              <span style={{
                fontSize: 11,
                fontWeight: active ? 700 : 400,
                color: active ? 'var(--color-primary)' : 'var(--color-outline)',
                fontFamily: 'var(--font-body)',
                letterSpacing: active ? '0.01em' : '0',
                transition: 'color 0.3s, font-weight 0.2s',
              }}>
                {label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* ── Toast container ──────────────────────────────────────── */}
      <div className="toast-container" aria-live="polite">
        {toasts.map(({ id, msg, type }) => (
          <div key={id} className={`toast ${type}`}>{msg}</div>
        ))}
      </div>
    </div>
  );
}
