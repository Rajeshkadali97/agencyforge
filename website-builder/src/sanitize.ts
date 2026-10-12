import { WebsiteBuilderValidationError } from './errors';

const MAX_NAME_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_BUSINESS_TYPE_LENGTH = 100;
const MAX_AUDIENCE_LENGTH = 500;

const INJECTION_PATTERNS: RegExp[] = [
  /<\|system\|>/gi,
  /<\|user\|>/gi,
  /<\/s>/gi,
  /IGNORE PREVIOUS/gi,
  /\[INST\]/gi,
  /\[\/INST\]/gi,
];

function stripInjectionPatterns(value: string): string {
  let clean = value;
  for (const pattern of INJECTION_PATTERNS) {
    clean = clean.replace(pattern, '');
  }
  return clean;
}

export function sanitizeProjectName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    throw new WebsiteBuilderValidationError('Project name cannot be empty');
  }
  if (trimmed.length > MAX_NAME_LENGTH) {
    throw new WebsiteBuilderValidationError(
      `Project name cannot exceed ${MAX_NAME_LENGTH} characters`,
    );
  }
  const sanitized = trimmed.replace(/[\x00-\x1F\x7F]/g, '');
  if (sanitized.length === 0) {
    throw new WebsiteBuilderValidationError('Project name contains only invalid characters');
  }
  return sanitized;
}

export function sanitizeDescription(description: string): string {
  const trimmed = description.trim();
  if (trimmed.length > MAX_DESCRIPTION_LENGTH) {
    throw new WebsiteBuilderValidationError(
      `Description cannot exceed ${MAX_DESCRIPTION_LENGTH} characters`,
    );
  }
  return stripInjectionPatterns(trimmed.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ''));
}

export function sanitizeBusinessType(businessType: string): string {
  const trimmed = businessType.trim();
  if (trimmed.length === 0) {
    throw new WebsiteBuilderValidationError('Business type cannot be empty');
  }
  if (trimmed.length > MAX_BUSINESS_TYPE_LENGTH) {
    throw new WebsiteBuilderValidationError(
      `Business type cannot exceed ${MAX_BUSINESS_TYPE_LENGTH} characters`,
    );
  }
  return stripInjectionPatterns(trimmed.replace(/[\x00-\x1F\x7F]/g, ''));
}

export function sanitizeAudience(audience: string): string {
  const trimmed = audience.trim();
  if (trimmed.length > MAX_AUDIENCE_LENGTH) {
    throw new WebsiteBuilderValidationError(
      `Target audience cannot exceed ${MAX_AUDIENCE_LENGTH} characters`,
    );
  }
  return stripInjectionPatterns(trimmed.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ''));
}

export function sanitizeUrl(url: string): string {
  const trimmed = url.trim();
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new WebsiteBuilderValidationError('URL must use http or https protocol');
    }
    return trimmed;
  } catch (err) {
    if (err instanceof WebsiteBuilderValidationError) throw err;
    throw new WebsiteBuilderValidationError(`Invalid URL: ${trimmed}`);
  }
}
