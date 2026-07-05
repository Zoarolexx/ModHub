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

  const page = parseInt(req.query.page || '1', 10) || 1;
  const targetUrl = page === 1 ? 'https://an1.com/tags/mods/' : `https://an1.com/tags/mods/page/${page}/`;
  const cacheKey = 'home_' + page;
  const cached = getCached(cacheKey);
  if (cached) return res.json(cached);

  try {
    const { data } = await axios.get(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36',
        Accept: 'text/html',
      },
      timeout: 20000,
    });

    const $ = cheerio.load(data);
    const results = [];

    $('.item .item_app').each((_, el) => {
      const link = $(el).find('.name a').first();
      const href = link.attr('href') || '';
      const title = link.attr('title') || link.text().trim();
      const img = $(el).find('.img img').attr('src') || '';
      const developer = $(el).find('.developer').text().trim();
      const ratingWidth = $(el).find('.current-rating').attr('style') || '';
      const ratingMatch = ratingWidth.match(/width:(\d+)%/);
      const ratingNum = ratingMatch?.[1] ? parseInt(ratingMatch[1]) / 20 : 0;

      const idMatch = href.match(/\/(\d+)-/);
      const id = idMatch ? idMatch[1] : '';

      if (title && href) {
        results.push({
          id,
          title,
          url: href.startsWith('https://') ? href : 'https://an1.com' + href,
          thumbnail: img.startsWith('https://') ? img : 'https://an1.com' + img,
          developer,
          rating: ratingNum || 0,
        });
      }
    });

    const lastPage = $('.navigation_ext .pages a').last().text().trim();
    const totalPages = parseInt(lastPage) || 1;
    const currentPageText = $('.navigation_ext .pages span').first().text().trim();
    const currentPage = currentPageText ? parseInt(currentPageText) : page;

    const resp = {
      status: true,
      creator: 'Zerozx',
      result: {
        page: currentPage,
        total_pages: totalPages,
        total_items: results.length,
        games: results,
      },
    };

    setCached(cacheKey, resp);
    return res.json(resp);
  } catch (err) {
    return res.status(500).json({ status: false, creator: 'Zerozx', message: err.message });
  }
};
