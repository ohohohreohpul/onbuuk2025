import { describe, expect, it } from 'vitest';
import { customOr } from '../bookingLanguage';

describe('customOr', () => {
  it("uses the shop's own wording", () => {
    expect(customOr('Wählen Sie Ihre Masseurin', 'เลือกผู้ให้บริการ', 'Choose Your Specialist')).toBe('Wählen Sie Ihre Masseurin');
  });

  it('uses the translation when the custom text is just the English default', () => {
    expect(customOr('Choose Your Specialist', 'เลือกผู้ให้บริการ', 'Choose Your Specialist')).toBe('เลือกผู้ให้บริการ');
    // defaults of the appearance editor count as "not customized" too
    expect(customOr('Get Started', 'เริ่มต้น', 'Start')).toBe('เริ่มต้น');
  });

  it('uses the translation when nothing is set', () => {
    expect(customOr(undefined, 'ดำเนินการต่อ', 'Continue')).toBe('ดำเนินการต่อ');
    expect(customOr('  ', 'ดำเนินการต่อ', 'Continue')).toBe('ดำเนินการต่อ');
  });
});
