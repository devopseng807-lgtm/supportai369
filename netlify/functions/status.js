import { neon } from '@neondatabase/serverless';

export default async (req, context) => {
  // 1. Parse query parameters
  const url = new URL(req.url);
  const requestId = url.searchParams.get('id');

  if (!requestId) {
    return new Response(JSON.stringify({ error: 'Missing id parameter' }), { status: 400 });
  }

  // 2. Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(requestId)) {
    return new Response(JSON.stringify({ error: 'Invalid id format' }), { status: 400 });
  }

  // 3. Connect to Neon PostgreSQL
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL not set');
    return new Response(JSON.stringify({ error: 'Database configuration error' }), { status: 500 });
  }

  const sql = neon(databaseUrl);

  try {
    // Query the database for this request
    const rows = await sql`
      SELECT status, report FROM requests WHERE id = ${requestId}
    `;
    
    if (rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Request not found' }), { status: 404 });
    }
    
    const { status, report } = rows[0];
    
    return new Response(JSON.stringify({
      status,
      report,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Database query error:', err);
    return new Response(JSON.stringify({ error: 'Database error' }), { status: 500 });
  }
};
