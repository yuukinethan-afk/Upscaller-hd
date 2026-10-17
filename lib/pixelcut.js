// Modul PixelCut (dari scraper Khafa), diubah supaya menerima buffer, bukan path file.
const axios = require('axios');
const FormData = require('form-data');

class PixelCut {
  constructor() {
    this.baseUrl = 'https://www.pixelcut.ai';
    this.session = axios.create({
      baseURL: this.baseUrl, // di script asli baseURL tidak diset, jadi path relatif akan gagal
      timeout: 60000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8',
        'Origin': this.baseUrl,
        'Referer': this.baseUrl + '/id/peningkat-kualitas-gambar'
      }
    });
  }

  async init() {
    const res = await this.session.get('/id/peningkat-kualitas-gambar');
    const html = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
    const pick = (patterns) => {
      for (const p of patterns) { const m = html.match(p); if (m) return m[1]; }
      return null;
    };
    const csrf = pick([
      /csrfToken["'\s]*[:=]\s*["']([^"']+)["']/i,
      /csrf[_-]token["'\s]*[:=]\s*["']([^"']+)["']/i,
      /<meta[^>]*csrf[^>]*content=["']([^"']+)["']/i,
      /"csrfToken":"([^"]+)"/i
    ]);
    if (csrf) this.session.defaults.headers['X-CSRF-Token'] = csrf;
    const auth = pick([
      /auth[_-]token["'\s]*[:=]\s*["']([^"']+)["']/i,
      /"token":"([^"]+)"/i,
      /"accessToken":"([^"]+)"/i
    ]);
    if (auth) this.session.defaults.headers['Authorization'] = 'Bearer ' + auth;
    const cookies = (res.headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; ');
    if (cookies) this.session.defaults.headers['Cookie'] = cookies;
  }

  async upload(buffer, filename, mime) {
    const form = new FormData();
    form.append('file', buffer, { filename, contentType: mime });
    form.append('type', 'upscale');
    const res = await this.session.post('/api/v1/upload', form, {
      headers: { ...form.getHeaders(), 'X-Requested-With': 'XMLHttpRequest' },
      maxContentLength: Infinity, maxBodyLength: Infinity
    });
    const d = res.data || {};
    const id = d.task_id || d.id || d.taskId;
    if (!id) throw new Error('Upload tidak mengembalikan task id');
    return id;
  }

  async upscale(taskId, scale) {
    await this.session.post('/api/v1/upscale', {
      task_id: taskId, scale,
      enhance_quality: true, preserve_color: true, remove_noise: true, sharpen: true,
      face_enhance: false, creative: false, creativity: 0.5, resemblance: 0.8
    }, { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
  }

  async status(taskId) {
    const res = await this.session.get('/api/v1/status/' + encodeURIComponent(taskId), {
      headers: { 'X-Requested-With': 'XMLHttpRequest' }
    });
    const s = res.data || {};
    const state = String(s.status || s.state || 'processing').toLowerCase();
    return {
      state: ['completed', 'done', 'success'].includes(state) ? 'done'
           : ['failed', 'error'].includes(state) ? 'failed' : 'processing',
      progress: s.progress || s.percentage || 0,
      url: s.download_url || s.output_url || s.result_url || s.url || null,
      error: s.error || s.message || null
    };
  }

  async download(url) {
    return this.session.get(url, { responseType: 'stream' });
  }
}

module.exports = PixelCut;
    
