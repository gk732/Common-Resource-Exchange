import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import LandingPage from '@/components/LandingPage'
import LoginPage from '@/components/auth/LoginPage'
import RegisterPage from '@/components/auth/RegisterPage'
import AuthCallback from '@/components/auth/AuthCallback'
import Dashboard from '@/components/dashboard/Dashboard'
import ResourcesPage from '@/components/resources/ResourcesPage'
import RequestsPage from '@/components/requests/RequestsPage'
import MessagesPage from '@/components/messages/ModernMessagesPage'
import ProfilePage from '@/components/profile/ProfilePage'
import AdminDashboard from '@/components/admin/AdminDashboard'
import ConversationManagementPage from '@/pages/Admin/ConversationManagementPage'
import Layout from '@/components/layout/Layout'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
})

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    )
  }
  
  if (!user) {
    return <Navigate to="/login" replace />
  }
  
  return <>{children}</>
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    )
  }
  
  if (!user || !['SUPER_ADMIN', 'ADMIN', 'super_admin', 'admin'].includes(user.role)) {
    return <Navigate to="/dashboard" replace />
  }
  
  return <>{children}</>
}

function AppRoutes() {
  const { user } = useAuth()
  
  return (
    <Routes>
      <Route path="/" element={!user ? <LandingPage /> : <Navigate to="/dashboard" replace />} />
      <Route path="/login" element={!user ? <LoginPage /> : <Navigate to="/dashboard" replace />} />
      <Route path="/register" element={!user ? <RegisterPage /> : <Navigate to="/dashboard" replace />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <Layout>
            <Dashboard />
          </Layout>
        </ProtectedRoute>
      } />
      
      <Route path="/resources" element={
        <ProtectedRoute>
          <Layout>
            <ResourcesPage />
          </Layout>
        </ProtectedRoute>
      } />
      
      <Route path="/requests" element={
        <ProtectedRoute>
          <Layout>
            <RequestsPage />
          </Layout>
        </ProtectedRoute>
      } />
      
      <Route path="/messages" element={
        <ProtectedRoute>
          <Layout>
            <MessagesPage />
          </Layout>
        </ProtectedRoute>
      } />
      
      <Route path="/profile" element={
        <ProtectedRoute>
          <Layout>
            <ProfilePage />
          </Layout>
        </ProtectedRoute>
      } />
      
      <Route path="/admin" element={
        <AdminRoute>
          <Layout>
            <AdminDashboard />
          </Layout>
        </AdminRoute>
      } />
      
      <Route path="/admin/conversations" element={
        <AdminRoute>
          <Layout>
            <ConversationManagementPage />
          </Layout>
        </AdminRoute>
      } />
      
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
            <AppRoutes />
          </div>
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  )
}

export default App