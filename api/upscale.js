const PixelCut = require('../lib/pixelcut');

const SCALES = [2, 4, 8, 16];
const OK_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 3 * 1024 * 1024; // batas aman karena Vercel membatasi body ~4,5 MB

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { filename, mime, scale, data } = req.body || {};
    const sc = parseInt(scale, 10) || 4;
    if (typeof data !== 'string' || !data) return res.status(400).json({ error: 'Pilih gambar dulu.' });
    if (!OK_MIME.includes(mime)) return res.status(400).json({ error: 'Format harus JPG, PNG, atau WEBP.' });
    if (!SCALES.includes(sc)) return res.status(400).json({ error: 'Skala tidak valid.' });

    const buf = Buffer.from(data, 'base64');
    if (!buf.length) return res.status(400).json({ error: 'File kosong.' });
    if (buf.length > MAX_BYTES) return res.status(413).json({ error: 'Gambar terlalu besar.' });

    const px = new PixelCut();
    await px.init();
    const name = String(filename || 'image').replace(/[^\w.-]/g, '_').slice(0, 80);
    const taskId = await px.upload(buf, name, mime);
    await px.upscale(taskId, sc);
    res.json({ taskId });
  } catch (e) {
    console.error('upscale:', e.response?.data || e.message);
    res.status(502).json({ error: 'Gagal menghubungi layanan upscale.' });
  }
};
