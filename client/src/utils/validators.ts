/**
 * Shared Client-Side Input Validators & Helpers
 *
 * Provides Date of Birth and input validation rules ensuring consistency
 * with backend API contracts and legal age requirements.
 */

export const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface DateOfBirthValidationResult {
  isValid: boolean;
  error?: string;
  age?: number;
}

export interface DateOfBirthOptions {
  required?: boolean;
  referenceDate?: Date;
}

/**
 * Calculates the maximum selectable Date of Birth string (YYYY-MM-DD) representing
 * someone who is exactly 18 years old today.
 * There is no minimum DOB (no maximum age restriction).
 */
export function getMaxDobString(referenceDate: Date = new Date()): string {
  const refYear = referenceDate.getFullYear();
  const refMonth = referenceDate.getMonth();
  const refDay = referenceDate.getDate();

  const targetYear = refYear - 18;
  // Handle leap year edge case: if reference date is Feb 29 and target year is not a leap year,
  // cap to the last day of February (Feb 28).
  const daysInMonth = new Date(targetYear, refMonth + 1, 0).getDate();
  const targetDay = Math.min(refDay, daysInMonth);

  const yStr = String(targetYear);
  const mStr = String(refMonth + 1).padStart(2, '0');
  const dStr = String(targetDay).padStart(2, '0');

  return `${yStr}-${mStr}-${dStr}`;
}

/**
 * Validates a Date of Birth string.
 *
 * Rules:
 * 1. Malformed or impossible dates (e.g. 2005-02-31, leap year mismatches) -> "Please enter a valid date of birth."
 * 2. Future dates (> today's date) -> "Date of birth cannot be in the future."
 * 3. Younger than 18 years old -> "You must be at least 18 years old."
 * 4. Exactly 18 years old or older -> Valid (no upper age limit).
 * 5. Empty / null / undefined:
 *    - If required: false (default) -> Valid
 *    - If required: true -> "Please enter a valid date of birth."
 */
export function validateDateOfBirth(
  val: unknown,
  options: DateOfBirthOptions = {}
): DateOfBirthValidationResult {
  const { required = false, referenceDate = new Date() } = options;

  if (val === undefined || val === null || val === '') {
    if (required) {
      return { isValid: false, error: 'Please enter a valid date of birth.' };
    }
    return { isValid: true };
  }

  if (typeof val !== 'string') {
    return { isValid: false, error: 'Please enter a valid date of birth.' };
  }

  const trimmed = val.trim();
  if (trimmed === '') {
    if (required) {
      return { isValid: false, error: 'Please enter a valid date of birth.' };
    }
    return { isValid: true };
  }

  // 1. Syntactic check (YYYY-MM-DD)
  if (!DATE_REGEX.test(trimmed)) {
    return { isValid: false, error: 'Please enter a valid date of birth.' };
  }

  const [birthYear, birthMonth, birthDay] = trimmed.split('-').map(Number);
  if (
    isNaN(birthYear) ||
    isNaN(birthMonth) ||
    isNaN(birthDay) ||
    birthMonth < 1 ||
    birthMonth > 12 ||
    birthDay < 1 ||
    birthDay > 31
  ) {
    return { isValid: false, error: 'Please enter a valid date of birth.' };
  }

  // Check impossible calendar dates and leap years
  const d = new Date(birthYear, birthMonth - 1, birthDay);
  if (birthYear < 100) d.setFullYear(birthYear);
  if (
    d.getFullYear() !== birthYear ||
    d.getMonth() !== birthMonth - 1 ||
    d.getDate() !== birthDay
  ) {
    return { isValid: false, error: 'Please enter a valid date of birth.' };
  }

  // 2. Future date check (against referenceDate in local calendar)
  const todayYear = referenceDate.getFullYear();
  const todayMonth = referenceDate.getMonth() + 1;
  const todayDay = referenceDate.getDate();

  const todayStr = `${todayYear}-${String(todayMonth).padStart(2, '0')}-${String(todayDay).padStart(2, '0')}`;
  if (trimmed > todayStr) {
    return { isValid: false, error: 'Date of birth cannot be in the future.' };
  }

  // 3. Dynamic age calculation from referenceDate
  let age = todayYear - birthYear;
  const hasHadBirthdayThisYear =
    todayMonth > birthMonth ||
    (todayMonth === birthMonth && todayDay >= birthDay);

  if (!hasHadBirthdayThisYear) {
    age--;
  }

  if (age < 18) {
    return { isValid: false, error: 'You must be at least 18 years old.', age };
  }

  return { isValid: true, age };
}

/**
 * Type guard / boolean helper for date of birth validation.
 */
export function isValidDOB(val: unknown, options?: DateOfBirthOptions): boolean {
  return validateDateOfBirth(val, options).isValid;
}
