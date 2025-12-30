"use client"

import React, { useEffect, useRef, useCallback, useState } from 'react'
import { FileText, HelpCircle, X } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Props for the SelectionContextMenu component
 * 
 * **Feature: hybrid-question-selection**
 * **Requirements: 3.2**
 */
export interface SelectionContextMenuProps {
  /** Position to display the menu (screen coordinates) */
  position: { x: number; y: number }
  /** Callback when user selects "Tag as Section" */
  onTagAsSection: () => void
  /** Callback when user selects "Tag as Question" */
  onTagAsQuestion: () => void
  /** Callback to close the menu */
  onClose: () => void
  /** Whether the menu is visible */
  isOpen?: boolean
}

/**
 * SelectionContextMenu Component
 * 
 * A popup context menu that appears when the user selects text in the PDF viewer.
 * Provides options to tag the selected text as either a Section or Question.
 * 
 * Features:
 * - Positioned near the text selection
 * - Closes when clicking outside
 * - Closes on Escape key press
 * - Accessible with keyboard navigation (Arrow keys, Enter, Tab)
 * 
 * **Feature: hybrid-question-selection**
 * **Requirements: 3.2 - WHEN text is selected THEN the Question_Selection_System 
 * SHALL display a context menu with options to tag as Section or Question**
 */
export function SelectionContextMenu({
  position,
  onTagAsSection,
  onTagAsQuestion,
  onClose,
  isOpen = true,
}: SelectionContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [focusedIndex, setFocusedIndex] = useState(0)
  const menuItems = useRef<HTMLButtonElement[]>([])

  // Reset focused index when menu opens
  useEffect(() => {
    if (isOpen) {
      setFocusedIndex(0)
    }
  }, [isOpen])

  /**
   * Handle click outside to close the menu
   */
  const handleClickOutside = useCallback((event: MouseEvent) => {
    if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
      onClose()
    }
  }, [onClose])


  /**
   * Handle keyboard navigation
   * - Escape: Close menu
   * - ArrowDown/ArrowUp: Navigate between items
   * - Enter/Space: Select focused item
   * - Tab: Navigate and wrap around
   * 
   * **Feature: hybrid-question-selection**
   * **Requirements: 3.2 - Keyboard shortcuts for context menu**
   */
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    switch (event.key) {
      case 'Escape':
        event.preventDefault()
        onClose()
        break
      case 'ArrowDown':
        event.preventDefault()
        setFocusedIndex(prev => (prev + 1) % 2)
        break
      case 'ArrowUp':
        event.preventDefault()
        setFocusedIndex(prev => (prev - 1 + 2) % 2)
        break
      case 'Enter':
      case ' ':
        event.preventDefault()
        if (focusedIndex === 0) {
          onTagAsSection()
          onClose()
        } else {
          onTagAsQuestion()
          onClose()
        }
        break
      case 'Tab':
        event.preventDefault()
        if (event.shiftKey) {
          setFocusedIndex(prev => (prev - 1 + 2) % 2)
        } else {
          setFocusedIndex(prev => (prev + 1) % 2)
        }
        break
      case 's':
      case 'S':
        // Shortcut: 's' for Section
        event.preventDefault()
        onTagAsSection()
        onClose()
        break
      case 'q':
      case 'Q':
        // Shortcut: 'q' for Question
        event.preventDefault()
        onTagAsQuestion()
        onClose()
        break
    }
  }, [onClose, onTagAsSection, onTagAsQuestion, focusedIndex])

  /**
   * Set up event listeners for click outside and keyboard events
   */
  useEffect(() => {
    if (isOpen) {
      // Add listeners with a small delay to prevent immediate close
      // from the same click that opened the menu
      const timeoutId = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside)
        document.addEventListener('keydown', handleKeyDown)
      }, 0)

      return () => {
        clearTimeout(timeoutId)
        document.removeEventListener('mousedown', handleClickOutside)
        document.removeEventListener('keydown', handleKeyDown)
      }
    }
  }, [isOpen, handleClickOutside, handleKeyDown])

  /**
   * Focus the menu when it opens for accessibility
   */
  useEffect(() => {
    if (isOpen && menuRef.current) {
      menuRef.current.focus()
    }
  }, [isOpen])

  // Focus the appropriate menu item when focusedIndex changes
  useEffect(() => {
    if (isOpen && menuItems.current[focusedIndex]) {
      menuItems.current[focusedIndex].focus()
    }
  }, [isOpen, focusedIndex])

  /**
   * Handle tag as section click
   */
  const handleTagAsSection = useCallback(() => {
    onTagAsSection()
    onClose()
  }, [onTagAsSection, onClose])

  /**
   * Handle tag as question click
   */
  const handleTagAsQuestion = useCallback(() => {
    onTagAsQuestion()
    onClose()
  }, [onTagAsQuestion, onClose])

  /**
   * Register menu item ref
   */
  const setMenuItemRef = useCallback((index: number) => (el: HTMLButtonElement | null) => {
    if (el) {
      menuItems.current[index] = el
    }
  }, [])

  if (!isOpen) {
    return null
  }

  // Calculate position to keep menu within viewport
  const adjustedPosition = getAdjustedPosition(position)

  return (
    <div
      ref={menuRef}
      role="menu"
      tabIndex={-1}
      className={cn(
        "fixed z-50 min-w-[160px] overflow-hidden rounded-md border",
        "bg-popover text-popover-foreground shadow-md",
        "animate-in fade-in-0 zoom-in-95",
        "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
      )}
      style={{
        left: adjustedPosition.x,
        top: adjustedPosition.y,
      }}
      aria-label="Tag selection menu"
    >
      {/* Menu Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
        <span className="text-xs font-medium text-muted-foreground">
          Tag Selection As
        </span>
        <button
          onClick={onClose}
          className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          aria-label="Close menu (Escape)"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      {/* Menu Items */}
      <div className="p-1">
        <MenuItem
          ref={setMenuItemRef(0)}
          icon={<FileText className="h-4 w-4 text-blue-500" />}
          label="Section"
          description="Mark as section header"
          shortcut="S"
          onClick={handleTagAsSection}
          colorClass="hover:bg-blue-50 dark:hover:bg-blue-950/30"
          isFocused={focusedIndex === 0}
        />
        <MenuItem
          ref={setMenuItemRef(1)}
          icon={<HelpCircle className="h-4 w-4 text-yellow-500" />}
          label="Question"
          description="Mark as question"
          shortcut="Q"
          onClick={handleTagAsQuestion}
          colorClass="hover:bg-yellow-50 dark:hover:bg-yellow-950/30"
          isFocused={focusedIndex === 1}
        />
      </div>
      
      {/* Keyboard hints */}
      <div className="px-3 py-1.5 border-t bg-muted/20">
        <p className="text-[10px] text-muted-foreground text-center">
          ↑↓ Navigate • Enter Select • Esc Close
        </p>
      </div>
    </div>
  )
}

/**
 * Props for MenuItem component
 */
interface MenuItemProps {
  icon: React.ReactNode
  label: string
  description: string
  shortcut?: string
  onClick: () => void
  colorClass?: string
  isFocused?: boolean
}

/**
 * Individual menu item component with keyboard shortcut display
 */
const MenuItem = React.forwardRef<HTMLButtonElement, MenuItemProps>(
  function MenuItem({ icon, label, description, shortcut, onClick, colorClass, isFocused }, ref) {
    return (
      <button
        ref={ref}
        role="menuitem"
        onClick={onClick}
        className={cn(
          "flex w-full items-center gap-3 rounded-sm px-2 py-2 text-left",
          "outline-none transition-colors",
          "focus:bg-accent focus:text-accent-foreground",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          isFocused && "bg-accent/50",
          colorClass
        )}
      >
        <div className="flex-shrink-0">{icon}</div>
        <div className="flex flex-col flex-1">
          <span className="text-sm font-medium">{label}</span>
          <span className="text-xs text-muted-foreground">{description}</span>
        </div>
        {shortcut && (
          <kbd className="ml-auto text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
            {shortcut}
          </kbd>
        )}
      </button>
    )
  }
)

/**
 * Calculate adjusted position to keep menu within viewport
 */
function getAdjustedPosition(position: { x: number; y: number }): { x: number; y: number } {
  const menuWidth = 180 // Approximate menu width
  const menuHeight = 120 // Approximate menu height
  const padding = 8 // Padding from viewport edges

  let { x, y } = position

  // Check if menu would overflow right edge
  if (typeof window !== 'undefined') {
    if (x + menuWidth > window.innerWidth - padding) {
      x = window.innerWidth - menuWidth - padding
    }

    // Check if menu would overflow bottom edge
    if (y + menuHeight > window.innerHeight - padding) {
      y = y - menuHeight - padding
    }

    // Ensure menu doesn't go off left edge
    if (x < padding) {
      x = padding
    }

    // Ensure menu doesn't go off top edge
    if (y < padding) {
      y = padding
    }
  }

  return { x, y }
}

export default SelectionContextMenu
