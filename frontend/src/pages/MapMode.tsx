import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ReactFlow, Background, Controls, MiniMap, useNodesState, useEdgesState } from '@xyflow/react';
import type { Node, Edge, NodeTypes } from '@xyflow/react';
import { Handle, Position } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { api } from '../services/api';
import type { ExpeditionGraph } from '../services/api';

// --- Custom Node Component ---
interface WikiNodeData {
  label: string;
  nodeType?: string;
  linkType?: string;
  isRoot?: boolean;
}

const WikiNode = ({ data }: { data: WikiNodeData }) => {
  const isRoot = data.isRoot;
  const isDrift = data.nodeType === 'drift';
  const isSeeAlso = data.linkType === 'see_also_link';

  let bg = 'bg-white border-gray-300';
  let textColor = 'text-black';
  let badge = '';

  if (isRoot) { bg = 'bg-black border-black'; textColor = 'text-white'; }
  else if (isDrift) { bg = 'bg-amber-50 border-amber-300'; textColor = 'text-amber-800'; badge = 'Drift'; }
  else if (isSeeAlso) { bg = 'bg-teal-50 border-teal-300'; textColor = 'text-teal-800'; badge = 'See Also'; }

  return (
    <div className={`px-3 py-2 border rounded-sm min-w-[110px] max-w-[170px] ${bg} shadow-sm cursor-pointer hover:shadow-md transition-shadow`}>
      <Handle type="target" position={Position.Top} className="opacity-0" />
      {badge && <div className={`text-[9px] uppercase tracking-widest mb-1 ${textColor} opacity-60`}>{badge}</div>}
      <div className={`text-xs font-medium leading-tight ${textColor}`}>{data.label}</div>
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </div>
  );
};

const nodeTypes: NodeTypes = { wiki: WikiNode as unknown as NodeTypes['wiki'] };

// Radial layout: root center, embedded links fan above, see-also fan below
const layoutGraph = (graphData: ExpeditionGraph): { nodes: Node[]; edges: Edge[] } => {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  const root = graphData.nodes.find(n => n.level === 0);
  const others = graphData.nodes.filter(n => n.level !== 0);
  const embeds = others.filter(n => n.link_type !== 'see_also_link');
  const seeAlsos = others.filter(n => n.link_type === 'see_also_link');

  if (root) {
    nodes.push({
      id: root.node_id,
      type: 'wiki',
      position: { x: 0, y: 0 },
      data: { label: root.topic, isRoot: true } as WikiNodeData
    });
  }

  embeds.forEach((n, i) => {
    const total = embeds.length;
    const spread = Math.min(total, 8); 
    const angle = (Math.PI / (spread + 1)) * (i + 1);
    const radius = total > 4 ? 300 : 240;
    const x = (Math.cos(angle - Math.PI / 2)) * radius;
    const y = -(Math.sin(angle - Math.PI / 2) * radius) - 160;
    nodes.push({ id: n.node_id, type: 'wiki', position: { x, y }, data: { label: n.topic, linkType: n.link_type, nodeType: n.node_type } as WikiNodeData });
  });

  seeAlsos.forEach((n, i) => {
    const total = seeAlsos.length;
    const angle = (Math.PI / (total + 1)) * (i + 1);
    const x = (Math.cos(angle - Math.PI / 2)) * 220;
    const y = -(Math.sin(angle - Math.PI / 2) * 220) + 200;
    nodes.push({ id: n.node_id, type: 'wiki', position: { x, y }, data: { label: n.topic, linkType: n.link_type, nodeType: n.node_type } as WikiNodeData });
  });

  graphData.edges.forEach((e, i) => {
    const isSA = e.type === 'see_also_link';
    edges.push({
      id: `e-${i}`,
      source: e.from_node_id,
      target: e.to_node_id,
      animated: !isSA,
      style: { stroke: isSA ? '#14b8a6' : '#000', strokeWidth: 1 },
      type: 'smoothstep'
    });
  });

  return { nodes, edges };
};

const MapMode = () => {
  const { id: expeditionId } = useParams();
  const navigate = useNavigate();
  const [rfNodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [rfEdges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [rootTopic, setRootTopic] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadGraph = useCallback(async () => {
    if (!expeditionId) return;
    try {
      const graph = await api.expedition.getGraph(expeditionId);
      setRootTopic(graph.root_topic);
      const { nodes, edges } = layoutGraph(graph);
      setNodes(nodes);
      setEdges(edges);
    } catch {
      setError('Failed to load expedition graph.');
    } finally {
      setLoading(false);
    }
  }, [expeditionId, setNodes, setEdges]);

  useEffect(() => { loadGraph(); }, [loadGraph]);

  const onNodeClick = (_evt: React.MouseEvent, node: Node) => {
    navigate(`/learn/${node.id}`);
  };

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-white">
      <div className="text-yggen-teal animate-pulse text-xs tracking-widest uppercase">Loading expedition map...</div>
    </div>
  );

  if (error) return (
    <div className="h-screen flex items-center justify-center bg-white text-red-500 text-sm">{error}</div>
  );

  return (
    <div className="h-screen w-full bg-white relative">
      {/* Header */}
      <div className="absolute top-4 left-20 z-10 pointer-events-none">
        <div className="text-xs text-gray-400 uppercase tracking-widest mb-1">Knowledge Map</div>
        <h1 className="text-2xl font-bold tracking-tighter">{rootTopic}</h1>
      </div>

      {/* Legend */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2 text-xs text-gray-500">
        <div className="flex items-center gap-2"><div className="w-3 h-3 bg-black rounded-sm" />Root Article</div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 bg-white border border-gray-400 rounded-sm" />Linked Page</div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 bg-teal-100 border border-teal-400 rounded-sm" />See Also</div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 bg-amber-100 border border-amber-400 rounded-sm" />Drift</div>
      </div>

      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        colorMode="light"
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.1}
        maxZoom={2.5}
      >
        <Background color="#f0f0f0" gap={24} size={1} />
        <Controls className="bg-white border border-gray-200" />
        <MiniMap
          nodeColor={(n: Node) => {
            const d = n.data as WikiNodeData;
            if (d?.isRoot) return '#000';
            if (d?.nodeType === 'drift') return '#f59e0b';
            if (d?.linkType === 'see_also_link') return '#14b8a6';
            return '#e5e5e5';
          }}
          className="bg-white border border-gray-200"
        />
      </ReactFlow>
    </div>
  );
};

export default MapMode;
