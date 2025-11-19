import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import * as cheerio from 'cheerio';

type Data = {
  rate?: number;
  error?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  try {
    // Wise Public Converter Page
    // URL: https://wise.com/zh-cn/currency-converter/gbp-to-hkd-rate
    // We can scrape the rate from this page.
    
    const response = await axios.get('https://wise.com/zh-cn/currency-converter/gbp-to-hkd-rate', {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    });
    
    const html = response.data;
    const $ = cheerio.load(html);
    
    // The rate is usually in a specific element.
    // Based on common Wise page structure, look for the rate class or specific text.
    // Often it's in an element with class "text-success" or similar, or we can regex for "1 GBP ="
    
    // Let's try to find the rate in the "1 GBP 兑 HKD 统计信息" or the main converter display.
    // A robust way is to look for the input value corresponding to 1 GBP if available, or the rate display.
    
    // Searching for "1 GBP =" or similar text pattern in the body might be safer if classes change.
    // Or look for the specific data-testid if stable.
    
    // Let's try to find the rate value directly.
    // Often Wise puts the rate in a span with class `text-success` or `rate-value`.
    
    // Strategy: Look for the text "1 GBP =" and parse the number after it?
    // Or look for the conversion result of 1 GBP.
    
    // Let's try to find the rate in the HTML content by regex for "1 GBP = [0-9.]+ HKD" or similar.
    // Or simply "1 GBP = " followed by number.
    
    // In the previous read_url_content, we saw "1 GBP 兑 HKD 统计信息".
    // And "30 天高点为 10.4124".
    // But we want the *current* rate.
    
    // Let's try to fetch the dynamic data embedded in script tags if possible, or just regex the HTML.
    // Wise often embeds state in a script tag `window.__INITIAL_STATE__` or similar.
    
    // Let's try a simple regex first on the whole HTML for "1 GBP = "
    // The page title often contains the rate too? "1,000 英镑 兑港元 汇率" -> No rate in title.
    
    // Let's try to find the rate class.
    // Common class for rate: `d-inline-block` inside `rate-value`?
    
    // Alternative: Use the internal API that the frontend uses?
    // https://wise.com/rates/history+live?source=GBP&target=HKD&length=1&resolution=hourly&unit=day
    // This might be public.
    
    const apiResponse = await axios.get('https://wise.com/rates/history+live?source=GBP&target=HKD&length=1&resolution=hourly&unit=day', {
        headers: {
            'User-Agent': 'Mozilla/5.0'
        }
    });
    
    if (apiResponse.data && apiResponse.data.length > 0) {
        // The last item is usually the latest rate
        const latest = apiResponse.data[apiResponse.data.length - 1];
        if (latest && latest.value) {
             res.status(200).json({ rate: latest.value });
             return;
        }
    }
    
    // Fallback to scraping if API fails
    // ... (Keep simple for now, try the API first as it's much cleaner)
    
    throw new Error('Could not fetch rate from Wise public API');

  } catch (error: any) {
    console.error('Wise Public API Error:', error.message);
    res.status(500).json({ error: 'Failed to fetch Wise data' });
  }
}
