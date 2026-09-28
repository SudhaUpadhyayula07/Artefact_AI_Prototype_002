# Deploying Artefact.AI to Google Cloud Run and Attaching a Custom Domain

This guide explains how to deploy Artefact.AI to Google Cloud Run and configure a custom domain with HTTPS and proper environment variables.

---

## 1. Prerequisites

1. A Google Cloud project with billing enabled.
2. A registered domain name where you can edit DNS records.
3. A Gemini API key from Google AI Studio.

---

## 2. Deploying to Cloud Run from Google AI Studio

1. Open your project in Google AI Studio.
2. Click **Deploy to Cloud Run** in the top bar.
3. Select or create your target Google Cloud project and choose a region (for example, `asia-southeast1`, `us-central1`, or `europe-west1`).
4. Wait for the build and deployment to finish. Cloud Run will provide a default service URL ending in `.run.app`.

### Deploying via Google Cloud CLI (Alternative)

If you prefer deploying from a terminal:

```bash
gcloud run deploy artefact-ai \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --port 3000
```

---

## 3. Setting Environment Variables on Cloud Run

Artefact.AI reads all configuration from server-side environment variables. The API key is never included in the browser bundle.

1. Open the [Google Cloud Console - Cloud Run](https://console.cloud.google.com/run).
2. Click your service (`artefact-ai`).
3. Click **Edit and deploy new revision**.
4. Open the **Variables & Secrets** tab and set the following environment variables:

| Variable | Value | Description |
|---|---|---|
| `GEMINI_API_KEY` | Your Gemini API Key | Required for server-side extraction, analysis, generation, and validation. |
| `GEMINI_MODEL` | `gemini-3.8-flash` | Model used by the server pipeline. |
| `PUBLIC_SITE_URL` | `https://your-domain.com` | Canonical URL used for Open Graph tags, `sitemap.xml`, and `robots.txt`. |
| `APP_URL` | `https://your-service.run.app` | Fallback service URL if `PUBLIC_SITE_URL` is not set. |
| `CONTACT_EMAIL` | `ops@your-domain.com` | Contact address shown in the footer and Terms page. |
| `NODE_ENV` | `production` | Enables static asset serving from `dist`. |

5. Click **Deploy** to apply the revision.

---

## 4. Attaching a Custom Domain

You can attach a custom domain using either **Cloud Run Domain Mapping** (simplest for supported regions) or **Google Cloud Global External Application Load Balancer** (recommended for global CDN and any region).

### Option A: Cloud Run Domain Mapping

1. In the Cloud Run console, click **Manage Custom Domains** at the top of the services list.
2. Click **Add Mapping**.
3. Select your Cloud Run service (`artefact-ai`), choose your verified domain, and specify the subdomain (or root domain).
4. Cloud Run will display the exact DNS records to add at your DNS registrar:
   - **For a subdomain (for example, `app.your-domain.com`):**
     - Type: `CNAME`
     - Name / Host: `app`
     - Value / Target: `ghs.googlehosted.com.`
   - **For an apex / root domain (for example, `your-domain.com`):**
     - Add the four `A` records (`216.239.32.21`, `216.239.34.21`, `216.239.36.21`, `216.239.38.21`) and four `AAAA` records (`2001:4860:4802:32::15`, `2001:4860:4802:34::15`, `2001:4860:4802:36::15`, `2001:4860:4802:38::15`) shown in the console.
5. Save the DNS records at your registrar.
6. **HTTPS Provisioning:** Google Cloud automatically provisions and renews a managed TLS/SSL certificate once DNS propagation completes (typically 15 to 45 minutes).

### Option B: Global External Application Load Balancer

1. Reserve a global static IPv4 (and optional IPv6) address in **VPC Network > IP Addresses**.
2. Create a **Serverless NEG (Network Endpoint Group)** pointing to your Cloud Run service.
3. Create an **HTTPS Load Balancer**:
   - Backend service: attach the Serverless NEG.
   - Frontend configuration: select the reserved static IP, protocol `HTTPS` (port 443), and create a **Google-managed SSL certificate** for your domain name.
4. At your DNS registrar, add an `A` record pointing your domain to the load balancer's static IPv4 address.
5. Wait 15 to 30 minutes for the managed SSL certificate status to change to `ACTIVE`.

---

## 5. Persistent Ledger Note

By default, Artefact.AI writes the local tamper-evident hash chain to `data/ledger.json`. On Cloud Run, container instances have an ephemeral filesystem unless a volume is mounted. To persist `data/ledger.json` across container restarts on Cloud Run:

1. Create a Cloud Storage bucket in the same region.
2. In your Cloud Run service settings, go to **Volumes**, add a **Cloud Storage bucket** volume, and mount it at `/app/data` (or the `data` directory in your working path).
