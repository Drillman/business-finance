import { Check, ChevronDown } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'

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
  const listboxId = useId()
  const [isOpen, setIsOpen] = useState(false)
  const [inputValue, setInputValue] = useState(value)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)

  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const normalizedInput = inputValue.trim().toLowerCase()

  const filteredOptions = useMemo(
    () => options.filter((option) => option.toLowerCase().includes(normalizedInput)),
    [options, normalizedInput],
  )

  const exactMatch = useMemo(
    () => options.some((option) => option.toLowerCase() === normalizedInput),
    [options, normalizedInput],
  )

  useEffect(() => {
    setInputValue(value)
  }, [value])

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
    if (!isOpen) {
      setHighlightedIndex(-1)
      return
    }

    setHighlightedIndex(filteredOptions.length > 0 ? 0 : -1)
  }, [isOpen, filteredOptions.length])

  useEffect(() => {
    if (!isOpen || highlightedIndex < 0) return

    requestAnimationFrame(() => {
      const activeNode = listRef.current?.querySelector<HTMLElement>(`[data-option-index="${highlightedIndex}"]`)
      activeNode?.scrollIntoView({ block: 'nearest' })
    })
  }, [highlightedIndex, isOpen])

  const commitValue = (nextValue: string) => {
    setInputValue(nextValue)
    onChange(nextValue)
    setIsOpen(false)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextValue = e.target.value
    setInputValue(nextValue)
    onChange(nextValue)
    setIsOpen(true)
  }

  const moveHighlight = (direction: 1 | -1) => {
    if (!filteredOptions.length) return

    if (highlightedIndex < 0) {
      setHighlightedIndex(direction === 1 ? 0 : filteredOptions.length - 1)
      return
    }

    const nextIndex = (highlightedIndex + direction + filteredOptions.length) % filteredOptions.length
    setHighlightedIndex(nextIndex)
  }

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!isOpen) {
        setIsOpen(true)
        return
      }
      moveHighlight(1)
      return
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (!isOpen) {
        setIsOpen(true)
        return
      }
      moveHighlight(-1)
      return
    }

    if (e.key === 'Enter') {
      if (isOpen && highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
        e.preventDefault()
        commitValue(filteredOptions[highlightedIndex])
      } else {
        setIsOpen(false)
      }
      return
    }

    if (e.key === 'Escape') {
      e.preventDefault()
      setIsOpen(false)
    }
  }

  return (
    <div ref={rootRef} className="relative w-full">
      <input
        ref={inputRef}
        type="text"
        className={[
          'h-9.5 w-full rounded-lg border border-(--border-default) bg-(--card-bg) pr-9 pl-3 text-sm text-(--text-primary) outline-none transition-colors placeholder:text-(--text-tertiary) focus:border-(--border-focus) focus-visible:ring-2 focus-visible:ring-(--border-focus) focus-visible:ring-offset-1',
          className,
        ].join(' ')}
        value={inputValue}
        onChange={handleInputChange}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleInputKeyDown}
        placeholder={placeholder}
        required={required}
        autoComplete="off"
        role="combobox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
      />

      <button
        type="button"
        onClick={() => {
          setIsOpen((open) => !open)
          if (!isOpen) {
            inputRef.current?.focus()
          }
        }}
        className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-(--text-secondary)"
        aria-label="Afficher les options"
      >
        <ChevronDown
          className={[
            'h-4 w-4 transition-transform',
            isOpen ? 'rotate-180' : '',
          ].join(' ')}
        />
      </button>

      {isOpen && (
        <div
          id={listboxId}
          ref={listRef}
          className="absolute top-[calc(100%+6px)] z-40 max-h-56 w-full overflow-y-auto rounded-[10px] border border-(--border-default) bg-(--card-bg) p-1 shadow-[0_8px_24px_-10px_rgba(0,0,0,0.28),0_2px_6px_rgba(0,0,0,0.1)]"
          role="listbox"
        >
          {!filteredOptions.length ? (
            <div className="px-3 py-2 text-[13px] text-(--text-tertiary)">Aucune option</div>
          ) : (
            filteredOptions.map((option, index) => {
              const selected = option === value
              const highlighted = index === highlightedIndex

              return (
                <button
                  key={option}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  data-option-index={index}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  onClick={() => commitValue(option)}
                  className={[
                    'flex h-9.5 w-full cursor-pointer items-center justify-between rounded-md px-3 text-left text-[13px] transition-colors',
                    selected
                      ? 'bg-(--color-primary)/10 font-semibold text-(--color-primary)'
                      : highlighted
                        ? 'bg-(--bg-hover) text-(--text-primary)'
                        : 'text-(--text-primary) hover:bg-(--bg-hover)',
                  ].join(' ')}
                >
                  <span className="truncate">{option}</span>
                  {selected ? <Check className="h-3.5 w-3.5 shrink-0" /> : null}
                </button>
              )
            })
          )}

          {!exactMatch && inputValue.trim() && (
            <button
              type="button"
              onClick={() => commitValue(inputValue.trim())}
              className="mt-1 flex h-9.5 w-full cursor-pointer items-center rounded-md border border-dashed border-(--border-default) px-3 text-left text-[13px] font-medium text-(--text-secondary) transition-colors hover:bg-(--bg-hover)"
            >
              + Ajouter "{inputValue.trim()}"
            </button>
          )}
        </div>
      )}
    </div>
  )
}
