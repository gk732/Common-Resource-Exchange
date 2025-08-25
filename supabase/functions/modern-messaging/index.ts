Deno.serve(async (req) => {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE, PATCH',
        'Access-Control-Max-Age': '86400',
        'Access-Control-Allow-Credentials': 'false'
    };

    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 200, headers: corsHeaders });
    }

    try {
        const requestBody = await req.json();
        const { action } = requestBody;

        // Get environment variables
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

        if (!supabaseUrl || !anonKey || !serviceRoleKey) {
            throw new Error('Missing environment variables');
        }

        // Get and validate auth token
        const authHeader = req.headers.get('authorization');
        if (!authHeader) {
            throw new Error('Authorization header required');
        }

        const token = authHeader.replace('Bearer ', '');
        
        // Verify token and get user
        const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'apikey': anonKey
            }
        });

        if (!userResponse.ok) {
            throw new Error('Invalid authentication token');
        }

        const userData = await userResponse.json();
        const currentUserId = userData.id;

        console.log(`[Modern Messaging] ${action} action for user:`, currentUserId);

        let result;

        switch (action) {
            case 'send_message':
                result = await sendMessage(requestBody, currentUserId, supabaseUrl, token, anonKey);
                break;
                
            case 'get_conversations':
                result = await getConversations(currentUserId, supabaseUrl, token, anonKey, serviceRoleKey);
                break;
                
            case 'get_conversation_messages':
                result = await getConversationMessages(requestBody, currentUserId, supabaseUrl, token, anonKey);
                break;
                
            case 'mark_messages_read':
                result = await markMessagesRead(requestBody, currentUserId, supabaseUrl, token, anonKey);
                break;
                
            case 'delete_conversation':
                result = await deleteConversation(requestBody, currentUserId, supabaseUrl, token, anonKey, serviceRoleKey);
                break;
                
            case 'clear_chat':
                result = await clearChat(requestBody, currentUserId, supabaseUrl, token, anonKey, serviceRoleKey);
                break;
                
            case 'search_messages':
                result = await searchMessages(requestBody, currentUserId, supabaseUrl, token, anonKey);
                break;
                
            case 'update_typing_status':
                result = await updateTypingStatus(requestBody, currentUserId, supabaseUrl, token, anonKey);
                break;
                
            case 'update_user_presence':
                result = await updateUserPresence(currentUserId, supabaseUrl, token, anonKey);
                break;
                
            case 'get_user_presence':
                result = await getUserPresence(requestBody, supabaseUrl, token, anonKey);
                break;
                
            default:
                throw new Error(`Unknown action: ${action}`);
        }

        return new Response(JSON.stringify({ success: true, data: result }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('[Modern Messaging] Error:', error);
        
        return new Response(JSON.stringify({
            error: {
                code: 'MESSAGING_ERROR',
                message: error.message || 'An error occurred'
            }
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});

// Send message function
async function sendMessage(requestBody, currentUserId, supabaseUrl, token, anonKey) {
    const { receiverId, content, messageType = 'text', attachmentUrl, attachmentName, attachmentSize } = requestBody;
    
    if (!receiverId || !content) {
        throw new Error('Receiver ID and content are required');
    }
    
    if (receiverId === currentUserId) {
        throw new Error('Cannot send message to yourself');
    }
    
    if (content.length > 2000) {
        throw new Error('Message content too long (max 2000 characters)');
    }
    
    // Ensure conversation exists
    const conversationResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/ensure_conversation_exists`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'apikey': anonKey,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            user1_id: currentUserId,
            user2_id: receiverId
        })
    });
    
    if (!conversationResponse.ok) {
        throw new Error('Failed to create or find conversation');
    }
    
    const conversationId = await conversationResponse.json();
    
    // Insert message
    const messageData = {
        conversation_id: conversationId,
        sender_id: currentUserId,
        content: content.trim(),
        message_type: messageType,
        attachment_url: attachmentUrl || null,
        attachment_name: attachmentName || null,
        attachment_size: attachmentSize || null
    };
    
    const messageResponse = await fetch(`${supabaseUrl}/rest/v1/messages`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'apikey': anonKey,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        },
        body: JSON.stringify(messageData)
    });
    
    if (!messageResponse.ok) {
        const error = await messageResponse.text();
        console.error('Message insert failed:', error);
        throw new Error('Failed to send message');
    }
    
    const message = await messageResponse.json();
    console.log('[Modern Messaging] Message sent successfully:', message[0]?.id);
    
    return message[0];
}

// Get conversations function
async function getConversations(currentUserId, supabaseUrl, token, anonKey, serviceRoleKey) {
    // Get conversations with latest message info
    const conversationsResponse = await fetch(
        `${supabaseUrl}/rest/v1/conversations?or=(participant_1_id.eq.${currentUserId},participant_2_id.eq.${currentUserId})&order=last_message_at.desc`,
        {
            headers: {
                'Authorization': `Bearer ${token}`,
                'apikey': anonKey
            }
        }
    );
    
    if (!conversationsResponse.ok) {
        throw new Error('Failed to fetch conversations');
    }
    
    const conversations = await conversationsResponse.json();
    
    if (conversations.length === 0) {
        return [];
    }
    
    // Get partner user details
    const partnerIds = conversations.map(conv => 
        conv.participant_1_id === currentUserId ? conv.participant_2_id : conv.participant_1_id
    );
    
    const usersResponse = await fetch(
        `${supabaseUrl}/rest/v1/users?id=in.(${partnerIds.join(',')})&select=id,name,email,profile_image_url`,
        {
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey
            }
        }
    );
    
    if (!usersResponse.ok) {
        throw new Error('Failed to fetch conversation partners');
    }
    
    const users = await usersResponse.json();
    
    // Get unread message counts
    const unreadCountsResponse = await fetch(
        `${supabaseUrl}/rest/v1/messages?conversation_id=in.(${conversations.map(c => c.id).join(',')})&sender_id=neq.${currentUserId}&is_read=eq.false&is_deleted=eq.false&select=conversation_id`,
        {
            headers: {
                'Authorization': `Bearer ${token}`,
                'apikey': anonKey
            }
        }
    );
    
    const unreadMessages = unreadCountsResponse.ok ? await unreadCountsResponse.json() : [];
    const unreadCounts = unreadMessages.reduce((acc, msg) => {
        acc[msg.conversation_id] = (acc[msg.conversation_id] || 0) + 1;
        return acc;
    }, {});
    
    // Get last messages
    const lastMessageIds = conversations.map(c => c.last_message_id).filter(Boolean);
    let lastMessages = [];
    
    if (lastMessageIds.length > 0) {
        const lastMessagesResponse = await fetch(
            `${supabaseUrl}/rest/v1/messages?id=in.(${lastMessageIds.join(',')})&is_deleted=eq.false`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'apikey': anonKey
                }
            }
        );
        
        if (lastMessagesResponse.ok) {
            lastMessages = await lastMessagesResponse.json();
        }
    }
    
    // Combine all data
    const result = conversations.map(conversation => {
        const partnerId = conversation.participant_1_id === currentUserId 
            ? conversation.participant_2_id 
            : conversation.participant_1_id;
            
        const partner = users.find(user => user.id === partnerId);
        const lastMessage = lastMessages.find(msg => msg.id === conversation.last_message_id);
        const unreadCount = unreadCounts[conversation.id] || 0;
        
        return {
            id: conversation.id,
            partner,
            lastMessage,
            unreadCount,
            lastMessageAt: conversation.last_message_at,
            createdAt: conversation.created_at
        };
    });
    
    console.log('[Modern Messaging] Retrieved conversations:', result.length);
    return result;
}

// Get conversation messages function
async function getConversationMessages(requestBody, currentUserId, supabaseUrl, token, anonKey) {
    const { conversationId, limit = 50, offset = 0 } = requestBody;
    
    if (!conversationId) {
        throw new Error('Conversation ID is required');
    }
    
    // Verify user has access to this conversation
    const conversationResponse = await fetch(
        `${supabaseUrl}/rest/v1/conversations?id=eq.${conversationId}&or=(participant_1_id.eq.${currentUserId},participant_2_id.eq.${currentUserId})`,
        {
            headers: {
                'Authorization': `Bearer ${token}`,
                'apikey': anonKey
            }
        }
    );
    
    if (!conversationResponse.ok) {
        throw new Error('Failed to verify conversation access');
    }
    
    const conversations = await conversationResponse.json();
    if (conversations.length === 0) {
        throw new Error('Conversation not found or access denied');
    }
    
    // Get messages
    const messagesResponse = await fetch(
        `${supabaseUrl}/rest/v1/messages?conversation_id=eq.${conversationId}&is_deleted=eq.false&order=created_at.desc&limit=${limit}&offset=${offset}`,
        {
            headers: {
                'Authorization': `Bearer ${token}`,
                'apikey': anonKey
            }
        }
    );
    
    if (!messagesResponse.ok) {
        throw new Error('Failed to fetch messages');
    }
    
    const messages = await messagesResponse.json();
    
    console.log('[Modern Messaging] Retrieved messages:', messages.length);
    return messages.reverse(); // Return in chronological order
}

// Mark messages as read function
async function markMessagesRead(requestBody, currentUserId, supabaseUrl, token, anonKey) {
    const { conversationId, messageIds } = requestBody;
    
    if (!conversationId && !messageIds) {
        throw new Error('Either conversation ID or message IDs are required');
    }
    
    let updateUrl;
    if (conversationId) {
        updateUrl = `${supabaseUrl}/rest/v1/messages?conversation_id=eq.${conversationId}&sender_id=neq.${currentUserId}&is_read=eq.false&is_deleted=eq.false`;
    } else {
        updateUrl = `${supabaseUrl}/rest/v1/messages?id=in.(${messageIds.join(',')})&sender_id=neq.${currentUserId}&is_read=eq.false&is_deleted=eq.false`;
    }
    
    const response = await fetch(updateUrl, {
        method: 'PATCH',
        headers: {
            'Authorization': `Bearer ${token}`,
            'apikey': anonKey,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            is_read: true,
            read_at: new Date().toISOString()
        })
    });
    
    if (!response.ok) {
        throw new Error('Failed to mark messages as read');
    }
    
    return { success: true };
}

// Delete conversation function
async function deleteConversation(requestBody, currentUserId, supabaseUrl, token, anonKey, serviceRoleKey) {
    const { conversationId } = requestBody;
    
    if (!conversationId) {
        throw new Error('Conversation ID is required');
    }
    
    // Verify user has access to this conversation first
    const conversationResponse = await fetch(
        `${supabaseUrl}/rest/v1/conversations?id=eq.${conversationId}&or=(participant_1_id.eq.${currentUserId},participant_2_id.eq.${currentUserId})`,
        {
            headers: {
                'Authorization': `Bearer ${token}`,
                'apikey': anonKey
            }
        }
    );
    
    if (!conversationResponse.ok) {
        throw new Error('Failed to verify conversation access');
    }
    
    const conversations = await conversationResponse.json();
    if (conversations.length === 0) {
        throw new Error('Conversation not found or access denied');
    }
    
    // First, delete all messages in the conversation using service role
    const messagesResponse = await fetch(
        `${supabaseUrl}/rest/v1/messages?conversation_id=eq.${conversationId}`,
        {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey
            }
        }
    );
    
    if (!messagesResponse.ok) {
        console.error('Failed to delete messages:', await messagesResponse.text());
        // Continue even if message deletion fails
    }
    
    // Then, delete the conversation record itself using service role
    const deleteConversationResponse = await fetch(
        `${supabaseUrl}/rest/v1/conversations?id=eq.${conversationId}`,
        {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey
            }
        }
    );
    
    if (!deleteConversationResponse.ok) {
        const error = await deleteConversationResponse.text();
        console.error('Failed to delete conversation:', error);
        throw new Error('Failed to delete conversation record');
    }
    
    return { success: true, message: 'Conversation deleted successfully' };
}

// Clear chat function (delete all messages but keep conversation)
async function clearChat(requestBody, currentUserId, supabaseUrl, token, anonKey, serviceRoleKey) {
    const { conversationId } = requestBody;
    
    if (!conversationId) {
        throw new Error('Conversation ID is required');
    }
    
    // Verify user has access to this conversation first
    const conversationResponse = await fetch(
        `${supabaseUrl}/rest/v1/conversations?id=eq.${conversationId}&or=(participant_1_id.eq.${currentUserId},participant_2_id.eq.${currentUserId})`,
        {
            headers: {
                'Authorization': `Bearer ${token}`,
                'apikey': anonKey
            }
        }
    );
    
    if (!conversationResponse.ok) {
        throw new Error('Failed to verify conversation access');
    }
    
    const conversations = await conversationResponse.json();
    if (conversations.length === 0) {
        throw new Error('Conversation not found or access denied');
    }
    
    // Delete ALL messages in the conversation using service role for full permissions
    const response = await fetch(
        `${supabaseUrl}/rest/v1/messages?conversation_id=eq.${conversationId}`,
        {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey
            }
        }
    );
    
    if (!response.ok) {
        const error = await response.text();
        console.error('Failed to clear chat messages:', error);
        throw new Error('Failed to clear chat messages');
    }
    
    // Update the conversation's last_message_id and last_message_at to null since all messages are gone
    const updateConversationResponse = await fetch(
        `${supabaseUrl}/rest/v1/conversations?id=eq.${conversationId}`,
        {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                last_message_id: null,
                last_message_at: null
            })
        }
    );
    
    if (!updateConversationResponse.ok) {
        console.error('Failed to update conversation after clearing chat');
        // Don't throw error as the main operation (clearing messages) succeeded
    }
    
    return { success: true, message: 'Chat cleared successfully' };
}

// Search messages function
async function searchMessages(requestBody, currentUserId, supabaseUrl, token, anonKey) {
    const { query, conversationId, limit = 20 } = requestBody;
    
    if (!query || query.trim().length < 2) {
        throw new Error('Search query must be at least 2 characters');
    }
    
    let searchUrl = `${supabaseUrl}/rest/v1/messages?content=ilike.*${query}*&is_deleted=eq.false&order=created_at.desc&limit=${limit}`;
    
    if (conversationId) {
        searchUrl += `&conversation_id=eq.${conversationId}`;
    }
    
    const response = await fetch(searchUrl, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'apikey': anonKey
        }
    });
    
    if (!response.ok) {
        throw new Error('Failed to search messages');
    }
    
    const messages = await response.json();
    return messages;
}

// Update typing status function
async function updateTypingStatus(requestBody, currentUserId, supabaseUrl, token, anonKey) {
    const { conversationId, isTyping = true } = requestBody;
    
    if (!conversationId) {
        throw new Error('Conversation ID is required');
    }
    
    if (isTyping) {
        // Insert or update typing indicator
        const response = await fetch(`${supabaseUrl}/rest/v1/typing_indicators`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'apikey': anonKey,
                'Content-Type': 'application/json',
                'Prefer': 'resolution=merge-duplicates'
            },
            body: JSON.stringify({
                conversation_id: conversationId,
                user_id: currentUserId,
                is_typing: true
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to update typing status');
        }
    } else {
        // Remove typing indicator
        const response = await fetch(
            `${supabaseUrl}/rest/v1/typing_indicators?conversation_id=eq.${conversationId}&user_id=eq.${currentUserId}`,
            {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'apikey': anonKey
                }
            }
        );
        
        if (!response.ok) {
            throw new Error('Failed to remove typing status');
        }
    }
    
    return { success: true };
}

// Update user presence function
async function updateUserPresence(currentUserId, supabaseUrl, token, anonKey) {
    const response = await fetch(`${supabaseUrl}/rest/v1/user_presence`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'apikey': anonKey,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({
            user_id: currentUserId,
            is_online: true,
            last_seen: new Date().toISOString()
        })
    });
    
    if (!response.ok) {
        throw new Error('Failed to update user presence');
    }
    
    return { success: true };
}

// Get user presence function
async function getUserPresence(requestBody, supabaseUrl, token, anonKey) {
    const { userIds } = requestBody;
    
    if (!userIds || !Array.isArray(userIds)) {
        throw new Error('User IDs array is required');
    }
    
    const response = await fetch(
        `${supabaseUrl}/rest/v1/user_presence?user_id=in.(${userIds.join(',')})`,
        {
            headers: {
                'Authorization': `Bearer ${token}`,
                'apikey': anonKey
            }
        }
    );
    
    if (!response.ok) {
        throw new Error('Failed to fetch user presence');
    }
    
    const presence = await response.json();
    return presence;
}