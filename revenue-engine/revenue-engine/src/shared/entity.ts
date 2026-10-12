export interface Entity<TId extends string = string> {
  readonly id: TId;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface Traceable {
  readonly traceId?: string;
  readonly sourceRefs: readonly SourceReference[];
}

export interface SourceReference {
  readonly providerId: string;
  readonly providerRecordId?: string;
  readonly url?: string;
  readonly observedAt: Date;
  readonly confidence: number;
  readonly terms?: readonly string[];
}
