# Model Routing for AgencyForge

## 1. Purpose and Scope

This document defines the routing logic, policies, and decision framework that AgencyForge uses to select the most appropriate Large Language Model (LLM) or generative AI model for any given task. The Model Router is a core Kernel service that interacts with the Agent lifecycle as defined in `AGENT_CONTRACT.md`.

This specification is binding. All routing decisions MUST be auditable, reproducible, and accountable.

## 2. Supported Providers

AgencyForge maintains a provider registry. The Kernel MUST support the following providers and their standard API formats. Each provider is assigned a canonical `provider_id`.

### 2.1. OpenAI (`openai`)
- **Models**: GPT-4o, GPT-4o-mini, o1, o1-mini, DALL-E 3, TTS, Whisper
- **Routing Notes**: Default for general purpose tasks. GPT-4o preferred for speed and cost balance.

### 2.2. Anthropic (`anthropic`)
- **Models**: Claude 3 Opus, Claude 3.5 Sonnet, Claude 3.5 Haiku, Claude 3.7 Sonnet
- **Routing Notes**: Preferred for long-context reasoning, legal/compliance text, and nuanced analysis. Default for 100k+ token tasks.

### 2.3. Google (`google`)
- **Models**: Gemini 1.5 Pro, Gemini 1.5 Flash, Gemma 2
- **Routing Notes**: Flash for low-latency. Pro for 1M token context. Multi-modal star. Default for Video analysis.

### 2.4. NVIDIA (`nvidia`)
- **Models**: Nemotron, Llama 3.1 405B (via NIM)
- **Routing Notes**: Default for agentic workflows and structured output. Preferred for high-speed inference on GPU infrastructure.

### 2.5. OpenRouter (`openrouter`)
- **Models**: Aggregates dozens of frontier and open-source models.
- **Routing Notes**: Used as a fallback provider when primary providers are unavailable. Also used for accessing cutting-edge models that are not in the primary registry yet.

### 2.6. Ollama (`ollama`)
- **Models**: All pull-able models (Llama, Mistral, Qwen, DeepSeek, etc.)
- **Routing Notes**: Primary provider for offline, local, and privacy-sensitive execution. Requires the Ollama server to be running.

### 2.7. LM Studio (`lmstudio`)
- **Models**: Any GGUF model loaded by the user.
- **Routing Notes**: Used for deep local development, model testing, and air-gapped environments.

## 3. Model Capability Registry

The Kernel maintains a canonical registry of model capabilities. When a new model is released, a `Model Registration Request` MUST be filed against this document.

### 3.1. Capability Dimensions
- `context_window`: Maximum tokens supported (e.g., 128k, 200k, 2M).
- `max_output_tokens`: Typical output capacity.
- `supports_vision`: Boolean. Ability to process images and video frames.
- `supports_audio`: Boolean. Ability to process audio or generate voice.
- `supports_tools`: Boolean. Can this model invoke external tools?
- `supports_structured_output`: Boolean. Can this model reliably return JSON/schema?
- `coding_capability_score`: Float 0.0 to 1.0.
- `reasoning_capability_score`: Float 0.0 to 1.0.
- `creative_capability_score`: Float 0.0 to 1.0.
- `latency_profile`: Qualitative (Instant, Fast, Standard, Slow, Heavy).
- `cost_per_1k_tokens`: Input/output pricing.

### 3.2. Registry Maintenance
- The Kernel MUST NOT use a model that is not in the registry.
- The registry MUST be versioned.
- Periodic evaluation of new models is REQUIRED.

## 4. Cost-Aware Routing

Cost is a primary routing dimension. The Model Router MUST optimize for task success within budget constraints.

### 4.1. Budget Modes
- `COST_UNCONSCIOUS`: Use the best model regardless of cost. Only allowed for `CRITICAL` tasks or explicit human override.
- `COST_BALANCED`: Default. Route to the most cost-effective model that meets all capability thresholds.
- `COST_CONSCIOUS`: Aggressive cost saving. Route to the cheapest model that is predicted to succeed. Preferred for low-priority or large-batch tasks.

### 4.2. Cost Thresholds
- The Kernel MUST define a `max_cost_per_task` based on the task directive.
- If a model's projected cost exceeds the threshold, the Router MUST select a cheaper alternative or escalate to the Human Operator.

### 4.3. Batch Optimization
- For multi-step tasks that can be broken down, the Router MAY batch calls to cheaper models where accuracy is secondary.

## 5. Context Window Routing

The size of the input directly dictates model eligibility.

### 5.1. Tiered Routing by Input Size
- **Small Context (0 - 16k tokens)**: Any model. Default to fastest/cheapest that meets quality bar.
- **Medium Context (16k - 128k tokens)**: Standard frontier models (GPT-4o, Claude 3.5 Sonnet, Gemini 1.5 Pro).
- **Large Context (128k - 200k tokens)**: Must route to models with confirmed capacity (Claude 3.5 Sonnet, GPT-4o).
- **Massive Context (200k - 2M tokens)**: Route to Gemini 1.5 Pro or other models with 1M+ capacity. If the task is reasoning over a massive context, Gemini 1.5 Pro is preferred.

### 5.2. Token Estimation
- The Router MUST estimate the token count of the context window before routing.
- If the estimate exceeds the target model's capacity, the Router MUST NOT make the request. It MUST either trim the context, route to a larger-context model, or split the task.

## 6. Speed vs. Quality Routing

Not all tasks require the frontier model. The Router MUST balance latency and quality based on task type.

### 6.1. Speed Priority
- **Trigger**: `latency_priority` > 0.8, user-facing interactive tasks, real-time suggestions.
- **Strategy**: Route to models with `latency_profile` of `Instant` or `Fast`. (e.g., GPT-4o-mini, Claude 3.5 Haiku).
- **Trade-off**: Reduced reasoning depth. Acceptable for filtering, summarization, and routing decisions.

### 6.2. Quality Priority
- **Trigger**: `CRITICAL` tasks, complex reasoning, multi-step problem solving.
- **Strategy**: Route to models with the highest `reasoning_capability_score`. (e.g., Claude 3.5 Sonnet, o1, o1-mini for reasoning tasks).
- **Strategy**: Allow for multi-pass generation (e.g., draft with a fast model, review with a slow, powerful model).

### 6.3. Balanced
- **Trigger**: Default for most tasks.
- **Strategy**: Route to the model that sits at the Pareto frontier of cost/speed/quality for that specific task category.

## 7. Vision Model Selection

Vision tasks require models that can process images or video.

### 7.1. Image Understanding
- **High-Detail Images/Diagrams**: Claude 3.5 Sonnet. Excels at OCR, interpreting UI mockups, and reading charts.
- **General Purpose/Photorealistic**: GPT-4o. Excellent general vision capabilities, balanced cost.
- **Video Frames/High Volume**: Gemini 1.5 Pro. Unbeatable for processing long sequences of images or video due to massive context.
- **Local/Offline**: Gemma 2 or Llava via Ollama.

### 7.2. Video Understanding
- **Short Video Analysis**: GPT-4o (processes frames), Gemini 1.5 Pro.
- **Long Video Analysis**: Gemini 1.5 Pro is the PRIMARY choice for 10-minute+ videos. Its native video understanding and 1M+ context make it uniquely capable.

## 8. Coding Model Selection

Coding tasks demand models with high token-level accuracy for syntax and long-range dependencies.

### 8.1. Code Generation
- **Best-in-Class**: Claude 3.5 Sonnet for complex, multi-file architectural changes. GPT-4o for general-purpose coding.
- **Routine/Boilerplate**: GPT-4o-mini or Claude 3.5 Haiku for speed and cost.
- **Local/Offline**: DeepSeek-Coder or Qwen2.5-Coder via Ollama.

### 8.2. Code Review and Debugging
- **Best-in-Class**: Claude 3.5 Sonnet. Its deep reasoning is superior for catching subtle bugs.
- **Large Codebase Analysis**: Gemini 1.5 Pro for its ability to ingest massive codebases at once.

### 8.3. Language-Specific Routing
- The Router MAY use a preference matrix. For example, `python` tasks may have a slight preference for Claude, while `frontend` tasks may lean towards GPT-4o or Gemini for UI components.

## 9. UI/UX and Design Routing

Design tasks require creativity, visual understanding, and adherence to design system constraints.

### 9.1. UI Generation (React/HTML/CSS)
- **Best-in-Class**: GPT-4o and Claude 3.5 Sonnet are excellent. Claude often produces more aesthetically pleasing and structured code from prompts.
- **Component Generation**: Use cheaper models if the design system is strictly defined and the component is routine.

### 9.2. Design-to-Code
- **From Image Mockups**: Claude 3.5 Sonnet due to its superior vision capabilities for UI/UX.
- **From Figma/Structured Data**: Claude 3.5 Sonnet or GPT-4o.

## 10. Website Generation Routing

Website generation often involves long-context, multi-file, and design-heavy prompts.

### 10.1. Single-Page Sites
- Route to Claude 3.5 Sonnet for best performance on complex layout and styling.

### 10.2. Multi-Page Sites
- Route to Gemini 1.5 Pro. Its massive context allows it to hold an entire site's structure in memory for coherent cross-page navigation and design.

### 10.3. E-commerce/SaaS Specific
- Route to models with strong function calling to interact with backend specification tools.

## 11. Image Generation Routing

Image generation is distinct from LLM processing and is routed to specialized providers.

### 11.1. Photorealistic
- Primary: DALL-E 3 (OpenAI), Ideogram, Midjourney (via third-party bridge if needed).
- Fallback: Stable Diffusion XL (via API or local).

### 11.2. Illustration/Art
- Primary: DALL-E 3, Ideogram.
- Fallback: Local Stable Diffusion models via Ollama/LM Studio.

### 11.3. Design Assets
- For icons and SVGs, prefer code-generating models that output SVG markup rather than bitmap rendering.

## 12. Video Generation Routing

Video generation is resource-intensive and requires specialized providers.

### 12.1. Text-to-Video
- Route to Runway Gen-3, Pika, Kling, or similar.
- The Router MUST handle this as a high-cost, asynchronous task.

### 12.2. Video-to-Video
- Route to Runway or DaVinci Resolve plugins if available.

### 12.3. Fallback
- If no video generation provider is available, the Router MUST signal `CAPABILITY_UNAVAILABLE` and suggest a human operator review.

## 13. Voice Routing

Voice tasks require models that process or generate audio.

### 13.1. Text-to-Speech (TTS)
- **Natural/Dynamic Voice**: OpenAI TTS (e.g., `echo`, `onyx`, `nova`).
- **Low Latency**: OpenAI TTS or ElevenLabs.
- **Local/Offline**: Coqui TTS, Piper, or other local models via Ollama.

### 13.2. Speech-to-Text (Transcription)
- **High Accuracy**: OpenAI Whisper (API).
- **Local/Offline**: OpenAI Whisper (Local) or Faster-Whisper via Ollama.

### 13.3. Voice Interaction
- Models that support audio input (e.g., GPT-4o Voice Mode, Gemini 1.5 Pro) can be routed for real-time voice conversations.

## 14. Research Routing

Research tasks require exhaustive, accurate, and up-to-date information.

### 14.1. Deep Research
- **Best-in-Class**: Claude 3.5 Sonnet for synthesizing information, or Perplexity via API for web-grounded answers.
- **Massive Document Analysis**: Gemini 1.5 Pro for ingesting and querying large PDFs or archives.
- **Coding/Library Research**: O1 or O1-mini for deep technical reasoning.

### 14.2. Quick Lookup
- Route to fast models (GPT-4o-mini) for simple definitions, syntax lookups, or low-stakes fact-checking.

## 15. Multi-Model Collaboration

Complex tasks often benefit from a pipeline of different models.

### 15.1. Plan-Draft-Review Pipeline
- **Planner**: A powerful reasoning model (e.g., Claude 3.5 Sonnet) breaks the task down into steps.
- **Drafter**: A fast model (e.g., GPT-4o-mini) executes the steps, generating content or code.
- **Reviewer**: The powerful reasoning model reviews the output for correctness, quality, and style.

### 15.2. Specialist Ensemble
- A task may be decomposed into subtasks (e.g., a Coding subtask, a Design subtask, a Research subtask). The Router routes each subtask to its respective specialist model and then assembles the results.

## 16. Automatic Fallback Strategy

Failures are inevitable. The Router MUST have a defined fallback path.

### 16.1. Failover Chain
- If a primary model fails (e.g., `503` error, timeout, or invalid output), the Router MUST next attempt the secondary model for that task category.
- If the secondary fails, the Router MUST attempt the tertiary.
- If all tiers fail, the Router MUST raise a `SYSTEM_ERROR` to the Kernel and a Human Operator.

### 16.2. Output Validation Fallback
- If a model produces output in the wrong format (e.g., invalid JSON when `json_mode` was requested), the Router MUST NOT pass the garbage downstream. It MUST retry with the same model or fall back to a model with stronger `supports_structured_output` guarantees.

## 17. Rate Limit Handling

The Router MUST be a good citizen of the providers' API ecosystem.

### 17.1. Rate Limit Awareness
- The Router MUST consume and respect rate limit headers (`X-RateLimit-Remaining`, `X-RateLimit-Reset`).
- It SHOULD proactively migrate to other providers BEFORE hitting the limit, if the task allows.

### 17.2. Queue Management
- If a rate limit is hit, the Router MUST queue the request with an exponential backoff, respecting the provider's `Retry-After`.
- For time-sensitive tasks, it MUST immediately fail over to another provider.

## 18. Offline and Local Model Strategy

AgencyForge MUST be functional in offline or privacy-sensitive environments.

### 18.1. Local-First Option
- If the system is configured for `local_only`, the Router MUST route ALL requests to Ollama or LM Studio.
- It MUST NOT attempt to call external APIs.

### 18.2. Hybrid Mode
- If `hybrid` mode is active, the Router prefers local models for low-complexity tasks and routes high-complexity or creative tasks to the cloud to save local resources.

### 18.3. Local Model Registry
- The Router MUST maintain a registry of locally available models and their capabilities, just like the cloud registry.
- It MUST validate that the Ollama/LM Studio server is alive before attempting a route.

## 19. User Preferences

The Human Operator's preferences override the default heuristics where possible.

### 19.1. Declarative Preferences
- Users MAY declare `preferred_provider`, `preferred_model`, and `avoid_models` in their profile.
- The Router MUST respect `preferred_model` unless it lacks a required capability (e.g., a user prefers GPT-4 but asks for a 200k token task).

### 19.2. Dynamic Override
- At any time, a user MAY issue a `!model <model_name>` command (or equivalent API call) to force the Router for the next task.
- The Router MUST log this override.

### 19.3. Learning
- The Router MAY track successful task completions per model for a given user to improve future routing suggestions.
- This learning MUST be scoped to the user's `user_id` and respects privacy rules.

## 20. Future Model Compatibility

The field of AI is evolving at an unprecedented pace. AgencyForge MUST be designed to accommodate new models without rewrites.

### 20.1. Extensible Registry
- The capability registry format MUST be forward-compatible. New dimensions can be added as optional fields.
- A new model MUST be swappable with an existing one by adding a single entry to the registry.

### 20.2. Abstraction Layer
- The Router MUST interact with models through a standard `ModelInterface` abstraction. The underlying implementation (REST, gRPC, local binary) is an implementation detail.
- Provider-specific code MUST NOT leak into the core routing logic.

### 20.3. Continuous Evaluation
- AgencyForge MUST have a mechanism to continuously evaluate new models against a suite of benchmark tasks.
- Unproven models MUST NOT be used for `CRITICAL` tasks until they have passed the benchmark suite.

### 20.4. Deprecation and Sunsetting
- When a model is deprecated by its provider, the Router MUST automatically update its internal rankings and migrate tasks away from it.
- It MUST notify the Human Operator of upcoming sunsetting that affects active workflows.
