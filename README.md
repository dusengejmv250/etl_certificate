# ETL Certificate Portal

A certificate management system for **École Technique Libre (ETL)** —
secretaries add students, head teachers manage academic profiles and sign
(or invite others to sign) certificates, and anyone can verify a certificate
by scanning its QR code.

**Stack:** Node.js + Express + MySQL + EJS (server-rendered) + Nodemailer
(real email) + local disk storage for signature images.

---

## 1. Prerequisites

- Node.js 18+ and npm
- A MySQL server (local install, or a free-tier hosted one — see §6)
- An email account to send from (Gmail App Password works fine for a small school — see §3)

---

## 2. Install and configure

```bash
cd etl-certificate-portal
npm install
cp .env.example .env
```

Open `.env` and fill in:

| Variable | What it is |
|---|---|
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Your MySQL connection details |
| `SESSION_SECRET` | Any long random string — generate with the command shown in `.env.example` |
| `SMTP_*`, `EMAIL_FROM` | Your email sending credentials (see §3) |
| `BASE_URL` | The public URL of your deployed app (use `http://localhost:3000` while testing locally) |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` | The administrator account that gets created automatically on first migration |

---

## 3. Setting up real email (Gmail example)

1. Turn on 2-Step Verification on the Gmail account you'll send from.
2. Go to Google Account → Security → **App passwords**, create one for "Mail".
3. Use that 16-character app password as `SMTP_PASSWORD` (not your normal Gmail password).
4. Set:
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=465
   SMTP_SECURE=true
   SMTP_USER=youraddress@gmail.com
   SMTP_PASSWORD=your16charapppassword
   EMAIL_FROM="École Technique Libre <youraddress@gmail.com>"
   ```

Any other SMTP provider (Zoho, Outlook, SendGrid, Mailgun, your own school
mail server) works the same way — just change the host/port/credentials.

---

## 4. Set up the database

Create an empty database and a user for the app:

```sql
CREATE DATABASE etl_certificate_portal;
CREATE USER 'etl_app'@'localhost' IDENTIFIED BY 'choose_a_strong_password';
GRANT ALL PRIVILEGES ON etl_certificate_portal.* TO 'etl_app'@'localhost';
FLUSH PRIVILEGES;
```

Match these credentials in your `.env` file, then run the migration, which
creates all tables **and** seeds your administrator account:

```bash
npm run migrate
```

You should see:
```
Connected to MySQL. Applying schema...
Schema applied (or already up to date).
Administrator account created: drmarvinltd@gmail.com
Migration complete.
```

This is safe to run again later (e.g. after pulling schema changes) — it
won't duplicate the admin account or error on existing tables.

---

## 5. Run it

```bash
npm run dev      # auto-restarts on file changes, good for development
# or
npm start        # plain node, good for production
```

Visit `http://localhost:3000`. Log in as Administrator using the
`ADMIN_EMAIL` / `ADMIN_PASSWORD` you set in `.env`.

---

## 6. Deploying for real

You need somewhere that can run a persistent Node.js process (not a
static host) plus a MySQL database reachable from it. Reasonable options:

- **Railway** or **Render** — both can host the Node app and a MySQL
  database together, with a free/cheap starter tier. Push this folder to a
  GitHub repo, connect it, set the same environment variables from `.env` in
  their dashboard, and they'll run `npm install && npm start` for you.
- **A VPS** (DigitalOcean, Linode, a Rwandan hosting provider, etc.) — install
  Node and MySQL yourself, use `pm2` to keep the app running, and put Nginx
  in front for HTTPS via Let's Encrypt.
- **Shared hosting with Node support** — some providers (e.g. some cPanel
  setups) support Node apps directly; check they also offer MySQL.

Whichever you choose:
1. Set `NODE_ENV=production` and `BASE_URL` to your real domain.
2. Make sure cookies work over HTTPS (the session cookie is marked `secure`
   in production — see `server.js` — so the site **must** be served over
   HTTPS once `NODE_ENV=production`, or logins will silently fail).
3. Re-run `npm run migrate` once, pointed at the production database.
4. Signature images are stored in `public/uploads/signatures/` on disk —
   make sure your hosting plan has **persistent storage** (some platforms
   wipe the filesystem on every deploy; if so, mount a persistent volume at
   that path, or see the note below on swapping to cloud storage later).

---

## 7. How the certificate signing flow works

1. **Secretary** adds a student (name, level, graduation date, assigned head
   teacher) → creates a draft certificate for them.
2. **Head teacher** opens the certificate, can:
   - Sign it themselves (using the signature they saved under "My signature"), and/or
   - Invite other people (e.g. a district education officer) to co-sign —
     this sends a **real email** with a unique link.
3. Each invited co-signer opens their link (no account needed), types their
   name and role, and draws or uploads a signature. The background is
   automatically stripped so it looks hand-signed on the printed certificate.
4. Once **everyone** required has signed, the certificate status flips to
   `issued` and the red wax-seal graphic activates.
5. Anyone — parents, employers, other schools — can scan the certificate's
   QR code (or visit `/verify/<id>` directly) to see a public verification
   page showing only the academic fields the head teacher marked **public**.

---

## 8. Known limitations to know about

- **Signature background removal** uses a simple corner-sampling color-key
  technique (`lib/stripBackground.js`, via the `sharp` library). It works
  well for signatures photographed/scanned against plain, evenly-lit paper.
  Heavily shadowed photos or lined paper may leave faint artifacts. If this
  becomes a problem at scale, consider swapping in a dedicated
  background-removal API (e.g. remove.bg) inside that same file.
- **File storage is local disk.** This is simplest to set up, but means
  signature images live on whichever server is running the app. If you ever
  move to a multi-server or serverless deployment, you'd want to swap
  `public/uploads/` for a cloud bucket (S3, Cloudinary, etc.) — the rest of
  the app doesn't need to change, just `middleware/upload.js` and
  `lib/stripBackground.js`'s output path.
- **QR codes encode a URL**, not the certificate data itself — scanning
  requires the verifying device to have internet access to reach `BASE_URL`.
- **No automated backups** are configured for MySQL — set up routine
  `mysqldump` backups (or your hosting provider's managed backup feature)
  once this is handling real student records.

---

## 9. Project structure

```
config/db.js              MySQL connection pool
controllers/              Route handler logic, one file per role/area
lib/                       Email, QR code, signature processing, ID helpers
middleware/                Auth/role guards, file upload config
migrations/                SQL schema + the script that applies it & seeds admin
models/                    Plain SQL data access layer (no ORM)
public/                    CSS, client-side JS, uploaded signature images
routes/                    Express routers, one per role/area
views/                     EJS templates, organized by role
server.js                  App entry point
```
