import React, { memo, useState } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { Plus, Minus, ChevronRight, ChevronLeft } from 'lucide-react';

/** Editable label component for double-tap text editing */
const EditableLabel = ({ id, label }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [val, setVal] = useState(label);
  const { updateNodeData } = useReactFlow();

  const onDoubleClick = (e) => {
    e.stopPropagation();
    setIsEditing(true);
  };

  const onBlur = () => {
    setIsEditing(false);
    if (val !== label) {
      updateNodeData(id, { label: val });
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter') {
      onBlur();
    }
  };

  if (isEditing) {
    return (
      <input
        autoFocus
        className="nodrag"
        value={val}
        onChange={e => setVal(e.target.value)}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        style={{
          background: 'rgba(0,0,0,0.3)',
          border: '1px solid var(--color-primary)',
          color: 'var(--color-on-surface)',
          borderRadius: 4,
          padding: '2px 4px',
          width: '100%',
          minWidth: '60px',
          textAlign: 'center',
          fontFamily: 'inherit',
          fontSize: 'inherit',
          outline: 'none',
        }}
      />
    );
  }

  return (
    <span 
      onDoubleClick={onDoubleClick} 
      title="Double click to edit"
      style={{ cursor: 'text', flex: 1 }}
    >
      {label}
    </span>
  );
};

/** Reusable Memo component for nodes */
const NodeMemo = ({ id, data }) => {
  const [expanded, setExpanded] = useState(false);
  const { updateNodeData } = useReactFlow();

  const toggleExpanded = (e) => {
    e.stopPropagation();
    setExpanded((prev) => !prev);
  };

  const handleMemoChange = (e) => {
    updateNodeData(id, { memo: e.target.value });
  };

  return (
    <>
      <button
        onClick={toggleExpanded}
        className="nodrag"
        title={expanded ? "Close memo" : "Add/View memo"}
        style={{
          position: 'absolute',
          bottom: -10,
          left: -10,
          background: 'var(--color-surface-bright)',
          border: '2px solid var(--color-secondary)',
          borderRadius: '50%',
          width: 26,
          height: 26,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: 'var(--color-on-surface)',
          zIndex: 10,
          boxShadow: 'var(--shadow-float)',
        }}
      >
        {expanded ? <Minus size={16} /> : <Plus size={16} />}
      </button>

      {expanded && (
        <div
          className="nodrag nopan"
          style={{
            marginTop: 12,
            paddingTop: 8,
            borderTop: '0.5px solid rgba(159, 167, 255, 0.2)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <textarea
            value={data.memo || ''}
            onChange={handleMemoChange}
            placeholder="Write a memo..."
            style={{
              width: '100%',
              minHeight: '60px',
              minWidth: '120px',
              background: 'rgba(0,0,0,0.2)',
              border: 'none',
              borderRadius: 6,
              padding: '8px',
              color: 'var(--color-on-surface)',
              fontSize: '12px',
              fontFamily: 'var(--font-body)',
              resize: 'vertical',
              outline: 'none',
            }}
          />
        </div>
      )}
    </>
  );
};

/** Hotspot on the right 20% to toggle children visibility */
const CollapseHandle = ({ id, data }) => {
  const { updateNodeData } = useReactFlow();

  const toggleCollapse = (e) => {
    e.stopPropagation();
    updateNodeData(id, { collapsed: !data.collapsed });
  };

  return (
    <div
      onClick={toggleCollapse}
      className="nodrag"
      title="Toggle children"
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        width: '20%',
        minWidth: '24px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(255,255,255,0.0)',
        borderTopRightRadius: 'inherit',
        borderBottomRightRadius: 'inherit',
        transition: 'background 0.2s',
      }}
      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(159, 167, 255, 0.1)'}
      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.3)',
        borderRadius: '50%',
        width: 16,
        height: 16,
      }}>
        {data.collapsed ? (
          <ChevronLeft size={12} color="var(--color-outline)" />
        ) : (
          <ChevronRight size={12} color="var(--color-outline)" />
        )}
      </div>
    </div>
  );
};

/** Extra style parser for custom colors */
const getBorderStyle = (data) => {
  if (data.color) {
    return { borderColor: data.color };
  }
  return {};
};

/** Root / Central node — gradient pill */
export const RootNode = memo(({ id, data, selected }) => (
  <div 
    className={`mind-node mind-node-root${selected ? ' selected' : ''}`} 
    style={{ position: 'relative', paddingRight: '32px', ...getBorderStyle(data) }}
  >
    <Handle type="source" position={Position.Right} style={{ opacity: 0, pointerEvents: 'none' }} />
    <Handle type="target" position={Position.Left} style={{ opacity: 0, pointerEvents: 'none' }} />
    <Handle type="source" position={Position.Bottom} style={{ opacity: 0, pointerEvents: 'none' }} />
    <Handle type="target" position={Position.Top} style={{ opacity: 0, pointerEvents: 'none' }} />
    <EditableLabel id={id} label={data.label} />
    <NodeMemo id={id} data={data} />
    <CollapseHandle id={id} data={data} />
  </div>
));
RootNode.displayName = 'RootNode';

/** Custom node — glassmorphism card */
export const CustomNode = memo(({ id, data, selected }) => (
  <div 
    className={`mind-node${selected ? ' selected' : ''}`} 
    style={{ position: 'relative', paddingRight: '28px', ...getBorderStyle(data) }}
  >
    <Handle type="source" position={Position.Right} style={{ background: 'var(--color-primary)', width: 7, height: 7, border: 'none' }} />
    <Handle type="target" position={Position.Left} style={{ background: 'var(--color-primary)', width: 7, height: 7, border: 'none' }} />
    <Handle type="source" position={Position.Bottom} style={{ background: 'var(--color-primary)', width: 7, height: 7, border: 'none' }} />
    <Handle type="target" position={Position.Top} style={{ background: 'var(--color-primary)', width: 7, height: 7, border: 'none' }} />
    <EditableLabel id={id} label={data.label} />
    <NodeMemo id={id} data={data} />
    <CollapseHandle id={id} data={data} />
  </div>
));
CustomNode.displayName = 'CustomNode';

export const nodeTypes = {
  root: RootNode,
  customNode: CustomNode, // Renamed from "default" to fix the white background CSS collision 
};
