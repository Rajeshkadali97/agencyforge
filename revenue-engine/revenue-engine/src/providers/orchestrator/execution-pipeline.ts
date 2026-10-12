import { IProvider } from "../interfaces/index.js";
import { Result } from "../../shared/result.js";
import { DomainEvent } from "../../interfaces/events.js";

/**
 * Stages of the execution pipeline
 */
export enum PipelineStage {
  PLAN = "plan",
  VALIDATE = "validate",
  SELECT_PROVIDER = "select_provider",
  EXECUTE = "execute",
  NORMALIZE = "normalize",
  MERGE = "merge",
  STORE = "store",
  NOTIFY = "notify",
  COMPLETE = "complete"
}

/**
 * Result of executing a pipeline stage
 */
export interface PipelineStageResult<T = any> {
  stage: PipelineStage;
  success: boolean;
  data?: T;
  error?: any;
  durationMs: number;
  timestamp: Date;
}

/**
 * Context passed between pipeline stages
 */
export interface PipelineContext {
  // Input
  capability: string;
  operation: string;
  parameters: Record<string, any>;
  
  // Processing
  selectedProvider?: IProvider;
  rawResult?: any;
  normalizedResult?: any;
  
  // Output
  finalResult?: any;
  
  // Metadata
  correlationId: string;
  timestamp: Date;
  retryCount: number;
  
  // Extensibility
  [key: string]: any;
}

/**
 * Interface for pipeline stages
 */
export interface PipelineStageExecutor<TInput, TOutput> {
  execute(context: TInput): Promise<Result<TOutput>>;
  getStageName(): PipelineStage;
}

/**
 * Pipeline that orchestrates the execution flow
 */
export class ExecutionPipeline {
  private readonly stages: Map<PipelineStage, PipelineStageExecutor<any, any>> = new Map();
  
  constructor() {
    // Initialize with default stages
    this.initializeDefaultStages();
  }
  
  /**
   * Add a custom stage to the pipeline
   * @param stage The stage enum
   * @param executor The executor for this stage
   */
  addStage(stage: PipelineStage, executor: PipelineStageExecutor<any, any>): void {
    this.stages.set(stage, executor);
  }
  
  /**
   * Remove a stage from the pipeline
   * @param stage The stage to remove
   */
  removeStage(stage: PipelineStage): void {
    this.stages.delete(stage);
  }
  
  /**
   * Execute the pipeline for a given capability and operation
   * @param capability The capability to execute
   * @param operation The specific operation
   * @param parameters Parameters for the operation
   * @param context Additional context
   * @returns Result of the pipeline execution
   */
  async execute(
    capability: string,
    operation: string,
    parameters: Record<string, any> = {},
    context: Record<string, any> = {}
  ): Promise<Result<any>> {
    const startTime = Date.now();
    
    // Initialize pipeline context
    const pipelineContext: PipelineContext = {
      capability,
      operation,
      parameters,
      correlationId: context.correlationId ?? `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      retryCount: context.retryCount ?? 0,
      ...context
    };
    
    try {
      // Execute each stage in sequence
      const orderedStages = [
        PipelineStage.PLAN,
        PipelineStage.VALIDATE,
        PipelineStage.SELECT_PROVIDER,
        PipelineStage.EXECUTE,
        PipelineStage.NORMALIZE,
        PipelineStage.MERGE,
        PipelineStage.STORE,
        PipelineStage.NOTIFY,
        PipelineStage.COMPLETE
      ];
      
      for (const stage of orderedStages) {
        const executor = this.stages.get(stage);
        if (!executor) {
          throw new Error(`No executor found for stage: ${stage}`);
        }
        
        const stageStart = Date.now();
        let result: Result<any>;
        
        try {
          result = await executor.execute(pipelineContext);
        } catch (error) {
          result = {
            ok: false,
            error: {
              code: "PIPELINE_STAGE_ERROR",
              message: error instanceof Error ? error.message : String(error),
              cause: error
            }
          };
        }
        
        const stageDuration = Date.now() - stageStart;
        
        // Record stage result
        if (result.ok) {
          // Update context with successful result data
          if (result.value !== undefined) {
            // Map stage outputs to context properties
            switch (stage) {
              case PipelineStage.PLAN:
                // Plan results might modify parameters or add metadata
                break;
              case PipelineStage.VALIDATE:
                // Validation might add validated parameters
                break;
              case PipelineStage.SELECT_PROVIDER:
                if (result.value) {
                  pipelineContext.selectedProvider = result.value;
                }
                break;
              case PipelineStage.EXECUTE:
                pipelineContext.rawResult = result.value;
                break;
              case PipelineStage.NORMALIZE:
                pipelineContext.normalizedResult = result.value;
                break;
              case PipelineStage.MERGE:
                // Merge might combine multiple results
                break;
              case PipelineStage.STORE:
                // Storage result
                break;
              case PipelineStage.NOTIFY:
                // Notification result
                break;
              case PipelineStage.COMPLETE:
                pipelineContext.finalResult = result.value;
                break;
            }
          }
        } else {
          // Stage failed - return error with stage information
          return {
            ok: false,
            error: {
              ...result.error,
              stage: stage,
              stageDurationMs: stageDuration,
              pipelineContext: { ...pipelineContext }
            } as any
          };
        }
        
        // Check if we should continue based on stage result
        // For now, we continue unless it's a critical failure
        // In a more advanced implementation, we might have retry logic here
      }
      
      // Pipeline completed successfully
      const totalDuration = Date.now() - startTime;
      
      return {
        ok: true,
        value: {
          result: pipelineContext.finalResult || pipelineContext.rawResult,
          pipelineContext: {
            ...pipelineContext,
            durationMs: totalDuration,
            completedAt: new Date()
          }
        }
      };
    } catch (error) {
      return {
        ok: false,
        error: {
          code: "PIPELINE_ERROR",
          message: error instanceof Error ? error.message : String(error),
          cause: error
        }
      };
    }
  }
  
  /**
   * Initialize default stage executors
   * These can be overridden by providing custom implementations
   */
  private initializeDefaultStages(): void {
    // Planning stage - determine what needs to be done
    this.stages.set(PipelineStage.PLAN, {
      execute: async (context: PipelineContext) => {
        // In a real implementation, this might:
        // - Break down complex operations into steps
        // - Determine required parameters
        // - Check prerequisites
        // - Estimate resource requirements
        
        // For now, just pass through
        return { ok: true, value: { plan: `Execute ${context.operation} for ${context.capability}` } };
      },
      getStageName: () => PipelineStage.PLAN
    });
    
    // Validation stage - validate inputs and parameters
    this.stages.set(PipelineStage.VALIDATE, {
      execute: async (context: PipelineContext) => {
        // Basic validation
        if (!context.capability) {
      return { ok: false, error: { code: "MISSING_CAPABILITY", message: "Capability is required" } };
        }

        if (!context.operation) {
          return { ok: false, error: { code: "MISSING_OPERATION", message: "Operation is required" } };
        }
        
        // Additional validation could go here
        // - Parameter validation
        // - Permission checks
        // - Precondition verification
        
        return { ok: true, value: { validated: true } };
      },
      getStageName: () => PipelineStage.VALIDATE
    });
    
    // Provider selection stage - choose which provider to use
    // Note: This would typically be injected with a CapabilityResolver
    this.stages.set(PipelineStage.SELECT_PROVIDER, {
      execute: async (context: PipelineContext) => {
// Provider selection resolved by upstream orchestrator; here we simply return the provider if already set.
        
        if (context.selectedProvider) {
          return { ok: true, value: context.selectedProvider };
        } else {
          return {
            ok: false,
            error: { code: "NO_PROVIDER", message: "No provider selected - this should be set by the orchestrator" }
          };
        }
      },
      getStageName: () => PipelineStage.SELECT_PROVIDER
    });
    
    // Execution stage - actually call the provider
    this.stages.set(PipelineStage.EXECUTE, {
      execute: async (context: PipelineContext) => {
        if (!context.selectedProvider) {
          return {
            ok: false,
            error: { code: "NO_PROVIDER", message: "No provider selected for execution" }
          };
        }
        
        try {
          // Execute the provider with a unified input envelope
          const result = await context.selectedProvider.execute({
            operation: context.operation,
            parameters: context.parameters,
          });
          
          return { ok: true, value: result };
        } catch (error) {
          return {
            ok: false,
            error: {
              code: "EXECUTE_ERROR",
              message: error instanceof Error ? error.message : String(error),
              cause: error
            }
          };
        }
      },
      getStageName: () => PipelineStage.EXECUTE
    });
    
    // Normalization stage - convert provider response to common format
    this.stages.set(PipelineStage.NORMALIZE, {
      execute: async (context: PipelineContext) => {
        if (context.rawResult === undefined) {
          return {
            ok: false,
            error: { code: "NO_RAW_RESULT", message: "No raw result to normalize" }
          };
        }
        
        // In a real implementation, this would:
        // - Convert provider-specific formats to common schema
        // - Apply data transformations
        // - Validate response structure
        // - Handle errors and edge cases
        
        // For now, just pass through with a marker
        return { 
          ok: true, 
          value: { 
            ...context.rawResult,
            _normalized: true,
            _normalizedBy: context.selectedProvider?.id ?? "unknown"
          } 
        };
      },
      getStageName: () => PipelineStage.NORMALIZE
    });
    
    // Merge stage - combine results if needed (for scatter-gather patterns)
    this.stages.set(PipelineStage.MERGE, {
      execute: async (context: PipelineContext) => {
        // For simple single-provider execution, just pass through
        // For scatter-gather, this would combine multiple results
        
        return { 
          ok: true, 
          value: context.normalizedResult ?? context.rawResult 
        };
      },
      getStageName: () => PipelineStage.MERGE
    });
    
    // Store stage - persist results to memory/cache
    this.stages.set(PipelineStage.STORE, {
      execute: async (context: PipelineContext) => {
        // This would integrate with the memory engine to store:
        // Execution results
        // Performance metrics
        // Usage statistics
        // etc.
        
        // For now, just acknowledge
        return { 
          ok: true, 
          value: { stored: true, timestamp: Date.now() } 
        };
      },
      getStageName: () => PipelineStage.STORE
    });
    
    // Notification stage - send notifications/events
    this.stages.set(PipelineStage.NOTIFY, {
      execute: async (context: PipelineContext) => {
        // This would publish domain events for:
        // - Successful execution
        // - Performance metrics
        // - Error alerts
        // - Usage billing
        // etc.
        
        // For now, just acknowledge
        return { 
          ok: true, 
          value: { notified: true, eventCount: 0 } 
        };
      },
      getStageName: () => PipelineStage.NOTIFY
    });
    
    // Completion stage - finalize and return result
    this.stages.set(PipelineStage.COMPLETE, {
      execute: async (context: PipelineContext) => {
        return { 
          ok: true, 
          value: {
            result: context.finalResult,
            executionSummary: {
              capability: context.capability,
              operation: context.operation,
              provider: context.selectedProvider?.id,
              durationMs: Date.now() - context.timestamp.getTime(),
              timestamp: new Date()
            }
          }
        };
      },
      getStageName: () => PipelineStage.COMPLETE
    });
  }
}
