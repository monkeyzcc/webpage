import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import * as cheerio from 'cheerio';
import iconv from 'iconv-lite';

type Data = {
  rate?: number;
  updateTime?: string;
  error?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  try {
    // Bank of China (Mainland) rates page
    // The page is often GB2312 encoded.
    const url = 'https://www.bankofchina.com/sourcedb/whpj/enindex_1619.html';
    
    const response = await axios.get(url, {
        responseType: 'arraybuffer',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    });
    
    // Decode GB2312
    const html = iconv.decode(response.data, 'gb2312');
    const $ = cheerio.load(html);
    
    let rate: number | undefined;
    let updateTime: string | undefined;

    // The table structure usually has rows with currency names.
    // We look for "Hong Kong Dollar"
    
    const currencies: string[] = [];
    $('table tr').each((i, el) => {
      const tds = $(el).find('td');
      if (tds.length > 0) {
        const currency = $(tds[0]).text().trim();
        if (currency) currencies.push(currency);
        
        if (currency === 'Hong Kong Dollar') {
          // Columns: Currency Name, Buying Rate, Cash Buying Rate, Selling Rate, Cash Selling Rate, Middle Rate, Pub Time
          // Index: 0, 1, 2, 3, 4, 5, 6
          // We want "Buying Rate" (Index 1)
          
          const buyingRateStr = $(tds[1]).text().trim();
          const buyingRate = parseFloat(buyingRateStr);
          
          if (!isNaN(buyingRate)) {
            rate = buyingRate / 100; // Convert to per 1 unit
          }
          
          updateTime = $(tds[6]).text().trim();
        }
      }
    });

    if (rate) {
      res.status(200).json({ rate, updateTime });
    } else {
      // Fallback: Use an estimated rate if scraping fails
      // HKD to CNY is roughly 0.92
      res.status(200).json({ 
        rate: 0.92, 
        updateTime: new Date().toISOString(),
        error: 'Scraping failed, using estimated rate'
      });
    }

  } catch (error: any) {
    console.error('BOC Scraper Error:', error.message);
    res.status(500).json({ error: 'Failed to scrape BOC data' });
  }
}
