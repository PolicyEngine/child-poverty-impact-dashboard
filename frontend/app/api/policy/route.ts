import { NextResponse } from 'next/server';

// Proxy for api.policyengine.org/us/policy. The browser-side call hits
// inconsistent CORS preflight behaviour from some networks, even though
// PE's API does return the right Access-Control-Allow-Origin header.
// Going through this route keeps the request server-to-server.
export async function POST(req: Request) {
  const body = await req.text();
  const upstream = await fetch('https://api.policyengine.org/us/policy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: { 'Content-Type': 'application/json' },
  });
}
