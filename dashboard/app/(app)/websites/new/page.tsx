'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Check, Globe, Loader2 } from 'lucide-react';
import type { GoalType, StylePreference, OutputFormat } from '@agencyforge/website-builder';

interface WizardState {
  name: string;
  businessType: string;
  description: string;
  targetAudience: string;
  goals: GoalType[];
  stylePreference: StylePreference | '';
  outputFormat: OutputFormat;
}

const GOAL_OPTIONS: { value: GoalType; label: string; description: string }[] = [
  { value: 'leads', label: 'Generate leads', description: 'Capture potential customer contacts' },
  { value: 'sales', label: 'Drive sales', description: 'Sell products or services directly' },
  { value: 'credibility', label: 'Build credibility', description: 'Establish trust and authority' },
  { value: 'portfolio', label: 'Showcase portfolio', description: 'Display work and case studies' },
  { value: 'info', label: 'Provide information', description: 'Share knowledge or resources' },
];

const STYLE_OPTIONS: { value: StylePreference; label: string; description: string }[] = [
  { value: 'minimal', label: 'Minimal', description: 'Clean, lots of whitespace' },
  { value: 'bold', label: 'Bold', description: 'Strong typography, high contrast' },
  { value: 'corporate', label: 'Corporate', description: 'Professional, structured' },
  { value: 'warm', label: 'Warm', description: 'Friendly, approachable tones' },
  { value: 'creative', label: 'Creative', description: 'Expressive, unconventional' },
];

const TOTAL_STEPS = 6;

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {Array.from({ length: TOTAL_STEPS }, (_, i) => (
        <div
          key={i}
          className={`h-2 rounded-full transition-all duration-300 ${
            i < current
              ? 'bg-indigo-500 w-6'
              : i === current
                ? 'bg-indigo-400 w-8'
                : 'bg-neutral-200 w-4'
          }`}
        />
      ))}
      <span className="text-xs text-neutral-500 ml-2">
        Step {current + 1} of {TOTAL_STEPS}
      </span>
    </div>
  );
}

export default function NewWebsitePage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [state, setState] = useState<WizardState>({
    name: '',
    businessType: '',
    description: '',
    targetAudience: '',
    goals: [],
    stylePreference: '',
    outputFormat: 'html',
  });

  function update(patch: Partial<WizardState>) {
    setState(prev => ({ ...prev, ...patch }));
    setError(null);
  }

  function canProceed(): boolean {
    switch (step) {
      case 0: return state.name.trim().length > 0;
      case 1: return state.businessType.trim().length > 0;
      case 2: return state.description.trim().length > 0;
      case 3: return state.targetAudience.trim().length > 0;
      case 4: return state.goals.length > 0;
      case 5: return state.stylePreference !== '';
      default: return false;
    }
  }

  function toggleGoal(goal: GoalType) {
    setState(prev => ({
      ...prev,
      goals: prev.goals.includes(goal)
        ? prev.goals.filter(g => g !== goal)
        : [...prev.goals, goal],
    }));
    setError(null);
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/websites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: state.name,
          outputFormat: state.outputFormat,
          brief: {
            businessType: state.businessType,
            description: state.description,
            targetAudience: state.targetAudience,
            goals: state.goals,
            stylePreference: state.stylePreference,
          },
        }),
      });

      if (response.status === 429) {
        const data = (await response.json()) as { error: string; limit: string };
        setError(
          data.limit === 'PROJECT_LIMIT'
            ? 'You have reached the maximum of 10 projects. Archive some before creating new ones.'
            : 'Too many builds in progress. Wait for current builds to complete.',
        );
        setSubmitting(false);
        return;
      }

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        setError(data.error ?? 'Something went wrong. Please try again.');
        setSubmitting(false);
        return;
      }

      router.push('/websites');
    } catch {
      setError('Network error. Please try again.');
      setSubmitting(false);
    }
  }

  const inputClass =
    'w-full rounded-xl border border-neutral-200 bg-white/70 px-4 py-3 text-sm text-neutral-800 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all';

  return (
    <div className="flex-1 p-8 overflow-y-auto">
      <div className="max-w-xl mx-auto">
        <button
          onClick={() => (step === 0 ? router.push('/websites') : setStep(s => s - 1))}
          className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-800 mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {step === 0 ? 'Back to Websites' : 'Back'}
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-400 to-indigo-500 shadow-md">
            <Globe className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-neutral-800">New Website</h1>
            <p className="text-xs text-neutral-500">Tell us about your project</p>
          </div>
        </div>

        <StepIndicator current={step} />

        <div className="rounded-2xl border border-white/50 bg-white/40 backdrop-blur-sm p-6">
          {step === 0 && (
            <div>
              <label htmlFor="wb-project-name" className="block text-sm font-semibold text-neutral-700 mb-1.5">
                Project name
              </label>
              <p id="wb-project-name-hint" className="text-xs text-neutral-500 mb-3">Give your website project a name.</p>
              <input
                id="wb-project-name"
                type="text"
                className={inputClass}
                placeholder="My Awesome Website"
                value={state.name}
                onChange={e => update({ name: e.target.value })}
                maxLength={100}
                aria-describedby="wb-project-name-hint"
                autoFocus
              />
            </div>
          )}

          {step === 1 && (
            <div>
              <label htmlFor="wb-business-type" className="block text-sm font-semibold text-neutral-700 mb-1.5">
                Business type
              </label>
              <p id="wb-business-type-hint" className="text-xs text-neutral-500 mb-3">
                What kind of business or project is this for?
              </p>
              <input
                id="wb-business-type"
                type="text"
                className={inputClass}
                placeholder="e.g. SaaS startup, dental clinic, freelance designer…"
                value={state.businessType}
                onChange={e => update({ businessType: e.target.value })}
                maxLength={100}
                aria-describedby="wb-business-type-hint"
                autoFocus
              />
            </div>
          )}

          {step === 2 && (
            <div>
              <label htmlFor="wb-description" className="block text-sm font-semibold text-neutral-700 mb-1.5">
                Description
              </label>
              <p id="wb-description-hint" className="text-xs text-neutral-500 mb-3">
                Describe what you do, your unique value, and key offerings.
              </p>
              <textarea
                id="wb-description"
                className={`${inputClass} resize-none h-32`}
                placeholder="We help remote teams stay productive with async video updates…"
                value={state.description}
                onChange={e => update({ description: e.target.value })}
                maxLength={2000}
                aria-describedby="wb-description-hint"
                autoFocus
              />
              <p className="text-xs text-neutral-400 mt-1 text-right">
                {state.description.length}/2000
              </p>
            </div>
          )}

          {step === 3 && (
            <div>
              <label htmlFor="wb-audience" className="block text-sm font-semibold text-neutral-700 mb-1.5">
                Target audience
              </label>
              <p id="wb-audience-hint" className="text-xs text-neutral-500 mb-3">Who is this website for?</p>
              <input
                id="wb-audience"
                type="text"
                className={inputClass}
                placeholder="e.g. Small business owners, B2B SaaS founders…"
                value={state.targetAudience}
                onChange={e => update({ targetAudience: e.target.value })}
                maxLength={500}
                aria-describedby="wb-audience-hint"
                autoFocus
              />
            </div>
          )}

          {step === 4 && (
            <div>
              <p id="wb-goals-label" className="block text-sm font-semibold text-neutral-700 mb-1.5">Goals</p>
              <p id="wb-goals-hint" className="text-xs text-neutral-500 mb-3">
                What should this website accomplish? Select all that apply.
              </p>
              <div role="group" aria-labelledby="wb-goals-label" aria-describedby="wb-goals-hint" className="space-y-2">
                {GOAL_OPTIONS.map(option => {
                  const selected = state.goals.includes(option.value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="checkbox"
                      aria-checked={selected}
                      onClick={() => toggleGoal(option.value)}
                      className={`w-full flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all ${
                        selected
                          ? 'border-indigo-400 bg-indigo-50 text-indigo-800'
                          : 'border-neutral-200 bg-white/60 text-neutral-700 hover:border-neutral-300'
                      }`}
                    >
                      <div
                        className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border transition-colors ${
                          selected ? 'bg-indigo-500 border-indigo-500' : 'border-neutral-300'
                        }`}
                        aria-hidden="true"
                      >
                        {selected && <Check className="h-3 w-3 text-white" />}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{option.label}</p>
                        <p className="text-xs text-neutral-500">{option.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 5 && (
            <div>
              <p id="wb-style-label" className="block text-sm font-semibold text-neutral-700 mb-1.5">
                Style preference
              </p>
              <p id="wb-style-hint" className="text-xs text-neutral-500 mb-3">
                Choose the visual tone for your website.
              </p>
              <div role="radiogroup" aria-labelledby="wb-style-label" aria-describedby="wb-style-hint" className="space-y-2">
                {STYLE_OPTIONS.map(option => {
                  const selected = state.stylePreference === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => update({ stylePreference: option.value })}
                      className={`w-full flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all ${
                        selected
                          ? 'border-indigo-400 bg-indigo-50'
                          : 'border-neutral-200 bg-white/60 hover:border-neutral-300'
                      }`}
                    >
                      <div
                        className={`h-3.5 w-3.5 flex-shrink-0 rounded-full border-2 transition-colors ${
                          selected ? 'border-indigo-500 bg-indigo-500' : 'border-neutral-300'
                        }`}
                        aria-hidden="true"
                      />
                      <div>
                        <p
                          className={`text-sm font-medium ${selected ? 'text-indigo-800' : 'text-neutral-700'}`}
                        >
                          {option.label}
                        </p>
                        <p className="text-xs text-neutral-500">{option.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {error && (
          <p className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            {error}
          </p>
        )}

        <div className="flex items-center justify-end mt-6">
          {step < TOTAL_STEPS - 1 ? (
            <button
              onClick={() => setStep(s => s + 1)}
              disabled={!canProceed()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 text-white text-sm font-semibold shadow-md hover:shadow-lg hover:from-violet-600 hover:to-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Continue
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!canProceed() || submitting}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 text-white text-sm font-semibold shadow-md hover:shadow-lg hover:from-violet-600 hover:to-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating…
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Create Website
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
