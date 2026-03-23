const { neon } = require('@neondatabase/serverless');

export default async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
      }
    });
  }

  // API key authentication
  const apiKey = req.headers['x-api-key'];
  const expectedKey = process.env.N8N_WEBHOOK_SECRET;
  
  if (expectedKey && apiKey !== expectedKey) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { 
        status: 401, 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        } 
      }
    );
  }

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

  let payload;
  try {
    payload = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body' }),
      { 
        status: 400, 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        } 
      }
    );
  }

  const { requestId, report } = payload;

  if (!requestId || !report) {
    return new Response(
      JSON.stringify({ error: 'Missing requestId or report' }),
      { 
        status: 400, 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        } 
      }
    );
  }

  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    return new Response(
      JSON.stringify({ error: 'Database not configured' }),
      { 
        status: 500, 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        } 
      }
    );
  }

  try {
    const sql = neon(databaseUrl);
    
    const existing = await sql`SELECT id FROM requests WHERE id = ${requestId}`;
    if (existing.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Request not found' }),
        { 
          status: 404, 
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          } 
        }
      );
    }

    await sql`
      UPDATE requests
      SET status = 'ready', 
          report = ${JSON.stringify(report)}::jsonb, 
          updated_at = NOW()
      WHERE id = ${requestId}
    `;

    return new Response(
      JSON.stringify({ success: true }),
      { 
        status: 200, 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        } 
      }
    );
  } catch (err) {
    console.error('Webhook error:', err);
    return new Response(
      JSON.stringify({ error: 'Database error', details: err.message }),
      { 
        status: 500, 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        } 
      }
    );
  }
};
