const API_BASE_URL = 'http://localhost:8000/api';
export const CURRENT_USER_ID = "test-user-001";

export interface NodeContent {
    node_id: string;
    expedition_id: string;
    topic: string;
    level: number;
    difficulty_score: number;
    abstraction_score: number;
    content?: string;
    sources?: string[];
}

export interface ContinueResponse {
    next_node_id?: string;
    reflection_required: boolean;
    message: string;
    xp_gained: number;
    node_id?: string; // If reflection required, stays on node
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

export const api = {
    expedition: {
        create: async (topic: string) => {
            const res = await fetch(`${API_BASE_URL}/expedition/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    user_id: CURRENT_USER_ID,
                    root_topic: topic 
                })
            });
            if (!res.ok) throw new Error('Failed to create expedition');
            return res.json();
        }
    },
    node: {
        get: async (nodeId: string): Promise<NodeContent> => {
            const res = await fetch(`${API_BASE_URL}/expedition/node/${nodeId}`);
            if (!res.ok) throw new Error('Failed to fetch node');
            return res.json();
        },
        continue: async (nodeId: string, expeditionId: string): Promise<ContinueResponse> => {
            const res = await fetch(`${API_BASE_URL}/expedition/node/${nodeId}/continue`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    expedition_id: expeditionId,
                    user_id: CURRENT_USER_ID
                })
            });
            if (!res.ok) throw new Error('Failed to continue');
            return res.json();
        },
        reflect: async (nodeId: string, answer: string): Promise<ReflectionResponse> => {
            const res = await fetch(`${API_BASE_URL}/expedition/node/${nodeId}/reflect`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    user_id: CURRENT_USER_ID,
                    answer 
                })
            });
            if (!res.ok) throw new Error('Failed to submit reflection');
            return res.json();
        }
    },
    user: {
        getStats: async (): Promise<UserStats> => {
            const res = await fetch(`${API_BASE_URL}/expedition/user/${CURRENT_USER_ID}`);
            if (!res.ok) throw new Error('Failed to fetch user stats');
            return res.json();
        }
    }
};
