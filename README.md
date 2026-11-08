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

Phase 1 is complete: the foundation, design system, landing page, and route stubs are in place.

Phase 2 is complete: the shared normalization and hashing core is tested, and a locked-down Supabase backend foundation is in place. Names are normalized (unicode NFC → trim → lowercase → letters/marks/whitespace only → collapse spaces → sort → join), hashed with a per-organization salt, and protected by row-level security and narrow rate-limited RPCs. Participants are stored only as hashes; categories and position text are readable.

The organizer and student flows now work end to end against the live database: create an organization, save the one-time edit key, log in, create events and categories, add participants with optional position text, publish, share the link, look up a name, and download the certificate. Pausing, extending, and deleting an event, plus the download and not-found counters, are wired too.

Organizers can now upload their own certificate image for each category and drag the name and position boxes directly on it. Images are compressed in the browser, stored in a private bucket, and only served for live events; drafts are previewed through a short-lived signed URL. Categories without an image still fall back to the built-in design.

Phase 4 is complete: organizers can import a CSV or Excel list of up to 5,000 rows and 2 MB. The file is parsed, validated, and hashed in the browser, so names never leave the device. Columns are detected automatically (Name, Identifier, Category, Position) and can be corrected, every category value is mapped to an existing, new, or default category, and per-category counts are shown before anything is saved. An import can append to or atomically replace the list; a failed replace leaves the old list untouched. Blank names, duplicate names, unknown categories, and overlong position text are reported before upload. Organizers can also rename, reorder, and choose the default category, and update or remove one person by name without re-importing. The paste box remains for quick additions.

The platform admin console at `/admin` is live: unlock it with the admin secret, see organization and category counts (never participant names), disable or enable a link, delete an organization, or issue a new edit key. Retention cleanup, security notes, operations notes, the keep-alive workflow, and the Vercel security headers are in place. Remaining work is device testing and the real pilot.
