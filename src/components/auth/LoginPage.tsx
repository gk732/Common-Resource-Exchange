import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Package, Eye, EyeOff, LogIn } from 'lucide-react'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const { signIn } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email || !password) {
      toast.error('Please fill in all fields')
      return
    }

    setLoading(true)
    try {
      const { data, error } = await signIn(email, password)
      
      if (error) {
        if (error.message.includes('Email not confirmed')) {
          // Clear, explicit error message for unconfirmed email
          toast.error(
            `⚠️ Email verification required!\n\nPlease check your inbox for ${email} and click the confirmation link before signing in.`,
            {
              duration: 10000,
              style: {
                background: '#f59e0b',
                color: '#fff',
                maxWidth: '450px',
                whiteSpace: 'pre-line'
              }
            }
          )
          
          // Show additional helpful tip
          setTimeout(() => {
            toast('💡 Pro Tip: Don\'t forget to check your spam/junk folder!', {
              duration: 8000,
              icon: '💡',
              style: {
                background: '#8b5cf6',
                color: '#fff'
              }
            })
          }, 3000)
        } else if (error.message.includes('Invalid login credentials')) {
          toast.error(
            'Invalid email or password. Please check your credentials and try again.',
            {
              duration: 6000,
              style: {
                background: '#ef4444',
                color: '#fff'
              }
            }
          )
        } else {
          toast.error(error.message || 'Failed to sign in')
        }
      } else {
        toast.success('Welcome back!', {
          duration: 4000,
          style: {
            background: '#10b981',
            color: '#fff'
          }
        })
        navigate('/dashboard')
      }
    } catch (error) {
      toast.error('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <Link to="/" className="inline-flex items-center space-x-2 mb-6">
            <Package className="h-8 w-8 text-blue-600" />
            <span className="text-2xl font-bold text-slate-900">Common Resource Exchange</span>
          </Link>
          <h2 className="text-3xl font-bold text-slate-900 mb-2">Welcome back</h2>
          <p className="text-slate-600">Sign in to your account to continue</p>
        </div>
        
        <div className="bg-white py-8 px-6 shadow-xl rounded-2xl border border-slate-200">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2">
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-3 border border-slate-300 rounded-lg shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                placeholder="Enter your email"
              />
            </div>
            
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-3 pr-10 border border-slate-300 rounded-lg shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                <>
                  <LogIn className="h-5 w-5 mr-2" />
                  Sign In
                </>
              )}
            </button>
          </form>
          
          <div className="mt-6 text-center">
            <p className="text-slate-600">
              Don't have an account?{' '}
              <Link to="/register" className="text-blue-600 hover:text-blue-700 font-medium">
                Sign up here
              </Link>
            </p>
          </div>
        </div>
        
        {/* Demo Accounts */}
        <div className="bg-slate-100 p-4 rounded-lg border border-slate-200">
          <h3 className="text-sm font-medium text-slate-700 mb-2">Demo Accounts</h3>
          <div className="text-xs text-slate-600 space-y-1">
            <p><strong>Super Admin (Salvador V S):</strong> childetartaglia732@gmail.com</p>
            <p><strong>Regular User:</strong> Use the registration form to create an account</p>
          </div>
        </div>
      </div>
    </div>
  )
}