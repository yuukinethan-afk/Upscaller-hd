const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const PixelCut = require('./pixelcut');

const PORT = process.env.PORT || 3000;
const MAX_MB = 20;
const SCALES = [2, 4, 8, 16];
const OK_MIME = ['image/jpeg', 'image/png', 'image/webp'];

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_MB * 1024 * 1024 } });
const jobs = new Map(); // jobId -> { px, taskId, scale, state, progress, url, error, at }
const hits = new Map(); // ip -> [timestamps]

app.use(express.static(path.join(__dirname, 'public')));

function limited(req, res, next) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.ip;
  const now = Date.now();
  const list = (hits.get(ip) || []).filter(t => now - t < 60000);
  if (list.length >= 5) return res.status(429).json({ error: 'Terlalu banyak permintaan, coba lagi sebentar.' });
  list.push(now); hits.set(ip, list);
  next();
}

app.post('/api/upscale', limited, upload.single('file'), async (req, res) => {
  try {
    const f = req.file;
    const scale = parseInt(req.body.scale, 10) || 4;
    if (!f) return res.status(400).json({ error: 'Pilih gambar dulu.' });
    if (!OK_MIME.includes(f.mimetype)) return res.status(400).json({ error: 'Format harus JPG, PNG, atau WEBP.' });
    if (!SCALES.includes(scale)) return res.status(400).json({ error: 'Skala tidak valid.' });

    const px = new PixelCut();
    await px.init();
    const taskId = await px.upload(f.buffer, f.originalname.replace(/[^\w.-]/g, '_'), f.mimetype);
    await px.upscale(taskId, scale);

    const jobId = crypto.randomBytes(8).toString('hex');
    jobs.set(jobId, { px, taskId, scale, state: 'processing', progress: 0, url: null, error: null, at: Date.now() });
    res.json({ jobId });
  } catch (e) {
    console.error('upscale:', e.response?.data || e.message);
    res.status(502).json({ error: 'Gagal menghubungi layanan upscale.' });
  }
});

app.get('/api/jobs/:id', async (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job tidak ditemukan.' });
  if (job.state === 'processing') {
    try {
      const s = await job.px.status(job.taskId);
      Object.assign(job, s);
    } catch (e) { /* coba lagi di polling berikutnya */ }
  }
  res.json({ state: job.state, progress: job.progress, error: job.state === 'failed' ? (job.error || 'Proses gagal') : null });
});

app.get('/api/jobs/:id/result', async (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job || job.state !== 'done' || !job.url) return res.status(404).end();
  try {
    const r = await job.px.download(job.url);
    res.setHeader('Content-Type', r.headers['content-type'] || 'image/png');
    res.setHeader('Content-Disposition', 'inline; filename="hd_' + job.scale + 'x.png"');
    r.data.pipe(res);
  } catch (e) { res.status(502).end(); }
});

setInterval(() => {
  const now = Date.now();
  for (const [id, j] of jobs) if (now - j.at > 30 * 60000) jobs.delete(id);
}, 60000);

app.listen(PORT, () => console.log('Berjalan di http://localhost:' + PORT));
            
