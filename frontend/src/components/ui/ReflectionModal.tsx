import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ReflectionModalProps {
  isOpen: boolean;
  topic: string;
  onSubmit: (answer: string) => Promise<void>;
  onClose: () => void;
  feedback?: string;
  isRetry?: boolean;
}

const ReflectionModal: React.FC<ReflectionModalProps> = ({ 
  isOpen, 
  topic, 
  onSubmit, 
  onClose,
  feedback,
  isRetry 
}) => {
  const [answer, setAnswer] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!answer.trim()) return;
    
    setIsSubmitting(true);
    await onSubmit(answer);
    setIsSubmitting(false);
    // Note: Parent controls closing or showing feedback
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={onClose}
          />
          
          <motion.div 
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative w-full max-w-lg bg-white p-8 shadow-2xl border-t-4 border-yggen-teal z-[101]"
          >
            <h2 className="text-2xl font-bold font-mono mb-2 text-black tracking-tight">
              REFLECTION REQUIRED
            </h2>
            <p className="text-gray-600 mb-6 font-sans">
              To proceed, explain your understanding of <span className="font-bold text-black">{topic}</span>.
            </p>

            {feedback && (
              <div className={`mb-4 p-3 text-sm border-l-2 ${isRetry ? 'border-red-500 bg-red-50 text-red-700' : 'border-yggen-teal bg-teal-50 text-teal-800'}`}>
                {feedback}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                className="w-full h-32 p-3 border border-gray-300 focus:border-yggen-teal focus:ring-1 focus:ring-yggen-teal outline-none resize-none font-mono text-sm mb-4 text-black bg-gray-50"
                placeholder="Type your explanation here..."
                disabled={isSubmitting}
                autoFocus
              />
              
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose} // Or handle cancel logic
                  className="px-4 py-2 text-sm text-gray-500 hover:text-black transition-colors"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-black text-white font-mono text-sm hover:bg-gray-900 transition-colors disabled:opacity-50 flex items-center gap-2"
                  disabled={isSubmitting || !answer.trim()}
                >
                  {isSubmitting ? (
                    <>
                      <span className="block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Evaluating...
                    </>
                  ) : (
                    isRetry ? 'Retry' : 'Submit'
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ReflectionModal;
