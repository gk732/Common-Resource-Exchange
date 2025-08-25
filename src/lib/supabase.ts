import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://dgssrzejerppvpuxxnly.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRnc3NyemVqZXJwcHZwdXh4bmx5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2ODIxMzEsImV4cCI6MjA3MTI1ODEzMX0.qCxeLMcq2AOf3j_0dA5TeWK-xG2-5TT3KO2lcAxcOqw'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Types for our platform
export interface User {
  id: string
  name: string
  email: string
  role: 'SUPER_ADMIN' | 'ADMIN' | 'CONTRIBUTOR' | 'REQUESTER' | 'super_admin' | 'admin' | 'contributor' | 'requester'
  role_hierarchy_level?: number
  profile_info?: {
    bio?: string
    location?: string
    is_founder?: boolean
  }
  profile_image_url?: string
  created_at: string
  updated_at: string
}

export interface Resource {
  id: string
  user_id: string
  title: string
  description: string
  category: string
  condition: string
  images?: string[]
  location?: string
  is_available: boolean
  exchange_type: string
  created_at: string
  updated_at: string
  category_id?: string
  tags?: string[]
  views: number
}

export interface Request {
  id: string
  requester_id: string
  resource_id: string
  status: 'pending' | 'approved' | 'rejected' | 'completed'
  message?: string
  created_at: string
  updated_at: string
}

export interface Message {
  id: string
  exchange_id: string
  sender_id: string
  receiver_id: string
  content: string
  image_url?: string
  created_at: string
  read_at?: string
}

export interface Review {
  id: string
  exchange_id: string
  reviewer_id: string
  reviewee_id: string
  rating: number
  review_text?: string
  created_at: string
}

export interface Notification {
  id: string
  user_id: string
  type: string
  title: string
  message: string
  is_read: boolean
  related_id?: string
  created_at: string
}

export interface SystemLog {
  id: string
  admin_id: string
  action: string
  details?: any
  timestamp: string
}