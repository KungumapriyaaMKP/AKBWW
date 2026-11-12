# Deployment Guide | Anirudh & Kavya Wedding Website

This website is a zero-dependency, ultra-luxury static experience engineered for **instant load (0ms perceived wait)**, **60fps hardware-accelerated scroll animations**, and **full mobile responsiveness**.

---

## 🚀 Instant Deployment Options

### Option 1: Vercel (Recommended)
1. Install Vercel CLI (or connect via GitHub):
   ```bash
   npm i -g vercel
   vercel
   ```
2. Press `Enter` to accept defaults.
3. The included `vercel.json` automatically configures:
   - 1-year immutable caching on `frames_opt/**` and `images/**`
   - Clean URLs
   - Security headers

---

### Option 2: Netlify (Drag & Drop or Git)
1. **Drag & Drop**:
   - Go to [app.netlify.com/drop](https://app.netlify.com/drop)
   - Drag and drop this folder (`d:\Sumya\Bridal\AK`).
2. **Git**:
   - Push to GitHub/GitLab and link repository in Netlify.
   - Build command: *(leave empty)*
   - Publish directory: `.`
3. Netlify automatically reads `netlify.toml`, `_headers`, and `_redirects`.
4. RSVP submissions are automatically collected in the **Netlify Forms** dashboard.

---

### Option 3: GitHub Pages
1. Push this repository to GitHub:
   ```bash
   git add .
   git commit -m "Production deployment ready"
   git push origin main
   ```
2. In your GitHub repository:
   - Go to **Settings** > **Pages**.
   - Source: **Deploy from a branch** (`main` or `master` / root `/`).
   - Click **Save**.
3. The included `.nojekyll` file ensures all assets are served directly without Jekyll filtering.

---

### Option 4: Cloudflare Pages
1. Log in to [dash.cloudflare.com](https://dash.cloudflare.com) > **Workers & Pages**.
2. Select **Create application** > **Pages** > **Connect to Git** (or Direct Upload).
3. Build command: *(none)*
4. Output directory: `.`
5. Cloudflare Pages automatically honors `_headers` for edge caching.

---

## 📦 Production File Manifest
- `index.html`: Main celebration page (preloaded Frame 0, SEO, Open Graph & Twitter Cards)
- `styles.css`: Hardware-accelerated luxury stylesheet with mobile responsiveness
- `script.js`: Zero-reflow scroll pipeline & staged frame streaming
- `frames_opt/`: 362 optimized continuous drone frames (29.2 MB total)
- `images/`: High-clarity optimized couple portraits and gallery assets
- `wedding-music.mp3`: Ambient ceremony soundtrack
- `favicon.svg`, `favicon.ico`, `apple-touch-icon.png`: Multi-device branding
- `site.webmanifest`: Progressive Web App mobile manifest
- `404.html`: Cohesive luxury error page
- `robots.txt` & `sitemap.xml`: Production search engine discovery
- `vercel.json`, `netlify.toml`, `_headers`, `_redirects`: Multi-host deployment rules
- `.nojekyll`: GitHub Pages bypass rule
- `.gitignore`: Production repository hygiene rule
