export class WebsiteBuilderQuotaError extends Error {
  constructor(
    public readonly limit: 'CONCURRENT_BUILD_LIMIT' | 'PROJECT_LIMIT',
    public readonly current: number,
    public readonly max: number,
  ) {
    super(`Quota exceeded: ${limit} (current: ${current}, max: ${max})`);
    this.name = 'WebsiteBuilderQuotaError';
  }
}

export class WebsiteBuilderNotFoundError extends Error {
  constructor(projectId: string) {
    super(`Website project not found: ${projectId}`);
    this.name = 'WebsiteBuilderNotFoundError';
  }
}

export class WebsiteBuilderValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WebsiteBuilderValidationError';
  }
}
