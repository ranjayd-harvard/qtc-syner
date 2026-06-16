# EC2 Deployment Guide

## Prerequisites

- EC2 instance running **Ubuntu** (22.04 or 24.04 recommended)
- Your SSH key pair (`.pem` file)
- A GitHub remote for this repo
- Gemini API key (for the AI features)

---

## 1. EC2 Security Group

Open these inbound ports in the AWS console before connecting:

| Port | Protocol | Purpose |
|------|----------|---------|
| 22   | TCP      | SSH |
| 80   | TCP      | HTTP (if using nginx) |
| 3061 | TCP      | Direct app access |

---

## 2. SSH into EC2

If you get a "Host key verification failed" error (IP changed), clear the stale entry first:

```bash
ssh-keygen -R <old-ip>
ssh -i ~/path/to/keypair.pem ubuntu@<EC2_PUBLIC_IP>
```

---

## 3. Install Docker

```bash
sudo apt-get update
sudo apt-get install -y docker.io docker-compose-plugin
sudo systemctl enable --now docker
sudo usermod -aG docker ubuntu
newgrp docker                    # apply group without logout
docker compose version           # verify
```

---

## 4. Clone the repo

```bash
cd ~
git clone <your-repo-url> qtc-syncer
cd qtc-syncer
```

---

## 5. Create the `.env` file

```bash
cp .env.example .env
nano .env
```

Fill in every value — generate secrets with the commands shown:

```env
# MongoDB
MONGO_ROOT_USER=admin
MONGO_ROOT_PASSWORD=<strong-password>

# Encryption — generate: openssl rand -hex 32
ENCRYPTION_KEY=<64-char-hex>

# Internal service auth — generate: openssl rand -hex 32
CONNECTOR_INTERNAL_KEY=<64-char-hex>

# NextAuth — generate: openssl rand -base64 32
NEXTAUTH_SECRET=<base64-string>
NEXTAUTH_URL=http://<EC2_PUBLIC_IP>:3061    # use your actual IP or domain

# Admin login
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=<strong-password>

# Gemini AI
GEMINI_API_KEY=<your-gemini-key>
GEMINI_MODEL=gemini-2.5-flash

# Port
WEB_PORT=3061
```

> `NEXTAUTH_URL` must match the URL you open in your browser exactly (including port).

---

## 6. Build and start

```bash
docker compose up -d --build
```

First build takes 5–10 minutes. Watch progress with:

```bash
docker compose logs -f web
```

The app is ready when you see `Listening on port 3000` in the web logs.

---

## 7. Seed the admin user (first time only)

The database starts empty. Run this once to create the admin account from your `.env` values:

```bash
export $(grep -v '^#' .env | xargs)

docker run --rm \
  --network qtc-syncer_qtc-internal \
  -e MONGODB_URI="mongodb://${MONGO_ROOT_USER}:${MONGO_ROOT_PASSWORD}@mongodb:27017/qtc_syncer?authSource=admin" \
  -e ADMIN_EMAIL="${ADMIN_EMAIL}" \
  -e ADMIN_PASSWORD="${ADMIN_PASSWORD}" \
  node:20-alpine sh -c "
    npm install -q --prefix /tmp bcryptjs mongodb 2>/dev/null
    node -e \"
      const bcrypt = require('/tmp/node_modules/bcryptjs');
      const { MongoClient } = require('/tmp/node_modules/mongodb');
      const uri = process.env.MONGODB_URI;
      const email = process.env.ADMIN_EMAIL;
      const pass = process.env.ADMIN_PASSWORD;
      bcrypt.hash(pass, 12).then(hash =>
        MongoClient.connect(uri).then(client =>
          client.db('qtc_syncer').collection('users').updateOne(
            { email },
            { \\\$set: { email, passwordHash: hash, name: 'Admin', updatedAt: new Date() }, \\\$setOnInsert: { createdAt: new Date() } },
            { upsert: true }
          ).then(r => { console.log(r.upsertedCount > 0 ? 'Admin created' : 'Admin updated'); client.close(); })
        )
      )
    \"
  "
```

Expected output: `Admin created`

---

## 8. Access the app

Open `http://<EC2_PUBLIC_IP>:3061` and log in with your `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

---

## Optional: nginx reverse proxy (port 80)

Avoids exposing port 3061 directly and makes the URL cleaner.

```bash
sudo apt-get install -y nginx
```

Create `/etc/nginx/sites-available/qtc-syncer`:

```nginx
server {
    listen 80;
    server_name <EC2_PUBLIC_IP>;

    location / {
        proxy_pass http://localhost:3061;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/qtc-syncer /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl enable --now nginx
```

Then update `.env`:
```env
NEXTAUTH_URL=http://<EC2_PUBLIC_IP>    # no port
```

And restart the web container:
```bash
docker compose restart web
```

---

## Updating the app

```bash
git pull
docker compose up -d --build
```

Data is preserved in the `mongodb_data` Docker volume across rebuilds.

---

## Useful commands

```bash
# View all logs
docker compose logs -f

# View only web logs
docker compose logs -f web

# Restart a single service
docker compose restart web

# Stop everything
docker compose down

# Stop and wipe MongoDB data (destructive!)
docker compose down -v

# Check running containers
docker compose ps
```

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Web container crashes on start | `docker compose logs web` — usually a missing or wrong env var |
| Can't reach the app in browser | Check EC2 security group has port 3061 (or 80) open |
| MongoDB auth failure | `MONGO_ROOT_USER`/`MONGO_ROOT_PASSWORD` in `.env` must match the values used when MongoDB was first started. If you change them, run `docker compose down -v` to wipe the volume and start fresh. |
| Login fails after seeding | Verify `NEXTAUTH_URL` matches the exact URL in your browser (including or excluding port) |
| Host key verification failed on SSH | Run `ssh-keygen -R <old-ip>` then reconnect |
