const https = require('https');
const http = require('http');
const cheerio = require('cheerio');

function fetch(url, redirects = 0) {
  if (redirects > 5) return Promise.reject(new Error('too many redirects'));
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MoriBot/1.0; +https://mori.vercel.app)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
      }
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const next = res.headers.location.startsWith('http')
          ? res.headers.location
          : new URL(res.headers.location, url).href;
        return fetch(next, redirects + 1).then(resolve).catch(reject);
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    });
    req.on('error', reject);
    req.setTimeout(8000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'url 파라미터가 필요합니다.' });

  let targetUrl;
  try {
    targetUrl = new URL(url);
  } catch {
    return res.status(400).json({ error: '올바른 URL이 아닙니다.' });
  }

  try {
    const html = await fetch(targetUrl.href);
    const $ = cheerio.load(html);

    const og = (prop) =>
      $(`meta[property="og:${prop}"]`).attr('content') ||
      $(`meta[name="${prop}"]`).attr('content') || '';

    const image = og('image');

    res.json({
      title:       og('title') || $('title').text().trim(),
      description: og('description'),
      image:       image.startsWith('http') ? image : image ? new URL(image, targetUrl.origin).href : '',
      url:         og('url') || targetUrl.href,
    });
  } catch (e) {
    res.status(502).json({ error: `페이지를 가져오지 못했습니다: ${e.message}` });
  }
};
