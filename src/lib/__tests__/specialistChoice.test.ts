import { describe, expect, it } from 'vitest';
import { isSpecialistChoiceAllowed, serializeSpecialistChoice } from '../specialistChoice';

describe('isSpecialistChoiceAllowed', () => {
  it('allows choosing when the shop never set it', () => {
    expect(isSpecialistChoiceAllowed(null)).toBe(true);
    expect(isSpecialistChoiceAllowed(undefined)).toBe(true);
    expect(isSpecialistChoiceAllowed('')).toBe(true);
  });

  it('reads the stored off value, plain or JSON-encoded', () => {
    expect(isSpecialistChoiceAllowed('false')).toBe(false);
    expect(isSpecialistChoiceAllowed('"false"')).toBe(false);
  });

  it('reads the stored on value', () => {
    expect(isSpecialistChoiceAllowed('true')).toBe(true);
  });

  it('round-trips with serializeSpecialistChoice', () => {
    expect(isSpecialistChoiceAllowed(serializeSpecialistChoice(false))).toBe(false);
    expect(isSpecialistChoiceAllowed(serializeSpecialistChoice(true))).toBe(true);
  });
});
