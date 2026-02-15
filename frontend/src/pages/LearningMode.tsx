import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { api, type NodeContent } from '../services/api';
import ReflectionModal from '../components/ui/ReflectionModal';

const LearningMode = () => {
  const { id } = useParams(); // This is the node_id
  const navigate = useNavigate();
  
  const [content, setContent] = useState<NodeContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Reflection State
  const [isReflectionOpen, setIsReflectionOpen] = useState(false);
  const [reflectionFeedback, setReflectionFeedback] = useState('');
  const [isRetry, setIsRetry] = useState(false);
  
  // Trigger update for XPDisplay (handled via custom event or context ideally, but here just local state if XPDisplay was child? 
  // XPDisplay is sibling in Layout. We'll update user XP on backend, XPDisplay polls or needs trigger.
  // For now, simpler: XPDisplay polls or we assume user navigation triggers re-fetch if we mount/unmount.
  // But XPDisplay is in Layout. We can't easily trigger it without context.
  // Let's assume XPDisplay handles itself or we ignore real-time update for a second.)

  useEffect(() => {
    if (!id) return;
    
    const fetchContent = async () => {
      setLoading(true);
      try {
        const data = await api.node.get(id);
        setContent(data);
      } catch (err) {
        setError('Failed to load content.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchContent();
  }, [id]);

  const handleContinue = async () => {
    if (!content) return;
    
    try {
      const result = await api.node.continue(content.node_id, content.expedition_id);
      
      if (result.reflection_required) {
        setIsReflectionOpen(true);
        setReflectionFeedback(''); // Reset
        setIsRetry(false);
      } else if (result.next_node_id) {
        navigate(`/learn/${result.next_node_id}`);
      } else {
        // Path complete
        alert("Expedition complete!"); // Replace with UI later
        navigate(`/map/${content.expedition_id}`);
      }
    } catch (err) {
      console.error("Continue failed", err);
    }
  };

  const handleReflectionSubmit = async (answer: string) => {
    if (!content) return;
    
    try {
      const result = await api.node.reflect(content.node_id, answer);
      
      if (result.passed) {
        setIsReflectionOpen(false);
        // Show success toast?
        if (result.next_node_id) {
            navigate(`/learn/${result.next_node_id}`);
        } else {
            navigate(`/map/${content.expedition_id}`);
        }
      } else {
        setReflectionFeedback(result.feedback || "Reflection failed. Please try again.");
        setIsRetry(true);
      }
    } catch (err) {
      console.error("Reflection failed", err);
      setReflectionFeedback("Error submitting reflection.");
    }
  };

  if (loading) {
    return (
        <div className="min-h-screen bg-black flex items-center justify-center">
            <div className="text-yggen-teal animate-pulse tracking-widest uppercase">Initializing Neural Link...</div>
        </div>
    );
  }

  if (error || !content) {
      return (
          <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white">
              <div className="text-red-500 mb-4">{error || "Node not found"}</div>
              <Link to="/" className="text-gray-400 hover:text-white underline">Return Home</Link>
          </div>
      );
  }

  return (
    <div className="relative min-h-screen text-black bg-white">
      {/* Content Layer */}
      <div className="relative z-10 min-h-screen flex flex-col items-center pb-32">
        
        {/* Header */}
        <section className="min-h-[50vh] flex flex-col items-center justify-center text-center p-4 mt-16">
          <div className="mb-6 text-gray-400 text-xs tracking-[0.3em] uppercase">
            Node {content.level} / {content.topic}
          </div>
          <h1 className="text-6xl md:text-8xl font-bold mb-8 tracking-tighter text-black">
            {content.topic}
          </h1>
        </section>

        {/* Dynamic Content */}
        <section className="w-full max-w-2xl px-6 md:px-0 space-y-12">
             <div className="text-lg leading-relaxed font-light text-gray-800">
                 {/* Content rendering */}
                 {content.content?.split('\n').map((line, i) => (
                    <p key={i} className="mb-6">{line}</p>
                 ))}
             </div>
             
             {content.sources && content.sources.length > 0 && (
                 <div className="pt-8 border-t border-gray-100">
                     <span className="text-xs uppercase tracking-widest text-gray-400 mb-4 block">References</span>
                     <ul className="space-y-2">
                         {content.sources.map((src, idx) => (
                             <li key={idx}>
                                 <a href={src} target="_blank" rel="noopener noreferrer" className="text-sm text-gray-500 hover:text-black hover:underline transition-colors decoration-yggen-teal decoration-2 underline-offset-4">
                                     {src}
                                 </a>
                             </li>
                         ))}
                     </ul>
                 </div>
             )}
        </section>

        {/* Action Footer */}
        <section className="mt-32">
             <button 
                onClick={handleContinue}
                className="group relative px-6 py-3 bg-white text-black font-medium tracking-wide text-sm border-b-2 border-transparent hover:border-yggen-teal transition-all duration-300 flex items-center gap-4"
             >
                 <span>PROCEED TO NEXT NODE</span>
                 <ArrowRight className="w-4 h-4 text-yggen-teal group-hover:translate-x-2 transition-transform" />
             </button>
        </section>

        {/* Modal needs to be outside the flow? It handles its own portal or overlay usually. 
            Passing it here is fine as long as ReflectionModal has fixed position. */}
        <ReflectionModal 
            isOpen={isReflectionOpen}
            topic={content.topic}
            onSubmit={handleReflectionSubmit}
            onClose={() => setIsReflectionOpen(false)}
            feedback={reflectionFeedback}
            isRetry={isRetry}
        />

      </div>
    </div>
  );
};

export default LearningMode;
