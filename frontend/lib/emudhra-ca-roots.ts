import { X509Certificate } from 'node:crypto';
import tls from 'node:tls';

// Vercel Functions still run Node.js 24.21.0 and 22.23.2, which trust the
// compromised eMudhra root "emSign ECC Root CA - G3" (and Sectigo's
// "AAA Certificate Services", which cross-signed the affected intermediates).
// Remove both from Node's default CA list before any outbound request.
// Delete this once Vercel Functions run Node.js 24.22.1 / 22.23.4 or later.
// See https://emudhra.we-have-a-problem.com.
const COMPROMISED_ROOT_COMMON_NAMES = ['emSign ECC Root CA - G3', 'AAA Certificate Services'];

// The project's @types/node (20.x) has no declarations for these two
// functions, which Node.js 20 lacks (they exist on the Node.js 22 and 24
// releases Vercel runs). Declare them as optional, matching the runtime
// check below.
type TlsDefaultCaListFunctions = {
  getCACertificates?: (type: 'default') => string[];
  setDefaultCACertificates?: (certificates: string[]) => void;
};
const tlsCaList = tls as typeof tls & TlsDefaultCaListFunctions;

export function removeCompromisedEmudhraRoots(): void {
  if (
    typeof tlsCaList.getCACertificates !== 'function' ||
    typeof tlsCaList.setDefaultCACertificates !== 'function'
  ) {
    return;
  }
  const trusted = tlsCaList.getCACertificates('default').filter((pem) => {
    const subjectFields = new X509Certificate(pem).subject.split('\n');
    return !COMPROMISED_ROOT_COMMON_NAMES.some((name) => subjectFields.includes('CN=' + name));
  });
  tlsCaList.setDefaultCACertificates(trusted);
}
