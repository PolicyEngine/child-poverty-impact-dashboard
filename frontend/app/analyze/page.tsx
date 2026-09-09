import { redirect } from 'next/navigation';

// The legacy analyze experience (statewide "coming soon" + old household
// results with placeholder metrics) predates the report wizard. Send
// visitors to the supported flow instead of exposing the unfinished path.
export default function Page() {
  redirect('/');
}
