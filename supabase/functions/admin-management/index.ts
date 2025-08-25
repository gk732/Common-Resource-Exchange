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
        const action = requestData.action;

        // Get Supabase configuration
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        const anonKey = Deno.env.get('SUPABASE_ANON_KEY');

        console.log('[Admin Management] Processing action:', action);

        if (!supabaseUrl || !serviceRoleKey || !anonKey) {
            throw new Error('Supabase configuration missing');
        }

        // Get IP address and User Agent for audit logging
        const rawIpAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || req.headers.get('cf-connecting-ip');
        const ipAddress = rawIpAddress || null; // Use null instead of 'unknown' for inet type
        const userAgent = req.headers.get('user-agent') || null;

        // Get user from auth header
        const authHeader = req.headers.get('authorization');
        if (!authHeader) {
            throw new Error('No authorization header - Authentication required');
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
            throw new Error('Invalid token - Please login again');
        }

        const userData = await userResponse.json();
        console.log('[Admin Management] User authenticated:', userData.id);

        // Get user role and hierarchy level from users table
        const userRoleResponse = await fetch(`${supabaseUrl}/rest/v1/users?id=eq.${userData.id}&select=id,role,role_hierarchy_level,name,email`, {
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey,
                'Content-Type': 'application/json'
            }
        });

        if (!userRoleResponse.ok) {
            throw new Error('Failed to fetch user role');
        }

        const userRoleData = await userRoleResponse.json();
        const currentUser = userRoleData[0];

        if (!currentUser) {
            throw new Error('User not found in database');
        }

        // Check if user has admin privileges (hierarchy level 3 or higher for admin, 4+ for super admin)
        const requiredLevel = action === 'get_system_stats' ? 3 : 3; // All actions require admin level
        if (!currentUser.role_hierarchy_level || currentUser.role_hierarchy_level < requiredLevel) {
            throw new Error('Insufficient permissions - Admin access required');
        }

        console.log('[Admin Management] Permission check passed for action:', action, 'User level:', currentUser.role_hierarchy_level);

        // Helper function to log admin activities
        const logAdminActivity = async ({
            adminUserId,
            adminName,
            adminRole,
            activityType,
            targetUserId = null,
            targetUserName = null,
            oldValue = null,
            newValue = null,
            reason = null,
            success = true
        }) => {
            try {
                console.log('[Admin Management] Attempting to log activity:', {
                    adminUserId,
                    adminName,
                    adminRole,
                    activityType,
                    targetUserId,
                    targetUserName,
                    success
                });
                
                // Validate and clean IP address for inet type
                let validIpAddress = null;
                if (ipAddress) {
                    // Basic IP validation (IPv4 and IPv6)
                    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
                    const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
                    
                    if (ipv4Regex.test(ipAddress) || ipv6Regex.test(ipAddress)) {
                        validIpAddress = ipAddress;
                    } else {
                        console.log('[Admin Management] Invalid IP address format, using null:', ipAddress);
                    }
                }
                
                const activityData = {
                    admin_user_id: adminUserId,
                    admin_name: adminName,
                    admin_role: adminRole,
                    activity_type: activityType,
                    target_user_id: targetUserId,
                    target_user_name: targetUserName,
                    old_value: oldValue,
                    new_value: newValue,
                    reason: reason,
                    ip_address: validIpAddress,
                    user_agent: userAgent,
                    success: success,
                    created_at: new Date().toISOString()
                };
                
                console.log('[Admin Management] Activity data prepared:', activityData);
                
                const adminActivityResponse = await fetch(`${supabaseUrl}/rest/v1/admin_activity_logs`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(activityData)
                });

                console.log('[Admin Management] Activity logging response status:', adminActivityResponse.status);
                
                if (!adminActivityResponse.ok) {
                    const errorText = await adminActivityResponse.text();
                    console.error('[Admin Management] Admin activity log failed:', {
                        status: adminActivityResponse.status,
                        statusText: adminActivityResponse.statusText,
                        error: errorText
                    });
                    // Don't throw error - just log it so role changes can continue
                    console.error('[Admin Management] Activity logging failed but continuing with role change');
                    return null;
                } else {
                    const responseData = await adminActivityResponse.json();
                    console.log('[Admin Management] Admin activity logged successfully:', {
                        activityType,
                        responseData
                    });
                    return responseData;
                }
            } catch (error) {
                console.error('[Admin Management] Admin activity log error:', error);
                // Don't throw error - just log it so role changes can continue
                console.error('[Admin Management] Activity logging failed with error but continuing');
                return null;
            }
        };

        // Helper function to check role hierarchy permissions
        const canManageUser = (adminHierarchyLevel, targetHierarchyLevel) => {
            return adminHierarchyLevel > targetHierarchyLevel;
        };

        let result;

        switch (action) {
            case 'get_system_stats':
                console.log('[Admin Management] Processing get_system_stats action');
                
                // Log admin activity for accessing system stats
                try {
                    await logAdminActivity({
                        adminUserId: userData.id,
                        adminName: currentUser.name,
                        adminRole: currentUser.role,
                        activityType: 'view_system_stats',
                        success: true
                    });
                } catch (loggingError) {
                    console.warn('[Admin Management] Failed to log view_system_stats activity:', loggingError);
                }
                
                // Get basic counts
                const [usersRes, resourcesRes, requestsRes, messagesRes] = await Promise.all([
                    fetch(`${supabaseUrl}/rest/v1/users?select=count`, {
                        headers: {
                            'Authorization': `Bearer ${serviceRoleKey}`,
                            'apikey': serviceRoleKey,
                            'Prefer': 'count=exact'
                        }
                    }),
                    fetch(`${supabaseUrl}/rest/v1/resources?select=count`, {
                        headers: {
                            'Authorization': `Bearer ${serviceRoleKey}`,
                            'apikey': serviceRoleKey,
                            'Prefer': 'count=exact'
                        }
                    }),
                    fetch(`${supabaseUrl}/rest/v1/requests?select=count`, {
                        headers: {
                            'Authorization': `Bearer ${serviceRoleKey}`,
                            'apikey': serviceRoleKey,
                            'Prefer': 'count=exact'
                        }
                    }),
                    fetch(`${supabaseUrl}/rest/v1/messages?select=count`, {
                        headers: {
                            'Authorization': `Bearer ${serviceRoleKey}`,
                            'apikey': serviceRoleKey,
                            'Prefer': 'count=exact'
                        }
                    })
                ]);

                const totalUsers = usersRes.ok ? parseInt(usersRes.headers.get('content-range')?.split('/')[1] || '0') : 0;
                const totalResources = resourcesRes.ok ? parseInt(resourcesRes.headers.get('content-range')?.split('/')[1] || '0') : 0;
                const totalRequests = requestsRes.ok ? parseInt(requestsRes.headers.get('content-range')?.split('/')[1] || '0') : 0;
                const totalMessages = messagesRes.ok ? parseInt(messagesRes.headers.get('content-range')?.split('/')[1] || '0') : 0;

                // Get role distribution
                const roleDistRes = await fetch(`${supabaseUrl}/rest/v1/users?select=role`, {
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey
                    }
                });
                const roleData = roleDistRes.ok ? await roleDistRes.json() : [];
                const roleDistribution = roleData.reduce((acc, user) => {
                    const roleKey = (user.role || 'unknown').replace(/_/g, ' ').toUpperCase();
                    acc[roleKey] = (acc[roleKey] || 0) + 1;
                    return acc;
                }, {});

                // Get recent admin activity (latest 10)
                const activityRes = await fetch(`${supabaseUrl}/rest/v1/admin_activity_logs?select=*&order=created_at.desc&limit=10`, {
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey
                    }
                });

                let recentActivity = [];
                if (activityRes.ok) {
                    try {
                        recentActivity = await activityRes.json();
                        console.log('[Admin Management] Recent activity fetched successfully:', recentActivity.length);
                    } catch (parseError) {
                        console.error('[Admin Management] Failed to parse recent activity:', parseError);
                        recentActivity = [];
                    }
                } else {
                    console.error('[Admin Management] Failed to fetch recent activity:', activityRes.status, activityRes.statusText);
                    const errorText = await activityRes.text();
                    console.error('[Admin Management] Activity fetch error details:', errorText);
                }

                const formattedActivity = recentActivity.map(activity => {
                    const actionText = `${activity.admin_name || 'Admin'} ${(activity.activity_type?.replace(/_/g, ' ') || 'performed action').toLowerCase()}${activity.target_user_name ? ` on ${activity.target_user_name}` : ''}`;
                    console.log('[Admin Management] Formatting activity:', {
                        activityType: activity.activity_type,
                        adminName: activity.admin_name,
                        actionText
                    });
                    
                    return {
                        id: activity.id,
                        action: actionText,
                        timestamp: activity.created_at,
                        details: {
                            adminRole: activity.admin_role,
                            activityType: activity.activity_type,
                            oldValue: activity.old_value,
                            newValue: activity.new_value,
                            reason: activity.reason,
                            success: activity.success,
                            targetUserName: activity.target_user_name
                        }
                    };
                });
                
                console.log('[Admin Management] Formatted recent activities count:', formattedActivity.length);

                result = {
                    totalUsers,
                    totalResources,
                    totalRequests,
                    totalMessages,
                    roleDistribution,
                    recentActivity: formattedActivity,
                    currentAdminLevel: currentUser.role_hierarchy_level,
                    currentAdminRole: currentUser.role
                };
                break;

            case 'get_all_users':
                console.log('[Admin Management] Processing get_all_users action');
                
                // Log admin activity
                try {
                    await logAdminActivity({
                        adminUserId: userData.id,
                        adminName: currentUser.name,
                        adminRole: currentUser.role,
                        activityType: 'view_all_users',
                        success: true
                    });
                } catch (loggingError) {
                    console.warn('[Admin Management] Failed to log view_all_users activity:', loggingError);
                }
                
                const allUsersRes = await fetch(`${supabaseUrl}/rest/v1/users?select=*&order=created_at.desc`, {
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey
                    }
                });

                if (!allUsersRes.ok) {
                    throw new Error('Failed to fetch users');
                }

                const allUsers = await allUsersRes.json();
                
                // Super Admins (level 4+) can see all users, regular admins can only see users below their level
                const filteredUsers = allUsers.filter(user => {
                    if (currentUser.role_hierarchy_level >= 4) {
                        return true; // Super admins can see everyone
                    }
                    return (user.role_hierarchy_level || 1) < currentUser.role_hierarchy_level;
                });
                
                result = filteredUsers;
                console.log('[Admin Management] Retrieved users count:', result.length);
                break;

            case 'update_user_role':
                console.log('[Admin Management] Processing update_user_role action');
                const { targetUserId, newRole, reason } = requestData;

                if (!targetUserId || !newRole) {
                    throw new Error('Target user ID and new role are required');
                }

                if (!reason || reason.trim().length < 5) {
                    throw new Error('A detailed reason (minimum 5 characters) is required for role changes');
                }

                // Get target user details
                const targetUserResponse = await fetch(`${supabaseUrl}/rest/v1/users?id=eq.${targetUserId}&select=*`, {
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey,
                        'Content-Type': 'application/json'
                    }
                });

                if (!targetUserResponse.ok) {
                    throw new Error('Failed to fetch target user');
                }

                const targetUsers = await targetUserResponse.json();
                const targetUser = targetUsers[0];

                if (!targetUser) {
                    throw new Error('Target user not found');
                }

                console.log('[Admin Management] Target user found:', targetUser.name, 'Current role:', targetUser.role);

                // Check hierarchy permissions
                if (!canManageUser(currentUser.role_hierarchy_level, targetUser.role_hierarchy_level || 1)) {
                    try {
                        await logAdminActivity({
                            adminUserId: userData.id,
                            adminName: currentUser.name,
                            adminRole: currentUser.role,
                            activityType: 'role_change_attempt',
                            targetUserId: targetUserId,
                            targetUserName: targetUser.name,
                            oldValue: targetUser.role,
                            newValue: newRole,
                            reason: `DENIED: ${reason}`,
                            success: false
                        });
                    } catch (loggingError) {
                        console.warn('[Admin Management] Failed to log denied role change attempt:', loggingError);
                    }
                    throw new Error('You cannot manage users at or above your hierarchy level');
                }

                // Determine new hierarchy level
                const roleHierarchy = {
                    'founder': 5,
                    'super_admin': 4,
                    'admin': 3,
                    'contributor': 2,
                    'user': 1,
                    'requester': 1
                };
                const newHierarchyLevel = roleHierarchy[newRole.toLowerCase()] || 1;

                console.log('[Admin Management] Role change:', newRole, 'New hierarchy level:', newHierarchyLevel);

                // Check if admin can assign this role level
                if (newHierarchyLevel >= currentUser.role_hierarchy_level) {
                    try {
                        await logAdminActivity({
                            adminUserId: userData.id,
                            adminName: currentUser.name,
                            adminRole: currentUser.role,
                            activityType: 'role_change_attempt',
                            targetUserId: targetUserId,
                            targetUserName: targetUser.name,
                            oldValue: targetUser.role,
                            newValue: newRole,
                            reason: `DENIED - Cannot assign equal/higher role: ${reason}`,
                            success: false
                        });
                    } catch (loggingError) {
                        console.warn('[Admin Management] Failed to log denied role assignment attempt:', loggingError);
                    }
                    throw new Error('You cannot assign roles at or above your own hierarchy level');
                }

                // Perform the role update
                const updateRoleResponse = await fetch(`${supabaseUrl}/rest/v1/users?id=eq.${targetUserId}`, {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=representation'
                    },
                    body: JSON.stringify({
                        role: newRole.toLowerCase(),
                        role_hierarchy_level: newHierarchyLevel,
                        updated_at: new Date().toISOString()
                    })
                });

                if (!updateRoleResponse.ok) {
                    const errorText = await updateRoleResponse.text();
                    console.error('[Admin Management] Role update failed:', errorText);
                    
                    try {
                        await logAdminActivity({
                            adminUserId: userData.id,
                            adminName: currentUser.name,
                            adminRole: currentUser.role,
                            activityType: 'role_change',
                            targetUserId: targetUserId,
                            targetUserName: targetUser.name,
                            oldValue: targetUser.role,
                            newValue: newRole,
                            reason: `FAILED: ${reason} - ${errorText}`,
                            success: false
                        });
                    } catch (loggingError) {
                        console.warn('[Admin Management] Failed to log role update failure:', loggingError);
                    }
                    throw new Error('Failed to update user role');
                }

                const updatedUser = await updateRoleResponse.json();
                console.log('[Admin Management] Role updated successfully:', updatedUser);

                // Log successful role change
                try {
                    console.log('[Admin Management] About to log successful role change activity');
                    await logAdminActivity({
                        adminUserId: userData.id,
                        adminName: currentUser.name,
                        adminRole: currentUser.role,
                        activityType: 'role_change',
                        targetUserId: targetUserId,
                        targetUserName: targetUser.name,
                        oldValue: `${targetUser.role} (Level ${targetUser.role_hierarchy_level || 1})`,
                        newValue: `${newRole.toLowerCase()} (Level ${newHierarchyLevel})`,
                        reason: reason,
                        success: true
                    });
                    console.log('[Admin Management] Role change activity logged successfully');
                } catch (loggingError) {
                    console.error('[Admin Management] CRITICAL: Failed to log role change activity:', loggingError);
                    console.error('[Admin Management] Role change was successful but logging failed - this is the core issue!');
                    // Don't fail the entire operation if logging fails, but make sure we know about it
                }

                result = updatedUser[0];
                break;

            case 'get_system_logs':
                console.log('[Admin Management] Processing get_system_logs action');
                
                // Log admin access to system logs
                try {
                    await logAdminActivity({
                        adminUserId: userData.id,
                        adminName: currentUser.name,
                        adminRole: currentUser.role,
                        activityType: 'view_system_logs',
                        success: true
                    });
                } catch (loggingError) {
                    console.warn('[Admin Management] Failed to log view_system_logs activity:', loggingError);
                }

                // Get comprehensive activity logs from multiple sources (latest 10)
                const [adminLogsRes, userLogsRes, usersRes2] = await Promise.all([
                    fetch(`${supabaseUrl}/rest/v1/admin_activity_logs?select=*&order=created_at.desc&limit=10`, {
                        headers: {
                            'Authorization': `Bearer ${serviceRoleKey}`,
                            'apikey': serviceRoleKey
                        }
                    }),
                    fetch(`${supabaseUrl}/rest/v1/user_activity_logs?select=*&order=created_at.desc&limit=10`, {
                        headers: {
                            'Authorization': `Bearer ${serviceRoleKey}`,
                            'apikey': serviceRoleKey
                        }
                    }),
                    fetch(`${supabaseUrl}/rest/v1/users?select=id,name,email,role`, {
                        headers: {
                            'Authorization': `Bearer ${serviceRoleKey}`,
                            'apikey': serviceRoleKey
                        }
                    })
                ]);

                const adminLogs = adminLogsRes.ok ? await adminLogsRes.json() : [];
                const userLogs = userLogsRes.ok ? await userLogsRes.json() : [];
                const usersMap = usersRes2.ok ? await usersRes2.json() : [];

                console.log('[Admin Management] Raw logs data:', {
                    adminLogs: adminLogs.slice(0, 2), // Log first 2 for debugging
                    userLogs: userLogs.slice(0, 2),
                    usersMapCount: usersMap.length
                });

                console.log('[Admin Management] Logs counts:', {
                    adminLogs: adminLogs.length,
                    userLogs: userLogs.length
                });

                // Create user lookup map
                const userLookup = usersMap.reduce((acc, user) => {
                    acc[user.id] = user;
                    return acc;
                }, {});

                console.log('[Admin Management] User lookup sample:', {
                    userLookupKeys: Object.keys(userLookup).slice(0, 3),
                    sampleUser: Object.values(userLookup)[0]
                });

                // Format and combine all activities
                let allActivities = [];

                // Format admin activities
                adminLogs.forEach(log => {
                    // Create meaningful action descriptions
                    let actionDescription = 'Unknown Action';
                    if (log.activity_type) {
                        switch (log.activity_type) {
                            case 'role_change':
                                actionDescription = `Changed user role from ${log.old_value || 'unknown'} to ${log.new_value || 'unknown'}`;
                                break;
                            case 'view_system_stats':
                                actionDescription = 'Viewed system statistics';
                                break;
                            case 'view_system_logs':
                                actionDescription = 'Viewed system activity logs';
                                break;
                            case 'user_delete':
                                actionDescription = 'Deleted user account';
                                break;
                            case 'user_suspend':
                                actionDescription = 'Suspended user account';
                                break;
                            case 'user_activate':
                                actionDescription = 'Activated user account';
                                break;
                            default:
                                actionDescription = (log.activity_type).replace(/_/g, ' ').toUpperCase();
                        }
                    }

                    allActivities.push({
                        id: `admin_${log.id}`,
                        type: 'admin_activity',
                        timestamp: log.created_at,
                        action: actionDescription,
                        user_name: log.admin_name || userLookup[log.admin_user_id]?.name || 'Unknown Admin',
                        user_role: log.admin_role || 'admin',
                        target_name: log.target_user_name || null,
                        details: {
                            old_value: log.old_value,
                            new_value: log.new_value,
                            reason: log.reason,
                            success: log.success,
                            ip_address: log.ip_address
                        },
                        severity: log.success ? 'info' : 'warning'
                    });
                });

                // Format user activities
                userLogs.forEach(log => {
                    // Create meaningful action descriptions
                    let actionDescription = 'Unknown Action';
                    if (log.activity_type) {
                        switch (log.activity_type) {
                            case 'signin':
                                actionDescription = 'Signed in to the platform';
                                break;
                            case 'profile_update':
                                actionDescription = 'Updated profile information';
                                break;
                            case 'resource_post':
                                actionDescription = 'Posted a new resource';
                                break;
                            case 'resource_view':
                                actionDescription = 'Viewed a resource';
                                break;
                            case 'request_create':
                                actionDescription = 'Created a new request';
                                break;
                            case 'request_approve':
                                actionDescription = 'Approved a request';
                                break;
                            case 'request_reject':
                                actionDescription = 'Rejected a request';
                                break;
                            case 'message_sent':
                                actionDescription = 'Sent a message';
                                break;
                            default:
                                actionDescription = (log.activity_type).replace(/_/g, ' ').toUpperCase();
                        }
                    }

                    allActivities.push({
                        id: `user_${log.id}`,
                        type: 'user_activity',
                        timestamp: log.created_at,
                        action: actionDescription,
                        user_name: userLookup[log.user_id]?.name || 'Unknown User',
                        user_role: userLookup[log.user_id]?.role || 'user',
                        target_name: null,
                        details: log.details || {},
                        severity: 'info'
                    });
                });

                // Sort all activities by timestamp (most recent first)
                allActivities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

                console.log('[Admin Management] Final formatted activities:', {
                    totalActivities: allActivities.length,
                    sampleActivity: allActivities[0], // Log first activity for debugging
                    activityActions: allActivities.slice(0, 5).map(a => a.action) // Log first 5 actions
                });

                result = {
                    activities: allActivities.slice(0, 10), // Show only latest 10 activities
                    total: allActivities.length,
                    summary: {
                        admin_activities: adminLogs.length,
                        user_activities: userLogs.length
                    }
                };
                break;

            default:
                throw new Error(`Unknown action: ${action}`);
        }

        return new Response(JSON.stringify({ 
            success: true,
            data: result,
            message: `Admin ${action} completed successfully`
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('[Admin Management] Error:', error);
        return new Response(JSON.stringify({
            error: {
                code: 'ADMIN_MANAGEMENT_ERROR',
                message: error.message
            }
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});