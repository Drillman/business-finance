import { useState, useRef, useEffect } from 'react'

interface ComboSelectProps {
  value: string
  options: string[]
  onChange: (value: string) => void
  placeholder?: string
  required?: boolean
  className?: string
}

export function ComboSelect({
  value,
  options,
  onChange,
  placeholder = 'Sélectionner...',
  required = false,
  className = '',
}: ComboSelectProps) {
  const [isCustomMode, setIsCustomMode] = useState(false)
  const [customValue, setCustomValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Determine if current value is custom (not in options)
  const isCurrentValueCustom = value !== '' && !options.includes(value)

  useEffect(() => {
    if (isCustomMode && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isCustomMode])

  // Reset custom mode when value changes externally
  useEffect(() => {
    if (!isCustomMode && isCurrentValueCustom) {
      setCustomValue(value)
    }
  }, [value, isCustomMode, isCurrentValueCustom])

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newValue = e.target.value
    if (newValue === '__custom__') {
      setIsCustomMode(true)
      setCustomValue('')
    } else {
      onChange(newValue)
      setIsCustomMode(false)
    }
  }

  const handleCustomInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setCustomValue(newValue)
    onChange(newValue)
  }

  const handleCustomInputBlur = () => {
    if (customValue === '' && options.length > 0) {
      setIsCustomMode(false)
    }
  }

  const handleCancelCustom = () => {
    setIsCustomMode(false)
    setCustomValue('')
    if (!isCurrentValueCustom) {
      // Keep current value if it's from the list
    } else {
      // Clear if it was custom
      onChange('')
    }
  }

  if (isCustomMode || isCurrentValueCustom) {
    return (
      <div className={`join w-full ${className}`}>
        <input
          ref={inputRef}
          type="text"
          className="input input-bordered join-item flex-1"
          value={isCustomMode ? customValue : value}
          onChange={handleCustomInputChange}
          onBlur={handleCustomInputBlur}
          placeholder={placeholder}
          required={required}
        />
        {options.length > 0 && (
          <button
            type="button"
            className="btn join-item"
            onClick={handleCancelCustom}
            title="Revenir à la liste"
          >
            Liste
          </button>
        )}
      </div>
    )
  }

  return (
    <select
      className={`select select-bordered w-full ${className}`}
      value={value}
      onChange={handleSelectChange}
      required={required}
    >
      <option value="" disabled>
        {placeholder}
      </option>
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
      <option value="__custom__">+ Ajouter une nouvelle valeur</option>
    </select>
  )
}
