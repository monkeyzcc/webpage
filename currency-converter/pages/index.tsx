import Head from 'next/head';
import Converter from '../components/Converter';

export default function Home() {
  return (
    <>
      <Head>
        <title>Crypto Bridge | USDT to CNY</title>
        <meta name="description" content="Real-time USDT to CNY converter via Kraken, Wise, and BOC" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main>
        <Converter />
      </main>
    </>
  );
}
