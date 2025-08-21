# GitHub Pages Setup Instructions

## Automatic Setup
The GitHub Pages deployment should happen automatically via the GitHub Actions workflow. Once the workflow completes, your privacy policy will be available at:

**Privacy Policy URL:** `https://yigal.github.io/bookmarkable/privacy-policy.html`

## Manual Setup (if needed)
If the automatic setup doesn't work, follow these steps:

1. Go to your GitHub repository: https://github.com/Yigal/bookmarkable
2. Click on **Settings** tab
3. Scroll down to **Pages** section in the left sidebar
4. Under **Source**, select:
   - Source: "Deploy from a branch"
   - Branch: `main`
   - Folder: `/ (root)` or `/docs` 
5. Click **Save**

## Verification
1. Wait 5-10 minutes for deployment
2. Visit: https://yigal.github.io/bookmarkable/privacy-policy.html
3. Confirm the privacy policy loads correctly

## For Chrome Web Store Submission
Use this URL in the Chrome Web Store privacy policy field:
```
https://yigal.github.io/bookmarkable/privacy-policy.html
```

## Files Created
- `docs/privacy-policy.html` - HTML formatted privacy policy
- `docs/index.html` - Landing page for the documentation site
- `.github/workflows/pages.yml` - GitHub Actions workflow for automatic deployment