import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { ReactFlow, Background, Controls } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

const MapMode = () => {
  const { id } = useParams();

  const nodes = useMemo(() => [
      { 
          id: '1', 
          position: { x: 0, y: 0 }, 
          data: { label: 'Root: ' + (id || 'Unknown') },
          style: { background: '#fff', color: '#000', border: '1px solid #000', width: 180, borderRadius: '0px', boxShadow: 'none' } 
      },
      { 
          id: '2', 
          position: { x: -100, y: 150 }, 
          data: { label: 'Concept A' },
          style: { background: '#fff', color: '#000', border: '1px solid #000', width: 150, borderRadius: '0px' }
      },
      { 
          id: '3', 
          position: { x: 100, y: 150 }, 
          data: { label: 'Concept B' },
          style: { background: '#fff', color: '#000', border: '1px solid #000', width: 150, borderRadius: '0px' }
      },
  ], [id]);

  const edges = useMemo(() => [
      { id: 'e1-2', source: '1', target: '2', animated: true, style: { stroke: '#000' } },
      { id: 'e1-3', source: '1', target: '3', animated: true, style: { stroke: '#000' } },
  ], []);

  return (
    <div className="h-screen w-full bg-white text-black">
      <div className="absolute top-4 left-24 z-10">
          <h1 className="text-2xl font-bold tracking-tighter uppercase">Knowledge Graph</h1>
          <p className="text-gray-400 text-xs uppercase tracking-widest">Interactive Visualization</p>
      </div>

      <ReactFlow 
        nodes={nodes} 
        edges={edges} 
        colorMode="light"
        fitView
      >
        <Background color="#e5e5e5" gap={20} size={1} />
        <Controls className="bg-white border border-gray-200 fill-black text-black" />
      </ReactFlow>
    </div>
  );
};

export default MapMode;
