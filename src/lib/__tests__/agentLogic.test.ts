import { describe, test, expect } from 'vitest';
import {
  gateConfidence,
  routeIntentFallback,
  AGENT_CONFIDENCE_THRESHOLD,
  type GatedAction,
} from '../agentLogic';

// ---------------------------------------------------------------------------
// gateConfidence
// ---------------------------------------------------------------------------

describe('gateConfidence', () => {
  const action: GatedAction = 'book';

  test('proceeds when confidence meets the threshold', () => {
    // Arrange
    const confidence = AGENT_CONFIDENCE_THRESHOLD;
    // Act
    const result = gateConfidence(action, confidence, false);
    // Assert
    expect(result.proceed).toBe(true);
    expect(result.needsConfirmation).toBe(false);
    expect(result.reason).toBe('confidence_ok');
  });

  test('proceeds when confidence exceeds the threshold', () => {
    const result = gateConfidence(action, 0.95, false);
    expect(result.proceed).toBe(true);
    expect(result.needsConfirmation).toBe(false);
  });

  test('blocks when confidence is below threshold and confirm is false', () => {
    const result = gateConfidence(action, 0.4, false);
    expect(result.proceed).toBe(false);
    expect(result.needsConfirmation).toBe(true);
    expect(result.reason).toBe('low_confidence_for_book');
  });

  test('proceeds on explicit confirm even with zero confidence', () => {
    const result = gateConfidence(action, 0, true);
    expect(result.proceed).toBe(true);
    expect(result.needsConfirmation).toBe(false);
    expect(result.reason).toBe('explicit_confirm');
  });

  test('confirm flag overrides low confidence for cancel and reschedule', () => {
    expect(gateConfidence('cancel', 0.1, true).proceed).toBe(true);
    expect(gateConfidence('reschedule', 0.2, true).proceed).toBe(true);
  });

  test('respects a custom threshold', () => {
    // Arrange — a stricter 0.9 threshold
    // Act
    const result = gateConfidence(action, 0.75, false, 0.9);
    // Assert
    expect(result.proceed).toBe(false);
    expect(result.needsConfirmation).toBe(true);
  });

  test('reason encodes the action that was gated', () => {
    const cancelled = gateConfidence('cancel', 0.3, false);
    expect(cancelled.reason).toBe('low_confidence_for_cancel');
    const rescheduled = gateConfidence('reschedule', 0.3, false);
    expect(rescheduled.reason).toBe('low_confidence_for_reschedule');
  });
});

// ---------------------------------------------------------------------------
// routeIntentFallback
// ---------------------------------------------------------------------------

describe('routeIntentFallback', () => {
  test('detects cancel intent', () => {
    expect(routeIntentFallback('Please cancel my appointment').intent).toBe('cancel');
    expect(routeIntentFallback('Ich möchte stornieren').intent).toBe('cancel');
  });

  test('detects reschedule intent', () => {
    expect(routeIntentFallback('Move my booking to Thursday').intent).toBe('reschedule');
    expect(routeIntentFallback('reschedule to next week').intent).toBe('reschedule');
  });

  test('detects book intent', () => {
    expect(routeIntentFallback('Book me a haircut').intent).toBe('book');
    expect(routeIntentFallback('make an appointment').intent).toBe('book');
    expect(routeIntentFallback('Ich möchte einen Termin').intent).toBe('book');
  });

  test('detects hold intent', () => {
    expect(routeIntentFallback('hold that 3pm slot').intent).toBe('hold');
  });

  test('detects availability intent', () => {
    expect(routeIntentFallback('when are you free tomorrow').intent).toBe('availability');
    expect(routeIntentFallback('any available times?').intent).toBe('availability');
  });

  test('defaults to search when no keyword matches', () => {
    expect(routeIntentFallback('find a salon in Hamburg').intent).toBe('search');
  });

  test('always returns zero confidence so mutating intents still require confirm', () => {
    const intents = ['cancel', 'reschedule', 'book', 'hold', 'availability', 'search'] as const;
    for (const phrase of [
      'cancel it',
      'move it',
      'book me',
      'hold it',
      'when free',
      'find a salon',
    ]) {
      const result = routeIntentFallback(phrase);
      expect(result.confidence).toBe(0);
      expect(intents).toContain(result.intent);
    }
  });

  test('is case-insensitive', () => {
    expect(routeIntentFallback('CANCEL MY BOOKING').intent).toBe('cancel');
    expect(routeIntentFallback('BOOK Me').intent).toBe('book');
  });
});