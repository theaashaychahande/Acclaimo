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

Phase 1 is complete: the foundation, design system, landing page, and route stubs are in place. The organizer and student flows are being built next, so the forms and lookups on those pages are not connected to a backend yet.

## Running it locally

You need Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open the URL that Vite prints, usually `http://localhost:5173`.

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the local development server |
| `npm run build` | Type-check and build for production into `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm run typecheck` | Run TypeScript checks without building |

## Design system

The colours, type scale, spacing, and UI controls live on a single internal page at `/design`. It is for development and is not linked from the public navigation. The page is the quickest way to see how a button, form field, badge, or overlay should look and behave before using it in the product.

## How it's built

A React and TypeScript frontend built with Vite, styled with Tailwind CSS and a small set of design tokens. Routing is handled by React Router. The production site is static, so it can be hosted for free.

The interface uses warm paper tones, near-black ink, and one deep teal accent. Headings use Source Serif 4 and body text uses Public Sans. Dark mode, reduced motion, and keyboard navigation are supported throughout.

The landing page and route stubs are built with performance in mind: no heavy client libraries, no stock imagery, and a small bundle.

## Deployment

`npm run build` produces a static site in `dist/`. Serve that folder from any static host. Because routing is handled in the browser, configure the host to fall back to `index.html` for unknown paths.

## Contributing

This started as a personal project for one college, but it is open to anyone organizing events. Bug reports and suggestions are welcome through issues. If you want to use it for an event, open an issue and say so.

## License

MIT. See [LICENSE](LICENSE).
