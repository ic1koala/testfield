import React, { useCallback, useRef, useState, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  addEdge,
  useReactFlow,
  Panel,
  MiniMap
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { nodeTypes } from './MindNodes';
import dagre from 'dagre';
import { Wand2, CirclePlus, Trash2, Palette, Download, FileJson, Layers, Sparkles } from 'lucide-react';
import { toPng } from 'html-to-image';
import { useEffect } from 'react';

// ── Default demo map (Project Alpha) ──────────────────────────────
const DEFAULT_NODES = [
  { id: '1', type: 'root',       position: { x: 200, y: 200 }, data: { label: '🧠 Project Alpha' } },
  { id: '2', type: 'customNode', position: { x: 420, y: 80  }, data: { label: 'Research' } },
  { id: '3', type: 'customNode', position: { x: 420, y: 200 }, data: { label: 'Design' } },
  { id: '4', type: 'customNode', position: { x: 420, y: 320 }, data: { label: 'Engineering' } },
  { id: '5', type: 'customNode', position: { x: 620, y: 60  }, data: { label: 'User Interviews' } },
  { id: '6', type: 'customNode', position: { x: 620, y: 140 }, data: { label: 'Competitor Analysis' } },
  { id: '7', type: 'customNode', position: { x: 620, y: 200 }, data: { label: 'Wireframes' } },
  { id: '8', type: 'customNode', position: { x: 620, y: 280 }, data: { label: 'Design System' } },
  { id: '9', type: 'customNode', position: { x: 620, y: 340 }, data: { label: 'Frontend' } },
  { id: '10', type: 'customNode',position: { x: 620, y: 410 }, data: { label: 'Backend' } },
];
const DEFAULT_EDGES = [
  { id: 'e1-2',  source: '1', target: '2', animated: false },
  { id: 'e1-3',  source: '1', target: '3', animated: false },
  { id: 'e1-4',  source: '1', target: '4', animated: false },
  { id: 'e2-5',  source: '2', target: '5' },
  { id: 'e2-6',  source: '2', target: '6' },
  { id: 'e3-7',  source: '3', target: '7' },
  { id: 'e3-8',  source: '3', target: '8' },
  { id: 'e4-9',  source: '4', target: '9' },
  { id: 'e4-10', source: '4', target: '10' },
];

const COLORS = ['#6366f1', '#ec4899', '#14b8a6', '#f59e0b', '#be83fa'];

// ── Auto Layout Helper ───────────────────────────────────────────
const getLayoutedElements = (nodes, edges, direction = 'LR') => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  
  const nodeWidth = 140;
  const nodeHeight = 50;
  dagreGraph.setGraph({ rankdir: direction, ranksep: 80, nodesep: 30 });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const newNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      targetPosition: 'left',
      sourcePosition: 'right',
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    };
  });

  return { nodes: newNodes, edges };
};

// ── Context Menu Component ────────────────────────────────────────
const ContextMenu = ({ id, top, left, onClose, onAddChild, onChangeColor, onDeleteNode, onExpandAI }) => {
  return (
    <div 
      className="glass animate-fade-in-up"
      style={{
        position: 'absolute',
        top: top, left: left,
        zIndex: 1000,
        display: 'flex', flexDirection: 'column',
        background: 'var(--color-surface)',
        borderRadius: 'var(--radius-sm)',
        padding: '6px',
        width: 140,
        boxShadow: 'var(--shadow-float)',
      }}
      onMouseLeave={onClose}
    >
      <button style={menuItemStyle} onClick={() => onAddChild(id)}>
        <CirclePlus size={14} /> Add Child
      </button>

      <button style={{ ...menuItemStyle, color: 'var(--color-primary)' }} onClick={() => onExpandAI(id)}>
        <Sparkles size={14} /> AI Expand
      </button>
      
      <div style={{ padding: '6px 8px', display: 'flex', gap: 6, margin: '4px 0', borderTop: '0.5px solid rgba(159, 167, 255, 0.1)', borderBottom: '0.5px solid rgba(159, 167, 255, 0.1)' }}>
        <Palette size={14} color="var(--color-outline)" style={{ alignSelf: 'center' }} />
        {COLORS.map(c => (
          <div key={c} onClick={() => onChangeColor(id, c)} style={{ width: 14, height: 14, borderRadius: '50%', background: c, cursor: 'pointer' }} />
        ))}
      </div>

      <button style={{ ...menuItemStyle, color: 'var(--color-error)' }} onClick={() => onDeleteNode(id)}>
        <Trash2 size={14} /> Delete
      </button>
    </div>
  );
};

// ── Pane Context Menu Component ───────────────────────────────────
const PaneContextMenu = ({ top, left, onClose, onAddNode, onGenerateAIMap }) => {
  return (
    <div 
      className="glass animate-fade-in-up"
      style={{
        position: 'absolute',
        top: top, left: left,
        zIndex: 1000,
        display: 'flex', flexDirection: 'column',
        background: 'var(--color-surface)',
        borderRadius: 'var(--radius-sm)',
        padding: '6px',
        width: 150,
        boxShadow: 'var(--shadow-float)',
      }}
      onMouseLeave={onClose}
    >
      <button style={menuItemStyle} onClick={onAddNode}>
        <CirclePlus size={14} /> Add New Node
      </button>
      
      <div style={{ height: '0.5px', background: 'rgba(159, 167, 255, 0.1)', margin: '4px 0' }} />

      <button style={{ ...menuItemStyle, color: 'var(--color-primary)' }} onClick={onGenerateAIMap}>
        <Sparkles size={14} /> Generate map API
      </button>
    </div>
  );
};

const menuItemStyle = {
  display: 'flex', alignItems: 'center', gap: 8,
  padding: '8px', cursor: 'pointer',
  background: 'transparent', border: 'none',
  color: 'var(--color-on-surface)',
  fontSize: '13px', textAlign: 'left',
  borderRadius: 4, transition: 'background 0.2s'
};


import { loadWsData, saveWsData } from './storage';
import { generateMap, expandIdea } from './ai';

// ── MindMapCanvas ─────────────────────────────────────────────────
const MindMapCanvas = ({ toast, activeWorkspaceId, apiKey, aiModel }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [menu, setMenu] = useState(null);
  const [paneMenu, setPaneMenu] = useState(null);
  const fileRef = useRef(null);
  const { fitView, screenToFlowPosition } = useReactFlow();

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge({ ...params }, eds)),
    [setEdges]
  );

  // ── Load Workspace on Change ────────────────────────────────────
  useEffect(() => {
    if (activeWorkspaceId) {
      const data = loadWsData(activeWorkspaceId);
      if (data && data.nodes && data.nodes.length > 0) {
        setNodes(data.nodes);
        setEdges(data.edges);
        setTimeout(() => fitView({ duration: 800 }), 50);
      } else {
        setNodes([{ id: 'root', type: 'root', position: { x: 200, y: 200 }, data: { label: 'New Topic' } }]);
        setEdges([]);
        setTimeout(() => fitView({ duration: 800 }), 50);
      }
    }
  }, [activeWorkspaceId, setNodes, setEdges, fitView]);

  // ── Save to Workspace Storage ───────────────────────────────────
  useEffect(() => {
    if (activeWorkspaceId && nodes.length > 0) {
      saveWsData(activeWorkspaceId, nodes, edges);
      document.dispatchEvent(new CustomEvent('workspace-updated'));
    }
  }, [nodes, edges, activeWorkspaceId]);

  // ── Compute hidden objects for Collapse/Expand ──────────────────
  const { visibleNodes, visibleEdges } = useMemo(() => {
    const hiddenNodeIds = new Set();
    const hiddenEdgeIds = new Set();
    
    const collapsedNodes = nodes.filter(n => n.data?.collapsed);
    
    const hideDescendants = (nodeId) => {
      const outgoingEdges = edges.filter(e => e.source === nodeId);
      outgoingEdges.forEach(edge => {
        hiddenEdgeIds.add(edge.id);
        const childId = edge.target;
        hiddenNodeIds.add(childId);
        // recursively hide
        hideDescendants(childId);
      });
    };

    collapsedNodes.forEach(node => {
      hideDescendants(node.id);
    });

    const mappedNodes = nodes.map(n => ({ ...n, hidden: hiddenNodeIds.has(n.id) }));
    const mappedEdges = edges.map(e => ({ ...e, hidden: hiddenEdgeIds.has(e.id) }));

    return { visibleNodes: mappedNodes, visibleEdges: mappedEdges };
  }, [nodes, edges]);

  // ── Auto Layout Action ──────────────────────────────────────────
  const onLayout = useCallback(() => {
    // 実際に「表示対象(!hidden)」となっているノードとエッジだけを抽出
    const activeNodes = visibleNodes.filter(n => !n.hidden);
    const activeNodeIds = new Set(activeNodes.map(n => n.id));
    
    // 隠れていない、かつ両端のノードが存在しているエッジのみを抽出（Dagreのエラーを防ぐため）
    const activeEdges = visibleEdges.filter(e => 
      !e.hidden && activeNodeIds.has(e.source) && activeNodeIds.has(e.target)
    );

    // 見えている要素だけでDagreに計算させる
    const { nodes: layoutedNodes } = getLayoutedElements(activeNodes, activeEdges);
    
    // 計算された新しいポジションの辞書を作成
    const newPosMap = new Map();
    layoutedNodes.forEach(n => newPosMap.set(n.id, n.position));

    // フルセットのNodesに対して、Dagre計算対象だったものは座標を上書き、隠れているものはそのまま維持
    setNodes(nds => nds.map(n => {
      if (newPosMap.has(n.id)) {
        return {
          ...n,
          position: newPosMap.get(n.id),
        };
      }
      return n;
    }));

    window.requestAnimationFrame(() => {
      fitView({ duration: 800, padding: 0.2 });
    });
    toast('✓ Nodes Auto-Arranged', 'success');
  }, [visibleNodes, visibleEdges, setNodes, fitView, toast]);

  // ── Download Image Action ───────────────────────────────────────
  const downloadImage = useCallback(() => {
    const elem = document.querySelector('.react-flow');
    if (!elem) return;

    toast('Generating image...', 'info');
    toPng(elem, {
      filter: (node) => {
        // Exclude specific UI elements from the screenshot
        if (
          node?.classList?.contains('react-flow__panel') ||
          node?.classList?.contains('react-flow__controls') ||
          node?.classList?.contains('react-flow__minimap')
        ) {
          return false;
        }
        return true;
      }
    })
      .then((dataUrl) => {
        const link = document.createElement('a');
        link.download = 'mind-map.png';
        link.href = dataUrl;
        link.click();
        toast('✓ Saved map as image!', 'success');
      })
      .catch((err) => {
        toast('✗ Failed to save image', 'error');
        console.error(err);
      });
  }, [toast]);

  // ── Download JSON Action ────────────────────────────────────────
  const downloadJson = useCallback(() => {
    const dataStr = JSON.stringify({ nodes, edges }, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mind-map-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast('✓ Saved map as JSON!', 'success');
  }, [nodes, edges, toast]);

  // ── Attach Event Listeners for Header Buttons ───────────────────
  useEffect(() => {
    const handleDownloadJson = () => downloadJson();
    const handleDownloadImage = () => downloadImage();
    
    document.addEventListener('export-json', handleDownloadJson);
    document.addEventListener('export-png', handleDownloadImage);
    
    return () => {
      document.removeEventListener('export-json', handleDownloadJson);
      document.removeEventListener('export-png', handleDownloadImage);
    };
  }, [downloadJson, downloadImage]);

  // ── Context Menu Actions ────────────────────────────────────────
  const onNodeContextMenu = useCallback((event, node) => {
    event.preventDefault();
    setPaneMenu(null);
    setMenu({
      id: node.id,
      top: event.clientY,
      left: event.clientX,
    });
  }, []);

  const onPaneContextMenu = useCallback((event) => {
    event.preventDefault();
    setMenu(null);
    setPaneMenu({
      top: event.clientY,
      left: event.clientX,
    });
  }, []);

  const closeMenu = () => {
    setMenu(null);
    setPaneMenu(null);
  };
  
  const handleAddChild = useCallback((parentId) => {
    closeMenu();
    const parentNode = nodes.find(n => n.id === parentId);
    if (!parentNode) return;

    const newId = `node_${Date.now()}`;
    const newNode = {
      id: newId,
      type: 'customNode',
      position: { x: parentNode.position.x + 200, y: parentNode.position.y },
      data: { label: 'New Idea' }
    };
    const newEdge = { id: `e${parentId}-${newId}`, source: parentId, target: newId };
    
    setNodes((nds) => [...nds, newNode]);
    setEdges((eds) => [...eds, newEdge]);
  }, [nodes, setNodes, setEdges]);

  const handleChangeColor = useCallback((id, color) => {
    closeMenu();
    setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, color } } : n));
  }, [setNodes]);

  const handleDeleteNode = useCallback((id) => {
    closeMenu();
    setNodes(nds => nds.filter(n => n.id !== id));
    setEdges(eds => eds.filter(e => e.source !== id && e.target !== id));
  }, [setNodes, setEdges]);
  
  const handlePaneAddNode = useCallback(() => {
    if (!paneMenu) return;
    const position = screenToFlowPosition({
      x: paneMenu.left,
      y: paneMenu.top,
    });
    
    const newId = `node_${Date.now()}`;
    const newNode = {
      id: newId,
      type: 'root', // standalone nodes are created as root visually 
      position,
      data: { label: 'New Topic' }
    };
    
    setNodes((nds) => [...nds, newNode]);
    closeMenu();
  }, [paneMenu, screenToFlowPosition, setNodes]);

  const handleExpandAI = useCallback(async (id) => {
    if (!apiKey) {
      toast('⚠︎ Please set your AI API Key in Settings', 'error');
      closeMenu();
      return;
    }
    const node = nodes.find(n => n.id === id);
    if (!node) return;
    
    closeMenu();
    toast('✨ AI is brainstorming...', 'info');
    
    try {
      const data = await expandIdea(node.data.label, node.data.memo || '', apiKey, aiModel);
      if (data && data.nodes) {
        // 1. Prepare new nodes with unique IDs and relative positions
        const timestamp = Date.now();
        const idMap = {}; // To track AI ID -> New ID mapping if AI provided internal IDs
        
        const newNodes = data.nodes.map((n, i) => {
          const newId = `ai_${timestamp}_${i}`;
          if (n.id) idMap[n.id] = newId;
          return {
            ...n,
            id: newId,
            type: 'customNode',
            // Position child nodes to the right of the parent with vertical spread
            position: { 
              x: node.position.x + 250, 
              y: node.position.y + (i - (data.nodes.length-1)/2) * 100 
            }
          };
        });

        // 2. Prepare new edges
        let newEdges = [];
        if (data.edges && data.edges.length > 0) {
          // If AI provided edges, map them correctly
          newEdges = data.edges.map((e, i) => ({
            ...e,
            id: `e_ai_${timestamp}_${i}`,
            source: (e.source === 'PARENT_ID' || e.source === 'root' || !e.source) ? id : (idMap[e.source] || e.source),
            target: idMap[e.target] || e.target
          }));
        } else {
          // Fallback: connect all new nodes directly to the parent
          newEdges = newNodes.map(n => ({
            id: `e_${id}-${n.id}`, source: id, target: n.id
          }));
        }
        
        setNodes(nds => [...nds, ...newNodes]);
        setEdges(eds => [...eds, ...newEdges]);
        toast('✨ AI expanded the concept!', 'success');
        
        // auto layout visible parts after expansion
        setTimeout(() => onLayout(), 200);
      }
    } catch (err) {
      toast(`✗ AI Error: ${err.message}`, 'error');
    }
  }, [apiKey, nodes, setNodes, setEdges, toast]);

  const handleGenerateAIMap = useCallback(async () => {
    if (!apiKey) {
      toast('⚠︎ Please set your AI API Key in Settings', 'error');
      closeMenu();
      return;
    }
    
    closeMenu();
    const topic = window.prompt("What topic would you like AI to map out? (e.g. History of Smartphones)");
    if (!topic || !topic.trim()) return;

    toast(`✨ Generating complete map for "${topic}"...`, 'info');
    try {
      const data = await generateMap(topic, apiKey);
      if (data && data.nodes) {
        // Run auto-layout since raw AI coordinates are usually dummy values
        const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(data.nodes, data.edges || []);
        setNodes(layoutedNodes);
        setEdges(layoutedEdges);
        toast('✨ Mind Map Generated!', 'success');
        setTimeout(() => fitView({ duration: 800, padding: 0.2 }), 50);
      }
    } catch (err) {
      toast(`✗ AI Error: ${err.message}`, 'error');
    }
  }, [apiKey, setNodes, setEdges, toast, fitView]);


  // ── Depth Calculation & Layer Controls ──────────────────────────
  const nodeDepths = useMemo(() => {
    const depths = {};
    const targets = new Set(edges.map(e => e.target));
    const roots = nodes.filter(n => !targets.has(n.id));
    
    let queue = roots.map(r => ({ id: r.id, depth: 0 }));
    const visited = new Set();
    
    while(queue.length > 0) {
      const { id, depth } = queue.shift();
      if (!visited.has(id)) {
        visited.add(id);
        depths[id] = depth;
        // find children
        const children = edges.filter(e => e.source === id).map(e => ({ id: e.target, depth: depth + 1 }));
        queue.push(...children);
      }
    }
    return depths;
  }, [nodes, edges]);

  const collapseToDepth = useCallback((targetDepth) => {
    setNodes(nds => nds.map(n => {
      const depth = nodeDepths[n.id] ?? 0;
      const isCollapsed = targetDepth === 99 ? false : depth >= targetDepth;
      return {
        ...n,
        data: { ...n.data, collapsed: isCollapsed }
      };
    }));
    toast(`✓ Switched to Layer: ${targetDepth === 99 ? 'All' : targetDepth}`, 'success');
  }, [nodeDepths, setNodes, toast]);


  // ── JSON Upload ───────────────────────────────────────────────
  const handleFileChange = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      toast('⚠︎ Please upload a .json file', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        let textResult = event.target.result.trim();
        
        // Macのテキストエディット等でありがちな「リッチテキスト形式(.rtf)」での保存を検知
        if (textResult.startsWith('{\\rtf')) {
          throw new Error('ファイルが「リッチテキスト形式」になっています。テキストエディットのメニュー「フォーマット」＞「標準テキストにする」を選んで保存し直してください。');
        }

        // AI生成のマークダウン (```json ... ```) が含まれていた場合に取り除く処理
        if (textResult.startsWith('```')) {
          textResult = textResult.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
        }

        const data = JSON.parse(textResult);
        if (!Array.isArray(data.nodes) || !Array.isArray(data.edges)) {
          throw new Error('JSON must have "nodes" and "edges" arrays.');
        }

        // 外部から読み込んだJSONに `type` (スタイル定義) が抜けていた場合の自動補完
        const targets = new Set(data.edges.map(e => e.target));
        const parsedNodes = data.nodes.map((n) => {
          if (!n.type) {
            // 親がいない（どこからも矢印が向かっていない）ノードを 'root' とみなす
            n.type = targets.has(n.id) ? 'customNode' : 'root';
          }
          return n;
        });

        setNodes(parsedNodes);
        setEdges(data.edges);
        toast(`✓ Loaded "${file.name}" — ${data.nodes.length} nodes`, 'success');
        
        // Auto layout after load
        setTimeout(() => fitView({ duration: 800 }), 100);
      } catch (err) {
        toast(`✗ ${err.message}`, 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [setNodes, setEdges, toast, fitView]);

  return (
    <>
      <input id="json-upload-input" type="file" ref={fileRef} onChange={handleFileChange} />

      <ReactFlow
        nodes={visibleNodes}
        edges={visibleEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeContextMenu={onNodeContextMenu}
        onPaneContextMenu={onPaneContextMenu}
        onPaneClick={closeMenu}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        minZoom={0.15}
        maxZoom={3}
        attributionPosition="bottom-left"
        proOptions={{ hideAttribution: true }}
        style={{ background: 'var(--color-bg)' }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1.2} color="rgba(159,167,255,0.15)" />
        <Controls showInteractive={false} />
        
        <MiniMap 
          nodeColor={(n) => {
            if (n.type === 'root') return 'var(--color-primary)';
            return n.data?.color || 'var(--color-surface-high)';
          }}
          maskColor="rgba(13, 13, 24, 0.7)"
          style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 8, bottom: 'max(90px, env(safe-area-inset-bottom, 90px))' }}
        />
        
        <Panel position="top-left" style={{ top: 'var(--header-height)', left: 16, display: 'flex', gap: 6 }}>
          <div className="glass" style={{ display: 'flex', alignItems: 'center', padding: '6px 12px', borderRadius: 'var(--radius-pill)', gap: 8, boxShadow: 'var(--shadow-float)' }}>
            <Layers size={14} color="var(--color-primary)" />
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-on-surface-variant)', marginRight: 4 }}>Layer:</span>
            {[1, 2, 3].map(level => (
              <button
                key={level}
                onClick={() => collapseToDepth(level)}
                style={{ background: 'rgba(159,167,255,0.1)', border: 'none', borderRadius: 4, width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 11, fontWeight: 700, color: 'var(--color-on-surface)', transition: 'background 0.2s' }}
              >
                {level}
              </button>
            ))}
            <button
              onClick={() => collapseToDepth(99)}
              style={{ background: 'rgba(159,167,255,0.1)', border: 'none', borderRadius: 4, padding: '0 8px', height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 11, fontWeight: 700, color: 'var(--color-on-surface)', transition: 'background 0.2s' }}
            >
              All
            </button>
          </div>
        </Panel>

        <Panel position="top-right" style={{ top: 'var(--header-height)', right: 16, display: 'flex', gap: 8 }}>
          <button
            onClick={onLayout}
            title="Auto Layout (Left to Right)"
            className="glass"
            style={{
              padding: '10px 16px', borderRadius: 'var(--radius-pill)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
              color: 'var(--color-primary)', fontWeight: 600,
              boxShadow: 'var(--shadow-float)'
            }}
          >
            <Wand2 size={16} /> Auto Align
          </button>
        </Panel>
      </ReactFlow>

      {menu && (
        <ContextMenu
          id={menu.id} top={menu.top} left={menu.left}
          onClose={closeMenu} onAddChild={handleAddChild}
          onChangeColor={handleChangeColor} onDeleteNode={handleDeleteNode}
          onExpandAI={handleExpandAI}
        />
      )}
      {paneMenu && (
        <PaneContextMenu
          top={paneMenu.top} left={paneMenu.left}
          onClose={closeMenu} onAddNode={handlePaneAddNode}
          onGenerateAIMap={handleGenerateAIMap}
        />
      )}
      <style>{`#json-upload-input { display:none; }`}</style>
    </>
  );
};

export { MindMapCanvas, DEFAULT_NODES, DEFAULT_EDGES };
