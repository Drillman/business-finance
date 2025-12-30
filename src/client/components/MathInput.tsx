import { useState, useEffect, useCallback } from 'react'
import { evaluateMathExpression, isValidMathExpression } from '../utils/mathExpression'

interface MathInputProps {
  value: number
  onChange: (value: number) => void
  placeholder?: string
  className?: string
  min?: number
  disabled?: boolean
}

/**
 * An input that accepts math expressions (e.g., "100 + 50")
 * and evaluates them to a numeric value
 */
export function MathInput({
  value,
  onChange,
  placeholder = '0',
  className = '',
  min = 0,
  disabled = false,
}: MathInputProps) {
  const [inputValue, setInputValue] = useState(value.toString())
  const [isEditing, setIsEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Sync internal state when external value changes (but not while editing)
  useEffect(() => {
    if (!isEditing) {
      setInputValue(value.toString())
    }
  }, [value, isEditing])

  const handleFocus = useCallback(() => {
    setIsEditing(true)
    setError(null)
  }, [])

  const handleBlur = useCallback(() => {
    setIsEditing(false)

    // Try to evaluate the expression
    if (inputValue.trim() === '') {
      setInputValue('0')
      onChange(0)
      setError(null)
      return
    }

    try {
      const result = evaluateMathExpression(inputValue)
      const finalValue = min !== undefined ? Math.max(min, result) : result
      setInputValue(finalValue.toString())
      onChange(finalValue)
      setError(null)
    } catch (e) {
      // On error, revert to previous value
      setInputValue(value.toString())
      setError(e instanceof Error ? e.message : 'Expression invalide')
      // Clear error after a moment
      setTimeout(() => setError(null), 2000)
    }
  }, [inputValue, onChange, value, min])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    // Allow: digits, operators, parentheses, decimal points, spaces
    if (/^[\d\s+\-*/().]*$/.test(newValue)) {
      setInputValue(newValue)
      setError(null)
    }
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur()
    }
  }, [])

  // Check if current input looks like an expression (has operators)
  const isExpression = /[+\-*/]/.test(inputValue) && inputValue.trim() !== ''
  const previewValue = isExpression && isValidMathExpression(inputValue)
    ? evaluateMathExpression(inputValue)
    : null

  return (
    <div className="relative">
      <input
        type="text"
        inputMode="decimal"
        className={`input input-bordered w-full ${error ? 'input-error' : ''} ${className}`}
        value={inputValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
      />
      {isEditing && previewValue !== null && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-base-content/60 pointer-events-none">
          = {previewValue.toFixed(2)}
        </div>
      )}
      {error && (
        <div className="absolute -bottom-5 left-0 text-xs text-error">
          {error}
        </div>
      )}
    </div>
  )
}
