export default async (req) => {
  // Simple test that always returns JSON
  return new Response(
    JSON.stringify({ 
      message: "Test function is working!", 
      method: req.method,
      timestamp: new Date().toISOString()
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }
  );
};
