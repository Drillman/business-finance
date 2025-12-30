/**
 * Safe math expression evaluator
 * Supports: numbers, +, -, *, /, parentheses, decimal points, spaces
 * Does NOT use eval() - parses and evaluates safely
 */

type Token = { type: 'number'; value: number } | { type: 'operator'; value: string } | { type: 'paren'; value: string }

function tokenize(expression: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  const expr = expression.replace(/\s+/g, '') // Remove whitespace

  while (i < expr.length) {
    const char = expr[i]

    // Number (including decimals)
    if (/[\d.]/.test(char)) {
      let numStr = ''
      while (i < expr.length && /[\d.]/.test(expr[i])) {
        numStr += expr[i]
        i++
      }
      const num = parseFloat(numStr)
      if (isNaN(num)) {
        throw new Error('Nombre invalide')
      }
      tokens.push({ type: 'number', value: num })
      continue
    }

    // Operator
    if (['+', '-', '*', '/'].includes(char)) {
      tokens.push({ type: 'operator', value: char })
      i++
      continue
    }

    // Parenthesis
    if (char === '(' || char === ')') {
      tokens.push({ type: 'paren', value: char })
      i++
      continue
    }

    // Invalid character
    throw new Error(`Caractère invalide: ${char}`)
  }

  return tokens
}

// Recursive descent parser
function parse(tokens: Token[]): number {
  let pos = 0

  function peek(): Token | undefined {
    return tokens[pos]
  }

  function consume(): Token {
    return tokens[pos++]
  }

  // Handle + and - (lowest precedence)
  function parseAddSub(): number {
    let left = parseMulDiv()

    while (peek()?.type === 'operator' && (peek()?.value === '+' || peek()?.value === '-')) {
      const op = consume().value
      const right = parseMulDiv()
      if (op === '+') {
        left = left + right
      } else {
        left = left - right
      }
    }

    return left
  }

  // Handle * and / (higher precedence)
  function parseMulDiv(): number {
    let left = parseUnary()

    while (peek()?.type === 'operator' && (peek()?.value === '*' || peek()?.value === '/')) {
      const op = consume().value
      const right = parseUnary()
      if (op === '*') {
        left = left * right
      } else {
        if (right === 0) {
          throw new Error('Division par zéro')
        }
        left = left / right
      }
    }

    return left
  }

  // Handle unary minus
  function parseUnary(): number {
    if (peek()?.type === 'operator' && peek()?.value === '-') {
      consume()
      return -parsePrimary()
    }
    if (peek()?.type === 'operator' && peek()?.value === '+') {
      consume()
      return parsePrimary()
    }
    return parsePrimary()
  }

  // Handle numbers and parentheses
  function parsePrimary(): number {
    const token = peek()

    if (!token) {
      throw new Error('Expression incomplète')
    }

    if (token.type === 'number') {
      consume()
      return token.value
    }

    if (token.type === 'paren' && token.value === '(') {
      consume() // consume '('
      const result = parseAddSub()
      const closing = peek()
      if (!closing || closing.type !== 'paren' || closing.value !== ')') {
        throw new Error('Parenthèse fermante manquante')
      }
      consume() // consume ')'
      return result
    }

    throw new Error('Expression invalide')
  }

  const result = parseAddSub()

  if (pos < tokens.length) {
    throw new Error('Expression invalide')
  }

  return result
}

/**
 * Evaluates a math expression string safely
 * @param expression - A string like "100 + 50 * 2"
 * @returns The numeric result
 * @throws Error if the expression is invalid
 */
export function evaluateMathExpression(expression: string): number {
  const trimmed = expression.trim()

  // If it's just a number, return it directly
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return parseFloat(trimmed)
  }

  // If empty, return 0
  if (trimmed === '') {
    return 0
  }

  const tokens = tokenize(trimmed)

  if (tokens.length === 0) {
    return 0
  }

  return parse(tokens)
}

/**
 * Checks if a string is a valid math expression
 */
export function isValidMathExpression(expression: string): boolean {
  try {
    evaluateMathExpression(expression)
    return true
  } catch {
    return false
  }
}

/**
 * Formats a math expression result for display
 */
export function formatMathResult(value: number): string {
  // Round to 2 decimal places to avoid floating point issues
  return (Math.round(value * 100) / 100).toString()
}
