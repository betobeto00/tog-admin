// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import Tutorial, { hasTutorialCompleted, resetTutorial } from './Tutorial'

// Mock useTranslation
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

beforeEach(() => {
  localStorage.clear()
})

describe('Tutorial helper functions', () => {
  it('hasTutorialCompleted returns false initially', () => {
    expect(hasTutorialCompleted()).toBe(false)
  })

  it('hasTutorialCompleted returns true after marking', () => {
    localStorage.setItem('tog_tutorial_completed', 'true')
    expect(hasTutorialCompleted()).toBe(true)
  })

  it('resetTutorial clears completion flag', () => {
    localStorage.setItem('tog_tutorial_completed', 'true')
    resetTutorial()
    expect(hasTutorialCompleted()).toBe(false)
  })
})

describe('Tutorial component', () => {
  const mockComplete = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders step 1 title', () => {
    render(<Tutorial onComplete={mockComplete} />)
    expect(screen.getByText('tutorial.step1')).toBeInTheDocument()
  })

  it('navigates to next step', () => {
    render(<Tutorial onComplete={mockComplete} />)
    fireEvent.click(screen.getByText('tutorial.next'))
    expect(screen.getByText('tutorial.step2')).toBeInTheDocument()
  })

  it('navigates to previous step', () => {
    render(<Tutorial onComplete={mockComplete} />)
    fireEvent.click(screen.getByText('tutorial.next'))
    fireEvent.click(screen.getByText('tutorial.previous'))
    expect(screen.getByText('tutorial.step1')).toBeInTheDocument()
  })

  it('shows finish button on last step', () => {
    render(<Tutorial onComplete={mockComplete} />)
    for (let i = 0; i < 4; i++) {
      fireEvent.click(screen.getByText('tutorial.next'))
    }
    expect(screen.getByText('tutorial.finish')).toBeInTheDocument()
  })

  it('calls onComplete when finish is clicked', () => {
    render(<Tutorial onComplete={mockComplete} />)
    for (let i = 0; i < 4; i++) {
      fireEvent.click(screen.getByText('tutorial.next'))
    }
    fireEvent.click(screen.getByText('tutorial.finish'))
    expect(mockComplete).toHaveBeenCalled()
  })

  it('marks tutorial as completed in localStorage', () => {
    render(<Tutorial onComplete={mockComplete} />)
    for (let i = 0; i < 4; i++) {
      fireEvent.click(screen.getByText('tutorial.next'))
    }
    fireEvent.click(screen.getByText('tutorial.finish'))
    expect(localStorage.getItem('tog_tutorial_completed')).toBe('true')
  })
})
