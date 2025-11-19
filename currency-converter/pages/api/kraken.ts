import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

type Data = {
  result?: any;
  error?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  try {
    const response = await axios.get('https://api.kraken.com/0/public/Ticker?pair=USDTGBP');
    
    if (response.data.error && response.data.error.length > 0) {
      return res.status(500).json({ error: response.data.error.join(', ') });
    }

    // Kraken returns data with pair name as key, which might vary (e.g., USDTGBP or XUSDTZGBP)
    // We return the whole result object for the frontend to parse
    res.status(200).json({ result: response.data.result });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch Kraken data' });
  }
}
