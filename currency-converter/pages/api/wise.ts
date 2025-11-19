import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

type Data = {
  rate?: number;
  fee?: number;
  error?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  try {
    const { sourceAmount = '1000' } = req.query;
    const amount = parseFloat(sourceAmount as string) || 1000;

    // Wise Gateway API
    // URL: https://wise.com/gateway/v1/price
    const response = await axios.get('https://wise.com/gateway/v1/price', {
      params: {
        sourceAmount: amount,
        sourceCurrency: 'GBP',
        targetCurrency: 'HKD',
        profileType: 'PERSONAL',
        profileCountry: 'CN',
        markers: 'FCF_PRICING'
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    const prices = response.data;
    
    // Find the best price option. 
    // Priority: BALANCE -> BANK_TRANSFER (Cheapest for Wise users)
    // Fallback: BANK_TRANSFER -> BANK_TRANSFER (Standard)
    
    let selectedPrice = prices.find((p: any) => p.payInMethod === 'BALANCE' && p.payOutMethod === 'BANK_TRANSFER');
    
    if (!selectedPrice) {
      selectedPrice = prices.find((p: any) => p.payInMethod === 'BANK_TRANSFER' && p.payOutMethod === 'BANK_TRANSFER');
    }
    
    // Fallback to the first option if specific methods aren't found
    if (!selectedPrice && prices.length > 0) {
      selectedPrice = prices[0];
    }

    if (selectedPrice) {
      res.status(200).json({ 
        rate: selectedPrice.midRate,
        fee: selectedPrice.total
      });
    } else {
      throw new Error('No valid price option found from Wise API');
    }

  } catch (error: any) {
    console.error('Wise API Error:', error.message);
    res.status(500).json({ error: 'Failed to fetch Wise data' });
  }
}

