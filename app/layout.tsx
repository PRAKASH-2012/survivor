import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'NEON RIFT — Ranked Arcade',description:'Sign in, dodge hazards, collect energy and climb the Neon Rift leaderboard.',icons:{icon:'/favicon.svg',shortcut:'/favicon.svg'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en" className="dark"><body>{children}</body></html>}
