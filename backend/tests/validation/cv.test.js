const { validateCvInput } = require('../../validation/cv');

describe('validateCvInput', () => {
  describe('name', () => {
    test('returns error when name is missing', () => {
      const errors = validateCvInput({});
      expect(errors).toContain('name yra privalomas');
    });

    test('returns error when name is empty string', () => {
      const errors = validateCvInput({ name: '   ' });
      expect(errors).toContain('name yra privalomas');
    });

    test('returns error when name is not a string', () => {
      const errors = validateCvInput({ name: 123 });
      expect(errors).toContain('name yra privalomas');
    });

    test('returns error when name exceeds 100 characters', () => {
      const errors = validateCvInput({ name: 'a'.repeat(101) });
      expect(errors).toContain('name negali būti ilgesnis nei 100 simbolių');
    });

    test('passes with a valid name', () => {
      const errors = validateCvInput({ name: 'Jonas Jonaitis' });
      expect(errors).toHaveLength(0);
    });
  });

  describe('email', () => {
    test('passes when email is not provided', () => {
      const errors = validateCvInput({ name: 'Jonas' });
      expect(errors).toHaveLength(0);
    });

    test('passes with a valid email', () => {
      const errors = validateCvInput({ name: 'Jonas', email: 'jonas@example.com' });
      expect(errors).toHaveLength(0);
    });

    test('returns error for email without @', () => {
      const errors = validateCvInput({ name: 'Jonas', email: 'jonasbademail' });
      expect(errors).toContain('email formatas neteisingas');
    });

    test('returns error for email without domain', () => {
      const errors = validateCvInput({ name: 'Jonas', email: 'jonas@' });
      expect(errors).toContain('email formatas neteisingas');
    });

    test('returns error when email is not a string', () => {
      const errors = validateCvInput({ name: 'Jonas', email: 123 });
      expect(errors).toContain('email formatas neteisingas');
    });
  });

  describe('phone', () => {
    test('passes when phone is not provided', () => {
      const errors = validateCvInput({ name: 'Jonas' });
      expect(errors).toHaveLength(0);
    });

    test('passes with a valid phone number', () => {
      const errors = validateCvInput({ name: 'Jonas', phone: '+370 600 00000' });
      expect(errors).toHaveLength(0);
    });

    test('passes with digits-only phone', () => {
      const errors = validateCvInput({ name: 'Jonas', phone: '0037060000000' });
      expect(errors).toHaveLength(0);
    });

    test('returns error for phone that is too short', () => {
      const errors = validateCvInput({ name: 'Jonas', phone: '123' });
      expect(errors).toContain('phone formatas neteisingas (pvz. +370 600 00000)');
    });

    test('returns error for phone with invalid characters', () => {
      const errors = validateCvInput({ name: 'Jonas', phone: 'abc-def-ghij' });
      expect(errors).toContain('phone formatas neteisingas (pvz. +370 600 00000)');
    });

    test('returns error when phone is not a string', () => {
      const errors = validateCvInput({ name: 'Jonas', phone: 37060000000 });
      expect(errors).toContain('phone formatas neteisingas (pvz. +370 600 00000)');
    });
  });

  describe('experience', () => {
    test('passes when experience is not provided', () => {
      const errors = validateCvInput({ name: 'Jonas' });
      expect(errors).toHaveLength(0);
    });

    test('passes when experience is a string', () => {
      const errors = validateCvInput({ name: 'Jonas', experience: '2 metai Node.js kūrėjas' });
      expect(errors).toHaveLength(0);
    });

    test('passes when experience is an array', () => {
      const errors = validateCvInput({ name: 'Jonas', experience: [{ title: 'Dev', years: 2 }] });
      expect(errors).toHaveLength(0);
    });

    test('returns error when experience is a number', () => {
      const errors = validateCvInput({ name: 'Jonas', experience: 5 });
      expect(errors).toContain('experience turi būti tekstas arba masyvas');
    });

    test('returns error when experience string exceeds 5000 characters', () => {
      const errors = validateCvInput({ name: 'Jonas', experience: 'a'.repeat(5001) });
      expect(errors).toContain('experience negali viršyti 5000 simbolių');
    });
  });

  describe('education', () => {
    test('passes when education is not provided', () => {
      const errors = validateCvInput({ name: 'Jonas' });
      expect(errors).toHaveLength(0);
    });

    test('passes when education is a string', () => {
      const errors = validateCvInput({ name: 'Jonas', education: 'Vilniaus universitetas' });
      expect(errors).toHaveLength(0);
    });

    test('passes when education is an array', () => {
      const errors = validateCvInput({ name: 'Jonas', education: [{ school: 'VU', degree: 'BSc' }] });
      expect(errors).toHaveLength(0);
    });

    test('returns error when education is an object (not array)', () => {
      const errors = validateCvInput({ name: 'Jonas', education: { school: 'VU' } });
      expect(errors).toContain('education turi būti tekstas arba masyvas');
    });

    test('returns error when education string exceeds 5000 characters', () => {
      const errors = validateCvInput({ name: 'Jonas', education: 'a'.repeat(5001) });
      expect(errors).toContain('education negali viršyti 5000 simbolių');
    });
  });

  describe('skills', () => {
    test('passes when skills is not provided', () => {
      const errors = validateCvInput({ name: 'Jonas' });
      expect(errors).toHaveLength(0);
    });

    test('passes when skills is a string', () => {
      const errors = validateCvInput({ name: 'Jonas', skills: 'JavaScript, Node.js, SQL' });
      expect(errors).toHaveLength(0);
    });

    test('passes when skills is an array', () => {
      const errors = validateCvInput({ name: 'Jonas', skills: ['JavaScript', 'Node.js'] });
      expect(errors).toHaveLength(0);
    });

    test('returns error when skills is a boolean', () => {
      const errors = validateCvInput({ name: 'Jonas', skills: true });
      expect(errors).toContain('skills turi būti tekstas arba masyvas');
    });

    test('returns error when skills string exceeds 5000 characters', () => {
      const errors = validateCvInput({ name: 'Jonas', skills: 'a'.repeat(5001) });
      expect(errors).toContain('skills negali viršyti 5000 simbolių');
    });
  });

  describe('multiple errors', () => {
    test('collects multiple errors at once', () => {
      const errors = validateCvInput({
        name: '',
        email: 'not-an-email',
        phone: 'abc',
      });
      expect(errors.length).toBeGreaterThanOrEqual(3);
      expect(errors).toContain('name yra privalomas');
      expect(errors).toContain('email formatas neteisingas');
      expect(errors).toContain('phone formatas neteisingas (pvz. +370 600 00000)');
    });
  });
});
