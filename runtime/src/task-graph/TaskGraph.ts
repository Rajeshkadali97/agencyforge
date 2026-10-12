export interface TaskNode<T = unknown> {
  id: string;
  data?: T;
  dependencies: Set<string>;
}

export class TaskGraph<T = unknown> {
  private nodes: Map<string, TaskNode<T>> = new Map();

  addNode(id: string, data?: T): void {
    if (this.nodes.has(id)) {
      throw new Error(`Task node with id ${id} already exists`);
    }
    this.nodes.set(id, { id, data, dependencies: new Set() });
  }

  addDependency(nodeId: string, dependsOnId: string): void {
    const node = this.nodes.get(nodeId);
    const dep = this.nodes.get(dependsOnId);
    if (!node || !dep) {
      throw new Error('Both node and dependency must exist');
    }
    node.dependencies.add(dependsOnId);
  }

  /**
   * Returns nodes in topological order. Throws if a cycle is detected.
   */
  topologicalSort(): TaskNode<T>[] {
    const visited = new Set<string>();
    const temp = new Set<string>();
    const result: TaskNode<T>[] = [];
    const visit = (n: TaskNode<T>) => {
      if (temp.has(n.id)) {
        throw new Error('Cycle detected in task graph');
      }
      if (!visited.has(n.id)) {
        temp.add(n.id);
        n.dependencies.forEach((depId) => {
          const depNode = this.nodes.get(depId);
          if (!depNode) return;
          visit(depNode);
        });
        temp.delete(n.id);
        visited.add(n.id);
        result.push(n);
      }
    };
    this.nodes.forEach((node) => visit(node));
    return result;
  }
}
