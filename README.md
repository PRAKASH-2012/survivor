# Survivor

An arcade survival game with username/password accounts, persistent score cards and a shared leaderboard.

## Play
Sign up with a unique username, password and password confirmation. Log in using that username and password. Usernames are case-insensitive, 3–20 letters, digits or underscores. Passwords require at least 10 characters and at most 72 UTF-8 bytes. No email, email verification, SMTP or ChatGPT account is required. Password recovery is not available.

Move using WASD, arrow keys or touch. Space activates dash; P pauses. Finish a run to save your score and refresh your rank.

## Rankings
Each player appears once using their best completed score. Equal scores share the same rank. The board supports pages of 20 players. Existing scores remain stored, but new username accounts are separate from previous authentication accounts; accounts are not automatically merged.

## Runtime and authentication
Vinext on Cloudflare Workers with D1 profiles, runs, accounts and sessions. Passwords use bcrypt with cost 12. Random session tokens use Secure, HttpOnly, SameSite=Lax cookies and expire after seven days; only token hashes are stored. Logout revokes the session. Signup and login have IP and username rate limits, and authentication writes require a matching request origin. App authentication is separate from Sites audience access.

Run records are scoped to the authenticated player. Finishing a run is idempotent. Scores are calculated from submitted play duration and collected energy, with elapsed-time and collection bounds. This is a casual leaderboard, not a server-simulated, cheat-proof competition.

## Development
Use the declared pnpm version and lockfile. Run `pnpm dev` for development and `pnpm build` for production. Define schema in `db/schema.ts` and generate migrations using `pnpm db:generate`. The logical DB binding is in `.openai/hosting.json`. Run `node tests/username-auth.cjs` for authentication integration checks against in-memory SQLite with the real migrations and password hashing.

## Live game

[Play Survivor (currently branded NEON RIFT)](https://neon-rift-prakash.prakash-20.chatgpt.site).

This repository contains the full application source. Authentication and shared rankings require the Cloudflare Worker and D1 database; GitHub Pages alone cannot host those features.
