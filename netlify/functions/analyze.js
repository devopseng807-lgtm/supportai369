// Use require instead of import for better compatibility
const { neon } = require('@neondatabase/serverless');

export default async (req) => {
  // 1. Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    });
  }

  // 2. Only accept POST
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { 
        status: 405, 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        } 
      }
    );
  }

  // 3. Parse and validate input
  let body;
  try {
    body = await req.json();
  } catch (e) {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body', details: e.message }),
      { 
        status: 400, 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        } 
      }
    );
  }

  const { query } = body;

  if (!query || typeof query !== 'string') {
    return new Response(
      JSON.stringify({ error: 'query is required and must be a string' }),
      { 
        status: 400, 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        } 
      }
    );
  }

  const trimmed = query.trim();
  if (trimmed.length === 0) {
    return new Response(
      JSON.stringify({ error: 'query cannot be empty' }),
      { 
        status: 400, 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        } 
      }
    );
  }

  const sanitizedQuery = trimmed.substring(0, 500);
  const requestId = crypto.randomUUID();

  // 4. Try to connect to Neon database
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('DATABASE_URL not set');
    // Even if DB fails, return success so frontend doesn't error
    return new Response(
      JSON.stringify({
        requestId,
        company: sanitizedQuery,
        warning: 'Database not configured, running in demo mode'
      }),
      { 
        status: 200, 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        } 
      }
    );
  }

  try {
    // Create the SQL client
    const sql = neon(databaseUrl);
    
    // Insert into database
    await sql`
      INSERT INTO requests (id, query, status, created_at)
      VALUES (${requestId}, ${sanitizedQuery}, 'processing', NOW())
    `;
    
    console.log('Successfully inserted request:', requestId);
    
  } catch (dbError) {
    console.error('Database error:', dbError.message);
    // Still return success but with warning
    return new Response(
      JSON.stringify({
        requestId,
        company: sanitizedQuery,
        warning: 'Database error: ' + dbError.message
      }),
      { 
        status: 200, 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        } 
      }
    );
  }

  // 5. Trigger n8n webhook (optional)
  const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
  if (n8nWebhookUrl) {
    fetch(n8nWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestId,
        query: sanitizedQuery,
        callbackUrl: `${process.env.URL}/api/webhook`,
      }),
    }).catch(err => console.error('Failed to call n8n:', err));
  }

  // 6. Return success response
  return new Response(
    JSON.stringify({
      success: true,
      requestId,
      company: sanitizedQuery,
    }),
    { 
      status: 200, 
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      } 
    }
  );
};
