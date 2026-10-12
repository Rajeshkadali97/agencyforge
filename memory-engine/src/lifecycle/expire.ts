import { MemoryItem, MemoryType } from '../types';
import { IMemoryProvider } from '../interfaces';

export interface ExpireContext {
  provider: IMemoryProvider;
  policies: ExpiryPolicy[];
  expiredItems: MemoryItem[];
  startTime: number;
}

export interface ExpiryPolicy {
  id: string;
  name: string;
  memoryTypes: MemoryType[];
  maxAgeDays?: number;
  maxItems?: number;
  minImportance?: number;
  minConfidence?: number;
  action: 'archive' | 'delete' | 'forget';
  schedule?: string; // cron expression
  enabled: boolean;
}

export interface ExpireResult {
  processed: number;
  archived: number;
  deleted: number;
  forgotten: number;
  errors: number;
  durationMs: number;
  policyResults: PolicyResult[];
}

export interface PolicyResult {
  policyId: string;
  matched: number;
  archived: number;
  deleted: number;
  forgotten: number;
  errors: string[];
}

export interface IExpirePipeline {
  execute(context: ExpireContext): Promise<ExpireResult>;
  addPolicy(policy: ExpiryPolicy): void;
  removePolicy(policyId: string): boolean;
  getPolicies(): ExpiryPolicy[];
}

export class ExpirePipeline implements IExpirePipeline {
  private policies: ExpiryPolicy[] = [];

  addPolicy(policy: ExpiryPolicy): void {
    this.policies.push(policy);
  }

  removePolicy(policyId: string): boolean {
    const index = this.policies.findIndex(p => p.id === policyId);
    if (index !== -1) {
      this.policies.splice(index, 1);
      return true;
    }
    return false;
  }

  getPolicies(): ExpiryPolicy[] {
    return [...this.policies];
  }

  async execute(context: ExpireContext): Promise<ExpireResult> {
    const results: PolicyResult[] = [];
    let totalProcessed = 0;
    let totalArchived = 0;
    let totalDeleted = 0;
    let totalForgotten = 0;
    let totalErrors = 0;

    for (const policy of this.policies) {
      if (!policy.enabled) continue;

      const policyResult = await this.executePolicy(context, policy);
      results.push(policyResult);

      totalProcessed += policyResult.matched;
      totalArchived += policyResult.archived;
      totalDeleted += policyResult.deleted;
      totalForgotten += policyResult.forgotten;
      totalErrors += policyResult.errors.length;
    }

    return {
      processed: totalProcessed,
      archived: totalArchived,
      deleted: totalDeleted,
      forgotten: totalForgotten,
      errors: totalErrors,
      durationMs: Date.now() - context.startTime,
      policyResults: results,
    };
  }

  private async executePolicy(context: ExpireContext, policy: ExpiryPolicy): Promise<PolicyResult> {
    const result: PolicyResult = {
      policyId: policy.id,
      matched: 0,
      archived: 0,
      deleted: 0,
      forgotten: 0,
      errors: [],
    };

    // This would query the provider for items matching the policy
    // Retrieve matching items according to the expiry policy
    const items = await this.findMatchingItems(context.provider, policy);
    result.matched = items.length;

    for (const item of items) {
      try {
        switch (policy.action) {
          case 'archive':
            await context.provider.archive(item.id, { reason: `Expired by policy: ${policy.name}`, archiveLocation: 'auto-expired' });
            result.archived++;
            break;
          case 'delete':
            await context.provider.delete(item.id, true);
            result.deleted++;
            break;
          case 'forget':
            await this.forgetItem(context.provider, item.id);
            result.forgotten++;
            break;
        }
      } catch (error) {
        result.errors.push(`Item ${item.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return result;
  }

  private async findMatchingItems(provider: IMemoryProvider, policy: ExpiryPolicy): Promise<MemoryItem[]> {
    // This would be implemented with a query to the provider
    // For now, return empty array
    return [];
  }

  private async forgetItem(provider: IMemoryProvider, itemId: string): Promise<void> {
    // Forget removes the item and all its relationships/references
    await provider.delete(itemId, true);
  }
}

export interface ForgetContext {
  id: string;
  reason: string;
  provider: IMemoryProvider;
  item: MemoryItem | null;
  startTime: number;
}

export interface ForgetResult {
  success: boolean;
  providerId: string;
  durationMs: number;
  itemId: string;
  relatedCleaned: number;
}

export interface IForgetPipeline {
  execute(context: ForgetContext): Promise<ForgetResult>;
  addStep(step: ForgetStep): void;
  removeStep(name: string): boolean;
  getSteps(): ForgetStep[];
}

export interface ForgetStep {
  name: string;
  execute(context: ForgetContext): Promise<ForgetContext>;
  canSkip?(context: ForgetContext): boolean;
}

export class ForgetPipeline implements IForgetPipeline {
  private steps: ForgetStep[] = [];

  addStep(step: ForgetStep): void {
    this.steps.push(step);
  }

  removeStep(name: string): boolean {
    const index = this.steps.findIndex(s => s.name === name);
    if (index !== -1) {
      this.steps.splice(index, 1);
      return true;
    }
    return false;
  }

  getSteps(): ForgetStep[] {
    return [...this.steps];
  }

  async execute(context: ForgetContext): Promise<ForgetResult> {
    let currentContext = context;
    currentContext.item = await currentContext.provider.retrieve(currentContext.id);

    if (!currentContext.item) {
      return {
        success: false,
        providerId: currentContext.provider.metadata.id,
        durationMs: Date.now() - currentContext.startTime,
        itemId: currentContext.id,
        relatedCleaned: 0,
      };
    }

    let relatedCleaned = 0;

    for (const step of this.steps) {
      if (step.canSkip && step.canSkip(currentContext)) {
        continue;
      }
      currentContext = await step.execute(currentContext);
    }

    return {
      success: true,
      providerId: currentContext.provider.metadata.id,
      durationMs: Date.now() - currentContext.startTime,
      itemId: currentContext.id,
      relatedCleaned,
    };
  }
}

export class RetrieveForForgetStep implements ForgetStep {
  name = 'retrieve_for_forget';

  async execute(context: ForgetContext): Promise<ForgetContext> {
    context.item = await context.provider.retrieve(context.id);
    return context;
  }
}

export class CleanupRelationshipsStep implements ForgetStep {
  name = 'cleanup_relationships';

  async execute(context: ForgetContext): Promise<ForgetContext> {
    if (!context.item) return context;

    // Find and remove reverse relationships
    // This would be implemented by querying the provider for items that reference this one
    return context;
  }
}

export class CleanupEntityReferencesStep implements ForgetStep {
  name = 'cleanup_entity_references';

  async execute(context: ForgetContext): Promise<ForgetContext> {
    if (!context.item) return context;

    // Remove entity references from other items
    return context;
  }
}

export class RemoveFromIndexesStep implements ForgetStep {
  name = 'remove_from_indexes';

  async execute(context: ForgetContext): Promise<ForgetContext> {
    // Remove from all search indexes
    return context;
  }
}

export class DeleteItemStep implements ForgetStep {
  name = 'delete_item';

  async execute(context: ForgetContext): Promise<ForgetContext> {
    await context.provider.delete(context.id, true);
    return context;
  }
}

export class InvalidateCachesStep implements ForgetStep {
  name = 'invalidate_caches';

  async execute(context: ForgetContext): Promise<ForgetContext> {
    // Invalidate any caches containing this item
    return context;
  }
}