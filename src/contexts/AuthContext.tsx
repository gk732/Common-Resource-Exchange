import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase, User } from '@/lib/supabase'
import { Session } from '@supabase/supabase-js'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<any>
  signUp: (email: string, password: string, name: string) => Promise<any>
  signOut: () => Promise<void>
  updateProfile: (updates: Partial<User>) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    // Get initial session
    const getInitialSession = async () => {
      try {
        console.log('[Auth] Getting initial session...')
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('[Auth] Error getting initial session:', error)
          if (mounted) {
            setSession(null)
            setUser(null)
            setLoading(false)
          }
          return
        }
        
        console.log('[Auth] Initial session loaded:', !!session)
        
        if (mounted) {
          setSession(session)
          
          if (session?.user) {
            console.log('[Auth] Fetching user profile for:', session.user.id)
            const userData = await getUserData(session.user.id)
            if (mounted) {
              setUser(userData)
            }
          } else {
            setUser(null)
          }
          
          setLoading(false)
        }
      } catch (error) {
        console.error('[Auth] Error in getInitialSession:', error)
        if (mounted) {
          setSession(null)
          setUser(null)
          setLoading(false)
        }
      }
    }

    getInitialSession()

    // Listen for auth state changes - CRITICAL FIX: No async operations in callback
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('[Auth] Auth state change:', event, 'Session:', !!session)
        
        if (!mounted) return
        
        setSession(session)
        
        // CRITICAL FIX: Handle user data loading separately, not in callback
        if (session?.user && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
          console.log('[Auth] User signed in, will fetch profile:', session.user.id)
          // Set user immediately with basic auth user data
          setUser({
            id: session.user.id,
            email: session.user.email || '',
            name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || '',
            role: 'REQUESTER' as const,
            created_at: session.user.created_at || new Date().toISOString(),
            updated_at: session.user.updated_at || new Date().toISOString()
          })
          
          // Fetch full user data separately
          setTimeout(async () => {
            try {
              const userData = await getUserData(session.user.id)
              if (mounted && userData) {
                setUser(userData)
              }
            } catch (error) {
              console.error('[Auth] Error fetching user data after sign in:', error)
              // Keep basic user data if full fetch fails
            }
          }, 0)
        } else if (event === 'SIGNED_OUT') {
          console.log('[Auth] User signed out')
          setUser(null)
        }
        
        // Stop loading after any auth state change
        setLoading(false)
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const getUserData = async (userId: string): Promise<User | null> => {
    try {
      console.log('[Auth] Fetching user data for ID:', userId)
      
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle()
      
      if (error) {
        console.error('[Auth] Error fetching user data:', error)
        
        // If user doesn't exist in users table, return null to handle gracefully
        if (error.code === 'PGRST116') {
          console.log('[Auth] User not found in users table:', userId)
          return null
        }
        throw error
      }
      
      console.log('[Auth] User data fetched successfully:', !!data)
      return data
    } catch (error) {
      console.error('[Auth] Error fetching user data:', error)
      return null
    }
  }

  const signIn = async (email: string, password: string) => {
    console.log('[Auth] Signing in user:', email)
    setLoading(true)
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })
      
      if (error) {
        console.error('[Auth] Sign in error:', error)
        setLoading(false)
        return { data, error }
      }
      
      console.log('[Auth] Sign in successful:', !!data.user)
      
      // Log the signin activity (non-blocking)
      if (data.session) {
        try {
          console.log('[Auth] Logging signin activity...')
          await supabase.functions.invoke('activity-logger', {
            body: {
              action: 'log_signin',
              details: {
                method: 'email',
                timestamp: new Date().toISOString()
              }
            },
            headers: {
              'Authorization': `Bearer ${data.session.access_token}`
            }
          })
          console.log('[Auth] Signin activity logged successfully')
        } catch (logError) {
          // Don't block signin if logging fails
          console.warn('[Auth] Failed to log signin activity:', logError)
        }
      }
      
      // The auth state change listener will handle setting user data
      // Don't set loading to false here - let the listener handle it
      return { data, error: null }
    } catch (error) {
      console.error('[Auth] Sign in exception:', error)
      setLoading(false)
      return { data: null, error }
    }
  }

  const signUp = async (email: string, password: string, name: string) => {
    console.log('[Auth] Signing up user:', email, 'name:', name)
    setLoading(true)
    
    try {
      // Get the current domain for email confirmation redirect
      const currentDomain = window.location.origin
      console.log('[Auth] Using redirect URL:', `${currentDomain}/auth/callback`)
      
      // Sign up with Supabase Auth with proper email confirmation settings
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
            name: name
          },
          emailRedirectTo: `${currentDomain}/auth/callback`
        }
      })

      if (error) {
        console.error('[Auth] Sign up auth error:', error)
        setLoading(false)
        return { data, error }
      }

      console.log('[Auth] Sign up auth successful:', !!data.user, 'Session:', !!data.session)
      
      // Check if email confirmation is needed
      if (data.user && !data.session) {
        console.log('[Auth] Email confirmation required for:', email)
        // User created but needs email confirmation
        const enhancedData = {
          ...data,
          needsEmailConfirmation: true,
          confirmationMessage: `🎉 Account created successfully! Please check your email (${email}) and click the confirmation link to activate your account. The confirmation email should arrive within a few minutes.`
        }
        setLoading(false)
        return { data: enhancedData, error: null }
      } else if (data.user && data.session) {
        console.log('[Auth] User signed up and immediately signed in (no email confirmation required)')
        // User is immediately signed in (email confirmation disabled)
        setLoading(false)
        return { data, error: null }
      }
      
      console.log('[Auth] User profile will be created automatically by database trigger')
      
      // Don't set loading to false here - let the auth state listener handle it
      return { data, error: null }
    } catch (error) {
      console.error('[Auth] Sign up exception:', error)
      setLoading(false)
      return { data: null, error }
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const updateProfile = async (updates: Partial<User>) => {
    if (!user) return
    
    const { error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', user.id)
    
    if (error) throw error
    
    // Update local user state
    setUser({ ...user, ...updates })
  }

  const value = {
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    updateProfile
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}