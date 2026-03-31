export type PasswordError = string | null

/**
 * Validates password strength server-side.
 * Returns an error message string, or null if valid.
 */
export function validatePassword(password: string): PasswordError {
  if (password.length < 8) {
    return 'Password must be at least 8 characters'
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must contain a lowercase letter'
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain an uppercase letter'
  }
  if (!/\d/.test(password)) {
    return 'Password must contain a digit'
  }
  return null
}
