import { randomUUID } from 'crypto';
import { ILogger } from '../../interfaces';
import { EnhancedEventBus } from '../../events/EnhancedEventBus';
import { RuntimeEventTypes, createRuntimeEvent, BaseEventPayload } from '../../contracts';
import { ExecutionContext } from '../../context';
import { AgentMetadata, AgentResult, BaseAgent } from '../../agent/AgentRuntime';

// Stub for external dependency browser-use
interface BrowserUseAgentStub {
  goto: (url: string) => Promise<{ page: { title: string; url: string } }>;
  click: (selector: string) => Promise<void>;
  type: (selector: string, text: string) => Promise<void>;
  screenshot: (selector: string) => Promise<{ url: string }>;
  text: (selector: string) => Promise<string>;
}

const browserUseStub: BrowserUseAgentStub = {
  goto: async (url) => ({ page: { title: 'Stub Page', url } }),
  click: async () => {},
  type: async () => {},
  screenshot: async () => ({ url: 'http://localhost/stub.png' }),
  text: async () => 'stub extracted text',
};

export class BrowserAgent extends BaseAgent {
  private logger: ILogger;
  private eventBus: EnhancedEventBus;
  private browser: BrowserUseAgentStub;

  constructor(logger: ILogger, eventBus: EnhancedEventBus) {
    const metadata: AgentMetadata = {
      id: 'agent.browser',
      name: 'Browser Agent',
      version: '1.0.0',
      capabilities: [
        { name: 'page-navigation', version: '1.0.0', description: 'Navigate web pages programmatically' },
        { name: 'element-interaction', version: '1.0.0', description: 'Interact with page elements (click, input, etc.)' },
        { name: 'screenshot-capture', version: '1.0.0', description: 'Capture page screenshots' },
        { name: 'form-handling', version: '1.0.0', description: 'Fill and submit web forms' },
        { name: 'api-scraping', version: '1.0.0', description: 'Extract data from web pages' },
      ],
    };

    super(metadata);
    this.logger = logger;
    this.eventBus = eventBus;
    this.browser = browserUseStub;
  }

  protected async onInitialize(context: ExecutionContext): Promise<void> {
    this.logger.info('BrowserAgent: Initialized', { workflowId: context.workflowId });
  }

  protected async onExecute(context: ExecutionContext, input: unknown): Promise<AgentResult> {
    const params = input as {
      action: 'navigate' | 'click' | 'input' | 'screenshot' | 'extract';
      url?: string;
      selector?: string;
      text?: string;
      element?: string;
    };

    try {
      switch (params.action) {
        case 'navigate':
          return await this.handleNavigate(context, params);
        case 'click':
          return await this.handleClick(context, params);
        case 'input':
          return await this.handleInput(context, params);
        case 'screenshot':
          return await this.handleScreenshot(context, params);
        case 'extract':
          return await this.handleExtract(context, params);
        default:
          return { success: false, error: 'Unknown action' };
      }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err)
      };
    }
  }

  private async handleNavigate(context: ExecutionContext, params: any): Promise<AgentResult> {
    const { url } = params;
    if (!url) {
      return { success: false, error: 'URL required for navigation' };
    }

    this.logger.info('BrowserAgent: Navigating to', { url });

    const { page } = await this.browser.goto(url);
    const traceId = randomUUID();
    const spanId = randomUUID();

    this.eventBus.publish(
      createRuntimeEvent('browser.navigated' as any, {
        workflowId: context.workflowId,
        traceId,
        url,
        title: page.title,
        urlHash: '',
        timestamp: new Date().toISOString(),
        spanId
      } as BaseEventPayload, traceId, spanId)
    );

    return {
      success: true,
      output: {
        pageUrl: page.url,
        title: page.title,
        hash: ''
      }
    };
  }

  private async handleClick(context: ExecutionContext, params: any): Promise<AgentResult> {
    const { selector } = params;
    if (!selector) {
      return { success: false, error: 'CSS selector required for click action' };
    }

    this.logger.info('BrowserAgent: Clicking element', { selector });

    await this.browser.click(selector);
    const traceId = randomUUID();
    const spanId = randomUUID();

    this.eventBus.publish(
      createRuntimeEvent('browser.clicked' as any, {
        workflowId: context.workflowId,
        traceId,
        selector,
        timestamp: new Date().toISOString(),
        spanId
      } as BaseEventPayload, traceId, spanId)
    );

    return {
      success: true,
      output: {
        action: 'click',
        selector
      }
    };
  }

  private async handleInput(context: ExecutionContext, params: any): Promise<AgentResult> {
    const { selector, text } = params;
    if (!selector || !text) {
      return { success: false, error: 'Selector and text required for input action' };
    }

    this.logger.info('BrowserAgent: Inputting text', { selector, text });

    await this.browser.type(selector, text);
    const traceId = randomUUID();
    const spanId = randomUUID();

    this.eventBus.publish(
      createRuntimeEvent('browser.input' as any, {
        workflowId: context.workflowId,
        traceId,
        selector,
        text,
        timestamp: new Date().toISOString(),
        spanId
      } as BaseEventPayload, traceId, spanId)
    );

    return {
      success: true,
      output: {
        selector,
        text
      }
    };
  }

  private async handleScreenshot(context: ExecutionContext, params: any): Promise<AgentResult> {
    const { elementSelector = 'body' } = params;

    this.logger.info('BrowserAgent: Capturing screenshot', { selector: elementSelector });

    const screenshot = await this.browser.screenshot(elementSelector);
    const traceId = randomUUID();
    const spanId = randomUUID();

    this.eventBus.publish(
      createRuntimeEvent('browser.screenshot' as any, {
        workflowId: context.workflowId,
        traceId,
        elementSelector,
        screenshotUrl: screenshot?.url,
        timestamp: new Date().toISOString(),
        spanId
      } as BaseEventPayload, traceId, spanId)
    );

    return {
      success: true,
      output: {
        elementSelector,
        screenshotUrl: screenshot?.url
      }
    };
  }

  private async handleExtract(context: ExecutionContext, params: any): Promise<AgentResult> {
    const { selector } = params;
    if (!selector) {
      return { success: false, error: 'CSS selector required for extraction' };
    }

    this.logger.info('BrowserAgent: Extracting data from', { selector });

    const text = await this.browser.text(selector);
    const traceId = randomUUID();
    const spanId = randomUUID();

    this.eventBus.publish(
      createRuntimeEvent('browser.extracted' as any, {
        workflowId: context.workflowId,
        traceId,
        selector,
        textLength: text.length,
        timestamp: new Date().toISOString(),
        spanId
      } as BaseEventPayload, traceId, spanId)
    );

    return {
      success: true,
      output: {
        selector,
        text
      }
    };
  }

  protected async onPause(context: ExecutionContext): Promise<void> {
    this.logger.info('BrowserAgent: Paused', { workflowId: context.workflowId });
  }

  protected async onResume(context: ExecutionContext): Promise<void> {
    this.logger.info('BrowserAgent: Resumed', { workflowId: context.workflowId });
  }

  protected async onCancel(context: ExecutionContext): Promise<void> {
    this.logger.info('BrowserAgent: Cancelled', { workflowId: context.workflowId });
  }

  protected async onDispose(): Promise<void> {
    this.logger.info('BrowserAgent: Disposed');
  }
}
