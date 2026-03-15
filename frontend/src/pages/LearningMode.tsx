import { useEffect, useRef, useState } from 'react';
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

// ── Wikipedia HTML renderer ───────────────────────────────────────────────────
// Uses Wikipedia's full Parsoid HTML endpoint — same content as the desktop
// Wikipedia page, with all images, infoboxes, equations, and references.

const WikipediaArticle = ({
  topic,
  linkedNodes,
  onLinkClick,
}: {
  topic: string;
  linkedNodes: WikiLink[];
  onLinkClick: (nodeId: string, topic: string) => void;
}) => {
  const [html, setHtml] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!topic) return;
    setLoading(true);
    setHtml('');
    setError('');

    const slug = encodeURIComponent(topic.trim().replace(/ /g, '_'));
    const ua = 'wikiyggen_/1.0 (https://github.com/Arian-B/yggen_)';

    // Primary: full Parsoid HTML (complete article, all sections)
    fetch(`https://en.wikipedia.org/api/rest_v1/page/html/${slug}`, {
      headers: { 'Api-User-Agent': ua }
    })
      .then(r => {
        if (!r.ok) throw new Error(`status ${r.status}`);
        return r.text();   // returns full HTML document
      })
      .then(fullDoc => {
        // Extract just the <body> content
        const parser = new DOMParser();
        const doc = parser.parseFromString(fullDoc, 'text/html');
        const body = doc.body;

        // Remove edit-section links, hidden elements, footer navboxes (too noisy)
        body.querySelectorAll('.mw-editsection, .noprint, .navbox, .sistersitebox, #toc').forEach(el => el.remove());

        // Fix protocol-relative src on images and media
        body.querySelectorAll('img[src], img[data-src]').forEach(el => {
          const img = el as HTMLImageElement;
          const src = img.getAttribute('src') || img.getAttribute('data-src') || '';
          if (src.startsWith('//')) img.src = 'https:' + src;
          else if (src.startsWith('./')) img.src = `https://en.wikipedia.org/wiki/${src.slice(2)}`;
          img.style.maxWidth = '100%';
          img.style.height = 'auto';
        });

        setHtml(body.innerHTML);
      })
      .catch(() => {
        // Fallback 1: mobile-sections (structured JSON)
        fetch(`https://en.wikipedia.org/api/rest_v1/page/mobile-sections/${slug}`, {
          headers: { 'Api-User-Agent': ua }
        })
          .then(r => r.ok ? r.json() : Promise.reject())
          .then(data => {
            const lead = data.lead?.sections?.[0]?.text || '';
            const rest = (data.remaining?.sections || [])
              .map((s: any) => `<h2>${s.line || ''}</h2>${s.text || ''}`)
              .join('');
            setHtml(lead + rest);
          })
          .catch(() => {
            // Fallback 2: plain summary
            fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${slug}`)
              .then(r => r.json())
              .then(d => setHtml(`<p>${d.extract_html || d.extract || 'No content available.'}</p>`))
              .catch(() => setError('Could not load Wikipedia content.'));
          });
      })
      .finally(() => setLoading(false));
  }, [topic]);

  // Wire up internal wiki links → expedition node navigation
  useEffect(() => {
    if (!html || !containerRef.current) return;
    const container = containerRef.current;

    container.querySelectorAll('a[href]').forEach(el => {
      const a = el as HTMLAnchorElement;
      const href = a.getAttribute('href') || '';
      const wikiMatch = href.match(/^(?:\.\/|\/wiki\/)([^#?:]+)/);
      if (!wikiMatch) { a.target = '_blank'; a.rel = 'noopener noreferrer'; return; }

      const wikiTitle = decodeURIComponent(wikiMatch[1].replace(/_/g, ' '));
      const linkedNode = linkedNodes.find(
        n => n.topic.toLowerCase() === wikiTitle.toLowerCase()
      );

      if (linkedNode) {
        a.style.color = '#00ADB5';
        a.style.fontWeight = '500';
        a.onclick = e => { e.preventDefault(); onLinkClick(linkedNode.nodeId, linkedNode.topic); };
      } else {
        const abs = href.startsWith('//') ? 'https:' + href
          : href.startsWith('./') ? `https://en.wikipedia.org/wiki/${href.slice(2)}`
          : href.startsWith('/') ? `https://en.wikipedia.org${href}`
          : href;
        a.href = abs;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
      }
    });
  }, [html, linkedNodes, onLinkClick]);

  if (loading) return (
    <div className="text-yggen-teal text-xs animate-pulse tracking-widest uppercase py-8">
      Loading Wikipedia article...
    </div>
  );
  if (error) return <p className="text-red-400 text-sm">{error}</p>;

  return (
    <>
      <style>{`
        .wiki-article { font-family: 'Linux Libertine', Georgia, serif; color: #1a1a1a; font-size: 1rem; line-height: 1.75; }
        .wiki-article p { margin-bottom: 1em; }
        .wiki-article h1 { display: none; }
        .wiki-article h2 { font-size: 1.35rem; font-weight: 700; margin: 2em 0 0.5em; padding-bottom: 4px; border-bottom: 1px solid #e5e7eb; }
        .wiki-article h3 { font-size: 1.1rem; font-weight: 600; margin: 1.5em 0 0.4em; }
        .wiki-article h4 { font-size: 0.95rem; font-weight: 600; margin: 1.2em 0 0.3em; }
        .wiki-article figure { margin: 1.5em 0; }
        .wiki-article figure img { max-width: 100%; height: auto; border-radius: 6px; border: 1px solid #e5e7eb; display: block; }
        .wiki-article figcaption { font-size: 0.78rem; color: #6b7280; margin-top: 6px; }
        .wiki-article table { border-collapse: collapse; margin: 1.5em 0; font-size: 0.88rem; width: auto; max-width: 100%; }
        .wiki-article table th { background: #f9fafb; padding: 6px 10px; text-align: left; border: 1px solid #e5e7eb; font-weight: 600; }
        .wiki-article table td { padding: 6px 10px; border: 1px solid #e5e7eb; vertical-align: top; }
        .wiki-article .infobox, .wiki-article .infobox_v3 { float: right; clear: right; margin: 0 0 1.5em 1.5em; max-width: 300px; min-width: 200px; font-size: 0.82rem; border: 1px solid #e5e7eb; background: #f9fafb; }
        .wiki-article .infobox th, .wiki-article .infobox td { padding: 4px 8px; font-size: 0.8rem; border: 1px solid #e5e7eb; }
        .wiki-article .infobox caption { font-weight: 700; padding: 6px; background: #222; color: white; text-align: center; font-size: 0.85rem; }
        .wiki-article ul, .wiki-article ol { padding-left: 1.5em; margin-bottom: 1em; }
        .wiki-article li { margin-bottom: 0.3em; }
        .wiki-article .mwe-math-element { display: inline-block; overflow-x: auto; vertical-align: middle; }
        .wiki-article .mwe-math-element img { border: none !important; display: inline; }
        .wiki-article .hatnote { font-style: italic; color: #6b7280; border-left: 3px solid #00ADB5; padding-left: 10px; margin-bottom: 1em; font-size: 0.9rem; }
        .wiki-article sup { font-size: 0.7em; }
        .wiki-article sup a { color: #9ca3af; }
        .wiki-article .reflist, .wiki-article ol.references { font-size: 0.8rem; color: #6b7280; }
        .wiki-article .thumb { border: 1px solid #e5e7eb; padding: 4px; margin: 0 0 1em 1em; float: right; clear: right; max-width: 250px; background: #fafafa; font-size: 0.78rem; }
        .wiki-article .thumbcaption { font-size: 0.75rem; color: #6b7280; padding-top: 4px; }
        @media (max-width: 640px) {
          .wiki-article .infobox, .wiki-article .thumb { float: none; max-width: 100%; margin: 0 0 1em 0; }
        }
      `}</style>
      <div
        ref={containerRef}
        className="wiki-article"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </>
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

        // Write expedition context so VerticalNavbar can build the Map link
        if (data.expedition_id) {
          localStorage.setItem('wikiyggen_current_expedition', JSON.stringify({
            node_id: nodeId,
            expedition_id: data.expedition_id
          }));
        }

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

    // Clear expedition context on unmount
    return () => {
      // Only clear if we're leaving the /learn route entirely
      // (handled by next useEffect run, so no-op here is fine)
    };
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
      <div className="max-w-3xl mx-auto px-6 pt-16 pb-40">

        {/* Breadcrumb */}
        <div className="text-xs text-gray-400 tracking-widest uppercase mb-10 flex items-center gap-2">
          <span>{(content as any).primary_domain || 'General'}</span>
          <span>/</span>
          <span className="text-black">{content.topic}</span>
        </div>

        {/* Title */}
        <h1 className="text-5xl md:text-7xl font-bold tracking-tighter mb-4 text-black">
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

        {/* Drift summary peek */}
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

        {/* ── Wikipedia Article with real HTML, images, equations ── */}
        <article>
          <WikipediaArticle
            topic={content.topic}
            linkedNodes={linkedNodes}
            onLinkClick={handleLinkClick}
          />
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
                  className="text-xs px-3 py-1.5 border border-gray-200 text-gray-600 hover:border-yggen-teal hover:text-black transition-all disabled:opacity-40"
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
