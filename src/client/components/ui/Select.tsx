import { Check, ChevronDown } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode, SelectHTMLAttributes } from 'react'

export interface SelectOption {
  value: string
  label: ReactNode
  disabled?: boolean
}

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  options: SelectOption[]
  placeholder?: string
  hasError?: boolean
}

export function Select({
  id,
  value,
  onChange,
  required,
  name,
  options,
  placeholder,
  className = '',
  hasError = false,
  disabled,
  ...props
}: SelectProps) {
  const generatedId = useId()
  const selectId = id ?? generatedId
  const listboxId = `${selectId}-listbox`

  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)

  const rootRef = useRef<HTMLDivElement | null>(null)
  const hiddenSelectRef = useRef<HTMLSelectElement | null>(null)
  const listboxRef = useRef<HTMLDivElement | null>(null)

  const selectedValue = String(value ?? '')
  const selectedOption = options.find((option) => option.value === selectedValue)

  const enabledOptions = useMemo(
    () => options.filter((option) => !option.disabled),
    [options],
  )

  const currentEnabledIndex = useMemo(
    () => enabledOptions.findIndex((option) => option.value === selectedValue),
    [enabledOptions, selectedValue],
  )

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  useEffect(() => {
    if (!isOpen) return

    if (currentEnabledIndex >= 0) {
      setHighlightedIndex(currentEnabledIndex)
      requestAnimationFrame(() => {
        const selectedNode = listboxRef.current?.querySelector<HTMLElement>(`[data-option-index="${currentEnabledIndex}"]`)
        selectedNode?.scrollIntoView({ block: 'nearest' })
      })
      return
    }

    setHighlightedIndex(enabledOptions.length > 0 ? 0 : -1)
  }, [isOpen, currentEnabledIndex, enabledOptions.length])

  const emitChange = (nextValue: string) => {
    if (!hiddenSelectRef.current) return

    hiddenSelectRef.current.value = nextValue
    hiddenSelectRef.current.dispatchEvent(new Event('change', { bubbles: true }))
  }

  const selectValue = (nextValue: string) => {
    emitChange(nextValue)
    setIsOpen(false)
  }

  const moveHighlight = (direction: 1 | -1) => {
    if (enabledOptions.length === 0) return

    if (highlightedIndex < 0) {
      setHighlightedIndex(direction === 1 ? 0 : enabledOptions.length - 1)
      return
    }

    const nextIndex = (highlightedIndex + direction + enabledOptions.length) % enabledOptions.length
    setHighlightedIndex(nextIndex)

    requestAnimationFrame(() => {
      const highlightedNode = listboxRef.current?.querySelector<HTMLElement>(`[data-option-index="${nextIndex}"]`)
      highlightedNode?.scrollIntoView({ block: 'nearest' })
    })
  }

  const handleTriggerKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (!isOpen) {
        setIsOpen(true)
        return
      }
      moveHighlight(1)
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (!isOpen) {
        setIsOpen(true)
        return
      }
      moveHighlight(-1)
      return
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()

      if (!isOpen) {
        setIsOpen(true)
        return
      }

      if (highlightedIndex >= 0) {
        selectValue(enabledOptions[highlightedIndex].value)
      }
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      setIsOpen(false)
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <select
        id={selectId}
        ref={hiddenSelectRef}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        name={name}
        required={required}
        value={selectedValue}
        onChange={onChange}
        disabled={disabled}
        {...props}
      >
        {placeholder ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}

        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {typeof option.label === 'string' ? option.label : option.value}
          </option>
        ))}
      </select>

      <button
        type="button"
        className={[
          'h-9.5 w-full rounded-lg border bg-white pr-9 pl-3 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--border-focus) focus-visible:ring-offset-1',
          hasError ? 'border-[#F87171]' : isOpen ? 'border-(--border-focus)' : 'border-(--border-default)',
          disabled ? 'cursor-not-allowed bg-(--bg-hover) text-(--text-tertiary)' : 'cursor-pointer text-(--text-primary)',
          className,
        ].join(' ')}
        onClick={() => !disabled && setIsOpen((open) => !open)}
        onKeyDown={handleTriggerKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-disabled={disabled}
      >
        <span className={selectedOption ? 'text-(--text-primary)' : 'text-(--text-secondary)'}>
          {selectedOption?.label ?? placeholder ?? 'Selectionner...'}
        </span>

        <ChevronDown
          aria-hidden="true"
          className={[
            'pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-(--text-secondary) transition-transform',
            isOpen ? 'rotate-180' : '',
          ].join(' ')}
        />
      </button>

      {isOpen && !disabled && (
        <div
          id={listboxId}
          ref={listboxRef}
          role="listbox"
          className="absolute top-[calc(100%+6px)] z-40 max-h-56 w-full overflow-y-auto rounded-[10px] border border-(--border-default) bg-(--card-bg) p-1 shadow-[0_8px_24px_-10px_rgba(0,0,0,0.28),0_2px_6px_rgba(0,0,0,0.1)]"
        >
          {options.length === 0 ? (
            <div className="px-3 py-2 text-[13px] text-(--text-tertiary)">Aucune option</div>
          ) : (
            options.map((option) => {
              const enabledIndex = enabledOptions.findIndex((enabledOption) => enabledOption.value === option.value)
              const isSelected = option.value === selectedValue
              const isHighlighted = enabledIndex >= 0 && highlightedIndex === enabledIndex

              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  disabled={option.disabled}
                  data-option-index={enabledIndex}
                  className={[
                    'flex cursor-pointer h-9.5 w-full items-center justify-between rounded-md px-3 text-left text-[13px] transition-colors',
                    option.disabled
                      ? 'cursor-not-allowed text-(--text-tertiary) opacity-60'
                      : isSelected
                        ? 'bg-(--color-primary)/10 font-semibold text-(--color-primary)'
                        : isHighlighted
                          ? 'bg-(--bg-hover) text-(--text-primary)'
                          : 'text-(--text-primary) hover:bg-(--bg-hover)',
                  ].join(' ')}
                  onMouseEnter={() => {
                    if (enabledIndex >= 0) {
                      setHighlightedIndex(enabledIndex)
                    }
                  }}
                  onClick={() => {
                    if (!option.disabled) {
                      selectValue(option.value)
                    }
                  }}
                >
                  <span>{option.label}</span>
                  {isSelected ? <Check className="h-3.5 w-3.5" /> : null}
                </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
