// Public distribution builds need both settings. Never print key values in diagnostics.
const url=process.env.VITE_SUPABASE_URL?.trim(), key=process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
if(!url || !key) throw new Error('Native first login requires repository variables VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY. Local-only migration tests do not require them.');
const parsed=new URL(url);
if(parsed.protocol!=='https:' || parsed.username || parsed.password || parsed.search || parsed.hash || !['','/'].includes(parsed.pathname) || !key.startsWith('sb_publishable_')) throw new Error('Use an HTTPS Supabase project URL and a publishable public key. Secret/service_role keys are forbidden.');
console.log('Native public Auth configuration present and validated (values hidden).');
