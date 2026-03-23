const { neon } = require('@neondatabase/serverless');

export default async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    });
  }

  // Parse query parameters
  const url = new URL(req.url);
  const requestId = url.searchParams.get('id');

  if (!requestId) {
    return new Response(
      JSON.stringify({ error: 'Missing id parameter' }),
      { 
        status: 400, 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        } 
      }
    );
  }

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(requestId)) {
    return new Response(
      JSON.stringify({ error: 'Invalid id format' }),
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
      JSON.stringify({ status: 'processing', report: null, warning: 'Database not configured' }),
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
    const sql = neon(databaseUrl);
    const rows = await sql`
      SELECT status, report FROM requests WHERE id = ${requestId}
    `;
    
    if (rows.length === 0) {
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
    
    const { status, report } = rows[0];
    
    return new Response(
      JSON.stringify({ status, report }),
      { 
        status: 200, 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        } 
      }
    );
  } catch (err) {
    console.error('Database error:', err);
    return new Response(
      JSON.stringify({ status: 'processing', report: null, error: err.message }),
      { 
        status: 200, 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        } 
      }
    );
  }
};
