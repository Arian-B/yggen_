import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Loader2 } from 'lucide-react';
import { ExpeditionService } from '../services/expedition';

const CreateExpedition = () => {
  const [topic, setTopic] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;

    setIsLoading(true);
    try {
      const expedition = await ExpeditionService.create(topic);
      navigate(`/learn/${expedition.id}`);
    } catch (error) {
      console.error("Failed to create expedition:", error);
      // TODO: Add toast notification
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] w-full max-w-4xl mx-auto px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="w-full text-center"
      >
        <h1 className="text-4xl md:text-5xl font-light mb-2 tracking-tight">
          Where shall we go?
        </h1>
        <p className="text-gray-500 mb-12 tracking-widest uppercase text-sm">
          Enter a root topic to begin traversal
        </p>

        <form onSubmit={handleSubmit} className="relative max-w-xl mx-auto">
            <div className={`relative transition-all duration-300 ${isLoading ? 'opacity-50' : 'opacity-100'}`}>
                <input
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="e.g., Quantum Computing, The Renaissance, Mycology..."
                    disabled={isLoading}
                    className="w-full bg-transparent border-b-2 border-gray-800 text-3xl py-4 px-2 text-center text-white placeholder-gray-700 focus:outline-none focus:border-yggen-teal transition-colors duration-300"
                    autoFocus
                />
            </div>

            <AnimatePresence>
                {isLoading ? (
                    <motion.div 
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-x-0 -bottom-16 flex justify-center"
                    >
                         <div className="flex flex-col items-center gap-2">
                             <Loader2 className="w-6 h-6 text-yggen-teal animate-spin" />
                             <span className="text-xs text-yggen-teal tracking-widest animate-pulse">GENERATING GRAPH</span>
                         </div>
                    </motion.div>
                ) : (
                   topic.trim().length > 0 && (
                        <motion.button
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            type="submit"
                            className="absolute right-0 top-1/2 -translate-y-1/2 bg-transparent text-gray-400 hover:text-yggen-teal transition-colors p-2"
                        >
                            <ArrowRight className="w-8 h-8" />
                        </motion.button>
                   )
                )}
            </AnimatePresence>
        </form>
      </motion.div>
    </div>
  );
};

export default CreateExpedition;
