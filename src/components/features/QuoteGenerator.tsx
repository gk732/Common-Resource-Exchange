import React, { useState } from 'react'
import { Quote, RefreshCw, Sparkles, User } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface QuoteData {
  text: string
  author: string
}

interface ApiResponse {
  success: boolean
  data: QuoteData
  message: string
}

export default function QuoteGenerator() {
  const [currentQuote, setCurrentQuote] = useState<QuoteData | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const fetchQuoteFromJava = async (): Promise<QuoteData | null> => {
    try {
      // Try Java backend first (when available)
      const response = await fetch('http://localhost:8080/api/quotes/random', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      
      if (response.ok) {
        const data: ApiResponse = await response.json()
        if (data.success) {
          return data.data
        }
      }
    } catch (error) {
      console.log('Java backend not available, falling back to Edge Function')
    }
    return null
  }

  const fetchQuoteFromEdgeFunction = async (): Promise<QuoteData> => {
    const { data, error } = await supabase.functions.invoke('quote-generator', {
      body: { action: 'random' }
    })

    if (error) {
      throw new Error('Failed to fetch quote from Edge Function')
    }

    if (data?.success && data?.data) {
      return data.data
    }
    
    throw new Error('Invalid response from Edge Function')
  }

  const getRandomQuote = async () => {
    setIsLoading(true)
    
    try {
      // Try Java backend first, fall back to Edge Function
      let quote = await fetchQuoteFromJava()
      
      if (!quote) {
        quote = await fetchQuoteFromEdgeFunction()
      }
      
      setCurrentQuote(quote)
    } catch (error) {
      console.error('Error fetching quote:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const shareQuote = async () => {
    if (!currentQuote) return
    
    const shareText = `"${currentQuote.text}" - ${currentQuote.author}`
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Inspiring Quote',
          text: shareText,
        })
      } catch (error) {
        // User cancelled sharing or sharing not supported
      }
    } else {
      // Fallback to clipboard
      try {
        await navigator.clipboard.writeText(shareText)
      } catch (error) {
        console.error('Failed to copy quote')
      }
    }
  }

  React.useEffect(() => {
    // Load initial quote
    getRandomQuote()
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="bg-purple-100 p-3 rounded-full mr-3">
              <Quote className="h-8 w-8 text-purple-600" />
            </div>
            <h1 className="text-4xl font-bold text-slate-900">Quote Generator</h1>
          </div>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            Discover inspiring quotes about community, collaboration, and sharing that align with our platform's values.
          </p>
          <div className="flex items-center justify-center mt-4">
            <div className="bg-blue-50 px-4 py-2 rounded-full border border-blue-200">
              <div className="flex items-center text-sm text-blue-600">
                <Sparkles className="h-4 w-4 mr-2" />
                <span className="font-medium">Powered by Java + Edge Functions</span>
              </div>
            </div>
          </div>
        </div>

        {/* Quote Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8 mb-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
              <p className="text-slate-600 text-lg">Generating inspiring quote...</p>
            </div>
          ) : currentQuote ? (
            <div className="text-center">
              <blockquote className="text-2xl md:text-3xl font-medium text-slate-800 leading-relaxed mb-8">
                "{currentQuote.text}"
              </blockquote>
              <div className="flex items-center justify-center mb-6">
                <div className="bg-slate-100 p-2 rounded-full mr-3">
                  <User className="h-5 w-5 text-slate-600" />
                </div>
                <cite className="text-xl text-slate-600 font-semibold">
                  — {currentQuote.author}
                </cite>
              </div>
              
              {/* Action Button */}
              <div className="flex items-center justify-center">
                <button
                  onClick={shareQuote}
                  className="flex items-center px-6 py-3 bg-blue-100 text-blue-600 hover:bg-blue-200 rounded-lg transition-colors"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Share Quote
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-16">
              <Quote className="h-16 w-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 text-lg">Click the button below to generate your first inspiring quote!</p>
            </div>
          )}
        </div>

        {/* Generate Button */}
        <div className="text-center">
          <button
            onClick={getRandomQuote}
            disabled={isLoading}
            className="bg-blue-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg inline-flex items-center"
          >
            <RefreshCw className={`h-5 w-5 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            {isLoading ? 'Generating...' : 'Generate New Quote'}
          </button>
        </div>

        {/* Feature Info */}
        <div className="mt-12 bg-gradient-to-br from-purple-50 to-blue-50 rounded-2xl p-6 border border-purple-200">
          <div className="text-center">
            <h3 className="text-xl font-bold text-slate-900 mb-3">How It Works</h3>
            <div className="grid md:grid-cols-2 gap-6 text-left">
              <div className="flex items-start">
                <div className="bg-blue-100 w-8 h-8 rounded-lg flex items-center justify-center mr-3 mt-1">
                  <span className="text-blue-600 font-bold text-sm">1</span>
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900 mb-1">Java Backend Primary</h4>
                  <p className="text-slate-600 text-sm">Attempts to fetch quotes from the Java Spring Boot backend with authentic Java logic.</p>
                </div>
              </div>
              
              <div className="flex items-start">
                <div className="bg-purple-100 w-8 h-8 rounded-lg flex items-center justify-center mr-3 mt-1">
                  <span className="text-purple-600 font-bold text-sm">2</span>
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900 mb-1">Edge Function Fallback</h4>
                  <p className="text-slate-600 text-sm">Falls back to Supabase Edge Functions with identical logic for universal access.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}