import { VoiceEngine } from '../voice';

// Mock provider for testing
const mockProvider = {
  name: 'mock',
  enabled: true,
  synthesize: async (text: string) => Buffer.from(`audio:${text}`),
  transcribe: async (audio: Buffer) => audio.toString().replace('audio:', ''),
};

describe('VoiceEngine', () => {
  it('registers provider and synthesizes/transcribes', async () => {
    const engine = new VoiceEngine();
    engine.register(mockProvider);
    const audio = await engine.synthesize('mock', 'hello');
    expect(audio.toString()).toBe('audio:hello');
    const text = await engine.transcribe('mock', audio);
    expect(text).toBe('hello');
  });
});
