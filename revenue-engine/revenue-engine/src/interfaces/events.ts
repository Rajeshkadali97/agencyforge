export interface DomainEvent<TPayload = unknown> {
  readonly id: string;
  readonly type: string;
  readonly occurredAt: Date;
  readonly payload: TPayload;
}

export interface DomainEventPublisher {
  publish<TPayload>(event: DomainEvent<TPayload>): Promise<void>;
}

export interface NullDomainEventPublisher extends DomainEventPublisher {
  readonly type: "null";
}
