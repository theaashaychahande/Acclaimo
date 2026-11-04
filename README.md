# Acclaimo

Acclaimo is a free way to hand out event certificates. An organizer shares one link, students type their name, and the certificate is generated on their own device.

The usual routine after a college event is making hundreds of certificates by hand, renaming every file, and sending them out one by one on WhatsApp. Acclaimo replaces that with a single link and a name lookup. Students don't need an account, and organizers don't have to touch any files after uploading the participant list.

## What it does

- One private link per organization, showing all of its live events
- Name lookup that ignores extra spaces, capitalization, and reversed first and last names
- Certificates downloaded as a PDF or an image
- Works on phones, including the in-app browser inside WhatsApp
- No ads, no student sign-up, and no cost to run

## How it works

**Organizers** create an organization, upload the participant list and a certificate template, then place the name field on the design. Publishing gives them a share link and a ready-to-send WhatsApp message.

**Students** open the link, enter their full name, and download the certificate if it is on the list. When a name is not found, the page explains what to check and shows the organizer's contact details.

## Privacy

Names are cleaned up and hashed in the browser before anything is sent to the server, so what gets stored is a hash rather than a list of names. There is no public participant list, and one organization cannot see another's data.

Hashing makes a stolen database hard to read, but it does not make names secret. Someone who knows a student's name can still look up that person's certificate. Acclaimo is a distribution tool, not an identity check.

## Project status

Early development. The core flows and edge cases are planned, and the first build is in progress.

There is nothing to install or run yet. Setup instructions will be added once the first working version is deployed.

## How it's built

A static frontend and a small serverless backend, with the certificates drawn in the student's browser. Everything is kept inside free hosting limits.

## Contributing

This started as a personal project for one college, but it is open to anyone organizing events. Bug reports and suggestions are welcome through issues. If you want to use it for an event, open an issue and say so.

## License

MIT. See [LICENSE](LICENSE).
