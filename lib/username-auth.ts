import bcrypt from 'bcryptjs';
import {cookies} from 'next/headers';
import {database} from '@/db';
const COOKIE='__Host-neon_session';
const TTL=7*24*60*60;
const encoder=new TextEncoder();
export function normalizeUsername(value:unknown){return typeof value==='string'?value.trim().toLowerCase():'';}
export function validUsername(value:string){return /^[a-z0-9_]{3,20}$/.test(value);}
export function validPassword(value:unknown):value is string{return typeof value==='string'&&value.length>=10&&encoder.encode(value).length<=72;}
export async function digest(value:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value))),x=>x.toString(16).padStart(2,'0')).join('');}
export async function gameUser(){const jar=await cookies();const token=jar.get(COOKIE)?.value;if(!token||!/^[a-f0-9]{64}$/.test(token))return null;return database().prepare('SELECT a.user_id AS userId,a.username FROM sessions s JOIN accounts a ON a.user_id=s.user_id WHERE s.token_hash=? AND s.expires_at>?').bind(await digest(token),Date.now()).first<{userId:string;username:string}>();}
async function setSession(userId:string){const jar=await cookies(),db=database();const token=Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');const old=jar.get(COOKIE)?.value;const statements=[db.prepare('INSERT INTO sessions (token_hash,user_id,expires_at) VALUES (?,?,?)').bind(await digest(token),userId,Date.now()+TTL*1000),db.prepare('DELETE FROM sessions WHERE expires_at<=?').bind(Date.now()),db.prepare('DELETE FROM auth_limits WHERE expires_at<=?').bind(Date.now())];if(old)statements.push(db.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await digest(old)));await db.batch(statements);jar.set(COOKIE,token,{httpOnly:true,secure:true,sameSite:'lax',path:'/',maxAge:TTL});}
export async function signOut(){const jar=await cookies(),token=jar.get(COOKIE)?.value;if(token)await database().prepare('DELETE FROM sessions WHERE token_hash=?').bind(await digest(token)).run();jar.set(COOKIE,'',{httpOnly:true,secure:true,sameSite:'lax',path:'/',maxAge:0});}
export class AuthError extends Error{constructor(message:string,public status=400){super(message);}}
async function throttle(key:string,limit:number,period:number){const now=Date.now();const row=await database().prepare('INSERT INTO auth_limits (key,attempts,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN auth_limits.expires_at<=? THEN 1 ELSE auth_limits.attempts+1 END,expires_at=CASE WHEN auth_limits.expires_at<=? THEN excluded.expires_at ELSE auth_limits.expires_at END RETURNING attempts').bind(await digest(key),now+period,now,now).first<{attempts:number}>();if(!row||row.attempts>limit)throw new AuthError('Too many attempts. Please wait 15 minutes and try again.',429);}
// Bcrypt comparison for unknown users keeps login work similar to a real account.
const DUMMY_HASH='$2b$12$6rf/trU4JYVllFwqmH/uaOxzZ3.VhXd0f72ErEXMisiBFHKtKUHCm';
export async function authenticate(action:string,input:unknown,request:Request){
 if(!input||typeof input!=='object')throw new AuthError('Invalid request.');
 const b=input as Record<string,unknown>,username=normalizeUsername(b.username),password=b.password;
 if(!validUsername(username))throw new AuthError(action==='signup'?'Use 3–20 letters, numbers or underscores.':'Username or password is incorrect.');
 if(!validPassword(password))throw new AuthError(action==='signup'?'Use at least 10 characters, up to 72 UTF-8 bytes.':'Username or password is incorrect.');
 if(action==='signup'&&b.confirmPassword!==password)throw new AuthError('Passwords do not match.');
 // This trusted edge header is only used for throttling, never identity or authorization.
 const ip=request.headers.get('cf-connecting-ip')??'unknown';
 await throttle(action+':ip:'+ip,action==='signup'?30:80,15*60*1000);
 await throttle(action+':username:'+username,action==='signup'?6:12,15*60*1000);
 const db=database();const account=await db.prepare('SELECT user_id,password_hash FROM accounts WHERE username=?').bind(username).first<{user_id:string;password_hash:string}>();
 if(action==='signup'){
 if(account)throw new AuthError('This username is taken. Try another.',409);
 const userId='username:'+crypto.randomUUID(),hash=await bcrypt.hash(password,12),now=Date.now();
 try{await db.batch([db.prepare('INSERT INTO players (user_id,id,nickname,created_at) VALUES (?,?,?,?)').bind(userId,crypto.randomUUID(),username,now),db.prepare('INSERT INTO accounts (user_id,username,password_hash,created_at) VALUES (?,?,?,?)').bind(userId,username,hash,now)]);}catch(e){if(String(e).includes('UNIQUE'))throw new AuthError('This username is taken. Try another.',409);throw e;}
 await setSession(userId);return;
 }
 const matches=await bcrypt.compare(password,account?.password_hash??DUMMY_HASH);
 if(!account||!matches)throw new AuthError('Username or password is incorrect.',401);
 await setSession(account.user_id);
}
