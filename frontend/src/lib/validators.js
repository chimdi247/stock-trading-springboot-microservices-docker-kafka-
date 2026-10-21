// Client-side validation mirroring the backend DTO constraints
// (RegisterRequest / LoginRequest / OrderRequest).

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidEmail(email) {
  return typeof email === 'string' && EMAIL_RE.test(email.trim())
}

export function validateLogin({ email, password }) {
  const errors = {}
  if (!isValidEmail(email)) errors.email = 'Enter a valid e-mail address'
  if (!password) errors.password = 'Password is required'
  return errors
}

export function validateRegistration({ firstName, lastName, email, password, initialDeposit }) {
  const errors = {}
  if (!firstName || !firstName.trim()) errors.firstName = 'First name is required'
  if (!lastName || !lastName.trim()) errors.lastName = 'Last name is required'
  if (!isValidEmail(email)) errors.email = 'Enter a valid e-mail address'
  if (!password || password.length < 6) errors.password = 'Password must be at least 6 characters'
  if (initialDeposit !== undefined && initialDeposit !== '' && !(Number(initialDeposit) >= 0)) {
    errors.initialDeposit = 'Deposit must be zero or more'
  }
  return errors
}

/** quantity must be a whole number >= 1 (OrderRequest @Min(1)). */
export function validateOrder({ symbol, quantity }) {
  const errors = {}
  if (!symbol) errors.symbol = 'Choose a stock'
  const q = Number(quantity)
  if (!Number.isInteger(q) || q < 1) errors.quantity = 'Quantity must be a whole number of at least 1'
  return errors
}

export function validateAmount(amount) {
  const n = Number(amount)
  if (!Number.isFinite(n) || n <= 0) return 'Enter an amount greater than 0'
  if (n > 10_000_000) return 'Maximum single deposit is ₹1,00,00,000'
  return null
}
