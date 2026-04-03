export async function GET() {
  const html = `<!DOCTYPE html>
<html><body style="background:#111;color:#fff;padding:40px;font-family:sans-serif">
<h1>Speed Test</h1>
<p>If this loads instantly, the Navbar is the bottleneck.</p>
<p>Rendered at: ${new Date().toISOString()}</p>
</body></html>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html' } });
}
