# NV Shop QuickPrint — v8

## What's new
- **PDF password detection**: anywhere a PDF can be uploaded (Document
  tab, PVC Card, Other File), if it's password-protected, a popup asks
  for the password immediately and unlocks it client-side. The file
  that reaches your admin dashboard is always a freshly rebuilt,
  unlocked PDF (rasterized from the unlocked pages) -- you never need
  the password to open/print it.
- **PDF page preview + page selection (Other File tab)**: upload a PDF
  and it auto-detects the real page count, lets the customer type which
  pages to print (e.g. "1,3,5-8"), and shows a live A4-style preview of
  exactly those pages -- replacing the old "guess your page count"
  manual field. Price recalculates from the actual selected page count.
- **Same page-picker for Document tab**: uploading a multi-page PDF as
  a document page now asks which pages to include, then walks you
  through the normal crop/straighten/adjust flow for each one in turn.
- **Same single-page picker for PVC Card**: if a PDF design has
  multiple pages, you pick which one is this card's front/back.
- **Loading animation** during PDF preview rendering (spinner + "Loading
  preview..." text).
- **Preview always matches the chosen color mode** -- the same B&W/color
  toggle that affects photo previews now also applies to PDF page
  previews.
- Word/Excel/PowerPoint password-detection is NOT supported (no
  reliable way to do this in-browser) -- these still upload as-is via
  the Other File tab without page-preview, same as before.
- Retailer name "Abinash Kalita" renamed to "Abinash Talukdar".

## Deploying this update
1. Unzip this v8 folder fresh
2. Terminal inside it:
     git init
     git add .
     git commit -m "v8: PDF password handling, page preview/selection"
     git branch -M main
     git remote add origin https://github.com/nvtechmania/autoprint-shop.git
     git push -u origin main --force
3. Render auto-redeploys (check Events tab)

## Everything else (PVC/ID/Document editors, retailer pricing,
additional charges, env-var rate overrides, Razorpay, UPI QR) is
unchanged from v7.
