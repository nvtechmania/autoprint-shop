require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Razorpay = require('razorpay');
const { nanoid } = require('nanoid');

const app = express();
const PORT = process.env.PORT || 4000;

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || '';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';
const razorpayEnabled = RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET && !RAZORPAY_KEY_ID.includes('xxxx');

let razorpay = null;
if (razorpayEnabled) {
  razorpay = new Razorpay({ key_id: RAZORPAY_KEY_ID, key_secret: RAZORPAY_KEY_SECRET });
}

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
const DB_FILE = path.join(__dirname, 'db.json');

const DEFAULT_RATES = {
  bw_a4: 2,
  color_a4: 10,
  id_card_bw: 10,
  id_card_color: 20,
  pvc_retailer: 50,
  pvc_customer: 100,
  additionalChargeFlat: 0,
  additionalChargePercent: 0,
  upiId: ''
};

// Env vars always take priority over db.json — this is what survives free-tier
// hosting restarts/sleeps (where the filesystem resets). Set these in your
// Render dashboard's Environment tab for permanent pricing.
const ENV_RATE_KEYS = {
  RATE_BW_A4: 'bw_a4',
  RATE_COLOR_A4: 'color_a4',
  RATE_ID_BW: 'id_card_bw',
  RATE_ID_COLOR: 'id_card_color',
  RATE_PVC_RETAILER: 'pvc_retailer',
  RATE_PVC_CUSTOMER: 'pvc_customer',
  RATE_ADDITIONAL_FLAT: 'additionalChargeFlat',
  RATE_ADDITIONAL_PERCENT: 'additionalChargePercent',
  UPI_ID: 'upiId'
};
function envRateOverrides() {
  const overrides = {};
  for (const [envKey, rateKey] of Object.entries(ENV_RATE_KEYS)) {
    if (process.env[envKey] !== undefined && process.env[envKey] !== '') {
      overrides[rateKey] = rateKey === 'upiId' ? process.env[envKey] : parseFloat(process.env[envKey]);
    }
  }
  return overrides;
}

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify({ orders: [], rates: DEFAULT_RATES }, null, 2));

function readDB() {
  const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
  db.rates = { ...DEFAULT_RATES, ...db.rates, ...envRateOverrides() };
  return db;
}
function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use('/uploads', express.static(UPLOAD_DIR));
app.use('/', express.static(path.join(__dirname, '..', 'public')));
app.use('/prints', express.static(path.join(__dirname, '..', 'admin')));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.pdf';
    cb(null, `${Date.now()}_${nanoid(6)}${ext}`);
  }
});
const upload = multer({ storage });

function calcPrice(options, rates) {
  const copies = parseInt(options.copies || 1, 10);
  const pages = parseInt(options.pageCount || 1, 10);
  let base;
  if (options.jobType === 'id_card') {
    base = (options.colorMode === 'color' ? rates.id_card_color : rates.id_card_bw) * pages;
  } else if (options.jobType === 'pvc_card') {
    base = (options.cardType === 'retailer' ? rates.pvc_retailer : rates.pvc_customer) * pages;
  } else {
    // 'document' and 'other' (pdf/doc/xls/ppt/etc) priced per page the same way
    base = (options.colorMode === 'color' ? rates.color_a4 : rates.bw_a4) * pages;
  }
  base = base * copies;
  const flat = parseFloat(rates.additionalChargeFlat || 0);
  const percent = parseFloat(rates.additionalChargePercent || 0);
  const total = base + flat + (base * percent / 100);
  return Math.round(total * 100) / 100; // round to paise
}

// ---------- RATES ----------
app.get('/api/rates', (req, res) => {
  const db = readDB();
  res.json({ ok: true, rates: db.rates });
});

app.post('/api/rates', (req, res) => {
  const db = readDB();
  db.rates = { ...db.rates, ...req.body };
  writeDB(db);
  res.json({ ok: true, rates: db.rates });
});

// ---------- CONFIG (safe to expose — public key only) ----------
app.get('/api/config', (req, res) => {
  res.json({ ok: true, razorpayEnabled, razorpayKeyId: razorpayEnabled ? RAZORPAY_KEY_ID : null });
});

// ---------- RAZORPAY: create an order (server-side, uses secret key) ----------
app.post('/api/razorpay/create-order', async (req, res) => {
  if (!razorpayEnabled) return res.status(400).json({ ok: false, error: 'Razorpay not configured' });
  try {
    const { amount, localOrderId } = req.body; // amount in rupees
    const rpOrder = await razorpay.orders.create({
      amount: Math.round(amount * 100), // paise
      currency: 'INR',
      receipt: localOrderId,
      notes: { localOrderId }
    });
    res.json({ ok: true, rpOrder });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ---------- RAZORPAY: verify payment signature, then mark local order paid ----------
app.post('/api/razorpay/verify', (req, res) => {
  if (!razorpayEnabled) return res.status(400).json({ ok: false, error: 'Razorpay not configured' });
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, localOrderId } = req.body;

  const expectedSignature = crypto
    .createHmac('sha256', RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  if (expectedSignature !== razorpay_signature) {
    return res.status(400).json({ ok: false, error: 'Invalid signature — payment could not be verified' });
  }

  const db = readDB();
  const order = db.orders.find(o => o.id === localOrderId);
  if (!order) return res.status(404).json({ ok: false, error: 'Order not found' });
  order.status = 'paid';
  order.paidAt = new Date().toISOString();
  order.razorpayPaymentId = razorpay_payment_id;
  writeDB(db);
  res.json({ ok: true, order });
});

// ---------- ORDERS ----------
app.post('/api/orders', upload.single('file'), (req, res) => {
  const db = readDB();
  const options = JSON.parse(req.body.options || '{}');
  const amount = calcPrice(options, db.rates);

  const order = {
    id: nanoid(8).toUpperCase(),
    fileName: req.file ? req.file.filename : null,
    originalName: req.file ? req.file.originalname : null,
    options,
    amount,
    status: 'pending_payment',
    createdAt: new Date().toISOString()
  };

  db.orders.push(order);
  writeDB(db);
  res.json({ ok: true, order });
});

app.post('/api/orders/:id/pay', (req, res) => {
  const db = readDB();
  const order = db.orders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ ok: false, error: 'Order not found' });
  order.status = 'paid';
  order.paidAt = new Date().toISOString();
  writeDB(db);
  res.json({ ok: true, order });
});

app.get('/api/orders', (req, res) => {
  const db = readDB();
  const orders = db.orders
    .filter(o => o.status !== 'pending_payment')
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ ok: true, orders });
});

app.post('/api/orders/:id/printed', (req, res) => {
  const db = readDB();
  const order = db.orders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ ok: false, error: 'Order not found' });
  order.status = 'printed';
  order.printedAt = new Date().toISOString();
  writeDB(db);
  res.json({ ok: true, order });
});

app.listen(PORT, () => {
  console.log(`\nPrint Shop server running!`);
  console.log(`Customer site:  http://localhost:${PORT}/`);
  console.log(`Admin dashboard: http://localhost:${PORT}/prints/`);
  console.log(razorpayEnabled ? `Razorpay: ENABLED (live auto-confirm)\n` : `Razorpay: not configured — using manual UPI confirm\n`);
});
