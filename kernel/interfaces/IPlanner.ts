import { Goal, TaskGraph } from '../types';

export interface IPlanner {
  /** Accept a Goal and return an executable TaskGraph */
  plan(goal: Goal): TaskGraph;
}
