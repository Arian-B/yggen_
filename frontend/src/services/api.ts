const API_BASE_URL = 'http://localhost:8000/api';


export interface NodeContent {
    node_id: string;
    expedition_id: string;
    topic: string;
    level: number;
    difficulty_score: number;
    abstraction_score: number;
    content?: string;
    sources?: string[];
    wikipedia_url?: string;
    summary?: string;
    link_type?: 'embedded_link' | 'see_also_link' | null;
    node_type?: 'standard' | 'drift';
}

export interface GraphNode {
    node_id: string;
    topic: string;
    level: number;
    link_type?: string | null;
    node_type?: string;
    wikipedia_url?: string;
}

export interface GraphEdge {
    from_node_id: string;
    to_node_id: string;
    type: string;
}

export interface ExpeditionGraph {
    expedition_id: string;
    root_topic: string;
    nodes: GraphNode[];
    edges: GraphEdge[];
}

export interface ContinueResponse {
    next_node_id?: string;
    reflection_required: boolean;
    message: string;
    xp_gained: number;
    node_id?: string;
}

export interface ReflectionResponse {
    passed: boolean;
    score: number;
    feedback: string;
    xp_bonus?: number;
    next_node_id?: string;
}

export interface UserStats {
    user_id: string;
    total_xp: number;
    level: number;
}

export const getAuthHeader = (): Record<string, string> => {
    const token = localStorage.getItem('wikiyggen_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
};

export const api = {
    expedition: {
        search: async (query: string): Promise<{ results: Array<{ title: string; description: string; url: string }> }> => {
            if (!query || query.trim().length < 2) return { results: [] };
            const res = await fetch(`${API_BASE_URL}/expedition/search?q=${encodeURIComponent(query.trim())}`);
            if (!res.ok) return { results: [] };
            return res.json();
        },
        create: async (topic: string, userId: string) => {
            const res = await fetch(`${API_BASE_URL}/expedition/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
                body: JSON.stringify({ user_id: userId, root_topic: topic })
            });
            if (!res.ok) throw new Error('Failed to create expedition');
            return res.json();
        },
        getGraph: async (expeditionId: string): Promise<ExpeditionGraph> => {
            const res = await fetch(`${API_BASE_URL}/expedition/${expeditionId}/graph`);
            if (!res.ok) throw new Error('Failed to fetch expedition graph');
            return res.json();
        }
    },
    node: {
        get: async (nodeId: string): Promise<NodeContent> => {
            const res = await fetch(`${API_BASE_URL}/expedition/node/${nodeId}`);
            if (!res.ok) throw new Error('Failed to fetch node');
            return res.json();
        },
        getSummary: async (nodeId: string): Promise<{ summary: string; key_points: string[] }> => {
            const res = await fetch(`${API_BASE_URL}/expedition/node/${nodeId}/summary`);
            if (!res.ok) throw new Error('Failed to fetch summary');
            return res.json();
        },
        checkDrift: async (nodeId: string, candidateTopic: string, expeditionId: string): Promise<{
            score: number;
            is_drift: boolean;
            reason: string;
        }> => {
            const res = await fetch(`${API_BASE_URL}/expedition/node/${nodeId}/check-drift`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ candidate_topic: candidateTopic, expedition_id: expeditionId })
            });
            if (!res.ok) return { score: 60, is_drift: false, reason: '' }; // Fail open
            return res.json();
        },
        continue: async (nodeId: string, expeditionId: string, userId: string): Promise<ContinueResponse> => {
            const res = await fetch(`${API_BASE_URL}/expedition/node/${nodeId}/continue`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
                body: JSON.stringify({ expedition_id: expeditionId, user_id: userId })
            });
            if (!res.ok) throw new Error('Failed to continue');
            return res.json();
        },
        reflect: async (nodeId: string, answer: string, userId: string): Promise<ReflectionResponse> => {
            const res = await fetch(`${API_BASE_URL}/expedition/node/${nodeId}/reflect`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
                body: JSON.stringify({ user_id: userId, answer })
            });
            if (!res.ok) throw new Error('Failed to submit reflection');
            return res.json();
        }
    },
    user: {
        getStats: async (userId: string): Promise<UserStats> => {
            const res = await fetch(`${API_BASE_URL}/expedition/user/${userId}`, {
                headers: getAuthHeader()
            });
            if (!res.ok) throw new Error('Failed to fetch user stats');
            return res.json();
        },
        getExpeditions: async (userId: string): Promise<any> => {
            const res = await fetch(`${API_BASE_URL}/expedition/user/${userId}/expeditions`, {
                headers: getAuthHeader()
            });
            if (!res.ok) throw new Error('Failed to fetch expeditions');
            return res.json();
        }
    }
};
