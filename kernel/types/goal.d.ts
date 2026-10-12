export interface Goal {
    id: string;
    objective: string;
    context?: Record<string, unknown>;
    constraints?: string[];
    priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
    project_id?: string;
    user_id?: string;
    created_at: string;
}
//# sourceMappingURL=goal.d.ts.map