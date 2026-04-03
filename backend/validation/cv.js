const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\+?[\d\s\-().]{7,20}$/;
const MAX_NAME_LENGTH = 100;
const MAX_TEXT_LENGTH = 5000;

function validateCvInput({ name, email, phone, experience, education, skills }) {
  const errors = [];

  // name: required, non-empty string, max 100 chars
  if (!name || typeof name !== 'string' || name.trim() === '') {
    errors.push('name yra privalomas');
  } else if (name.trim().length > MAX_NAME_LENGTH) {
    errors.push(`name negali būti ilgesnis nei ${MAX_NAME_LENGTH} simbolių`);
  }

  // email: optional, must be valid format if provided
  if (email != null) {
    if (typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
      errors.push('email formatas neteisingas');
    }
  }

  // phone: optional, must match phone pattern if provided
  if (phone != null) {
    if (typeof phone !== 'string' || !PHONE_REGEX.test(phone.trim())) {
      errors.push('phone formatas neteisingas (pvz. +370 600 00000)');
    }
  }

  // experience: optional, must be string or array if provided
  if (experience != null) {
    if (typeof experience !== 'string' && !Array.isArray(experience)) {
      errors.push('experience turi būti tekstas arba masyvas');
    } else if (typeof experience === 'string' && experience.length > MAX_TEXT_LENGTH) {
      errors.push(`experience negali viršyti ${MAX_TEXT_LENGTH} simbolių`);
    }
  }

  // education: optional, must be string or array if provided
  if (education != null) {
    if (typeof education !== 'string' && !Array.isArray(education)) {
      errors.push('education turi būti tekstas arba masyvas');
    } else if (typeof education === 'string' && education.length > MAX_TEXT_LENGTH) {
      errors.push(`education negali viršyti ${MAX_TEXT_LENGTH} simbolių`);
    }
  }

  // skills: optional, must be string or array if provided
  if (skills != null) {
    if (typeof skills !== 'string' && !Array.isArray(skills)) {
      errors.push('skills turi būti tekstas arba masyvas');
    } else if (typeof skills === 'string' && skills.length > MAX_TEXT_LENGTH) {
      errors.push(`skills negali viršyti ${MAX_TEXT_LENGTH} simbolių`);
    }
  }

  return errors;
}

module.exports = { validateCvInput };
