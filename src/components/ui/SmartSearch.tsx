import React, { useState, useEffect } from 'react'
import { Search, X } from 'lucide-react'
import { useAI } from '@/hooks/useAI'
import AIIndicator from './AIIndicator'

interface SmartSearchProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export default function SmartSearch({ 
  value, 
  onChange, 
  placeholder = 'Search...',
  className = '' 
}: SmartSearchProps) {
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const { enhanceSearch, isEnhancingSearch } = useAI()

  const handleSearchChange = (newValue: string) => {
    onChange(newValue)
    
    // Clear suggestions if search is empty
    if (!newValue.trim()) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }

    // Auto-generate suggestions for longer queries
    if (newValue.length >= 3) {
      generateSuggestions(newValue)
    }
  }

  const generateSuggestions = async (searchText: string) => {
    try {
      const aiSuggestions = await enhanceSearch(searchText)
      setSuggestions(aiSuggestions || [])
      setShowSuggestions(true)
    } catch (error) {
      // Fail silently for search enhancement
      console.error('Search enhancement failed:', error)
    }
  }

  const handleSuggestionClick = (suggestion: string) => {
    onChange(suggestion)
    setShowSuggestions(false)
  }

  const clearSearch = () => {
    onChange('')
    setSuggestions([])
    setShowSuggestions(false)
  }

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <Search className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
        <input
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => handleSearchChange(e.target.value)}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          className="w-full pl-10 pr-10 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        {value && (
          <button
            onClick={clearSearch}
            className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        )}
        {isEnhancingSearch && (
          <div className="absolute right-10 top-3">
            <AIIndicator isActive={true} size="sm" />
          </div>
        )}
      </div>

      {/* AI Suggestions Dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-lg mt-1 z-10">
          <div className="p-2 border-b border-slate-100 bg-purple-50">
            <div className="flex items-center space-x-2">
              <AIIndicator size="sm" />
              <span className="text-xs font-medium text-purple-700">AI Suggestions</span>
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => handleSuggestionClick(suggestion)}
                className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}