import React, { useState } from 'react'
import { MessageCircle, X, Send, Minimize2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Message {
  id: string
  text: string
  isBot: boolean
  timestamp: Date
  isLoading?: boolean
}

const initialMessage: Message = {
  id: '1',
  text: 'Hello! I am your AI assistant for the Resource Exchange platform. Ask me anything about sharing resources, using features, or finding what you need!',
  isBot: true,
  timestamp: new Date()
}

export default function Chatbot() {
  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [messages, setMessages] = useState<Message[]>([initialMessage])
  const [inputMessage, setInputMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputMessage,
      isBot: false,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInputMessage('')
    setIsLoading(true)

    // Add loading message
    const loadingMessage: Message = {
      id: (Date.now() + 1).toString(),
      text: 'Thinking...',
      isBot: true,
      timestamp: new Date(),
      isLoading: true
    }
    setMessages(prev => [...prev, loadingMessage])

    try {
      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: {
          action: 'chatbot_conversation',
          text: inputMessage
        }
      })

      // Remove loading message
      setMessages(prev => prev.filter(msg => !msg.isLoading))

      if (error) {
        throw error
      }

      const botResponse: Message = {
        id: (Date.now() + 2).toString(),
        text: data.data.response || 'I apologize, but I encountered an issue. Please try again.',
        isBot: true,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, botResponse])
    } catch (error) {
      console.error('Chatbot error:', error)
      // Remove loading message
      setMessages(prev => prev.filter(msg => !msg.isLoading))
      
      const errorMessage: Message = {
        id: (Date.now() + 3).toString(),
        text: 'I apologize, but I encountered an issue. Please try again or check your connection.',
        isBot: true,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 bg-blue-600 text-white p-4 rounded-full shadow-lg hover:bg-blue-700 transition-colors z-50 group"
        aria-label="Open chat support"
      >
        <MessageCircle className="h-6 w-6" />
        <div className="absolute bottom-full right-0 mb-2 px-2 py-1 bg-slate-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
          Need help? Chat with AI!
        </div>
      </button>
    )
  }

  return (
    <div className="fixed bottom-4 right-4 w-80 bg-white rounded-lg shadow-xl border border-slate-200 z-50">
      <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-blue-600 text-white rounded-t-lg">
        <div className="flex items-center space-x-2">
          <MessageCircle className="h-5 w-5" />
          <span className="font-medium">AI Assistant</span>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="text-blue-100 hover:text-white transition-colors"
          >
            <Minimize2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="text-blue-100 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          <div className="h-80 overflow-y-auto p-4 space-y-3">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.isBot ? 'justify-start' : 'justify-end'}`}
              >
                <div
                  className={`max-w-xs p-3 rounded-lg text-sm ${
                    message.isBot
                      ? message.isLoading
                        ? 'bg-blue-50 text-blue-600 animate-pulse'
                        : 'bg-slate-100 text-slate-800'
                      : 'bg-blue-600 text-white'
                  }`}
                >
                  {message.text}
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 border-t border-slate-200">
            <div className="flex space-x-2">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask me anything..."
                disabled={isLoading}
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm disabled:opacity-50"
              />
              <button
                onClick={sendMessage}
                disabled={!inputMessage.trim() || isLoading}
                className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Press Enter to send • Powered by AI
            </p>
          </div>
        </>
      )}
    </div>
  )
}
