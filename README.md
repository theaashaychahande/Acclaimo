# Acclaimo

Acclaimo is a free way to hand out event certificates. An organizer shares one link, students type their name, and the certificate is generated on their own device.

## What it does

- One private link per organization, showing all of its live events
- Name lookup that ignores extra spaces, capitalization, and reversed first and last names
- Certificates downloaded on the student's device
- Works on phones, including the in-app browser inside WhatsApp
- No ads, no student sign-up, and no cost to run

## Privacy

Names are cleaned up and hashed in the browser before anything is sent to the server, so what gets stored is a hash rather than a list of names. There is no public participant list, and one organization cannot see another's data.

Hashing makes a stolen database hard to read, but it does not make names secret. Someone who knows a student's name can still look up that person's certificate. Acclaimo is a distribution tool, not an identity check.

## Project status

Phase 1 is complete: the foundation, design system, landing page, and route stubs are in place. The organizer and student flows are being built next, so the forms and lookups on those pages are not connected to a backend yet.

Phase 2 is complete: the shared normalization and hashing core is tested, and a locked-down Supabase backend foundation is in place. Names are normalized (unicode NFC → trim → lowercase → letters/marks/whitespace only → collapse spaces → sort → join), hashed with a per-organization salt, and protected by row-level security and narrow rate-limited RPCs. Participants are stored only as hashes; categories and position text are readable.