import {env} from 'cloudflare:workers';
export function database(){if(!env.DB)throw new Error('Leaderboard database unavailable');return env.DB;}
