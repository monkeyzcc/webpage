import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import Settings from './Settings';

const Converter: React.FC = () => {
  const [usdtAmount, setUsdtAmount] = useState<string>('');
  const [wiseToken, setWiseToken] = useState<string>('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [krakenData, setKrakenData] = useState<any>(null);
  const [wiseRate, setWiseRate] = useState<number | null>(null);
  const [wiseFee, setWiseFee] = useState<number | null>(null);
  const [bocRate, setBocRate] = useState<number | null>(null);

  useEffect(() => {
    const savedToken = localStorage.getItem('wise_api_token');
    if (savedToken) setWiseToken(savedToken);
  }, []);

  const fetchData = useCallback(async () => {
    if (!usdtAmount || parseFloat(usdtAmount) <= 0) return;

    setLoading(true);
    setError(null);
    setKrakenData(null);
    setWiseRate(null);
    setWiseFee(null);
    setBocRate(null);

    try {
      // 1. Kraken: USDT -> GBP
      const krakenRes = await axios.get('/api/kraken');
      const krakenResult = krakenRes.data.result;
      // Key might be USDTGBP or similar. Just take the first key.
      const pairKey = Object.keys(krakenResult)[0];
      const ticker = krakenResult[pairKey];
      setKrakenData(ticker);

      // Calculate estimated GBP amount for Wise query
      const currentUsdt = parseFloat(usdtAmount);
      const currentKrakenPrice = parseFloat(ticker.b[0]);
      const currentKrakenFeeRate = 0.0026;
      const currentGbpRaw = currentUsdt * currentKrakenPrice;
      const currentKrakenFee = currentGbpRaw * currentKrakenFeeRate;
      const currentGbpNet = currentGbpRaw - currentKrakenFee;

      // 2. Wise: GBP -> HKD
      try {
        // Pass the estimated GBP amount to Wise API to get accurate fee and rate
        const wiseRes = await axios.get('/api/wise', {
          params: { sourceAmount: currentGbpNet }
        });
        setWiseRate(wiseRes.data.rate);
        setWiseFee(wiseRes.data.fee);
      } catch (e) {
        console.error("Wise fetch failed", e);
        // Don't block flow, just show error for this part
      }

      // 3. BOC: HKD -> CNY
      try {
        const bocRes = await axios.get('/api/boc');
        setBocRate(bocRes.data.rate);
      } catch (e) {
        console.error("BOC fetch failed", e);
      }

    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [usdtAmount]);

  // Debounce fetch
  useEffect(() => {
    const timer = setTimeout(() => {
      if (usdtAmount) fetchData();
    }, 800);
    return () => clearTimeout(timer);
  }, [usdtAmount, fetchData]);

  // Calculations
  const usdt = parseFloat(usdtAmount) || 0;

  const krakenPrice = krakenData ? parseFloat(krakenData.b[0]) : 0; // Bid price
  const krakenFeeRate = 0.0026; // 0.26% estimate
  const gbpRaw = usdt * krakenPrice;
  const krakenFee = gbpRaw * krakenFeeRate;
  const gbpNet = gbpRaw - krakenFee;

  // Use dynamic fee from API if available, otherwise 0 (or fallback logic if you prefer)
  // The API returns the total fee in GBP
  const currentWiseFee = wiseFee !== null ? wiseFee : 0;

  const gbpForConversion = gbpNet - currentWiseFee;
  const hkdAmount = gbpForConversion > 0 && wiseRate ? gbpForConversion * wiseRate : 0;

  const cnyAmount = hkdAmount * (bocRate || 0);

  // Fee Conversions to CNY
  // Effective Chain Rate for GBP -> CNY = WiseRate (GBP->HKD) * BocRate (HKD->CNY)
  const gbpToCnyRate = (wiseRate || 0) * (bocRate || 0);
  const krakenFeeCny = krakenFee * gbpToCnyRate;
  const wiseFeeCny = currentWiseFee * gbpToCnyRate;
  const totalFeeCny = krakenFeeCny + wiseFeeCny;

  // Final Effective Rate Calculation
  // Formula: (Gross CNY - Total Fees CNY) / USDT
  const grossCny = cnyAmount;
  const effectiveRate = usdt > 0 ? ((grossCny - totalFeeCny) / usdt) : 0;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-sans selection:bg-blue-500/30 pb-20">
      <div className="max-w-4xl mx-auto px-6 py-12">

        <div className="flex justify-between items-center mb-12">
          <div>
            <h1 className="text-4xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400 tracking-tight">
              Crypto Bridge
            </h1>
            <p className="text-gray-500 mt-2 text-lg">Real-time USDT to CNY Conversion Path</p>
          </div>
        </div>

        <div className="bg-gray-900/50 rounded-3xl p-8 border border-gray-800 shadow-2xl backdrop-blur-sm mb-8">
          <label className="block text-sm font-medium text-gray-400 mb-3 uppercase tracking-wider">Input Amount</label>
          <div className="relative">
            <input
              type="number"
              value={usdtAmount}
              onChange={(e) => setUsdtAmount(e.target.value)}
              placeholder="0.00"
              className="w-full bg-transparent text-6xl font-bold text-white placeholder-gray-700 focus:outline-none"
            />
            <span className="absolute right-0 top-1/2 -translate-y-1/2 text-2xl font-semibold text-emerald-500">USDT</span>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl mb-8 flex items-center">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            {error}
          </div>
        )}

        <div className="space-y-6 relative mb-12">
          {/* Connecting Line */}
          <div className="absolute left-8 top-8 bottom-8 w-0.5 bg-gray-800 -z-10"></div>

          {/* Step 1: Kraken */}
          <div className="relative pl-20 transition-all duration-500 ease-out transform translate-y-0 opacity-100">
            <div className="absolute left-0 top-0 w-16 h-16 bg-gray-800 rounded-2xl flex items-center justify-center border border-gray-700 z-10">
              <span className="text-2xl">🐙</span>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 hover:border-gray-700 transition-colors">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-bold text-white">Kraken Exchange</h3>
                  <p className="text-gray-400 text-sm">USDT → GBP</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-mono font-bold text-blue-400">
                    {krakenData ? `£${gbpNet.toFixed(2)}` : '---'}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Rate: {krakenPrice.toFixed(4)}
                  </div>
                </div>
              </div>
              <div className="bg-gray-950/50 rounded-lg p-3 text-xs text-gray-500 space-y-1">
                <div className="flex justify-between">
                  <span>Raw Amount:</span>
                  <span>£{gbpRaw.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-red-400/70">
                  <span>Fee (0.26%):</span>
                  <div className="flex items-center">
                    <span>-£{krakenFee.toFixed(2)}</span>
                    <span className="group relative cursor-help ml-1 border-b border-dotted border-red-500/30">
                      (≈ ¥{krakenFeeCny.toFixed(2)})
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-max max-w-[250px] bg-gray-800 text-xs text-gray-200 p-3 rounded-xl shadow-xl z-50 border border-gray-700 backdrop-blur-md">
                        <div className="font-bold text-white mb-1">Fee Calculation</div>
                        <div className="space-y-1 font-mono">
                          <div>£{krakenFee.toFixed(2)} (Fee)</div>
                          <div>× {wiseRate?.toFixed(4) || '---'} (GBP→HKD)</div>
                          <div>× {bocRate?.toFixed(4) || '---'} (HKD→CNY)</div>
                          <div className="border-t border-gray-600 pt-1 mt-1 text-emerald-400">= ¥{krakenFeeCny.toFixed(4)}</div>
                        </div>
                        {/* Arrow */}
                        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-800"></div>
                      </div>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Step 2: Wise */}
          <div className="relative pl-20 transition-all duration-500 ease-out delay-100">
            <div className="absolute left-0 top-0 w-16 h-16 bg-gray-800 rounded-2xl flex items-center justify-center border border-gray-700 z-10">
              <span className="text-2xl">💸</span>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 hover:border-gray-700 transition-colors">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-bold text-white">Wise Transfer</h3>
                  <p className="text-gray-400 text-sm">GBP → HKD</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-mono font-bold text-emerald-400">
                    {wiseRate ? `HK$${hkdAmount.toFixed(2)}` : '---'}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Rate: {wiseRate ? wiseRate.toFixed(4) : '---'}
                  </div>
                </div>
              </div>
              <div className="bg-gray-950/50 rounded-lg p-3 text-xs text-gray-500 space-y-1">
                <div className="flex justify-between">
                  <span>Input:</span>
                  <span>£{gbpNet.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-red-400/70">
                  <span>Transfer Fee:</span>
                  <div className="flex items-center">
                    <span>-£{currentWiseFee.toFixed(2)}</span>
                    <span className="group relative cursor-help ml-1 border-b border-dotted border-red-500/30">
                      (≈ ¥{wiseFeeCny.toFixed(2)})
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-max max-w-[250px] bg-gray-800 text-xs text-gray-200 p-3 rounded-xl shadow-xl z-50 border border-gray-700 backdrop-blur-md">
                        <div className="font-bold text-white mb-1">Fee Calculation</div>
                        <div className="space-y-1 font-mono">
                          <div>£{currentWiseFee.toFixed(2)} (Fee)</div>
                          <div>× {wiseRate?.toFixed(4) || '---'} (GBP→HKD)</div>
                          <div>× {bocRate?.toFixed(4) || '---'} (HKD→CNY)</div>
                          <div className="border-t border-gray-600 pt-1 mt-1 text-emerald-400">= ¥{wiseFeeCny.toFixed(4)}</div>
                        </div>
                        {/* Arrow */}
                        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-800"></div>
                      </div>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Step 3: BOC */}
          <div className="relative pl-20 transition-all duration-500 ease-out delay-200">
            <div className="absolute left-0 top-0 w-16 h-16 bg-gray-800 rounded-2xl flex items-center justify-center border border-gray-700 z-10">
              <span className="text-2xl">🏦</span>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 hover:border-gray-700 transition-colors">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-bold text-white">BOC / Remittance</h3>
                  <p className="text-gray-400 text-sm">HKD → CNY</p>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-mono font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-yellow-400">
                    {bocRate ? `¥${cnyAmount.toFixed(2)}` : '---'}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Rate: {bocRate ? bocRate.toFixed(4) : '---'}
                  </div>
                </div>
              </div>
              <div className="bg-gray-950/50 rounded-lg p-3 text-xs text-gray-500 space-y-1">
                <div className="flex justify-between">
                  <span>Source:</span>
                  <span>Bank of China (Buying Rate)</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Fee:</span>
                  <span>Included in Spread</span>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Final Calculation */}
        {usdt > 0 && (
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl p-8 border border-gray-700 shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-6 flex items-center">
              <span className="bg-blue-500/20 text-blue-400 p-2 rounded-lg mr-3">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
              </span>
              Effective Rate Calculation
            </h3>

            <div className="space-y-4 text-sm font-mono">
              <div className="flex justify-between items-center p-4 bg-gray-950/50 rounded-xl border border-gray-800">
                <span className="text-gray-400">Theoretical Max (No Fees)</span>
                <span className="text-white">¥{grossCny.toFixed(2)}</span>
              </div>

              <div className="p-4 bg-red-900/10 rounded-xl border border-red-900/20">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-red-400 font-bold">Total Fees</span>
                  <span className="group relative cursor-help border-b border-dotted border-red-500/30 text-red-400 font-bold">
                    - ¥{totalFeeCny.toFixed(2)}
                    <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block w-max max-w-[250px] bg-gray-800 text-xs text-gray-200 p-3 rounded-xl shadow-xl z-50 border border-gray-700 backdrop-blur-md text-left font-normal">
                      <div className="font-bold text-white mb-1">Total Fee Calculation</div>
                      <div className="space-y-1 font-mono">
                        <div className="flex justify-between gap-4"><span>Kraken Fee:</span> <span>¥{krakenFeeCny.toFixed(2)}</span></div>
                        <div className="flex justify-between gap-4"><span>Wise Fee:</span> <span>¥{wiseFeeCny.toFixed(2)}</span></div>
                        <div className="border-t border-gray-600 pt-1 mt-1 text-emerald-400 flex justify-between gap-4"><span>Total:</span> <span>¥{totalFeeCny.toFixed(2)}</span></div>
                      </div>
                    </div>
                  </span>
                </div>
                <div className="text-xs text-red-400/70 flex justify-between pl-4">
                  <span>Kraken Fee:</span>
                  <span className="group relative cursor-help border-b border-dotted border-red-500/30">
                    ¥{krakenFeeCny.toFixed(2)}
                    <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block w-max max-w-[250px] bg-gray-800 text-xs text-gray-200 p-3 rounded-xl shadow-xl z-50 border border-gray-700 backdrop-blur-md text-left">
                      <div className="font-bold text-white mb-1">Fee Calculation</div>
                      <div className="space-y-1 font-mono">
                        <div>£{krakenFee.toFixed(2)} (Fee)</div>
                        <div>× {wiseRate?.toFixed(4) || '---'} (GBP→HKD)</div>
                        <div>× {bocRate?.toFixed(4) || '---'} (HKD→CNY)</div>
                        <div className="border-t border-gray-600 pt-1 mt-1 text-emerald-400">= ¥{krakenFeeCny.toFixed(4)}</div>
                      </div>
                    </div>
                  </span>
                </div>
                <div className="text-xs text-red-400/70 flex justify-between pl-4">
                  <span>Wise Fee:</span>
                  <span className="group relative cursor-help border-b border-dotted border-red-500/30">
                    ¥{wiseFeeCny.toFixed(2)}
                    <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block w-max max-w-[250px] bg-gray-800 text-xs text-gray-200 p-3 rounded-xl shadow-xl z-50 border border-gray-700 backdrop-blur-md text-left">
                      <div className="font-bold text-white mb-1">Fee Calculation</div>
                      <div className="space-y-1 font-mono">
                        <div>£{currentWiseFee.toFixed(2)} (Fee)</div>
                        <div>× {wiseRate?.toFixed(4) || '---'} (GBP→HKD)</div>
                        <div>× {bocRate?.toFixed(4) || '---'} (HKD→CNY)</div>
                        <div className="border-t border-gray-600 pt-1 mt-1 text-emerald-400">= ¥{wiseFeeCny.toFixed(4)}</div>
                      </div>
                    </div>
                  </span>
                </div>
              </div>

              <div className="flex justify-between items-center p-4 bg-emerald-900/10 rounded-xl border border-emerald-900/20">
                <span className="text-emerald-400 font-bold">Final Net RMB</span>
                <span className="text-emerald-400 font-bold">¥{cnyAmount.toFixed(3)} - ¥{totalFeeCny.toFixed(3)} = ¥{(cnyAmount - totalFeeCny).toFixed(3)}</span>
              </div>

              <div className="mt-6 pt-6 border-t border-gray-700">
                <div className="text-gray-400 mb-2">Formula:</div>
                <div className="bg-black/30 p-4 rounded-xl text-center text-lg text-blue-300 overflow-x-auto">
                  ( ¥{cnyAmount.toFixed(3)} - ¥{totalFeeCny.toFixed(3)}) ÷ {usdt} USDT = <span className="font-bold text-white">{effectiveRate.toFixed(4)}</span> CNY/USDT
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default Converter;
