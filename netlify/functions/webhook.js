import { neon } from '@neondatabase/serverless';

export default async (req, context) => {
  // 1. API key authentication
  const apiKey = req.headers['x-api-key'];
  const expectedKey = process.env.N8N_WEBHOOK_SECRET;
  
  if (!expectedKey || apiKey !== expectedKey) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  // 2. Method and content type
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  // 3. Validate payload
  let payload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 });
  }

  const { requestId, report } = payload;

  if (!requestId || typeof requestId !== 'string') {
    return new Response(JSON.stringify({ error: 'Missing or invalid requestId' }), { status: 400 });
  }
  if (!report || typeof report !== 'object') {
    return new Response(JSON.stringify({ error: 'Missing or invalid report (must be object)' }), { status: 400 });
  }

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(requestId)) {
    return new Response(JSON.stringify({ error: 'Invalid requestId format' }), { status: 400 });
  }

  // Reject unexpected fields
  const allowedKeys = ['requestId', 'report'];
  const extraKeys = Object.keys(payload).filter(k => !allowedKeys.includes(k));
  if (extraKeys.length) {
    return new Response(JSON.stringify({ error: `Unexpected fields: ${extraKeys.join(', ')}` }), { status: 400 });
  }

  // 4. Connect to Neon PostgreSQL
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL not set');
    return new Response(JSON.stringify({ error: 'Database configuration error' }), { status: 500 });
  }

  const sql = neon(databaseUrl);

  try {
    // First check if request exists
    const existing = await sql`SELECT id FROM requests WHERE id = ${requestId}`;
    if (existing.length === 0) {
      return new Response(JSON.stringify({ error: 'Request not found' }), { status: 404 });
    }

    // Update status and report
    await sql`
      UPDATE requests
      SET status = 'ready', 
          report = ${JSON.stringify(report)}::jsonb, 
          updated_at = NOW()
      WHERE id = ${requestId}
    `;

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Database update error:', err);
    return new Response(JSON.stringify({ error: 'Database error' }), { status: 500 });
  }
};
