import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Package, Eye, EyeOff, UserPlus, User, Mail, Lock } from 'lucide-react'
import toast from 'react-hot-toast'

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const { signUp } = useAuth()
  const navigate = useNavigate()

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name || !formData.email || !formData.password || !formData.confirmPassword) {
      toast.error('Please fill in all fields')
      return
    }

    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match')
      return
    }

    if (formData.password.length < 6) {
      toast.error('Password must be at least 6 characters long')
      return
    }

    setLoading(true)
    try {
      const { data, error } = await signUp(formData.email, formData.password, formData.name)
      
      if (error) {
        toast.error(error.message || 'Failed to create account')
      } else if (data.needsEmailConfirmation) {
        // Enhanced feedback for email confirmation requirement
        toast.success(data.confirmationMessage, {
          duration: 10000,
          style: {
            background: '#10b981',
            color: '#fff',
            maxWidth: '600px',
            fontSize: '14px'
          }
        })
        
        // Show additional helpful tips
        setTimeout(() => {
          toast('📧 Didn\'t receive the email? Check your spam/junk folder and ensure the email address is correct.', {
            duration: 8000,
            icon: '📧',
            style: {
              maxWidth: '500px'
            }
          })
        }, 2000)
        
        setTimeout(() => {
          toast('🔗 The confirmation link will redirect you back to this site to complete your registration.', {
            duration: 6000,
            icon: '🔗',
            style: {
              maxWidth: '500px'
            }
          })
        }, 4000)
        
        navigate('/login')
      } else {
        toast.success('Account created successfully! You can now sign in.')
        navigate('/login')
      }
    } catch (error) {
      toast.error('An unexpected error occurred')
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
          <h2 className="text-3xl font-bold text-slate-900 mb-2">Create your account</h2>
          <p className="text-slate-600">Join our community and start sharing resources</p>
        </div>
        
        <div className="bg-white py-8 px-6 shadow-xl rounded-2xl border border-slate-200">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-2">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-3.5 h-5 w-5 text-slate-400" />
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full pl-10 pr-3 py-3 border border-slate-300 rounded-lg shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="Enter your full name"
                />
              </div>
            </div>
            
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2">
                Email address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-3.5 h-5 w-5 text-slate-400" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full pl-10 pr-3 py-3 border border-slate-300 rounded-lg shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="Enter your email"
                />
              </div>
            </div>
            
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3.5 h-5 w-5 text-slate-400" />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full pl-10 pr-10 py-3 border border-slate-300 rounded-lg shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="Create a password"
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
            
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 mb-2">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3.5 h-5 w-5 text-slate-400" />
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="w-full pl-10 pr-10 py-3 border border-slate-300 rounded-lg shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="Confirm your password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                >
                  {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
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
                  <UserPlus className="h-5 w-5 mr-2" />
                  Create Account
                </>
              )}
            </button>
          </form>
          
          <div className="mt-6 text-center">
            <p className="text-slate-600">
              Already have an account?{' '}
              <Link to="/login" className="text-blue-600 hover:text-blue-700 font-medium">
                Sign in here
              </Link>
            </p>
          </div>
        </div>
        
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <h3 className="text-sm font-medium text-blue-800 mb-2">📧 Email Confirmation Required</h3>
          <p className="text-xs text-blue-700 mb-2">
            After creating your account, you'll receive a confirmation email. Please check your inbox and click the confirmation link to activate your account.
          </p>
          <ul className="text-xs text-blue-700 space-y-1">
            <li>• The confirmation email should arrive within a few minutes</li>
            <li>• Check your spam/junk folder if you don't see it</li>
            <li>• You'll need to confirm your email before you can sign in</li>
          </ul>
        </div>
        
        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
          <h3 className="text-sm font-medium text-green-800 mb-2">Account Benefits</h3>
          <ul className="text-xs text-green-700 space-y-1">
            <li>• Share and discover community resources</li>
            <li>• Connect with neighbors and local community</li>
            <li>• Rate and review exchanges</li>
            <li>• Real-time messaging with other users</li>
          </ul>
        </div>
      </div>
    </div>
  )
}