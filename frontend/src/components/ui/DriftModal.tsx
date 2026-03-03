import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, BookOpen, Rocket, X } from 'lucide-react';

interface DriftModalProps {
  isOpen: boolean;
  candidateTopic: string;
  reason: string;
  score: number;
  onViewSummary: () => void;
  onStartNewExpedition: () => void;
  onDismiss: () => void;
  isLoading?: boolean;
}

const DriftModal = ({
  isOpen,
  candidateTopic,
  reason,
  score,
  onViewSummary,
  onStartNewExpedition,
  onDismiss,
  isLoading = false
}: DriftModalProps) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-40"
            onClick={onDismiss}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm bg-white border border-amber-200 shadow-xl"
          >
            {/* Header */}
            <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-amber-100">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-semibold tracking-wide text-amber-700 uppercase">Drift Detected</div>
                  <div className="text-[10px] text-amber-500 mt-0.5">Relevance score: {score}/100</div>
                </div>
              </div>
              <button onClick={onDismiss} className="text-gray-300 hover:text-black transition-colors ml-4 shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-4">
              <p className="text-sm font-medium text-black mb-1">
                "{candidateTopic}"
              </p>
              <p className="text-xs text-gray-500 leading-relaxed">
                {reason || 'This link seems unrelated to your current expedition.'}
              </p>
            </div>

            {/* Tip */}
            <div className="mx-5 mb-4 px-3 py-2 bg-amber-50 border border-amber-100 text-[11px] text-amber-700 leading-relaxed">
              You can peek at this topic without leaving your expedition, or start a fresh one dedicated to it.
            </div>

            {/* Actions */}
            <div className="flex gap-2 px-5 pb-5">
              <button
                onClick={onViewSummary}
                disabled={isLoading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-200 text-xs text-gray-700 hover:border-black hover:text-black transition-all tracking-wide uppercase"
              >
                <BookOpen className="w-3.5 h-3.5" />
                View Summary
              </button>
              <button
                onClick={onStartNewExpedition}
                disabled={isLoading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-black text-white text-xs hover:bg-yggen-teal transition-colors tracking-wide uppercase"
              >
                <Rocket className="w-3.5 h-3.5" />
                New Expedition
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default DriftModal;
