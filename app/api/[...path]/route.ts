import {gameUser} from '@/lib/username-auth';
import {database} from '../../../db';
export const dynamic='force-dynamic';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
async function handle(request:Request){
 try{
 const user=await gameUser();if(!user)return json({error:'Sign in to continue.'},401);
 const url=new URL(request.url),path=url.pathname,db=database();
 if(request.method==='POST'&&request.headers.get('origin')!==url.origin)return json({error:'Request origin is not allowed.'},403);
 const profile=await db.prepare('SELECT id,nickname FROM players WHERE user_id=?').bind(user.userId).first();
 if(path==='/api/profile'&&request.method==='GET')return json({profile});
 if(path==='/api/profile'&&request.method==='POST'){
 const b=await request.json() as any;const nickname=typeof b.nickname==='string'?b.nickname.trim():'';
 if(!/^[\p{L}\p{N} _-]{3,20}$/u.test(nickname))return json({error:'Use 3–20 letters, numbers, spaces, underscores or hyphens.'},400);
 await db.prepare('INSERT INTO players (user_id,id,nickname,created_at) VALUES (?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET nickname=excluded.nickname').bind(user.userId,crypto.randomUUID(),nickname,Date.now()).run();return json({ok:true});}
 if(!profile)return json({error:'Choose your player name first.'},409);
 if(path==='/api/leaderboard'&&request.method==='GET'){
 const page=Math.max(1,Math.min(100000,Number(url.searchParams.get('page'))||1));if(!Number.isInteger(page))return json({error:'Invalid page.'},400);
 const cte='WITH scores AS (SELECT p.id,p.nickname,MAX(r.score) AS best,COUNT(r.score) AS runs,MAX(r.duration_ms) AS longest FROM players p JOIN runs r ON r.user_id=p.user_id WHERE r.score IS NOT NULL GROUP BY p.user_id), ranked AS (SELECT *,RANK() OVER (ORDER BY best DESC) AS rank FROM scores) ';
 const [board,mine,count]=await db.batch([db.prepare(cte+'SELECT * FROM ranked ORDER BY best DESC,id ASC LIMIT 20 OFFSET ?').bind((page-1)*20),db.prepare(cte+'SELECT * FROM ranked WHERE id=?').bind(profile.id),db.prepare('SELECT COUNT(DISTINCT user_id) AS total FROM runs WHERE score IS NOT NULL')]);
 return json({players:board.results,mine:mine.results[0]??{...profile,best:0,runs:0,rank:null,longest:0},total:count.results[0]?.total??0,page});}
 if(path==='/api/runs/start'&&request.method==='POST'){
 const recent=await db.prepare('SELECT started_at FROM runs WHERE user_id=? ORDER BY started_at DESC LIMIT 1').bind(user.userId).first<{started_at:number}>();if(recent&&Date.now()-recent.started_at<1000)return json({error:'Please wait a moment before starting again.'},429);
 const id=crypto.randomUUID();await db.prepare('INSERT INTO runs (id,user_id,started_at) VALUES (?,?,?)').bind(id,user.userId,Date.now()).run();return json({id});}
 if(path==='/api/runs/finish'&&request.method==='POST'){
 const b=await request.json() as any;
 if(typeof b.id!=='string'||!Number.isInteger(b.durationMs)||!Number.isInteger(b.coins)||b.durationMs<0||b.durationMs>21600000||b.coins<0)return json({error:'Invalid run result.'},400);
 const run=await db.prepare('SELECT started_at,score,duration_ms,coins FROM runs WHERE id=? AND user_id=?').bind(b.id,user.userId).first<any>();if(!run)return json({error:'Run not found for this account.'},404);
 if(run.score!==null){if(run.duration_ms!==b.durationMs||run.coins!==b.coins)return json({error:'This run already has a different result.'},409);return json({score:run.score,saved:true});}
 if(b.durationMs>Date.now()-run.started_at+1000||b.coins>Math.floor((b.durationMs/1000+.9)/1.25)+1)return json({error:'The run could not be validated. Start a new run.'},400);
 const score=Math.floor(b.durationMs/100)+b.coins*50;
 await db.prepare('UPDATE runs SET score=?,duration_ms=?,coins=?,finished_at=? WHERE id=? AND user_id=? AND score IS NULL').bind(score,b.durationMs,b.coins,Date.now(),b.id,user.userId).run();return json({score,saved:true});}
 return json({error:'Not found.'},404);
 }catch(e){console.error('Neon Rift API error',e);if(e instanceof SyntaxError)return json({error:'Invalid request.'},400);return json({error:'Scores are temporarily unavailable. Please try again.'},503);}
}
export const GET=handle;export const POST=handle;
