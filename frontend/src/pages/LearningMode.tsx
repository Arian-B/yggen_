import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Map, Sparkles, ExternalLink, ChevronDown, ChevronUp, ArrowRight, ArrowLeft } from 'lucide-react';
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

// --- Custom React Markdown Parser ---

interface WikiLink {
  topic: string;
  nodeId: string;
}

const renderInline = (text: string, linkedNodes: WikiLink[], onLinkClick: (nodeId: string, topic: string) => void) => {
  const regex = /(\*\*.*?\*\*|\*.*?\*|\[.*?\]\(.*?\)|`.*?`)/g;
  const parts = text.split(regex);

  return parts.map((part, pidx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={pidx} className="font-bold text-black dark:text-white">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={pidx} className="italic">{part.slice(1, -1)}</em>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={pidx} className="bg-gray-150 dark:bg-zinc-900 text-yggen-teal px-1.5 py-0.5 rounded text-xs font-mono">{part.slice(1, -1)}</code>;
    }
    if (part.startsWith('[') && part.includes('](')) {
      const match = part.match(/\[(.*?)\]\((.*?)\)/);
      if (match) {
        const linkText = match[1];
        const linkTarget = match[2];
        const cleanTarget = decodeURIComponent(linkTarget.replace(/_/g, ' ').replace(/^\.\//, '').replace(/^\/wiki\//, '')).trim().toLowerCase();
        
        const linkedNode = linkedNodes.find(
          n => n.topic.toLowerCase() === cleanTarget || n.topic.toLowerCase() === linkText.toLowerCase()
        );

        if (linkedNode) {
          return (
            <a
              key={pidx}
              href="#"
              onClick={(e) => { e.preventDefault(); onLinkClick(linkedNode.nodeId, linkedNode.topic); }}
              className="text-yggen-teal hover:underline font-medium transition-all"
            >
              {linkText}
            </a>
          );
        } else {
          const isAbsolute = linkTarget.startsWith('http') || linkTarget.startsWith('//');
          const href = isAbsolute ? linkTarget : `https://en.wikipedia.org/wiki/${linkTarget}`;
          return (
            <a
              key={pidx}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-yggen-teal hover:underline font-medium transition-all"
            >
              {linkText}
            </a>
          );
        }
      }
    }

    if (linkedNodes.length > 0) {
      const sortedNodes = [...linkedNodes].sort((a, b) => b.topic.length - a.topic.length);
      const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const patterns = sortedNodes.map(n => `\\b${escapeRegExp(n.topic)}\\b`).join('|');
      
      if (patterns) {
        const topicRegex = new RegExp(`(${patterns})`, 'gi');
        const textParts = part.split(topicRegex);
        
        return textParts.map((tPart, tIdx) => {
          const matchingNode = sortedNodes.find(n => n.topic.toLowerCase() === tPart.toLowerCase());
          if (matchingNode) {
            return (
              <a
                key={`t-${pidx}-${tIdx}`}
                href="#"
                onClick={(e) => { e.preventDefault(); onLinkClick(matchingNode.nodeId, matchingNode.topic); }}
                className="text-yggen-teal hover:underline font-medium transition-all"
              >
                {tPart}
              </a>
            );
          }
          return tPart;
        });
      }
    }

    return part;
  });
};

const parseMarkdownToReact = (markdown: string, linkedNodes: WikiLink[], onLinkClick: (nodeId: string, topic: string) => void) => {
  if (!markdown) return null;
  const blocks = markdown.split(/\n\n+/);

  return blocks.map((block, idx) => {
    const trimmed = block.trim();
    if (!trimmed) return null;

    if (trimmed.startsWith('# ')) {
      return <h1 key={idx} className="text-3xl md:text-4xl font-extrabold tracking-tight mt-10 mb-5 text-black dark:text-white">{renderInline(trimmed.slice(2), linkedNodes, onLinkClick)}</h1>;
    }
    if (trimmed.startsWith('## ')) {
      return <h2 key={idx} className="text-2xl md:text-3xl font-bold tracking-tight mt-8 mb-4 pb-2 border-b border-gray-200 dark:border-zinc-800 text-black dark:text-white">{renderInline(trimmed.slice(3), linkedNodes, onLinkClick)}</h2>;
    }
    if (trimmed.startsWith('### ')) {
      return <h3 key={idx} className="text-xl md:text-2xl font-semibold tracking-tight mt-6 mb-3 text-black dark:text-white">{renderInline(trimmed.slice(4), linkedNodes, onLinkClick)}</h3>;
    }
    if (trimmed.startsWith('#### ')) {
      return <h4 key={idx} className="text-lg font-semibold mt-4 mb-2 text-black dark:text-white">{renderInline(trimmed.slice(5), linkedNodes, onLinkClick)}</h4>;
    }

    if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.match(/^\d+\.\s/)) {
      const lines = trimmed.split('\n');
      const isNumbered = trimmed.match(/^\d+\.\s/);
      
      const items = lines.map((line, lidx) => {
        let content = line.trim();
        if (content.startsWith('- ') || content.startsWith('* ')) {
          content = content.slice(2);
        } else {
          content = content.replace(/^\d+\.\s/, '');
        }
        return <li key={lidx} className="mb-2 leading-relaxed">{renderInline(content, linkedNodes, onLinkClick)}</li>;
      });

      if (isNumbered) {
        return <ol key={idx} className="list-decimal pl-6 mb-6 text-gray-700 dark:text-zinc-350">{items}</ol>;
      } else {
        return <ul key={idx} className="list-disc pl-6 mb-6 text-gray-700 dark:text-zinc-350">{items}</ul>;
      }
    }

    return <p key={idx} className="text-base text-gray-700 dark:text-zinc-300 leading-relaxed mb-6">{renderInline(trimmed, linkedNodes, onLinkClick)}</p>;
  });
};

const WikipediaArticle = ({
  content,
  linkedNodes,
  onLinkClick,
}: {
  topic: string;
  content: string;
  linkedNodes: WikiLink[];
  onLinkClick: (nodeId: string, topic: string) => void;
}) => {
  return (
    <div className="wiki-article text-black dark:text-zinc-100">
      {parseMarkdownToReact(content, linkedNodes, onLinkClick)}
    </div>
  );
};

// ── Main LearningMode ──────────────────────────────────────────────────────────

const LearningMode = () => {
  const { id: nodeId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user?.user_id || '';

  const [content, setContent] = useState<NodeContent | null>(null);
  const [linkedNodes, setLinkedNodes] = useState<WikiLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Streaming state
  const [streamedContent, setStreamedContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamStatus, setStreamStatus] = useState('');

  // AI Summary state
  const [summary, setSummary] = useState('');
  const [keyPoints, setKeyPoints] = useState<string[]>([]);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);

  // Drift state
  const [drift, setDrift] = useState<DriftState>(INITIAL_DRIFT);

  // Drift summary peek
  const [driftSummary, setDriftSummary] = useState('');
  const [driftSummaryLoading, setDriftSummaryLoading] = useState(false);

  // Reflection state
  const [isReflectionOpen, setIsReflectionOpen] = useState(false);
  const [reflectionFeedback, setReflectionFeedback] = useState('');
  const [isRetry, setIsRetry] = useState(false);

  // traversal choice panel
  const [showOptionsPanel, setShowOptionsPanel] = useState(false);

  useEffect(() => {
    if (!nodeId) return;

    // Reset all state for new node
    setLoading(true);
    setContent(null);
    setStreamedContent('');
    setIsStreaming(false);
    setStreamStatus('');
    setSummary('');
    setKeyPoints([]);
    setSummaryOpen(false);
    setDrift(INITIAL_DRIFT);
    setDriftSummary('');
    setError('');

    // Start streaming
    const abort = api.node.stream(nodeId, {
      onMetadata: (data) => {
        // Page renders immediately with topic, domain, nav buttons, etc.
        setContent(data);
        setLoading(false);
        setIsStreaming(true);

        // Write expedition context for the sidebar map link
        if (data.expedition_id) {
          localStorage.setItem('wikiyggen_current_expedition', JSON.stringify({
            node_id: nodeId,
            expedition_id: data.expedition_id,
          }));
        }

        // Fetch linked graph nodes for inline highlighting
        if (data.expedition_id) {
          api.expedition.getGraph(data.expedition_id).then((graph) => {
            const links: WikiLink[] = graph.nodes
              .filter(n => n.node_id !== nodeId)
              .map(n => ({ topic: n.topic, nodeId: n.node_id }));
            setLinkedNodes(links);
          }).catch(() => { /* non-critical */ });
        }
      },
      onStatus: (msg) => {
        setStreamStatus(msg);
      },
      onChunk: (text) => {
        setStreamedContent(prev => prev + text);
      },
      onDone: () => {
        setIsStreaming(false);
        setStreamStatus('');
        // Persist final streamed content into the content object so
        // downstream components (sources, links) still work correctly
        setContent(prev => prev ? { ...prev, content: undefined } : prev);
      },
      onError: (err) => {
        setIsStreaming(false);
        setStreamStatus('');
        if (!content) {
          setError(`Failed to load article: ${err}`);
          setLoading(false);
        }
      },
    });

    return () => {
      abort(); // Cancel stream on unmount / nodeId change
    };
  }, [nodeId]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const handleLinkClick = async (linkedNodeId: string, topic: string) => {
    if (!content || !nodeId) return;
    setDrift({ ...INITIAL_DRIFT, checking: true, candidateTopic: topic, candidateNodeId: linkedNodeId, open: false });
    try {
      const result = await api.node.checkDrift(nodeId, topic, content.expedition_id);
      if (result.is_drift) {
        setDrift({ open: true, candidateTopic: topic, candidateNodeId: linkedNodeId, reason: result.reason, score: result.score, checking: false });
      } else {
        setDrift(INITIAL_DRIFT);
        navigate(`/learn/${linkedNodeId}`);
      }
    } catch {
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
      } else {
        setShowOptionsPanel(true);
      }
    } catch { /* no-op */ }
  };

  const handleReflectionSubmit = async (answer: string) => {
    if (!content) return;
    try {
      const result = await api.node.reflect(content.node_id, answer, userId);
      if (result.passed) {
        setIsReflectionOpen(false);
        setShowOptionsPanel(true);
      } else {
        setReflectionFeedback(result.feedback || 'Try again.');
        setIsRetry(true);
      }
    } catch {
      setReflectionFeedback('Error submitting reflection.');
    }
  };

  const handleSelectNextTopic = async (nextTopic: string) => {
    if (!content) return;
    try {
      setShowOptionsPanel(false);
      setLoading(true);
      const result = await api.node.selectNext(content.node_id, nextTopic, content.expedition_id);
      navigate(`/learn/${result.next_node_id}`);
    } catch (err) {
      console.error("Error selects next path node:", err);
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-zinc-950">
      <div className="text-yggen-teal animate-pulse text-xs tracking-widest uppercase">Loading article...</div>
    </div>
  );

  if (error || !content) return (
    <div className="min-h-screen flex flex-col items-center justify-center text-black dark:text-zinc-100 bg-white dark:bg-zinc-950">
      <div className="text-red-500 mb-4">{error || 'Article not found'}</div>
      <button onClick={() => navigate('/')} className="text-gray-400 dark:text-zinc-500 hover:text-black dark:hover:text-white underline text-sm">Return Home</button>
    </div>
  );

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 text-black dark:text-zinc-100 transition-colors duration-200">
      <div className="max-w-3xl mx-auto px-6 pt-16 pb-40">

        {/* Breadcrumb */}
        <div className="text-xs text-gray-400 dark:text-zinc-550 tracking-widest uppercase mb-10 flex items-center gap-2">
          <span>{(content as any).primary_domain || 'General'}</span>
          <span>/</span>
          <span className="text-black dark:text-zinc-100">{content.topic}</span>
        </div>

        {/* Title */}
        <h1 className="text-5xl md:text-7xl font-bold tracking-tighter mb-4 text-black dark:text-white">
          {content.topic}
        </h1>

        {/* Wikipedia link */}
        {content.wikipedia_url && (
          <a
            href={content.wikipedia_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-gray-400 dark:text-zinc-500 hover:text-black dark:hover:text-zinc-100 mb-8 transition-colors"
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

        {/* Drift summary peek */}
        <AnimatePresence>
          {driftSummary && (
            <motion.div
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="mb-8 p-4 border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20"
            >
              <div className="text-[10px] uppercase tracking-widest text-amber-600 dark:text-amber-550 mb-2">
                Drift peek — {drift.candidateTopic || 'Off-topic article'}
              </div>
              {driftSummaryLoading ? (
                <div className="text-xs text-amber-500 animate-pulse">Loading summary...</div>
              ) : (
                <p className="text-sm text-amber-900 dark:text-amber-200 leading-relaxed">{driftSummary}</p>
              )}
              <button
                onClick={() => setDriftSummary('')}
                className="mt-3 text-[10px] text-amber-500 hover:text-amber-800 dark:hover:text-amber-400 uppercase tracking-widest"
              >
                Dismiss
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* AI Summary Toggle */}
        <div className="mb-10 border border-gray-100 dark:border-zinc-800 rounded-sm overflow-hidden">
          <button
            onClick={handleLoadSummary}
            className="w-full flex items-center justify-between px-4 py-3 text-xs tracking-widest uppercase text-gray-500 dark:text-zinc-400 hover:text-black dark:hover:text-white hover:bg-gray-50 dark:hover:bg-zinc-900 transition-colors"
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
                <div className="px-4 py-4 border-t border-gray-100 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/40">
                  {summaryLoading ? (
                    <div className="text-yggen-teal text-xs animate-pulse">Generating summary...</div>
                  ) : (
                    <>
                      <p className="text-sm text-gray-700 dark:text-zinc-300 leading-relaxed mb-3">{summary}</p>
                      {keyPoints.length > 0 && (
                        <ul className="space-y-1.5">
                           {keyPoints.map((pt, i) => (
                            <li key={i} className="text-xs text-gray-600 dark:text-zinc-450 flex items-start gap-2">
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

        {/* ── Live streaming status badge ── */}
        {isStreaming && streamStatus && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mb-6 flex items-center gap-2 text-xs text-yggen-teal tracking-widest uppercase"
          >
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-yggen-teal animate-pulse" />
            {streamStatus}
          </motion.div>
        )}

        {/* ── Article (streamed or cached) ── */}
        <article>
          <WikipediaArticle
            topic={content.topic}
            content={streamedContent || content.content || ''}
            linkedNodes={linkedNodes}
            onLinkClick={handleLinkClick}
          />
          {/* Blinking cursor while streaming */}
          {isStreaming && (
            <span className="inline-block w-2 h-5 bg-yggen-teal ml-0.5 align-middle animate-[blink_1s_step-end_infinite]" />
          )}
        </article>

        {/* Sources */}
        {content.sources && content.sources.length > 0 && (
          <div className="mt-12 pt-6 border-t border-gray-100 dark:border-zinc-800">
            <span className="text-xs uppercase tracking-widest text-gray-400 dark:text-zinc-550 block mb-3">Source</span>
            {content.sources.map((src, i) => (
              <a key={i} href={src} target="_blank" rel="noopener noreferrer"
                className="text-sm text-gray-400 dark:text-zinc-500 hover:text-black dark:hover:text-zinc-200 transition-colors underline underline-offset-4 decoration-yggen-teal block">
                {src}
              </a>
            ))}
          </div>
        )}

        {/* Related nodes */}
        {linkedNodes.length > 0 && (
          <div className="mt-12 pt-6 border-t border-gray-100 dark:border-zinc-800">
            <span className="text-xs uppercase tracking-widest text-gray-400 dark:text-zinc-550 block mb-4">Related in this Expedition</span>
            <div className="flex flex-wrap gap-2">
              {linkedNodes.slice(0, 10).map(({ topic, nodeId: linkedId }) => (
                <button
                  key={linkedId}
                  onClick={() => handleLinkClick(linkedId, topic)}
                  disabled={drift.checking}
                  className="text-xs px-3 py-1.5 border border-gray-200 dark:border-zinc-800 text-gray-600 dark:text-zinc-400 hover:border-yggen-teal hover:text-black dark:hover:text-white transition-all disabled:opacity-40"
                >
                  {topic}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Sticky Footer */}
      <div className="fixed bottom-0 left-16 right-0 bg-white dark:bg-zinc-950 border-t border-gray-100 dark:border-zinc-850 px-6 py-4 flex justify-between items-center z-20 transition-colors duration-200">
        <button
          onClick={() => content && navigate(`/map/${content.expedition_id}`)}
          className="flex items-center gap-2 text-xs text-gray-400 dark:text-zinc-500 hover:text-black dark:hover:text-zinc-200 tracking-widest uppercase transition-colors"
        >
          <Map className="w-4 h-4" />
          Map Grid
        </button>

        <div className="flex items-center gap-3">
          {content.previous_node_id && (
            <button
              onClick={() => navigate(`/learn/${content.previous_node_id}`)}
              className="cursor-pointer flex items-center gap-1.5 text-xs px-5 py-2.5 bg-transparent text-gray-500 dark:text-zinc-400 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-zinc-800 border border-gray-200 dark:border-zinc-800 hover:border-gray-400 dark:hover:border-zinc-650 rounded-sm tracking-widest uppercase transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Previous Checkpoint
            </button>
          )}

          <button
            onClick={handleContinue}
            className="flex items-center gap-1.5 text-xs px-6 py-2.5 bg-black dark:bg-zinc-900 text-white dark:text-zinc-150 border border-transparent dark:border-zinc-850 tracking-widest uppercase hover:bg-yggen-teal hover:border-yggen-teal hover:shadow-[0_0_15px_#00ADB5] hover:text-white transition-all duration-300 rounded-sm"
          >
            Continue Expedition
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
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

      {/* Dynamic Next Options Panel */}
      <AnimatePresence>
        {showOptionsPanel && content && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-white/95 dark:bg-zinc-900/90 border border-gray-250 dark:border-zinc-800 rounded-xl p-8 max-w-lg w-full shadow-2xl backdrop-blur-md text-black dark:text-white flex flex-col gap-6"
            >
              <div>
                <h3 className="text-xl font-bold tracking-tight text-black dark:text-white mb-2">Continue Your Expedition</h3>
                <p className="text-sm text-zinc-400">Choose the next topic to branch your expedition path.</p>
              </div>
              
              <div className="max-h-[300px] overflow-y-auto pr-1 space-y-2 custom-scrollbar">
                {content.next_options && content.next_options.length > 0 ? (
                  content.next_options.map((topic, i) => (
                    <button
                      key={i}
                      onClick={() => handleSelectNextTopic(topic)}
                      className="w-full text-left px-4 py-3 rounded-lg border border-gray-200 dark:border-zinc-800 bg-gray-50/55 dark:bg-zinc-950/40 hover:bg-yggen-teal/10 hover:border-yggen-teal text-sm transition-all text-black dark:text-zinc-350 hover:text-black dark:hover:text-white"
                    >
                      {topic}
                    </button>
                  ))
                ) : (
                  <div className="text-zinc-500 text-xs py-4 text-center">No related topics found. Proceed to Galaxy Map to choose.</div>
                )}
              </div>

              <div className="flex justify-between items-center border-t border-gray-200 dark:border-zinc-800 pt-4">
                <button
                  onClick={() => { setShowOptionsPanel(false); navigate(`/map/${content.expedition_id}`); }}
                  className="text-xs text-gray-500 dark:text-zinc-500 hover:text-black dark:hover:text-white tracking-widest uppercase transition-colors"
                >
                  Go to Galaxy Map
                </button>
                <button
                  onClick={() => setShowOptionsPanel(false)}
                  className="text-xs px-4 py-2 border border-gray-300 dark:border-zinc-700 text-black dark:text-zinc-400 hover:text-black dark:hover:text-white hover:border-black dark:hover:border-zinc-500 rounded-sm tracking-widest uppercase transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LearningMode;
