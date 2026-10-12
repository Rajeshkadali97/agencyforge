export type TaskStatus = 'CREATED' | 'PENDING' | 'PLANNING' | 'SCHEDULED' | 'RUNNING' | 'WAITING_FOR_APPROVAL' | 'PAUSED' | 'COMPLETED' | 'FAILED' | 'ROLLED_BACK' | 'ARCHIVED' | 'SKIPPED';
export type TaskPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
export interface Task {
    /** Unique task identifier */
    id: string;
    /** Optional parent task for subtask decomposition */
    parent_task_id?: string;
    /** Human-readable objective */
    objective: string;
    /** References to input artifacts (URIs, IDs, etc.) */
    input_artifacts?: string[];
    /** Expected output types */
    output_artifact_types?: string[];
    /** Capability tags required to execute this task */
    required_capabilities: string[];
    /** Current lifecycle status */
    status: TaskStatus;
    /** Scheduling priority */
    priority: TaskPriority;
    /** Currently assigned agent */
    assigned_agent_id?: string;
    /** IDs of tasks this task depends on */
    dependencies: string[];
    /** How many retries have been attempted */
    retry_count: number;
    /** Maximum number of retry attempts */
    max_retries: number;
    /** ISO 8601 creation timestamp */
    created_at: string;
    /** ISO 8601 start timestamp */
    started_at?: string;
    /** ISO 8601 completion timestamp */
    completed_at?: string;
    /** Execution result (populated on completion or failure) */
    result?: TaskResult;
    /** Extra metadata */
    metadata?: Record<string, unknown>;
}
export interface TaskResult {
    success: boolean;
    output?: string | Record<string, unknown>;
    error?: string;
    metadata?: Record<string, unknown>;
}
export interface TaskGraph {
    id: string;
    goal_id: string;
    tasks: Task[];
    root_task_id: string;
    created_at: string;
}
//# sourceMappingURL=task.d.ts.map