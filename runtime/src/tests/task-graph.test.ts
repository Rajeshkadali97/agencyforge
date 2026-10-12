import { TaskGraph } from '../task-graph';

describe('TaskGraph', () => {
  it('topological sort respects dependencies', () => {
    const graph = new TaskGraph();
    graph.addNode('a');
    graph.addNode('b');
    graph.addNode('c');
    graph.addDependency('c', 'b'); // c depends on b
    graph.addDependency('b', 'a'); // b depends on a
    const sorted = graph.topologicalSort().map((n) => n.id);
    expect(sorted).toEqual(['a', 'b', 'c']);
  });

  it('detects cycles', () => {
    const graph = new TaskGraph();
    graph.addNode('x');
    graph.addNode('y');
    graph.addDependency('x', 'y');
    graph.addDependency('y', 'x'); // creates cycle
    expect(() => graph.topologicalSort()).toThrow('Cycle detected');
  });
});
