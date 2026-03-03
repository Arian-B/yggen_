import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Map, Sparkles, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import { api, getAuthHeader, type NodeContent } from '../services/api';
import { useAuth } from '../context/AuthContext';
import ReflectionModal from '../components/ui/ReflectionModal';
import DriftModal from '../components/ui/DriftModal';

interface WikiLink {
  topic: string;
  nodeId: string;
}

interface DriftState {
  open: boolean;
  candidateTopic: string;
  candidateNodeId: string;
  reason: string;
  score: number;
  checking: boolean;
}

const INITIAL_DRIFT: DriftState = {
  open: false,
  candidateTopic: '',
  candidateNodeId: '',
  reason: '',
  score: 60,
  checking: false
};

const LearningMode = () => {
  const { id: nodeId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user?.user_id || '';

  const [content, setContent] = useState<NodeContent | null>(null);
  const [linkedNodes, setLinkedNodes] = useState<WikiLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // AI Summary state
  const [summary, setSummary] = useState('');
  const [keyPoints, setKeyPoints] = useState<string[]>([]);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);

  // Drift state
  const [drift, setDrift] = useState<DriftState>(INITIAL_DRIFT);

  // Drift summary peek (View Summary Only)
  const [driftSummary, setDriftSummary] = useState('');
  const [driftSummaryLoading, setDriftSummaryLoading] = useState(false);

  // Reflection state
  const [isReflectionOpen, setIsReflectionOpen] = useState(false);
  const [reflectionFeedback, setReflectionFeedback] = useState('');
  const [isRetry, setIsRetry] = useState(false);

  useEffect(() => {
    if (!nodeId) return;
    setLoading(true);
    setSummary('');
    setKeyPoints([]);
    setSummaryOpen(false);
    setDrift(INITIAL_DRIFT);
    setDriftSummary('');

    const fetchNode = async () => {
      try {
        const data = await api.node.get(nodeId);
        setContent(data);

        if (data.expedition_id) {
          try {
            const graph = await api.expedition.getGraph(data.expedition_id);
            const links: WikiLink[] = graph.nodes
              .filter(n => n.node_id !== nodeId)
              .map(n => ({ topic: n.topic, nodeId: n.node_id }));
            setLinkedNodes(links);
          } catch { /* non-critical */ }
        }
      } catch {
        setError('Failed to load article.');
      } finally {
        setLoading(false);
      }
    };
    fetchNode();
  }, [nodeId]);

  const handleLoadSummary = async () => {
    if (!nodeId || summary) { setSummaryOpen(v => !v); return; }
    setSummaryLoading(true);
    setSummaryOpen(true);
    try {
      const result = await api.node.getSummary(nodeId);
      setSummary(result.summary);
      setKeyPoints(result.key_points || []);
    } catch {
      setSummary('Summary unavailable at the moment.');
    } finally {
      setSummaryLoading(false);
    }
  };

  /**
   * Called when user clicks a linked node chip or an inline hyperlink.
   * First runs a drift check — if drift is detected, shows DriftModal.
   * If clean, navigates directly.
   */
  const handleLinkClick = async (linkedNodeId: string, topic: string) => {
    if (!content || !nodeId) return;

    // Optimistic: set checking state
    setDrift({ ...INITIAL_DRIFT, checking: true, candidateTopic: topic, candidateNodeId: linkedNodeId, open: false });

    try {
      const result = await api.node.checkDrift(nodeId, topic, content.expedition_id);

      if (result.is_drift) {
        setDrift({
          open: true,
          candidateTopic: topic,
          candidateNodeId: linkedNodeId,
          reason: result.reason,
          score: result.score,
          checking: false
        });
      } else {
        // Clean link — navigate directly
        setDrift(INITIAL_DRIFT);
        navigate(`/learn/${linkedNodeId}`);
      }
    } catch {
      // Fail open — if drift check errors just navigate
      setDrift(INITIAL_DRIFT);
      navigate(`/learn/${linkedNodeId}`);
    }
  };

  const handleDriftViewSummary = async () => {
    if (!drift.candidateNodeId) return;
    setDriftSummaryLoading(true);
    try {
      const result = await api.node.getSummary(drift.candidateNodeId);
      setDriftSummary(result.summary || 'No summary available.');
    } catch {
      setDriftSummary('Summary unavailable.');
    } finally {
      setDriftSummaryLoading(false);
    }
    setDrift(prev => ({ ...prev, open: false }));
  };

  const handleDriftFork = async () => {
    if (!content || !drift.candidateTopic) return;
    setDrift(prev => ({ ...prev, open: false }));
    try {
      const result = await fetch(`http://localhost:8000/api/expedition/${content.expedition_id}/fork`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify({ user_id: userId, root_topic: drift.candidateTopic })
      }).then(r => r.json());
      const newNodeId = result.root_node?.node_id;
      if (newNodeId) navigate(`/learn/${newNodeId}`);
    } catch { /* no-op */ }
  };

  const handleContinue = async () => {
    if (!content) return;
    try {
      const result = await api.node.continue(content.node_id, content.expedition_id, userId);
      if (result.reflection_required) {
        setIsReflectionOpen(true);
        setReflectionFeedback('');
        setIsRetry(false);
      } else if (result.next_node_id) {
        navigate(`/learn/${result.next_node_id}`);
      } else {
        navigate(`/map/${content.expedition_id}`);
      }
    } catch { /* no-op */ }
  };

  const handleReflectionSubmit = async (answer: string) => {
    if (!content) return;
    try {
      const result = await api.node.reflect(content.node_id, answer, userId);
      if (result.passed) {
        setIsReflectionOpen(false);
        if (result.next_node_id) navigate(`/learn/${result.next_node_id}`);
        else navigate(`/map/${content.expedition_id}`);
      } else {
        setReflectionFeedback(result.feedback || 'Try again.');
        setIsRetry(true);
      }
    } catch {
      setReflectionFeedback('Error submitting reflection.');
    }
  };

  // Render article text, detecting and highlighting linked nodes as interactive spans
  const renderContent = (text: string) => {
    if (!text) return null;
    const paragraphs = text.split('\n').filter(p => p.trim().length > 0);

    return paragraphs.map((para, i) => {
      let result: (string | React.ReactElement)[] = [para];

      linkedNodes.forEach(({ topic, nodeId: linkedId }) => {
        result = result.flatMap(part => {
          if (typeof part !== 'string') return [part];
          const idx = part.toLowerCase().indexOf(topic.toLowerCase());
          if (idx === -1) return [part];
          return [
            part.slice(0, idx),
            <button
              key={`${linkedId}-${i}`}
              onClick={() => handleLinkClick(linkedId, topic)}
              title={`Explore: ${topic}`}
              className="text-yggen-teal underline decoration-dotted underline-offset-2 hover:decoration-solid font-medium transition-colors cursor-pointer"
            >
              {part.slice(idx, idx + topic.length)}
            </button>,
            part.slice(idx + topic.length)
          ];
        });
      });

      return <p key={i} className="mb-5 leading-relaxed text-gray-800">{result}</p>;
    });
  };

  // --- Loading / Error states ---
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-yggen-teal animate-pulse text-xs tracking-widest uppercase">Loading article...</div>
    </div>
  );

  if (error || !content) return (
    <div className="min-h-screen flex flex-col items-center justify-center text-black">
      <div className="text-red-500 mb-4">{error || 'Article not found'}</div>
      <button onClick={() => navigate('/')} className="text-gray-400 hover:text-black underline text-sm">Return Home</button>
    </div>
  );

  return (
    <div className="min-h-screen bg-white text-black">
      <div className="max-w-2xl mx-auto px-6 pt-16 pb-40">

        {/* Breadcrumb */}
        <div className="text-xs text-gray-400 tracking-widest uppercase mb-10 flex items-center gap-2">
          <span>{(content as any).primary_domain || 'General'}</span>
          <span>/</span>
          <span className="text-black">{content.topic}</span>
        </div>

        {/* Title */}
        <h1 className="text-5xl md:text-7xl font-bold tracking-tighter mb-6 text-black">
          {content.topic}
        </h1>

        {/* Wikipedia link */}
        {content.wikipedia_url && (
          <a
            href={content.wikipedia_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-black mb-8 transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            View on Wikipedia
          </a>
        )}

        {/* Drift checking indicator */}
        <AnimatePresence>
          {drift.checking && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="mb-4 text-xs text-amber-500 animate-pulse tracking-widest uppercase"
            >
              Checking relevance of "{drift.candidateTopic}"...
            </motion.div>
          )}
        </AnimatePresence>

        {/* Drift summary peek (persists after user clicks View Summary) */}
        <AnimatePresence>
          {driftSummary && (
            <motion.div
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="mb-8 p-4 border border-amber-200 bg-amber-50"
            >
              <div className="text-[10px] uppercase tracking-widest text-amber-600 mb-2">
                Drift peek — {drift.candidateTopic || 'Off-topic article'}
              </div>
              {driftSummaryLoading ? (
                <div className="text-xs text-amber-500 animate-pulse">Loading summary...</div>
              ) : (
                <p className="text-sm text-amber-900 leading-relaxed">{driftSummary}</p>
              )}
              <button
                onClick={() => setDriftSummary('')}
                className="mt-3 text-[10px] text-amber-500 hover:text-amber-800 uppercase tracking-widest"
              >
                Dismiss
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* AI Summary Toggle */}
        <div className="mb-10 border border-gray-100 rounded-sm overflow-hidden">
          <button
            onClick={handleLoadSummary}
            className="w-full flex items-center justify-between px-4 py-3 text-xs tracking-widest uppercase text-gray-500 hover:text-black hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-yggen-teal" />
              AI Summary
            </div>
            {summaryOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          <AnimatePresence>
            {summaryOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                <div className="px-4 py-4 border-t border-gray-100 bg-gray-50">
                  {summaryLoading ? (
                    <div className="text-yggen-teal text-xs animate-pulse">Generating summary...</div>
                  ) : (
                    <>
                      <p className="text-sm text-gray-700 leading-relaxed mb-3">{summary}</p>
                      {keyPoints.length > 0 && (
                        <ul className="space-y-1.5">
                          {keyPoints.map((pt, i) => (
                            <li key={i} className="text-xs text-gray-600 flex items-start gap-2">
                              <span className="text-yggen-teal mt-0.5">—</span>
                              {pt}
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Article Content */}
        <article className="text-base font-light">
          {renderContent(content.content || content.summary || 'No content available for this article yet.')}
        </article>

        {/* Sources */}
        {content.sources && content.sources.length > 0 && (
          <div className="mt-12 pt-6 border-t border-gray-100">
            <span className="text-xs uppercase tracking-widest text-gray-400 block mb-3">Source</span>
            {content.sources.map((src, i) => (
              <a key={i} href={src} target="_blank" rel="noopener noreferrer"
                className="text-sm text-gray-400 hover:text-black transition-colors underline underline-offset-4 decoration-yggen-teal block">
                {src}
              </a>
            ))}
          </div>
        )}

        {/* Related nodes */}
        {linkedNodes.length > 0 && (
          <div className="mt-12 pt-6 border-t border-gray-100">
            <span className="text-xs uppercase tracking-widest text-gray-400 block mb-4">Related in this Expedition</span>
            <div className="flex flex-wrap gap-2">
              {linkedNodes.slice(0, 10).map(({ topic, nodeId: linkedId }) => (
                <button
                  key={linkedId}
                  onClick={() => handleLinkClick(linkedId, topic)}
                  disabled={drift.checking}
                  className="text-xs px-3 py-1.5 border border-gray-200 text-gray-600 hover:border-black hover:text-black transition-all disabled:opacity-40"
                >
                  {topic}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Sticky Footer */}
      <div className="fixed bottom-0 left-16 right-0 bg-white border-t border-gray-100 px-6 py-4 flex justify-between items-center z-20">
        <button
          onClick={() => content && navigate(`/map/${content.expedition_id}`)}
          className="flex items-center gap-2 text-xs text-gray-400 hover:text-black tracking-widest uppercase transition-colors"
        >
          <Map className="w-4 h-4" />
          Galaxy Map
        </button>
        <button
          onClick={handleContinue}
          className="text-xs px-6 py-2.5 bg-black text-white tracking-widest uppercase hover:bg-yggen-teal transition-colors"
        >
          Continue Expedition
        </button>
      </div>

      {/* Drift Modal */}
      <DriftModal
        isOpen={drift.open}
        candidateTopic={drift.candidateTopic}
        reason={drift.reason}
        score={drift.score}
        onViewSummary={handleDriftViewSummary}
        onStartNewExpedition={handleDriftFork}
        onDismiss={() => setDrift(prev => ({ ...prev, open: false }))}
        isLoading={driftSummaryLoading}
      />

      {/* Reflection Modal */}
      <ReflectionModal
        isOpen={isReflectionOpen}
        topic={content.topic}
        onSubmit={handleReflectionSubmit}
        onClose={() => setIsReflectionOpen(false)}
        feedback={reflectionFeedback}
        isRetry={isRetry}
      />
    </div>
  );
};

export default LearningMode;
