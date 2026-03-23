// Import Neon PostgreSQL client
import { neon } from '@neondatabase/serverless';

// Helper: Rate limiter (per IP) - uses Netlify Blob for simplicity
// If you don't want rate limiting yet, you can remove this part
async function checkRateLimit(ip) {
  try {
    const store = getStore('rate-limits');
    const key = `analyze:${ip}`;
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute
    const maxRequests = 10;     // 10 requests per minute

    const record = await store.get(key);
    let count = 1;
    let windowStart = now;

    if (record) {
      const data = JSON.parse(record);
      if (now - data.windowStart < windowMs) {
        count = data.count + 1;
        windowStart = data.windowStart;
      }
    }

    if (count > maxRequests) {
      return { limited: true, retryAfter: Math.ceil((windowStart + windowMs - now) / 1000) };
    }

    await store.set(key, JSON.stringify({ count, windowStart }));
    return { limited: false };
  } catch (err) {
    // If rate limiting fails, allow the request (fail open)
    console.warn('Rate limiter error:', err);
    return { limited: false };
  }
}

// Main function
export default async (req, context) => {
  // 1. Rate limiting (optional - if you have blob store for rate limits)
  // const clientIp = context.ip || req.headers['x-forwarded-for'] || 'unknown';
  // const rate = await checkRateLimit(clientIp);
  // if (rate.limited) {
  //   return new Response(
  //     JSON.stringify({ error: 'Too many requests. Please try again later.' }),
  //     { status: 429, headers: { 'Retry-After': rate.retryAfter.toString() } }
  //   );
  // }

  // 2. Method check
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  // 3. Input validation
  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 });
  }

  const { query } = body;

  // Check required field and type
  if (typeof query !== 'string') {
    return new Response(JSON.stringify({ error: 'query must be a string' }), { status: 400 });
  }

  const trimmed = query.trim();
  if (trimmed.length === 0) {
    return new Response(JSON.stringify({ error: 'query cannot be empty' }), { status: 400 });
  }
  if (trimmed.length > 500) {
    return new Response(JSON.stringify({ error: 'query exceeds 500 characters' }), { status: 400 });
  }

  // Reject any unexpected fields
  const allowedKeys = ['query'];
  const extraKeys = Object.keys(body).filter(k => !allowedKeys.includes(k));
  if (extraKeys.length) {
    return new Response(JSON.stringify({ error: `Unexpected fields: ${extraKeys.join(', ')}` }), { status: 400 });
  }

  // Basic sanitization
  const sanitizedQuery = trimmed.replace(/[\x00-\x1F\x7F]/g, '');

  // 4. Create request ID
  const requestId = crypto.randomUUID();

  // 5. Connect to Neon PostgreSQL
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL not set');
    return new Response(JSON.stringify({ error: 'Database configuration error' }), { status: 500 });
  }

  const sql = neon(databaseUrl);

  try {
    // Insert the request into the database
    await sql`
      INSERT INTO requests (id, query, status, created_at)
      VALUES (${requestId}, ${sanitizedQuery}, 'processing', NOW())
    `;
  } catch (err) {
    console.error('Database insert error:', err);
    return new Response(JSON.stringify({ error: 'Database error' }), { status: 500 });
  }

  // 6. Call n8n webhook (asynchronously)
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
    }).catch(err => console.error('Failed to call n8n', err));
  }

  // 7. Return response
  return new Response(JSON.stringify({
    requestId,
    company: sanitizedQuery,
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
