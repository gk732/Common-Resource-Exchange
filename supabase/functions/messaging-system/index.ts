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
        const requestData = await req.json();
        const { action } = requestData;

        if (!action) {
            throw new Error('Action is required');
        }

        // Get environment variables
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        const supabaseUrl = Deno.env.get('SUPABASE_URL');

        if (!serviceRoleKey || !supabaseUrl) {
            throw new Error('Supabase configuration missing');
        }

        // Get user from auth header
        const authHeader = req.headers.get('authorization');
        if (!authHeader) {
            throw new Error('No authorization header');
        }

        const token = authHeader.replace('Bearer ', '');

        // Verify token and get user
        const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'apikey': serviceRoleKey
            }
        });

        if (!userResponse.ok) {
            throw new Error('Invalid token');
        }

        const userData = await userResponse.json();
        const userId = userData.id;

        let result;

        switch (action) {
            case 'getConversations':
                result = await getConversations(userId, supabaseUrl, serviceRoleKey);
                break;
            
            case 'getMessages':
                const { conversationId } = requestData;
                if (!conversationId) {
                    throw new Error('Conversation ID is required');
                }
                result = await getMessages(conversationId, userId, supabaseUrl, serviceRoleKey);
                break;
            
            case 'sendMessage':
                const { conversationId: msgConvId, content, messageType } = requestData;
                if (!msgConvId || !content) {
                    throw new Error('Conversation ID and content are required');
                }
                result = await sendMessage(msgConvId, userId, content, messageType || 'text', supabaseUrl, serviceRoleKey);
                break;
            
            case 'createConversation':
                const { participantUserId } = requestData;
                if (!participantUserId) {
                    throw new Error('Participant user ID is required');
                }
                result = await createConversation(userId, participantUserId, supabaseUrl, serviceRoleKey);
                break;
            
            case 'deleteConversation':
                const { conversationId: delConvId } = requestData;
                if (!delConvId) {
                    throw new Error('Conversation ID is required');
                }
                result = await deleteConversation(delConvId, userId, supabaseUrl, serviceRoleKey);
                break;
            
            case 'clearChat':
                const { conversationId: clearConvId } = requestData;
                if (!clearConvId) {
                    throw new Error('Conversation ID is required');
                }
                result = await clearChat(clearConvId, userId, supabaseUrl, serviceRoleKey);
                break;
                
            default:
                throw new Error(`Unknown action: ${action}`);
        }

        return new Response(JSON.stringify({ data: result }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Messaging system error:', error);

        const errorResponse = {
            error: {
                code: 'MESSAGING_ERROR',
                message: error.message
            }
        };

        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});

// Get all conversations for a user
async function getConversations(userId, supabaseUrl, serviceRoleKey) {
    // Get conversations where user is a participant
    const conversationsResponse = await fetch(
        `${supabaseUrl}/rest/v1/conversations?participants=cs.{${userId}}&select=*`,
        {
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey,
                'Content-Type': 'application/json'
            }
        }
    );

    if (!conversationsResponse.ok) {
        const errorText = await conversationsResponse.text();
        throw new Error(`Failed to fetch conversations: ${errorText}`);
    }

    const conversations = await conversationsResponse.json();
    
    // For each conversation, get the other participant's name and last message
    const enrichedConversations = await Promise.all(
        conversations.map(async (conv) => {
            // Get other participant
            const otherParticipantId = conv.participants.find(id => id !== userId);
            
            if (!otherParticipantId) {
                return {
                    ...conv,
                    name: 'Unknown',
                    lastMessage: undefined,
                    lastMessageTime: undefined,
                    unreadCount: 0
                };
            }

            // Get participant user info
            const userResponse = await fetch(
                `${supabaseUrl}/rest/v1/users?id=eq.${otherParticipantId}&select=id,name,email`,
                {
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey
                    }
                }
            );

            const users = await userResponse.json();
            const participantName = users[0]?.name || 'Unknown User';

            // Get last message
            const lastMessageResponse = await fetch(
                `${supabaseUrl}/rest/v1/messages?conversation_id=eq.${conv.id}&select=content,created_at&order=created_at.desc&limit=1`,
                {
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey
                    }
                }
            );

            const lastMessages = await lastMessageResponse.json();
            const lastMessage = lastMessages[0];

            return {
                ...conv,
                name: participantName,
                lastMessage: lastMessage?.content,
                lastMessageTime: lastMessage?.created_at,
                unreadCount: 0 // TODO: Implement unread count logic
            };
        })
    );

    return enrichedConversations;
}

// Get messages for a specific conversation
async function getMessages(conversationId, userId, supabaseUrl, serviceRoleKey) {
    // Verify user has access to this conversation
    const conversationResponse = await fetch(
        `${supabaseUrl}/rest/v1/conversations?id=eq.${conversationId}&participants=cs.{${userId}}`,
        {
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey
            }
        }
    );

    const conversations = await conversationResponse.json();
    if (conversations.length === 0) {
        throw new Error('Conversation not found or access denied');
    }

    // Get messages
    const messagesResponse = await fetch(
        `${supabaseUrl}/rest/v1/messages?conversation_id=eq.${conversationId}&select=*&order=created_at.asc`,
        {
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey
            }
        }
    );

    if (!messagesResponse.ok) {
        throw new Error('Failed to fetch messages');
    }

    const messages = await messagesResponse.json();
    
    // Get sender names for messages
    const enrichedMessages = await Promise.all(
        messages.map(async (message) => {
            const userResponse = await fetch(
                `${supabaseUrl}/rest/v1/users?id=eq.${message.sender_id}&select=name`,
                {
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey
                    }
                }
            );

            const users = await userResponse.json();
            const senderName = users[0]?.name || 'Unknown';

            return {
                id: message.id,
                conversationId: message.conversation_id,
                senderId: message.sender_id,
                senderName: senderName,
                content: message.content,
                messageType: message.message_type || 'text',
                status: message.status || 'sent',
                createdAt: message.created_at,
                metadata: message.metadata
            };
        })
    );

    return enrichedMessages;
}

// Send a message
async function sendMessage(conversationId, userId, content, messageType, supabaseUrl, serviceRoleKey) {
    // Verify user has access to this conversation
    const conversationResponse = await fetch(
        `${supabaseUrl}/rest/v1/conversations?id=eq.${conversationId}&participants=cs.{${userId}}`,
        {
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey
            }
        }
    );

    const conversations = await conversationResponse.json();
    if (conversations.length === 0) {
        throw new Error('Conversation not found or access denied');
    }

    // Insert message
    const messageResponse = await fetch(
        `${supabaseUrl}/rest/v1/messages`,
        {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify({
                conversation_id: conversationId,
                sender_id: userId,
                content: content,
                message_type: messageType,
                status: 'sent'
            })
        }
    );

    if (!messageResponse.ok) {
        const errorText = await messageResponse.text();
        throw new Error(`Failed to send message: ${errorText}`);
    }

    const message = await messageResponse.json();
    
    // Update conversation updated_at
    await fetch(
        `${supabaseUrl}/rest/v1/conversations?id=eq.${conversationId}`,
        {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                updated_at: new Date().toISOString()
            })
        }
    );

    return message[0];
}

// Create a new conversation
async function createConversation(userId, participantUserId, supabaseUrl, serviceRoleKey) {
    // Check if conversation already exists between these users
    const existingConversationResponse = await fetch(
        `${supabaseUrl}/rest/v1/conversations?participants=cs.{${userId},${participantUserId}}&is_group_chat=eq.false`,
        {
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey
            }
        }
    );

    const existingConversations = await existingConversationResponse.json();
    
    if (existingConversations.length > 0) {
        return existingConversations[0];
    }

    // Create new conversation
    const conversationResponse = await fetch(
        `${supabaseUrl}/rest/v1/conversations`,
        {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify({
                participants: [userId, participantUserId],
                is_group_chat: false,
                created_by: userId
            })
        }
    );

    if (!conversationResponse.ok) {
        const errorText = await conversationResponse.text();
        throw new Error(`Failed to create conversation: ${errorText}`);
    }

    const conversation = await conversationResponse.json();
    return conversation[0];
}

// Delete a conversation
async function deleteConversation(conversationId, userId, supabaseUrl, serviceRoleKey) {
    // Verify user has access to this conversation
    const conversationResponse = await fetch(
        `${supabaseUrl}/rest/v1/conversations?id=eq.${conversationId}&participants=cs.{${userId}}`,
        {
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey
            }
        }
    );

    const conversations = await conversationResponse.json();
    if (conversations.length === 0) {
        throw new Error('Conversation not found or access denied');
    }

    // Delete all messages in the conversation first
    await fetch(
        `${supabaseUrl}/rest/v1/messages?conversation_id=eq.${conversationId}`,
        {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey
            }
        }
    );

    // Delete the conversation
    const deleteResponse = await fetch(
        `${supabaseUrl}/rest/v1/conversations?id=eq.${conversationId}`,
        {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey
            }
        }
    );

    if (!deleteResponse.ok) {
        const errorText = await deleteResponse.text();
        throw new Error(`Failed to delete conversation: ${errorText}`);
    }

    return { success: true };
}

// Clear chat messages
async function clearChat(conversationId, userId, supabaseUrl, serviceRoleKey) {
    // Verify user has access to this conversation
    const conversationResponse = await fetch(
        `${supabaseUrl}/rest/v1/conversations?id=eq.${conversationId}&participants=cs.{${userId}}`,
        {
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey
            }
        }
    );

    const conversations = await conversationResponse.json();
    if (conversations.length === 0) {
        throw new Error('Conversation not found or access denied');
    }

    // Delete all messages in the conversation
    const deleteResponse = await fetch(
        `${supabaseUrl}/rest/v1/messages?conversation_id=eq.${conversationId}`,
        {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey
            }
        }
    );

    if (!deleteResponse.ok) {
        const errorText = await deleteResponse.text();
        throw new Error(`Failed to clear messages: ${errorText}`);
    }

    // Update conversation updated_at
    await fetch(
        `${supabaseUrl}/rest/v1/conversations?id=eq.${conversationId}`,
        {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                updated_at: new Date().toISOString()
            })
        }
    );

    return { success: true };
}