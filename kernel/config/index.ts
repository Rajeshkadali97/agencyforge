export interface KernelConfig {
  maxRetries: number;
  defaultTaskPriority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
  logLevel: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
}

export const defaultConfig: KernelConfig = {
  maxRetries: 3,
  defaultTaskPriority: 'NORMAL',
  logLevel: 'INFO',
};
