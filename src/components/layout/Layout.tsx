import React, { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import Chatbot from '@/components/ui/Chatbot'
import UserAvatar from '@/components/ui/UserAvatar'
import {
  Package,
  Home,
  Box,
  FileText,
  MessageCircle,
  User,
  Settings,
  Menu,
  X,
  LogOut,
  Shield,
  Users
} from 'lucide-react'
import toast from 'react-hot-toast'

interface LayoutProps {
  children: React.ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { user, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    try {
      await signOut()
      toast.success('Signed out successfully')
      navigate('/')
    } catch (error) {
      toast.error('Failed to sign out')
    }
  }

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: Home },
    { name: 'Resources', href: '/resources', icon: Box },
    { name: 'Requests', href: '/requests', icon: FileText },
    { name: 'Messages', href: '/messages', icon: MessageCircle },
    { name: 'Profile', href: '/profile', icon: User },
  ]

  const adminNavigation = [
    { name: 'Admin Panel', href: '/admin', icon: Shield },
  ]

  const isActivePath = (path: string) => location.pathname === path

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Mobile sidebar */}
      <div className={`fixed inset-0 z-50 lg:hidden ${sidebarOpen ? '' : 'pointer-events-none'}`}>
        <div className={`fixed inset-0 bg-slate-600 bg-opacity-75 transition-opacity ${sidebarOpen ? 'opacity-100' : 'opacity-0'}`} onClick={() => setSidebarOpen(false)} />
        <div className={`fixed inset-y-0 left-0 flex w-64 transform transition-transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="flex flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <Link to="/dashboard" className="flex items-center space-x-2">
                <Package className="h-6 w-6 text-blue-600" />
                <span className="font-bold text-slate-900">CRE</span>
              </Link>
              <button onClick={() => setSidebarOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-6 w-6" />
              </button>
            </div>
            <nav className="flex-1 px-4 py-4 space-y-2">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActivePath(item.href)
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <item.icon className="h-5 w-5 mr-3" />
                  {item.name}
                </Link>
              ))}
              
              {user?.role && ['SUPER_ADMIN', 'ADMIN', 'super_admin', 'admin'].includes(user.role) && (
                <>
                  <div className="border-t border-slate-200 my-4" />
                  {adminNavigation.map((item) => (
                    <Link
                      key={item.name}
                      to={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isActivePath(item.href)
                          ? 'bg-red-100 text-red-700'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      }`}
                    >
                      <item.icon className="h-5 w-5 mr-3" />
                      {item.name}
                    </Link>
                  ))}
                </>
              )}
            </nav>
          </div>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col bg-white shadow-lg border-r border-slate-200">
          <div className="flex items-center p-6 border-b border-slate-200">
            <Link to="/dashboard" className="flex items-center space-x-2">
              <Package className="h-8 w-8 text-blue-600" />
              <span className="text-xl font-bold text-slate-900">CRE</span>
            </Link>
          </div>
          <nav className="flex-1 px-4 py-6 space-y-2">
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActivePath(item.href)
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <item.icon className="h-5 w-5 mr-3" />
                {item.name}
              </Link>
            ))}
            
            {user?.role && ['SUPER_ADMIN', 'ADMIN', 'super_admin', 'admin'].includes(user.role) && (
              <>
                <div className="border-t border-slate-200 my-4" />
                {adminNavigation.map((item) => (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActivePath(item.href)
                        ? 'bg-red-100 text-red-700'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <item.icon className="h-5 w-5 mr-3" />
                    {item.name}
                  </Link>
                ))}
              </>
            )}
          </nav>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top navigation */}
        <div className="bg-white/80 backdrop-blur-sm border-b border-slate-200 sticky top-0 z-40">
          <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center">
              <button
                onClick={() => setSidebarOpen(true)}
                className="text-slate-400 hover:text-slate-600 lg:hidden"
              >
                <Menu className="h-6 w-6" />
              </button>
              <h1 className="text-2xl font-bold text-slate-900 ml-4 lg:ml-0">
                {navigation.find(item => item.href === location.pathname)?.name ||
                 adminNavigation.find(item => item.href === location.pathname)?.name ||
                 'Dashboard'}
              </h1>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* User menu */}
              <div className="flex items-center space-x-3">
                <div className="text-right">
                  <p className="text-sm font-medium text-slate-900">{user?.name}</p>
                  <p className="text-xs text-slate-500">{user?.role?.replace('_', ' ')}</p>
                </div>
                <UserAvatar 
                  user={user} 
                  size="sm" 
                  className="" 
                />
                <button
                  onClick={handleSignOut}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                  title="Sign out"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
        
        {/* Page content */}
        <main className="p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
      
      {/* Chatbot Widget */}
      <Chatbot />
    </div>
  )
}