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
        // Inspirational quotes about community, sharing, and collaboration - exact same as Java
        const quotes = [
            { text: "The best way to find yourself is to lose yourself in the service of others.", author: "Mahatma Gandhi" },
            { text: "Alone we can do so little; together we can do so much.", author: "Helen Keller" },
            { text: "Community is not a place, a building, or an organization; nor is it an exchange of information over the Internet. Community is both a feeling and a set of relationships among people.", author: "John McKnight" },
            { text: "We make a living by what we get, but we make a life by what we give.", author: "Winston Churchill" },
            { text: "Sharing is caring, but more than that, sharing is healing.", author: "Jaeda DeWalt" },
            { text: "The currency of real networking is not greed but generosity.", author: "Keith Ferrazzi" },
            { text: "We rise by lifting others.", author: "Robert Ingersoll" },
            { text: "Collaboration allows teachers to capture each other's fund of collective intelligence.", author: "Mike Schmoker" },
            { text: "If you want to go fast, go alone. If you want to go far, go together.", author: "African Proverb" },
            { text: "The strength of the team is each individual member. The strength of each member is the team.", author: "Phil Jackson" },
            { text: "Great things in business are never done by one person; they're done by a team of people.", author: "Steve Jobs" },
            { text: "Unity is strength... when there is teamwork and collaboration, wonderful things can be achieved.", author: "Mattie Stepanek" },
            { text: "Cooperation is the thorough conviction that nobody can get there unless everybody gets there.", author: "Virginia Burden" },
            { text: "The magic happens when we come together as a community to solve problems and support each other.", author: "Unknown" },
            { text: "Sharing knowledge is not about giving people something, or getting something from them. That is only valid for information sharing. Sharing knowledge occurs when people are genuinely interested in helping one another develop new capacities for action.", author: "Peter Senge" }
        ];

        const requestData = await req.json();
        const action = requestData.action || 'random';

        let result;

        switch (action) {
            case 'random':
                if (quotes.length === 0) {
                    result = { text: "No quotes available", author: "System" };
                } else {
                    const randomIndex = Math.floor(Math.random() * quotes.length);
                    result = quotes[randomIndex];
                }
                break;
            
            case 'all':
                result = {
                    quotes: quotes,
                    count: quotes.length
                };
                break;
            
            case 'stats':
                result = {
                    totalQuotes: quotes.length,
                    categories: "Community & Collaboration",
                    lastUpdated: Date.now()
                };
                break;
            
            default:
                // Default to random quote
                const randomIndex = Math.floor(Math.random() * quotes.length);
                result = quotes[randomIndex];
                break;
        }

        return new Response(JSON.stringify({ 
            success: true,
            data: result,
            message: `Quote ${action} operation completed successfully`
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Quote generator error:', error);

        const errorResponse = {
            error: {
                code: 'QUOTE_GENERATOR_ERROR',
                message: error.message
            }
        };

        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});