export interface Expedition {
    id: string;
    topic: string;
    createdAt: string;
  }
  
  // const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
  
  export const ExpeditionService = {
    create: async (topic: string): Promise<Expedition> => {
      // Simulator delay for "AI Generation" feel
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Mock response for now to allow frontend dev without backend running
      // In production, uncomment the fetch call below
      
      /*
      const response = await fetch(`${API_URL}/api/expedition/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic })
      });
      
      if (!response.ok) {
        throw new Error('Failed to initiate expedition');
      }
      return response.json();
      */
  
      return {
        id: `exp-${Date.now()}`,
        topic,
        createdAt: new Date().toISOString()
      };
    }
  };
