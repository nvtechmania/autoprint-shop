# NV Shop QuickPrint — v12

## What's new — PVC Card section overhaul

### No more cropping or adjustments — uploaded as-is
Per your request, PVC Card front/back uploads now skip the crop and
brightness/contrast steps entirely. Whatever the customer uploads
(JPG, PNG, or PDF) goes straight onto the card layout exactly as
uploaded -- no auto-cropping, no filters applied. You said you'll
handle any cleanup yourself on the admin side, so the website now gets
out of the way completely for this section.

### Quality preserved for HD printing
- PDF pages are now rendered at a much higher internal resolution
  specifically for PVC cards (4x scale instead of the previous 2x),
  producing noticeably crisper output for text and fine card details.
- The final card layout is now composited at 300dpi A4 resolution
  (2480x3508px) instead of the previous 150dpi (1240x1754px) used for
  documents -- this matters a lot for small card text staying sharp.
- The PDF that reaches your dashboard now embeds PVC card images as
  lossless PNG instead of compressed JPEG -- no quality loss from
  recompression at all. (Documents and ID cards still use efficient
  JPEG compression, since this quality jump is specifically needed for
  PVC card printing.)

### Password-protected PDFs — unchanged, already working
This was already in place from v8 and continues to work the same way:
if a customer uploads a locked PDF anywhere (including PVC Card), a
password prompt appears immediately, and the file that reaches your
dashboard is a freshly unlocked, print-ready PDF -- you never need the
password yourself.

## Deploying this update
1. Unzip this v12 folder fresh
2. Terminal inside it:
     git init
     git add .
     git commit -m "v12: PVC card no-crop/no-adjust, HD quality, lossless PNG export"
     git branch -M main
     git remote add origin https://github.com/nvtechmania/autoprint-shop.git
     git push -u origin main --force
3. Render auto-redeploys (check the Events tab)

## Everything else (Document/ID Card crop editors, retailer pricing,
additional charges, env-var rate overrides, Razorpay, UPI QR, /prints/
dashboard slug, magnifier fix, full-width crop, edge handles, A4
auto-fit) is unchanged from v11.
