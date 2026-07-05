const axios = require('axios');
const cheerio = require('cheerio');

const apiCache = new Map();
const CACHE_TTL = 10 * 60 * 1000;

function getCached(key) {
  const item = apiCache.get(key);
  if (item && Date.now() - item.time < CACHE_TTL) return item.data;
  return null;
}

function setCached(key, data) {
  apiCache.set(key, { data, time: Date.now() });
}

const UA = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120.0.6099.144 Mobile Safari/537.36',
];

async function fetchAn1(url) {
  const { data } = await axios.get(url, {
    headers: { 'User-Agent': UA[Math.floor(Math.random() * UA.length)], Accept: 'text/html', Origin: 'https://an1.com' },
    timeout: 30000,
    maxRedirects: 5,
  });
  return data;
}

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.headers['x-requested-with'] !== 'XMLHttpRequest') {
    return res.status(403).json({ status: false, message: 'Forbidden' });
  }

  const id = (req.query.id || '').trim();
  const cacheKey = 'detail_' + id;
  const cached = getCached(cacheKey);
  if (cached) return res.json(cached);
  
  if (!id || !/^\d+$/.test(id)) {
    return res.status(400).json({ status: false, creator: 'Zerozx', message: 'ID harus angka' });
  }

  try {
    let mainHtml = '';
    let mainUrl = '';
    for (const u of [`https://an1.com/${id}-game.html`, `https://an1.com/${id}-mod.html`, `https://an1.com/${id}-apk.html`]) {
      try {
        mainHtml = await fetchAn1(u);
        mainUrl = u;
        break;
      } catch (e) {}
    }

    if (!mainHtml) {
      try {
        const dw = await fetchAn1(`https://an1.com/file_${id}-dw.html`);
        const m = dw.match(/<a[^>]*class="[^"]*btn-back[^"]*"[^>]*href="([^"]+)"[^>]*>/);
        if (m) {
          const bu = m[1].startsWith('https://') ? m[1] : 'https://an1.com' + m[1];
          mainHtml = await fetchAn1(bu);
          mainUrl = bu;
        }
      } catch (e) {}
    }

    const $m = cheerio.load(mainHtml || '<html></html>');
    const result = {
      id,
      title: $m('h1').first().text().trim(),
      version: (mainHtml?.match(/Version:\s*<\/b>\s*([\d.]+)/) || [])[1] || '',
      developer: (mainHtml?.match(/Developer:\s*<\/b>\s*<a[^>]*>([^<]+)</) || [])[1]?.trim() || '',
      category: (mainHtml?.match(/Category:\s*<\/b>\s*<a[^>]*>([^<]+)</) || [])[1]?.trim() || '',
      description:
        $m('.full-text p, article p').map((_, e) => $m(e).text().trim()).get().join(' ') ||
        $m('meta[name="description"]').attr('content') ||
        '',
      thumbnail: $m('.app-icon img, .img-block img').first().attr('src') || '',
      screenshots: [],
      features: [],
      mod_info: (mainHtml?.match(/MOD(?: Features| Info)?:?\s*<\/b>(.*?)(?:<br|<p|<\/p|\n\n)/s) || [])[1]?.replace(/<[^>]+>/g, '').trim() || '',
      google_play_url: (mainHtml?.match(/href="(https:\/\/play\.google\.com\/store\/apps\/details\?id=[^"]+)"/) || [])[1] || '',
      main_page_url: mainUrl,
    };

    $m('.screenshots img, .screen img').each((_, e) => {
      const s = $m(e).attr('src');
      if (s && s !== result.thumbnail) result.screenshots.push(s);
    });
    $m('.features li, ul.mod-features li').each((_, e) => result.features.push($m(e).text().trim()));

    try {
      const dwHtml = await fetchAn1(`https://an1.com/file_${id}-dw.html`);
      const $d = cheerio.load(dwHtml);
      let dwHref = $d('#pre_download').attr('href') || '';
      if (dwHref && !dwHref.startsWith('http')) {
        dwHref = 'https://an1.com' + dwHref;
      }
      result.download_url = dwHref;
      result.size = (dwHtml.match(/<a[^>]*id="pre_download"[^>]*>.*?\(([\d.]+\s*(?:Mb|MB|GB|Kb))\)/s) || [])[1] || '';
      result.an1_store_url = (dwHtml.match(/<a[^>]*class="[^"]*an1-mobile-download[^"]*"[^>]*href="([^"]+)"[^>]*>/) || [])[1] || '';
      result.pc_emulator_url = (dwHtml.match(/<a[^>]*href="(https:\/\/www\.ldplayer\.net[^"]+)"[^>]*>.*?Play on PC/s) || [])[1] || '';
      result.title = $d('h1.title').first().text().trim() || result.title;
      result.thumbnail = $d('.box-file-img img').first().attr('src') || result.thumbnail;
      const av = (dwHtml.match(/<li[^>]*id="a_ver"[^>]*>(.*?)<\/li>/s) || [])[1]?.replace(/<[^>]+>/g, '') || '';
      const avMatch = av.match(/Android\s*([\d.]+)\s*\+?/);
      result.android_requirement = avMatch ? 'Android ' + avMatch[1] + '+' : '';
      result.timer_seconds = parseInt((dwHtml.match(/countdown\((\d+)\)/) || [])[1] || '0');
    } catch (e) {}

    const resp = { status: true, creator: 'Zerozx', input: { id }, result };
    setCached(cacheKey, resp);
    return res.json(resp);
  } catch (err) {
    return res.status(500).json({ status: false, creator: 'Zerozx', message: err.message });
  }
};
