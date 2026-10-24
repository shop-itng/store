/**
 * Anti-Bypass & Number Blocking Filter for Shop It (by TEEDS)
 *
 * User Requirement:
 * "Chat: block all numbers (digits and number words).
 * Prices and quantities are picked from preset buttons (₦100, ₦200, ₦500, ₦1,000...), never typed."
 */

export interface AntiBypassResult {
  isViolated: boolean;
  sanitizedText: string;
  detectedViolations: string[];
  violationCount: number;
}

// Regex to catch any digit in any form (standard 0-9, fullwidth, circled)
export const DIGIT_PATTERN = /[0-9\uFF10-\uFF19\u2460-\u2473\u24EA-\u24FF]/;

// Number words in English, Pidgin and common transliterations
export const NUMBER_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
  'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety',
  'hundred', 'thousand', 'million', 'billion',
  'naira', 'kobo', 'ngn',
  'kpa', 'gorimpa', 'shishi',
];

// Regex for whole number words (case-insensitive)
const NUMBER_WORD_REGEX = new RegExp(
  `\\b(${NUMBER_WORDS.join('|')})\\b`,
  'gi'
);

// Preset prices available for selection in chat
export const PRESET_PRICES = [100, 200, 500, 1000, 2000, 3000, 5000, 10000, 15000, 20000];

// Preset quantities available for selection in chat
export const PRESET_QUANTITIES = [1, 2, 3, 4, 5, 10];

/**
 * Checks if the text contains any digits or number words.
 * Returns true if numbers are detected, along with the found tokens.
 */
export function checkNumbersInText(text: string): { hasNumber: boolean; reasons: string[] } {
  if (!text || typeof text !== 'string') {
    return { hasNumber: false, reasons: [] };
  }

  const reasons: string[] = [];

  // Check for any digits
  if (DIGIT_PATTERN.test(text)) {
    reasons.push('Digits (0-9) are blocked in chat');
  }

  // Check for number words
  const wordMatches = text.match(NUMBER_WORD_REGEX);
  if (wordMatches && wordMatches.length > 0) {
    const uniqueMatches = Array.from(new Set(wordMatches.map(w => w.toLowerCase())));
    reasons.push(`Number words blocked: "${uniqueMatches.join(', ')}"`);
  }

  // Check for leetspeak or spaced numbers (e.g., "o 8 o", "z e r o")
  if (/\b(?:z\s*e\s*r\s*o|o\s*n\s*e|t\s*w\s*o)\b/gi.test(text)) {
    reasons.push('Spaced number word detected');
  }

  return {
    hasNumber: reasons.length > 0,
    reasons,
  };
}

// Regex patterns for Nigerian and international contact evasion
const PHONE_PATTERNS = [
  /(?:\+?234|0)[-\s.]?[789][01]\d[-\s.]?\d{3}[-\s.]?\d{4}/gi,
  /\b0\s*[789]\s*[01](?:\s*\d){8}\b/gi,
  /\b\d{3}[-\s.]?\d{3,4}[-\s.]?\d{4}\b/g,
  /\b\d{10,11}\b/g,
  /\b(?:zero|o)\s*(?:eight|8|seven|7|nine|9)\s*(?:zero|0|one|1)\b/gi,
];

const EMAIL_PATTERN = /\b[A-Za-z0-9._%+-]+(?:\s*@\s*|\sat\s)[A-Za-z0-9.-]+(?:\s*\.\s*|\sdot\s)[A-Z|a-z]{2,7}\b/gi;

const URL_PATTERNS = [
  /https?:\/\/[^\s]+/gi,
  /www\.[^\s]+/gi,
  /\b(?:wa\.me|t\.me|bit\.ly|tinyurl\.com|instagram\.com|tiktok\.com)\/[^\s]+/gi,
  /\b[a-zA-Z0-9-]+\.(?:com|ng|org|net|io|co|xyz|me)\b/gi,
];

const OFF_PLATFORM_KEYWORDS = [
  /\b(?:whats\s*app|whatapp|watsap|watsapp|wa\.me)\b/gi,
  /\b(?:telegram|tg\s*handle|t\.me)\b/gi,
  /\b(?:instagram|insta|ig\s*handle|ig\s*dm|dm\s*me|dm\s*on\s*ig)\b/gi,
  /\b(?:snapchat|snap\s*me)\b/gi,
  /\b(?:call\s*me|reach\s*me\s*on|text\s*me\s*on|dial\s*me|phone\s*number)\b/gi,
  /\b(?:opay|palmpay|palm\s*pay|kuda\s*bank|gtb|zenith|access\s*bank)\b/gi,
  /\b(?:send\s*to\s*my\s*account|transfer\s*to\s*my|acct\s*no|account\s*number|acct\s*num)\b/gi,
  /@([A-Za-z0-9_]{3,})/gi,
];

export function filterAntiBypass(text: string): AntiBypassResult {
  if (!text || typeof text !== 'string') {
    return {
      isViolated: false,
      sanitizedText: '',
      detectedViolations: [],
      violationCount: 0,
    };
  }

  let sanitized = text;
  const violations: string[] = [];

  // Check strict numbers and number words
  const numCheck = checkNumbersInText(text);
  if (numCheck.hasNumber) {
    violations.push(...numCheck.reasons);
    sanitized = sanitized.replace(DIGIT_PATTERN, '[#]');
    sanitized = sanitized.replace(NUMBER_WORD_REGEX, '[num]');
  }

  // Check email
  if (EMAIL_PATTERN.test(sanitized)) {
    violations.push('Email address detected');
    sanitized = sanitized.replace(EMAIL_PATTERN, '[blocked email]');
  }

  // Check URLs
  for (const pattern of URL_PATTERNS) {
    if (pattern.test(sanitized)) {
      violations.push('External web link detected');
      sanitized = sanitized.replace(pattern, '[blocked link]');
    }
  }

  // Check phone numbers and account numbers
  for (const pattern of PHONE_PATTERNS) {
    if (pattern.test(sanitized)) {
      violations.push('Phone or account number detected');
      sanitized = sanitized.replace(pattern, '[blocked number]');
    }
  }

  // Check off-platform keywords
  for (const pattern of OFF_PLATFORM_KEYWORDS) {
    if (pattern.test(sanitized)) {
      violations.push('Off-platform payment or contact term detected');
      sanitized = sanitized.replace(pattern, '[blocked contact]');
    }
  }

  const isViolated = violations.length > 0;

  return {
    isViolated,
    sanitizedText: sanitized,
    detectedViolations: Array.from(new Set(violations)),
    violationCount: violations.length,
  };
}
