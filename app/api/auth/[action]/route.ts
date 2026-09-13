import {authenticate,AuthError,gameUser,signOut} from '@/lib/username-auth';
export const dynamic='force-dynamic';
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(request:Request){if(!new URL(request.url).pathname.endsWith('/me'))return reply({error:'Not found.'},404);try{const user=await gameUser();return reply({authenticated:!!user,username:user?.username??null});}catch{return reply({error:'Login is temporarily unavailable. Please try again.'},503);}}
export async function POST(request:Request){
 const url=new URL(request.url);if(request.headers.get('origin')!==url.origin)return reply({error:'Request origin is not allowed.'},403);
 try{const action=url.pathname.split('/').pop();if(action==='logout'){await signOut();return reply({ok:true,next:'/'});}if(action!=='login'&&action!=='signup')return reply({error:'Not found.'},404);
 if(Number(request.headers.get('content-length')??0)>4096)return reply({error:'Request too large.'},413);const text=await request.text();if(text.length>4096)return reply({error:'Request too large.'},413);
 await authenticate(action,JSON.parse(text),request);return reply({ok:true,next:'/play'});
 }catch(e){if(e instanceof AuthError)return reply({error:e.message},e.status);if(e instanceof SyntaxError)return reply({error:'Invalid request.'},400);console.error('Username authentication operation failed');return reply({error:'Login is temporarily unavailable. Please try again.'},503);}
}
