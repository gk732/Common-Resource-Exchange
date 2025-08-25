import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Package, CheckCircle, XCircle, Loader } from 'lucide-react'
import toast from 'react-hot-toast'

export default function AuthCallback() {
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing')
  const [message, setMessage] = useState('Processing email confirmation...')
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        console.log('[AuthCallback] Processing auth callback...')
        
        // Get the current URL parameters
        const access_token = searchParams.get('access_token')
        const refresh_token = searchParams.get('refresh_token')
        const error_code = searchParams.get('error_code')
        const error_description = searchParams.get('error_description')

        // Handle error cases first
        if (error_code) {
          console.error('[AuthCallback] Auth error:', error_code, error_description)
          setStatus('error')
          setMessage(error_description || 'Authentication failed')
          setLoading(false)
          
          toast.error('Email confirmation failed. Please try signing up again.')
          
          // Redirect to registration after a delay
          setTimeout(() => {
            navigate('/register')
          }, 3000)
          return
        }

        // If we have tokens, set the session
        if (access_token && refresh_token) {
          console.log('[AuthCallback] Setting session with tokens...')
          
          const { data, error } = await supabase.auth.setSession({
            access_token,
            refresh_token
          })

          if (error) {
            console.error('[AuthCallback] Session error:', error)
            setStatus('error')
            setMessage('Failed to confirm email. Please try again.')
            setLoading(false)
            
            toast.error('Email confirmation failed. Please try signing up again.')
            
            setTimeout(() => {
              navigate('/register')
            }, 3000)
            return
          }

          if (data.user) {
            console.log('[AuthCallback] Email confirmation successful:', data.user.email)
            setStatus('success')
            setMessage(`🎉 Email confirmed successfully! Welcome to the platform, ${data.user.email}`)
            setLoading(false)
            
            toast.success('Email confirmed! You are now signed in.')
            
            // Redirect to dashboard after a short delay
            setTimeout(() => {
              navigate('/dashboard')
            }, 2000)
            return
          }
        }

        // Handle hash-based callback (alternative method)
        // For newer Supabase versions, we rely on the auth state change listener
        console.log('[AuthCallback] No tokens in URL params, checking if already authenticated...')
        
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError) {
          console.error('[AuthCallback] Session check error:', sessionError)
          setStatus('error')
          setMessage('Failed to confirm email. Please try again.')
          setLoading(false)
          
          toast.error('Email confirmation failed. Please try signing up again.')
          
          setTimeout(() => {
            navigate('/register')
          }, 3000)
          return
        }

        if (session && session.user) {
          console.log('[AuthCallback] User already authenticated:', session.user.email)
          setStatus('success')
          setMessage(`🎉 Email confirmed successfully! Welcome to the platform, ${session.user.email}`)
          setLoading(false)
          
          toast.success('Email confirmed! You are now signed in.')
          
          // Redirect to dashboard after a short delay
          setTimeout(() => {
            navigate('/dashboard')
          }, 2000)
        } else {
          console.warn('[AuthCallback] No session found, redirecting to login')
          setStatus('error')
          setMessage('No confirmation data found. Please try the confirmation link again.')
          setLoading(false)
          
          setTimeout(() => {
            navigate('/login')
          }, 3000)
        }

      } catch (error) {
        console.error('[AuthCallback] Callback processing error:', error)
        setStatus('error')
        setMessage('An unexpected error occurred during email confirmation.')
        setLoading(false)
        
        toast.error('Email confirmation failed. Please try again.')
        
        setTimeout(() => {
          navigate('/register')
        }, 3000)
      }
    }

    handleAuthCallback()
  }, [navigate, searchParams])

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-slate-50">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <Package className="h-12 w-12 text-blue-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Email Confirmation</h2>
        </div>
        
        <div className="bg-white py-8 px-6 shadow-xl rounded-2xl border border-slate-200">
          <div className="text-center">
            {status === 'processing' && (
              <div className="space-y-4">
                <Loader className="h-12 w-12 text-blue-600 mx-auto animate-spin" />
                <h3 className="text-lg font-medium text-slate-900">Processing...</h3>
                <p className="text-slate-600">{message}</p>
              </div>
            )}
            
            {status === 'success' && (
              <div className="space-y-4">
                <CheckCircle className="h-12 w-12 text-green-600 mx-auto" />
                <h3 className="text-lg font-medium text-green-800">Success!</h3>
                <p className="text-green-700">{message}</p>
                <p className="text-sm text-slate-600">Redirecting you to your dashboard...</p>
              </div>
            )}
            
            {status === 'error' && (
              <div className="space-y-4">
                <XCircle className="h-12 w-12 text-red-600 mx-auto" />
                <h3 className="text-lg font-medium text-red-800">Error</h3>
                <p className="text-red-700">{message}</p>
                <p className="text-sm text-slate-600">You will be redirected shortly...</p>
              </div>
            )}
          </div>
        </div>
        
        <div className="text-center">
          <p className="text-sm text-slate-500">
            Need help? Contact our support team.
          </p>
        </div>
      </div>
    </div>
  )
}
