import Arcade from './arcade';
export const dynamic='force-dynamic';
// Account data and scores are protected by the server-side API, not this empty UI shell.
export default function Play(){return <Arcade signOutPath='/'/>;}
