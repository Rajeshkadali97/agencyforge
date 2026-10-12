import { KnowledgeGraphNode } from './types';

export class KnowledgeSearchService {
  search(nodes: KnowledgeGraphNode[], query: string, maxResults: number = 10): KnowledgeGraphNode[] {
    const queryLower = query.toLowerCase();
    return nodes
      .filter(node => node.name.toLowerCase().includes(queryLower) || node.summary.toLowerCase().includes(queryLower))
      .slice(0, maxResults);
  }
}