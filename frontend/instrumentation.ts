// Runs once when each server instance starts, before it handles requests.
export async function register() {
  // The /report/results metadata fetch (app/report/results/page.tsx) runs in
  // a Node.js Vercel Function; drop the compromised eMudhra CA roots from
  // Node's default CA list before it makes any outbound request.
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { removeCompromisedEmudhraRoots } = await import('./lib/emudhra-ca-roots');
    removeCompromisedEmudhraRoots();
  }
}
