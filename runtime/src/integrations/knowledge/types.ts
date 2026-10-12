export interface KnowledgeGraphNode {
  id: string;
  type: 'file' | 'function' | 'class' | 'domain' | 'config';
  name: string;
  summary: string;
  tags: string[];
  complexity?: 'simple' | 'moderate' | 'complex';
  filePath?: string;
  lineRange?: [number, number];
  languageNotes?: string;
}

export interface KnowledgeGraphEdge {
  sourceId: string;
  targetId: string;
  type: 'imports' | 'calls' | 'contains' | 'reads_from';
  weight: number;
}

export interface KnowledgeGraphSchema {
  projectId: string;
  projectPath: string;
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
  languageStats?: Record<string, number>;
  architecturalLayers?: string[];
}

export interface CrossProjectUnderstanding {
  projectId: string;
  crossProjectDependencies: string[];
  sharedArchitecturalPatterns: string[];
  relatedProjects: string[];
  insights: string[];
}