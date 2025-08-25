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
        // Get request body
        const { action, requestData, requestId, status } = await req.json();

        // Get Supabase environment variables
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        const supabaseUrl = Deno.env.get('SUPABASE_URL');

        if (!serviceRoleKey || !supabaseUrl) {
            throw new Error('Supabase configuration missing');
        }

        // Get user from auth header
        const authHeader = req.headers.get('authorization');
        if (!authHeader) {
            throw new Error('Authentication required');
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
            throw new Error('Invalid authentication token');
        }

        const userData = await userResponse.json();
        const userId = userData.id;

        let responseData = {};

        switch (action) {
            case 'create_request': {
                if (!requestData?.resource_id) {
                    throw new Error('Resource ID is required');
                }

                // Check if resource exists and is available
                const resourceResponse = await fetch(`${supabaseUrl}/rest/v1/resources?id=eq.${requestData.resource_id}&select=*`, {
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey
                    }
                });

                if (!resourceResponse.ok) {
                    throw new Error('Failed to verify resource');
                }

                const resources = await resourceResponse.json();
                if (!resources || resources.length === 0) {
                    throw new Error('Resource not found');
                }

                const resource = resources[0];
                
                // Check if user is trying to request their own resource
                if (resource.user_id === userId) {
                    throw new Error('Cannot request your own resource');
                }

                // Check if resource is available
                if (!resource.is_available) {
                    throw new Error('Resource is not available');
                }

                // Check if user already has a pending or approved request for this resource
                const existingRequestResponse = await fetch(`${supabaseUrl}/rest/v1/requests?requester_id=eq.${userId}&resource_id=eq.${requestData.resource_id}&status=in.(pending,approved)&select=id`, {
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey
                    }
                });

                if (!existingRequestResponse.ok) {
                    throw new Error('Failed to check existing requests');
                }

                const existingRequests = await existingRequestResponse.json();
                if (existingRequests && existingRequests.length > 0) {
                    throw new Error('You already have a pending or approved request for this resource');
                }

                // Create the request
                const createResponse = await fetch(`${supabaseUrl}/rest/v1/requests`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=representation'
                    },
                    body: JSON.stringify({
                        requester_id: userId,
                        resource_id: requestData.resource_id,
                        message: requestData.message || '',
                        status: 'pending',
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    })
                });

                if (!createResponse.ok) {
                    const errorText = await createResponse.text();
                    throw new Error(`Failed to create request: ${errorText}`);
                }

                const createdRequest = await createResponse.json();
                responseData = { request: createdRequest[0] };
                break;
            }

            case 'update_request_status': {
                if (!requestId || !status) {
                    throw new Error('Request ID and status are required');
                }

                if (!['approved', 'rejected', 'completed'].includes(status)) {
                    throw new Error('Invalid status');
                }

                // Get the request and verify ownership
                const requestResponse = await fetch(`${supabaseUrl}/rest/v1/requests?id=eq.${requestId}&select=*,resources!inner(user_id)`, {
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey
                    }
                });

                if (!requestResponse.ok) {
                    throw new Error('Failed to fetch request');
                }

                const requests = await requestResponse.json();
                if (!requests || requests.length === 0) {
                    throw new Error('Request not found');
                }

                const request = requests[0];
                
                // Verify that the current user owns the resource
                if (request.resources.user_id !== userId) {
                    throw new Error('You can only update requests for your own resources');
                }

                // Update the request status
                const updateResponse = await fetch(`${supabaseUrl}/rest/v1/requests?id=eq.${requestId}`, {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=representation'
                    },
                    body: JSON.stringify({
                        status: status,
                        updated_at: new Date().toISOString()
                    })
                });

                if (!updateResponse.ok) {
                    const errorText = await updateResponse.text();
                    throw new Error(`Failed to update request: ${errorText}`);
                }

                const updatedRequest = await updateResponse.json();
                responseData = { request: updatedRequest[0] };
                break;
            }

            case 'cancel_request': {
                if (!requestId) {
                    throw new Error('Request ID is required');
                }

                // Get the request and verify ownership
                const requestResponse = await fetch(`${supabaseUrl}/rest/v1/requests?id=eq.${requestId}&select=*`, {
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey
                    }
                });

                if (!requestResponse.ok) {
                    throw new Error('Failed to fetch request');
                }

                const requests = await requestResponse.json();
                if (!requests || requests.length === 0) {
                    throw new Error('Request not found');
                }

                const request = requests[0];
                
                // Verify that the current user is the requester
                if (request.requester_id !== userId) {
                    throw new Error('You can only cancel your own requests');
                }

                // Only allow cancelling pending requests
                if (request.status !== 'pending') {
                    throw new Error('Only pending requests can be cancelled');
                }

                // Update to rejected status (cancelled by requester)
                const updateResponse = await fetch(`${supabaseUrl}/rest/v1/requests?id=eq.${requestId}`, {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=representation'
                    },
                    body: JSON.stringify({
                        status: 'rejected', // Mark as rejected when cancelled
                        updated_at: new Date().toISOString()
                    })
                });

                if (!updateResponse.ok) {
                    const errorText = await updateResponse.text();
                    throw new Error(`Failed to cancel request: ${errorText}`);
                }

                const cancelledRequest = await updateResponse.json();
                responseData = { request: cancelledRequest[0] };
                break;
            }

            case 'delete_request': {
                if (!requestId) {
                    throw new Error('Request ID is required');
                }

                // Get the request and verify ownership
                const requestResponse = await fetch(`${supabaseUrl}/rest/v1/requests?id=eq.${requestId}&select=*`, {
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey
                    }
                });

                if (!requestResponse.ok) {
                    throw new Error('Failed to fetch request');
                }

                const requests = await requestResponse.json();
                if (!requests || requests.length === 0) {
                    throw new Error('Request not found');
                }

                const request = requests[0];
                
                // Verify that the current user is the requester
                if (request.requester_id !== userId) {
                    throw new Error('You can only delete your own requests');
                }

                // Delete the request
                const deleteResponse = await fetch(`${supabaseUrl}/rest/v1/requests?id=eq.${requestId}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey
                    }
                });

                if (!deleteResponse.ok) {
                    const errorText = await deleteResponse.text();
                    throw new Error(`Failed to delete request: ${errorText}`);
                }

                responseData = { success: true };
                break;
            }

            case 'clear_past_requests': {
                // Clear completed and rejected requests for current user's resources
                
                // First get user's resources
                const userResourcesResponse = await fetch(`${supabaseUrl}/rest/v1/resources?user_id=eq.${userId}&select=id`, {
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey
                    }
                });

                if (!userResourcesResponse.ok) {
                    throw new Error('Failed to fetch user resources');
                }

                const userResources = await userResourcesResponse.json();
                if (!userResources || userResources.length === 0) {
                    responseData = { deletedCount: 0 };
                    break;
                }

                const resourceIds = userResources.map(r => r.id);

                // Delete completed and rejected requests for user's resources
                const deleteResponse = await fetch(`${supabaseUrl}/rest/v1/requests?resource_id=in.(${resourceIds.join(',')})&status=in.(completed,rejected)`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey,
                        'Prefer': 'return=minimal'
                    }
                });

                if (!deleteResponse.ok) {
                    const errorText = await deleteResponse.text();
                    throw new Error(`Failed to clear past requests: ${errorText}`);
                }

                // Return success with count (we can't get exact count from minimal return, but operation succeeded)
                responseData = { success: true, message: 'Past requests cleared successfully' };
                break;
            }

            default:
                throw new Error(`Unknown action: ${action}`);
        }

        // Return success response
        return new Response(JSON.stringify({ data: responseData }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Request management error:', error);

        const errorResponse = {
            error: {
                code: 'REQUEST_MANAGEMENT_ERROR',
                message: error.message
            }
        };

        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
