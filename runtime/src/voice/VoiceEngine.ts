/**
 * VoiceEngine manages voice providers for text‑to‑speech (TTS) and speech‑to‑text (STT).
 * Providers implement the VoiceProvider interface and can be registered at runtime.
 */
export interface VoiceProvider {
  name: string;
  enabled: boolean;
  synthesize(text: string): Promise<Buffer>;
  transcribe(audio: Buffer): Promise<string>;
}

export class VoiceEngine {
  private providers: Map<string, VoiceProvider> = new Map();

  register(provider: VoiceProvider): void {
    this.providers.set(provider.name, provider);
  }

  async synthesize(providerName: string, text: string): Promise<Buffer> {
    const provider = this.providers.get(providerName);
    if (!provider || !provider.enabled) {
      throw new Error(`Voice provider ${providerName} not available`);
    }
    return provider.synthesize(text);
  }

  async transcribe(providerName: string, audio: Buffer): Promise<string> {
    const provider = this.providers.get(providerName);
    if (!provider || !provider.enabled) {
      throw new Error(`Voice provider ${providerName} not available`);
    }
    return provider.transcribe(audio);
  }
}
