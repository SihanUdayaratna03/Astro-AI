import React, { useMemo } from 'react';
import { ReactFlow, Background, Controls, MiniMap, Handle, Position } from '@xyflow/react';
import type { Node, Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import ReactMarkdown from 'react-markdown';
import { User, Bot } from 'lucide-react';
import type { Message } from './App';

const CustomNode: React.FC<{ data: { msg: Message } }> = ({ data }) => {
  const { msg } = data;
  const isUser = msg.role === 'user';
  
  return (
    <div style={{
      background: isUser ? 'rgba(30, 41, 59, 0.9)' : 'rgba(15, 23, 42, 0.9)',
      border: `1px solid ${isUser ? 'rgba(148, 163, 184, 0.2)' : 'rgba(99, 102, 241, 0.3)'}`,
      borderRadius: '12px', padding: '12px', minWidth: '250px', maxWidth: '400px',
      color: 'white', boxShadow: '0 4px 6px rgba(0,0,0,0.3)', position: 'relative'
    }}>
      <Handle type="target" position={Position.Top} style={{ background: '#555' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px' }}>
        <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: isUser ? '#334155' : 'linear-gradient(135deg, #6366f1, #a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {isUser ? <User size={14} /> : <Bot size={14} color="white" />}
        </div>
        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
          {isUser ? 'You' : 'Astro AI'}
        </span>
      </div>
      <div className="markdown-body" style={{ fontSize: '12px', maxHeight: '200px', overflowY: 'auto' }}>
        <ReactMarkdown>{msg.content}</ReactMarkdown>
      </div>
      <Handle type="source" position={Position.Bottom} style={{ background: '#555' }} />
    </div>
  );
};

const nodeTypes = { custom: CustomNode };

export default function MindMapView({ messages }: { messages: Message[] }) {
  const { nodes, edges } = useMemo(() => {
    const nds: Node[] = [];
    const eds: Edge[] = [];
    let currentY = 50;
    
    messages.forEach((msg, index) => {
      const isUser = msg.role === 'user';
      const xPos = isUser ? 100 : 450;
      
      nds.push({ id: msg.id, type: 'custom', position: { x: xPos, y: currentY }, data: { msg } });
      if (index > 0) {
        eds.push({ id: `e-${messages[index-1].id}-${msg.id}`, source: messages[index-1].id, target: msg.id, animated: true, style: { stroke: 'rgba(99, 102, 241, 0.5)', strokeWidth: 2 } });
      }
      currentY += Math.max(120, Math.min(300, msg.content.length * 0.4)) + 60;
    });
    return { nodes: nds, edges: eds };
  }, [messages]);

  return (
    <div style={{ width: '100%', height: '100%', background: 'transparent' }}>
      <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView attributionPosition="bottom-right">
        <Background color="rgba(255,255,255,0.05)" gap={20} />
        <Controls style={{ fill: 'black' }} />
        <MiniMap nodeColor={(n: any) => n.data.msg.role === 'user' ? '#334155' : '#6366f1'} maskColor="rgba(0,0,0,0.5)" />
      </ReactFlow>
    </div>
  );
}
