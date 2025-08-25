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
        const { action, activity_type, resource_id, request_id, details } = requestData;

        // Get Supabase configuration
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        const anonKey = Deno.env.get('SUPABASE_ANON_KEY');

        console.log('[Activity Logger] Processing activity:', { action, activity_type });

        if (!supabaseUrl || !serviceRoleKey || !anonKey) {
            throw new Error('Supabase configuration missing');
        }

        // Get IP address and User Agent for logging
        const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
        const userAgent = req.headers.get('user-agent') || 'unknown';

        // Get user from auth header
        const authHeader = req.headers.get('authorization');
        if (!authHeader) {
            throw new Error('No authorization header');
        }

        const token = authHeader.replace('Bearer ', '');
        
        // Verify user authentication
        const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'apikey': anonKey
            }
        });

        if (!userResponse.ok) {
            throw new Error('Invalid token');
        }

        const userData = await userResponse.json();
        const userId = userData.id;

        console.log('[Activity Logger] User authenticated:', userId);

        let result;

        switch (action) {
            case 'log_user_activity':
                if (!activity_type) {
                    throw new Error('Activity type is required');
                }

                // Log user activity
                const activityLogResponse = await fetch(`${supabaseUrl}/rest/v1/user_activity_logs`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        user_id: userId,
                        activity_type: activity_type,
                        resource_id: resource_id || null,
                        request_id: request_id || null,
                        details: details || {},
                        ip_address: ipAddress,
                        user_agent: userAgent,
                        created_at: new Date().toISOString()
                    })
                });

                if (!activityLogResponse.ok) {
                    const errorText = await activityLogResponse.text();
                    console.error('[Activity Logger] Failed to log activity:', errorText);
                    throw new Error('Failed to log user activity');
                }

                result = { success: true, message: 'Activity logged successfully' };
                break;

            case 'log_signin':
                // Special handling for signin activity
                const signinLogResponse = await fetch(`${supabaseUrl}/rest/v1/user_activity_logs`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        user_id: userId,
                        activity_type: 'signin',
                        details: {
                            timestamp: new Date().toISOString(),
                            method: details?.method || 'email',
                            ...details
                        },
                        ip_address: ipAddress,
                        user_agent: userAgent,
                        created_at: new Date().toISOString()
                    })
                });

                if (!signinLogResponse.ok) {
                    const errorText = await signinLogResponse.text();
                    console.error('[Activity Logger] Failed to log signin:', errorText);
                } else {
                    console.log('[Activity Logger] Signin activity logged successfully');
                }

                // Update user's last_login timestamp
                try {
                    await fetch(`${supabaseUrl}/rest/v1/users?id=eq.${userId}`, {
                        method: 'PATCH',
                        headers: {
                            'Authorization': `Bearer ${serviceRoleKey}`,
                            'apikey': serviceRoleKey,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            last_login: new Date().toISOString()
                        })
                    });
                } catch (updateError) {
                    console.warn('[Activity Logger] Failed to update last_login:', updateError);
                }

                result = { success: true, message: 'Signin activity logged' };
                break;

            case 'log_resource_activity':
                if (!resource_id || !activity_type) {
                    throw new Error('Resource ID and activity type are required');
                }

                const resourceLogResponse = await fetch(`${supabaseUrl}/rest/v1/user_activity_logs`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        user_id: userId,
                        activity_type: activity_type, // 'resource_post', 'resource_view', 'resource_favorite', etc.
                        resource_id: resource_id,
                        details: details || {},
                        ip_address: ipAddress,
                        user_agent: userAgent,
                        created_at: new Date().toISOString()
                    })
                });

                if (!resourceLogResponse.ok) {
                    const errorText = await resourceLogResponse.text();
                    console.error('[Activity Logger] Failed to log resource activity:', errorText);
                    throw new Error('Failed to log resource activity');
                }

                result = { success: true, message: 'Resource activity logged' };
                break;

            case 'log_request_activity':
                if (!request_id || !activity_type) {
                    throw new Error('Request ID and activity type are required');
                }

                const requestLogResponse = await fetch(`${supabaseUrl}/rest/v1/user_activity_logs`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        user_id: userId,
                        activity_type: activity_type, // 'request_create', 'request_approve', 'request_reject', 'request_complete'
                        request_id: request_id,
                        details: details || {},
                        ip_address: ipAddress,
                        user_agent: userAgent,
                        created_at: new Date().toISOString()
                    })
                });

                if (!requestLogResponse.ok) {
                    const errorText = await requestLogResponse.text();
                    console.error('[Activity Logger] Failed to log request activity:', errorText);
                    throw new Error('Failed to log request activity');
                }

                result = { success: true, message: 'Request activity logged' };
                break;

            case 'log_profile_update':
                // Log profile update activity
                const profileLogResponse = await fetch(`${supabaseUrl}/rest/v1/user_activity_logs`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        user_id: userId,
                        activity_type: 'profile_update',
                        details: {
                            changes: details?.changes || {},
                            timestamp: new Date().toISOString()
                        },
                        ip_address: ipAddress,
                        user_agent: userAgent,
                        created_at: new Date().toISOString()
                    })
                });

                if (!profileLogResponse.ok) {
                    const errorText = await profileLogResponse.text();
                    console.error('[Activity Logger] Failed to log profile update:', errorText);
                }

                result = { success: true, message: 'Profile update activity logged' };
                break;

            case 'log_message_activity':
                // Log messaging activity
                const messageLogResponse = await fetch(`${supabaseUrl}/rest/v1/user_activity_logs`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        user_id: userId,
                        activity_type: activity_type || 'message_sent',
                        details: {
                            conversation_id: details?.conversation_id,
                            message_type: details?.message_type || 'text',
                            timestamp: new Date().toISOString()
                        },
                        ip_address: ipAddress,
                        user_agent: userAgent,
                        created_at: new Date().toISOString()
                    })
                });

                if (!messageLogResponse.ok) {
                    const errorText = await messageLogResponse.text();
                    console.error('[Activity Logger] Failed to log message activity:', errorText);
                }

                result = { success: true, message: 'Message activity logged' };
                break;

            default:
                throw new Error(`Unknown action: ${action}`);
        }

        return new Response(JSON.stringify({ 
            success: true,
            data: result,
            message: `Activity logging completed successfully`
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('[Activity Logger] Error:', error);

        const errorResponse = {
            error: {
                code: 'ACTIVITY_LOGGER_ERROR',
                message: error.message
            }
        };

        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});