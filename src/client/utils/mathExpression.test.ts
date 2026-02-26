import { describe, it, expect } from 'vitest'
import {
  evaluateMathExpression,
  isValidMathExpression,
  formatMathResult,
} from './mathExpression'

describe('evaluateMathExpression', () => {
  describe('basic operations', () => {
    it('evaluates addition', () => {
      expect(evaluateMathExpression('2 + 3')).toBe(5)
    })

    it('evaluates subtraction', () => {
      expect(evaluateMathExpression('10 - 4')).toBe(6)
    })

    it('evaluates multiplication', () => {
      expect(evaluateMathExpression('3 * 7')).toBe(21)
    })

    it('evaluates division', () => {
      expect(evaluateMathExpression('20 / 4')).toBe(5)
    })
  })

  describe('operator precedence', () => {
    it('multiplies before adding', () => {
      expect(evaluateMathExpression('2 + 3 * 4')).toBe(14)
    })

    it('divides before subtracting', () => {
      expect(evaluateMathExpression('10 - 6 / 2')).toBe(7)
    })

    it('handles complex precedence', () => {
      expect(evaluateMathExpression('2 + 3 * 4 - 1')).toBe(13)
    })
  })

  describe('parentheses', () => {
    it('overrides precedence with parens', () => {
      expect(evaluateMathExpression('(2 + 3) * 4')).toBe(20)
    })

    it('handles nested parentheses', () => {
      expect(evaluateMathExpression('((2 + 3) * (4 - 1))')).toBe(15)
    })
  })

  describe('decimals', () => {
    it('handles decimal numbers', () => {
      expect(evaluateMathExpression('1.5 + 2.5')).toBe(4)
    })

    it('handles decimal results', () => {
      expect(evaluateMathExpression('10 / 3')).toBeCloseTo(3.333, 2)
    })
  })

  describe('unary operators', () => {
    it('handles unary minus', () => {
      expect(evaluateMathExpression('-5 + 10')).toBe(5)
    })

    it('handles unary plus', () => {
      expect(evaluateMathExpression('+5')).toBe(5)
    })
  })

  describe('edge cases', () => {
    it('returns number directly for plain number', () => {
      expect(evaluateMathExpression('42')).toBe(42)
    })

    it('returns 0 for empty string', () => {
      expect(evaluateMathExpression('')).toBe(0)
    })

    it('returns 0 for whitespace only', () => {
      expect(evaluateMathExpression('   ')).toBe(0)
    })

    it('handles negative plain number', () => {
      expect(evaluateMathExpression('-42')).toBe(-42)
    })

    it('ignores whitespace', () => {
      expect(evaluateMathExpression('  2  +  3  ')).toBe(5)
    })
  })

  describe('errors', () => {
    it('throws on division by zero', () => {
      expect(() => evaluateMathExpression('10 / 0')).toThrow('Division par zéro')
    })

    it('throws on invalid characters', () => {
      expect(() => evaluateMathExpression('2 + abc')).toThrow('Caractère invalide')
    })

    it('throws on missing closing paren', () => {
      expect(() => evaluateMathExpression('(2 + 3')).toThrow('Parenthèse fermante manquante')
    })

    it('throws on incomplete expression', () => {
      expect(() => evaluateMathExpression('2 +')).toThrow()
    })
  })

  describe('financial calculations', () => {
    it('calculates HT to TTC', () => {
      // 1000 HT + 20% TVA = 1200 TTC
      expect(evaluateMathExpression('1000 * 1.2')).toBe(1200)
    })

    it('sums multiple invoices', () => {
      expect(evaluateMathExpression('500 + 750 + 1200')).toBe(2450)
    })

    it('calculates percentage', () => {
      expect(evaluateMathExpression('1000 * 20 / 100')).toBe(200)
    })
  })
})

describe('isValidMathExpression', () => {
  it('returns true for valid expressions', () => {
    expect(isValidMathExpression('2 + 3')).toBe(true)
    expect(isValidMathExpression('100')).toBe(true)
    expect(isValidMathExpression('(1 + 2) * 3')).toBe(true)
  })

  it('returns false for invalid expressions', () => {
    expect(isValidMathExpression('abc')).toBe(false)
    expect(isValidMathExpression('2 +')).toBe(false)
    expect(isValidMathExpression('(2 + 3')).toBe(false)
  })

  it('returns true for empty string', () => {
    expect(isValidMathExpression('')).toBe(true)
  })
})

describe('formatMathResult', () => {
  it('formats whole numbers', () => {
    expect(formatMathResult(42)).toBe('42')
  })

  it('rounds to 2 decimal places', () => {
    expect(formatMathResult(3.14159)).toBe('3.14')
  })

  it('removes trailing zeros', () => {
    expect(formatMathResult(10.10)).toBe('10.1')
  })

  it('handles floating point precision issues', () => {
    // 0.1 + 0.2 = 0.30000000000000004 in JS
    expect(formatMathResult(0.1 + 0.2)).toBe('0.3')
  })
})
