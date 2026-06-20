import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ForceGraph3D from 'react-force-graph-3d';
import * as THREE from 'three';
import SpriteText from 'three-spritetext';
import { api } from '../services/api';
import { useTheme } from '../context/ThemeContext';

interface Node3D {
  id: string;
  name: string;
  isRoot: boolean;
  completed: boolean;
  nodeType?: string;
  linkType?: string;
  val: number;
  // properties added by force graph
  x?: number;
  y?: number;
  z?: number;
  fx?: number;
  fy?: number;
  fz?: number;
}

interface Link3D {
  source: string;
  target: string;
  isPrereq: boolean;
  isSeeAlso: boolean;
  isVisited: boolean;
  color: string;
}

const MapMode = () => {
  const { id: expeditionId } = useParams();
  const navigate = useNavigate();
  const { resolvedTheme } = useTheme();
  
  // Use generic object to bypass strict unknown errors for internal methods
  const fgRef = useRef<Record<string, unknown> | null>(null);
  const [graphData, setGraphData] = useState<{ nodes: Node3D[], links: Link3D[] }>({ nodes: [], links: [] });
  const [rootTopic, setRootTopic] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [interactionMode, setInteractionMode] = useState<'pan' | 'orbit'>('pan');

  // Handle window resize for full screen 3D canvas
  useEffect(() => {
    const handleResize = () => setDimensions({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const loadGraph = useCallback(async () => {
    if (!expeditionId) return;
    try {
      const graph = await api.expedition.getGraph(expeditionId);
      setRootTopic(graph.root_topic);

      const completedNodeIds = new Set(graph.nodes.filter(n => n.completed || n.level === 0).map(n => n.node_id));

      const formattedNodes: Node3D[] = graph.nodes.map(n => {
        const isRoot = n.level === 0;
        return {
          id: n.node_id,
          name: n.topic,
          isRoot,
          completed: n.completed || isRoot,
          nodeType: n.node_type ?? undefined,
          linkType: n.link_type ?? undefined,
          val: isRoot ? 5 : (n.completed ? 3 : 1),
          ...(isRoot ? { fx: 0, fy: 0, fz: 0 } : {})
        };
      });

      const formattedLinks: Link3D[] = graph.edges.map(e => {
        const isSA = e.type === 'see_also_link';
        const isPrereq = e.type === 'prerequisite_of' || e.type === 'prerequisite';
        const isVisited = completedNodeIds.has(e.from_node_id) && completedNodeIds.has(e.to_node_id);

        let color = resolvedTheme === 'dark' ? '#27272a' : '#d1d5db';
        if (isVisited) color = '#00ADB5';
        else if (isPrereq) color = '#a855f7';
        else if (isSA) color = '#06b6d4';

        return {
          source: e.from_node_id,
          target: e.to_node_id,
          isPrereq,
          isSeeAlso: isSA,
          isVisited,
          color
        };
      });

      setGraphData({ nodes: formattedNodes, links: formattedLinks });
    } catch {
      setError('Failed to load expedition graph.');
    } finally {
      setLoading(false);
    }
  }, [expeditionId, resolvedTheme]);

  useEffect(() => { loadGraph(); }, [loadGraph]);

  // Removed custom physics to prevent node explosion

  // Safely configure Trackpad/Mouse Controls exactly once after load
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        if (fgRef.current) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const controls = (fgRef.current as any).controls();
          if (controls) {
            controls.panSpeed = 0.004; // Even less sensitivity for panning
            controls.rotateSpeed = 0.9; // A bit more speed for orbiting/spinning
            
            if (THREE && THREE.MOUSE) {
              controls.mouseButtons = {
                LEFT: interactionMode === 'pan' ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE,
                MIDDLE: THREE.MOUSE.DOLLY,
                RIGHT: interactionMode === 'pan' ? THREE.MOUSE.ROTATE : THREE.MOUSE.PAN
              };
            }
          }
        }
      } catch (e) {
        console.error("Failed to set controls", e);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [interactionMode]);

  const handleNodeClick = useCallback((node: Node3D) => {
    if (fgRef.current) {
      if (focusedNodeId === node.id) {
        // Second click -> navigate
        navigate(`/learn/${node.id}`);
      } else {
        // First click -> focus camera and change orbit center
        setFocusedNodeId(node.id);
        const distance = 80;
        const nx = node.x || 0;
        const ny = node.y || 0;
        const nz = node.z || 0;
        const hypot = Math.hypot(nx, ny, nz);
        
        let camPos;
        if (hypot === 0) {
          camPos = { x: 0, y: 0, z: distance };
        } else {
          const distRatio = 1 + distance / hypot;
          camPos = { x: nx * distRatio, y: ny * distRatio, z: nz * distRatio };
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fg = fgRef.current as any;
        fg.cameraPosition(camPos, node, 1000);
      }
    } else {
      navigate(`/learn/${node.id}`);
    }
  }, [navigate, focusedNodeId]);

  const nodeColorMap = useMemo(() => {
    return (node: Node3D) => {
      if (node.isRoot) return '#00ADB5';
      if (node.completed) return '#10b981';
      if (node.nodeType === 'drift') return '#f59e0b';
      return resolvedTheme === 'dark' ? '#a1a1aa' : '#6b7280';
    };
  }, [resolvedTheme]);

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-white dark:bg-zinc-950">
      <div className="text-yggen-teal animate-pulse text-xs tracking-widest uppercase">Loading expedition map...</div>
    </div>
  );

  if (error) return (
    <div className="h-screen flex items-center justify-center bg-white dark:bg-zinc-950 text-red-650 dark:text-red-400 text-sm">{error}</div>
  );

  if (graphData.nodes.length === 0 && !loading) return (
    <div className="h-screen flex items-center justify-center bg-white dark:bg-zinc-950 text-red-650 dark:text-red-400 text-sm">
      Graph data is completely empty. The backend returned 0 nodes.
    </div>
  );

  return (
    <div className="h-screen w-full bg-[#f8fafc] dark:bg-[#09090b] relative text-black dark:text-white overflow-hidden">
      {/* Header */}
      <div className="absolute top-4 left-20 z-10 pointer-events-none drop-shadow-md">
        <div className="text-xs text-black/55 dark:text-zinc-400 uppercase tracking-widest mb-1 font-mono">Map Grid</div>
        <h1 className="text-2xl font-bold tracking-tighter text-black dark:text-white">{rootTopic}</h1>
      </div>

      {/* Legend */}
      <div className="absolute bottom-6 right-6 z-10 flex flex-col gap-2 text-xs text-black dark:text-zinc-400 bg-white/80 dark:bg-zinc-900/80 border border-gray-250 dark:border-zinc-800 p-4 rounded-xl shadow-2xl backdrop-blur-md">
        <div className="text-[9px] uppercase tracking-widest text-black/55 dark:text-zinc-500 font-bold mb-1 font-mono mt-1">Nodes</div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 bg-yggen-teal rounded-sm" />Origin</div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 bg-emerald-500 rounded-sm" />Explored</div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 bg-amber-500 rounded-sm" />Drift</div>
        <div className="text-[9px] uppercase tracking-widest text-black/55 dark:text-zinc-500 font-bold mb-1 font-mono mt-2">Paths</div>
        <div className="flex items-center gap-2"><div className="w-3 h-0.5 bg-yggen-teal shadow-[0_0_8px_#00ADB5]" />Visited Path</div>
        <div className="flex items-center gap-2"><div className="w-3 h-0.5 bg-purple-500" />Prerequisite</div>
        <div className="flex items-center gap-2"><div className="w-3 h-0.5 bg-cyan-500" />See Also</div>
        
        <div className="text-[9px] uppercase tracking-widest text-black/55 dark:text-zinc-500 font-bold mb-1 font-mono mt-2">Interaction Mode</div>
        <div className="flex bg-gray-100 dark:bg-zinc-800 rounded-md p-1 border border-gray-200 dark:border-zinc-700">
          <button
            onClick={() => setInteractionMode('pan')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-sm text-[10px] font-bold uppercase tracking-wider transition-colors ${interactionMode === 'pan' ? 'bg-black dark:bg-zinc-600 text-white shadow-sm' : 'text-gray-500 hover:text-black dark:text-zinc-400 dark:hover:text-zinc-300'}`}
          >
            Pan
          </button>
          <button
            onClick={() => setInteractionMode('orbit')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-sm text-[10px] font-bold uppercase tracking-wider transition-colors ${interactionMode === 'orbit' ? 'bg-black dark:bg-zinc-600 text-white shadow-sm' : 'text-gray-500 hover:text-black dark:text-zinc-400 dark:hover:text-zinc-300'}`}
          >
            Orbit
          </button>
        </div>

        <div className="text-[9px] uppercase tracking-widest text-black/55 dark:text-zinc-500 font-bold mb-1 font-mono mt-2">Controls</div>
        <div className="text-xs text-gray-500 dark:text-zinc-400">
          • <span className="text-black dark:text-white font-bold">1-Finger Drag</span> to {interactionMode === 'pan' ? 'pan grid' : 'spin map'}<br/>
          • <span className="text-black dark:text-white font-bold">Pinch / Scroll</span> to zoom<br/>
          • <span className="text-black dark:text-white font-bold">Click Node</span> to focus/zoom<br/>
          • <span className="text-black dark:text-white font-bold">Double-Click</span> to enter node
        </div>
      </div>

      {/* 3D Force Graph */}
      <div className="absolute inset-0 cursor-move z-0">
        <ForceGraph3D
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ref={fgRef as any}
          width={dimensions.width}
          height={dimensions.height}
          graphData={graphData}
          backgroundColor={resolvedTheme === 'dark' ? '#09090b' : '#f8fafc'}
          showNavInfo={false}
          nodeRelSize={6}
          linkWidth={(link: unknown) => (link as Link3D).isVisited ? 1.5 : 0.8}
          linkColor={(link: unknown) => (link as Link3D).color}
          linkDirectionalParticles={(link: unknown) => (link as Link3D).isVisited ? 3 : 0}
          linkDirectionalParticleSpeed={0.005}
          linkDirectionalParticleWidth={2}
          onNodeClick={(node: unknown) => handleNodeClick(node as Node3D)}
          nodeThreeObject={(node: unknown) => {
            const n = node as Node3D;
            const color = nodeColorMap(n);

            const sprite = new SpriteText(n.name || 'Unknown');
            sprite.color = color;
            sprite.textHeight = n.isRoot ? 8 : (n.completed ? 6 : 4);
            sprite.fontWeight = 'bold';
            sprite.fontFace = 'Inter, sans-serif';
            return sprite;
          }}
        />
      </div>
    </div>
  );
};

export default MapMode;
