module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');

  try {
    const response = await fetch('https://nbt.tj/ru/kurs/export_xml.php', {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ZAKI-ERP/1.0)' },
      signal: AbortSignal.timeout(8000)
    });

    if (!response.ok) throw new Error('NBT HTTP ' + response.status);

    const xml = await response.text();
    const rates = {};

    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    while ((match = itemRegex.exec(xml)) !== null) {
      const block = match[1];
      const code  = block.match(/<CurrencyCode>(.*?)<\/CurrencyCode>/)?.[1]?.trim();
      const rateV = block.match(/<Rate>(.*?)<\/Rate>/)?.[1]?.trim();
      const nomV  = block.match(/<Nominal>(.*?)<\/Nominal>/)?.[1]?.trim();
      const diffV = block.match(/<Diff>(.*?)<\/Diff>/)?.[1]?.trim();
      if (code && rateV) {
        const nominal = parseFloat(nomV) || 1;
        rates[code] = {
          rate: parseFloat(rateV) / nominal,
          diff: parseFloat(diffV) || 0,
          nominal
        };
      }
    }

    if (!rates.USD) throw new Error('USD not found in NBT XML');

    res.json({ ok: true, rates, updated: new Date().toISOString() });

  } catch (err) {
    // Return fallback so the app never breaks
    res.status(200).json({ ok: false, error: err.message, rates: {} });
  }
};
