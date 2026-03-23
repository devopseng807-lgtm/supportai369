// Same import to access the notebook
import { getStore } from '@netlify/blobs';

export default async (req, context) => {
  
  // 1. GET: What order number is the website asking about?
  const url = new URL(req.url);
  const requestId = url.searchParams.get('id');  // Gets ?id=123 from the URL
  
  if (!requestId) {
    return new Response(JSON.stringify({ error: 'Missing id' }), { status: 400 });
  }

  // 2. LOOK: Find that order in the notebook
  const store = getStore('supportai-requests');
  const stored = await store.get(requestId);
  
  if (!stored) {
    return new Response(JSON.stringify({ error: 'Request not found' }), { status: 404 });
  }

  // 3. READ: What's the status? (processing or ready?)
  const data = JSON.parse(stored);
  
  // 4. REPLY: Tell the website the status
  return new Response(JSON.stringify({
    status: data.status,    // "processing" or "ready"
    report: data.report,    // If ready, this contains the research
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
