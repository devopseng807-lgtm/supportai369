import { getStore } from '@netlify/blobs';

export default async (req, context) => {
  
  // 1. CHECK: Only accept POST (n8n sending data)
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  // 2. RECEIVE: Get the data n8n sent
  const { requestId, report } = await req.json();
  
  if (!requestId || !report) {
    return new Response(JSON.stringify({ error: 'Missing requestId or report' }), { status: 400 });
  }

  // 3. FIND: Locate the order in the notebook
  const store = getStore('supportai-requests');
  const existing = await store.get(requestId);
  
  if (!existing) {
    return new Response(JSON.stringify({ error: 'Request not found' }), { status: 404 });
  }

  // 4. UPDATE: Mark it as ready and save the report
  const data = JSON.parse(existing);
  data.status = 'ready';           // Change from "processing" to "ready"
  data.report = report;            // Save the research results
  data.updatedAt = new Date().toISOString();
  
  await store.set(requestId, JSON.stringify(data));

  // 5. CONFIRM: Tell n8n "Got it, thanks!"
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
