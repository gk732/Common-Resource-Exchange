import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Users, Package, MessageCircle, Shield, Star, TrendingUp, Sparkles, Zap, Brain, Quote, RefreshCw, Heart, User } from 'lucide-react'
import AIIndicator from '@/components/ui/AIIndicator'
import TicTacToeWidget from '@/components/features/TicTacToeWidget'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

interface QuoteData {
  text: string
  author: string
}

interface ApiResponse {
  success: boolean
  data: QuoteData
  message: string
}

export default function LandingPage() {
  const [currentQuote, setCurrentQuote] = React.useState<QuoteData | null>(null)
  const [isLoadingQuote, setIsLoadingQuote] = React.useState(false)
  const [isFavorite, setIsFavorite] = React.useState(false)

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
    setIsLoadingQuote(true)
    setIsFavorite(false)
    
    try {
      // Try Java backend first, fall back to Edge Function
      let quote = await fetchQuoteFromJava()
      
      if (!quote) {
        quote = await fetchQuoteFromEdgeFunction()
      }
      
      setCurrentQuote(quote)
      toast.success('New inspiring quote generated!')
    } catch (error) {
      console.error('Error fetching quote:', error)
      toast.error('Failed to generate quote. Please try again.')
    } finally {
      setIsLoadingQuote(false)
    }
  }

  const toggleFavorite = () => {
    if (!currentQuote) return
    setIsFavorite(!isFavorite)
    toast.success(isFavorite ? 'Removed from favorites' : 'Added to favorites')
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
        toast.success('Quote copied to clipboard!')
      } catch (error) {
        toast.error('Failed to copy quote')
      }
    }
  }

  React.useEffect(() => {
    // Load initial quote
    getRandomQuote()
  }, [])
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Floating Tic-Tac-Toe Widget */}
      <TicTacToeWidget />
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-2">
              <Package className="h-8 w-8 text-blue-600" />
              <span className="text-2xl font-bold text-slate-900">Common Resource Exchange</span>
            </div>
            <div className="flex items-center space-x-4">
              <Link
                to="/login"
                className="text-slate-600 hover:text-slate-900 px-4 py-2 rounded-lg transition-colors"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-20 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="text-center lg:text-left">
              <h1 className="text-5xl md:text-6xl font-bold text-slate-900 mb-6">
                Share Resources,
                <br />
                <span className="text-blue-600">Build Community</span>
              </h1>
              <div className="flex items-center justify-center lg:justify-start mb-4">
                <AIIndicator size="md" text="Now with AI-Powered Features" className="bg-purple-50 px-3 py-1 rounded-full border border-purple-200" />
              </div>
              <p className="text-xl text-slate-600 mb-8 max-w-3xl">
                Connect with your community to share, borrow, and exchange resources. From books and tools to skills and services, make the most of what we have together.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Link
                  to="/register"
                  className="bg-blue-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-blue-700 transition-colors shadow-lg inline-flex items-center justify-center"
                >
                  Start Sharing
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
                <Link
                  to="/login"
                  className="border-2 border-slate-300 text-slate-700 px-8 py-4 rounded-lg text-lg font-semibold hover:border-slate-400 hover:bg-white transition-colors inline-flex items-center justify-center"
                >
                  Sign In
                </Link>
              </div>
            </div>
            <div className="hidden lg:block">
              <div className="relative">
                <img
                  src="/images/little_free_library_community_book_exchange.jpg"
                  alt="Community book sharing through Little Free Library"
                  className="rounded-2xl shadow-2xl w-full h-96 object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-blue-900/20 to-transparent rounded-2xl"></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-slate-900 mb-4">How It Works</h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              Simple, secure, and community-focused resource sharing
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center p-8 rounded-2xl bg-gradient-to-br from-blue-50 to-slate-50 border border-slate-200">
              <div className="relative mb-6">
                <img
                  src="/images/colorful-little-free-library-community-book-sharing.jpg"
                  alt="Colorful Little Free Library for book sharing"
                  className="w-full h-32 object-cover rounded-xl mb-4"
                />
                <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto -mt-8 relative z-10">
                  <Package className="h-8 w-8 text-blue-600" />
                </div>
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-4">List Resources</h3>
              <p className="text-slate-600">
                Share what you have - books, tools, equipment, or services. Set your own terms and availability.
              </p>
            </div>
            
            <div className="text-center p-8 rounded-2xl bg-gradient-to-br from-green-50 to-slate-50 border border-slate-200">
              <div className="relative mb-6">
                <img
                  src="/images/community_book_sharing_library_kids.jpg"
                  alt="People sharing books at community library"
                  className="w-full h-32 object-cover rounded-xl mb-4"
                />
                <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto -mt-8 relative z-10">
                  <Users className="h-8 w-8 text-green-600" />
                </div>
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-4">Connect & Request</h3>
              <p className="text-slate-600">
                Browse available resources and send requests. Connect directly with owners to coordinate exchanges.
              </p>
            </div>
            
            <div className="text-center p-8 rounded-2xl bg-gradient-to-br from-purple-50 to-slate-50 border border-slate-200">
              <div className="relative mb-6">
                <img
                  src="/images/tool_sharing_workshop_community_illustration.jpg"
                  alt="Tool sharing workshop community illustration"
                  className="w-full h-32 object-cover rounded-xl mb-4"
                />
                <div className="bg-purple-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto -mt-8 relative z-10">
                  <Star className="h-8 w-8 text-purple-600" />
                </div>
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-4">Rate & Review</h3>
              <p className="text-slate-600">
                Build trust through ratings and reviews. Help create a positive community experience for everyone.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-4xl font-bold text-slate-900 mb-6">Why Choose Our Platform?</h2>
              <div className="space-y-6">
                <div className="flex items-start space-x-4">
                  <div className="bg-blue-100 w-10 h-10 rounded-lg flex items-center justify-center mt-1">
                    <Shield className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">Secure & Trusted</h3>
                    <p className="text-slate-600">Role-based access control and verified user profiles ensure safe exchanges.</p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-4">
                  <div className="bg-green-100 w-10 h-10 rounded-lg flex items-center justify-center mt-1">
                    <MessageCircle className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">Real-time Communication</h3>
                    <p className="text-slate-600">Instant messaging and notifications keep you connected throughout the exchange process.</p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-4">
                  <div className="bg-purple-100 w-10 h-10 rounded-lg flex items-center justify-center mt-1">
                    <TrendingUp className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">Community Driven</h3>
                    <p className="text-slate-600">Built for communities, by communities. Promote sustainability and resource sharing.</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-200">
              <h3 className="text-2xl font-bold text-slate-900 mb-6 text-center">Platform Stats</h3>
              <div className="grid grid-cols-2 gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600 mb-2">500+</div>
                  <div className="text-slate-600">Active Users</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600 mb-2">1,200+</div>
                  <div className="text-slate-600">Resources Shared</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-purple-600 mb-2">800+</div>
                  <div className="text-slate-600">Successful Exchanges</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-orange-600 mb-2">4.8/5</div>
                  <div className="text-slate-600">Average Rating</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Visual Showcase Section */}
      <section className="py-20 bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-slate-900 mb-4">Bringing Resources to Life</h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              Showcase your resources with beautiful images and connect with community members who share your values
            </p>
          </div>
          
          <div className="grid lg:grid-cols-2 gap-12 items-center mb-16">
            <div>
              <h3 className="text-3xl font-bold text-slate-900 mb-6">Make Your Resources Stand Out</h3>
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="bg-blue-100 w-6 h-6 rounded-full flex items-center justify-center mt-1">
                    <span className="text-blue-600 text-sm font-bold">✓</span>
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900">High-Quality Image Uploads</h4>
                    <p className="text-slate-600">Upload up to 5 images per resource to show every detail</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="bg-green-100 w-6 h-6 rounded-full flex items-center justify-center mt-1">
                    <span className="text-green-600 text-sm font-bold">✓</span>
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900">Visual Discovery</h4>
                    <p className="text-slate-600">Browse resources with beautiful image galleries</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="bg-purple-100 w-6 h-6 rounded-full flex items-center justify-center mt-1">
                    <span className="text-purple-600 text-sm font-bold">✓</span>
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900">Secure Storage</h4>
                    <p className="text-slate-600">Your images are safely stored and optimized for fast loading</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-4">
                <img
                  src="/images/professional-man-workshop-tools-pegboard.jpg"
                  alt="Professional workshop with organized tools"
                  className="rounded-xl shadow-lg w-full h-32 object-cover"
                />
                <img
                  src="/images/red_little_free_library_books_community.jpg"
                  alt="Community book sharing library"
                  className="rounded-xl shadow-lg w-full h-40 object-cover"
                />
              </div>
              <div className="space-y-4 mt-8">
                <img
                  src="/images/community_tool_sharing_event_west_seattle.jpg"
                  alt="Community tool sharing event"
                  className="rounded-xl shadow-lg w-full h-40 object-cover"
                />
                <img
                  src="/images/little_free_library_community_book_sharing_fall.jpg"
                  alt="Fall season book sharing library"
                  className="rounded-xl shadow-lg w-full h-32 object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* AI Features Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="flex items-center justify-center mb-4">
              <AIIndicator size="lg" text="AI-Powered Features" />
            </div>
            <h2 className="text-4xl font-bold text-slate-900 mb-4">Smart Technology, Simplified</h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              Experience the future of resource sharing with intelligent features that make listing and finding resources effortless
            </p>
          </div>
          
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="text-center p-8 rounded-2xl bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-200">
              <div className="bg-purple-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                <Brain className="h-8 w-8 text-purple-600" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-4">Auto-Description</h3>
              <p className="text-slate-600 mb-4">
                Upload an image and let AI generate detailed, helpful descriptions for your resources automatically.
              </p>
              <div className="inline-flex items-center text-sm text-purple-600 font-medium">
                <Sparkles className="h-4 w-4 mr-1" />
                AI-Powered
              </div>
            </div>
            
            <div className="text-center p-8 rounded-2xl bg-gradient-to-br from-blue-50 to-green-50 border border-blue-200">
              <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                <Package className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-4">Smart Categories</h3>
              <p className="text-slate-600 mb-4">
                AI analyzes your resource details and suggests the perfect category, making organization effortless.
              </p>
              <div className="inline-flex items-center text-sm text-blue-600 font-medium">
                <Zap className="h-4 w-4 mr-1" />
                Intelligent Sorting
              </div>
            </div>
            
            <div className="text-center p-8 rounded-2xl bg-gradient-to-br from-green-50 to-purple-50 border border-green-200">
              <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                <Sparkles className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-4">Enhanced Search</h3>
              <p className="text-slate-600 mb-4">
                Get intelligent search suggestions and find exactly what you need with AI-powered discovery.
              </p>
              <div className="inline-flex items-center text-sm text-green-600 font-medium">
                <Brain className="h-4 w-4 mr-1" />
                Smart Discovery
              </div>
            </div>
          </div>
          
          <div className="text-center mt-12">
            <Link
              to="/register"
              className="inline-flex items-center bg-purple-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-purple-700 transition-colors shadow-lg"
            >
              <Sparkles className="mr-2 h-5 w-5" />
              Try AI Features Now
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-blue-600">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-white mb-6">
            Ready to Start Sharing?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Join our community today and discover the power of collaborative resource sharing.
          </p>
          <Link
            to="/register"
            className="bg-white text-blue-600 px-8 py-4 rounded-lg text-lg font-semibold hover:bg-blue-50 transition-colors shadow-lg inline-flex items-center"
          >
            Create Account
            <ArrowRight className="ml-2 h-5 w-5" />
          </Link>
        </div>
      </section>

      {/* Quote Generator Section */}
      <section className="py-20 bg-gradient-to-br from-purple-50 to-blue-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="flex items-center justify-center mb-4">
              <div className="bg-purple-100 p-3 rounded-full mr-3">
                <Quote className="h-8 w-8 text-purple-600" />
              </div>
              <h2 className="text-4xl font-bold text-slate-900">Daily Inspiration</h2>
            </div>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              Get inspired with quotes about community, collaboration, and sharing that align with our platform's values.
            </p>
          </div>

          {/* Quote Card */}
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8 mb-6">
            {isLoadingQuote ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mb-4"></div>
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
                
                {/* Action Buttons */}
                <div className="flex items-center justify-center space-x-4 flex-wrap">
                  <button
                    onClick={toggleFavorite}
                    className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
                      isFavorite 
                        ? 'bg-red-100 text-red-600 hover:bg-red-200' 
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <Heart className={`h-4 w-4 mr-2 ${isFavorite ? 'fill-current' : ''}`} />
                    {isFavorite ? 'Favorited' : 'Add to Favorites'}
                  </button>
                  
                  <button
                    onClick={shareQuote}
                    className="flex items-center px-4 py-2 bg-blue-100 text-blue-600 hover:bg-blue-200 rounded-lg transition-colors"
                  >
                    <Quote className="h-4 w-4 mr-2" />
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
              disabled={isLoadingQuote}
              className="bg-purple-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg inline-flex items-center"
            >
              <RefreshCw className={`h-5 w-5 mr-2 ${isLoadingQuote ? 'animate-spin' : ''}`} />
              {isLoadingQuote ? 'Generating...' : 'Generate New Quote'}
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-2 mb-4 md:mb-0">
              <Package className="h-6 w-6" />
              <span className="text-lg font-semibold">Common Resource Exchange</span>
            </div>
            <div className="text-slate-400">
              <p>&copy; 2025 Common Resource Exchange. Built by Salvador V S.</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}