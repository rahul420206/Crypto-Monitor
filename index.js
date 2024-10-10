const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const schedule = require('node-schedule');

const app = express();
const PORT = process.env.PORT || 3000;


const mongoURI = 'mongodb+srv://420206:g9GqjVLMH1KzcCZc@cluster0.q8abu.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0%20'; // Replace with your MongoDB connection string
mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true });

const cryptoPriceSchema = new mongoose.Schema({
  name: String,
  current_price: Number,
  market_cap: Number,
  change_24h: Number,
  timestamp: { type: Date, default: Date.now }
});

const CryptoPrice = mongoose.model('CryptoPrice', cryptoPriceSchema);

const fetchCryptoData = async () => {
  const url = 'https://api.coingecko.com/api/v3/simple/price';
  const params = {
    ids: 'bitcoin,matic-network,ethereum',
    vs_currencies: 'usd',
    include_market_cap: 'true',
    include_24hr_change: 'true'
  };

  try {
    const response = await axios.get(url, { params });
    return response.data;
  } catch (error) {
    console.error('Error fetching data from CoinGecko API:', error);
    return null;
  }
};

const storeDataInDb = async (data) => {
  for (const coin in data) {
    const details = data[coin];
    const record = new CryptoPrice({
      name: coin,
      current_price: details.usd,
      market_cap: details.usd_market_cap,
      change_24h: details.usd_24h_change
    });
    await record.save();
  }
};

const job = async () => {
  console.log('Fetching data from CoinGecko...');
  const data = await fetchCryptoData();
  if (data) {
    console.log('Data fetched successfully:', data);
    console.log('Storing data in the database...');
    await storeDataInDb(data);
    console.log('Data stored successfully.');
  } else {
    console.log('Failed to fetch data.');
  }
};

schedule.scheduleJob('0 */2 * * *', job); 

app.get('/stats', async (req, res) => {
  const { coin } = req.query;
  if (!coin) return res.status(400).json({ error: 'Coin is required' });

  const data = await CryptoPrice.findOne({ name: coin }).sort({ timestamp: -1 });
  if (!data) return res.status(404).json({ error: 'Data not found' });

  res.json({
    price: data.current_price,
    marketCap: data.market_cap,
    "24hChange": data.change_24h
  });
});

app.get('/deviation', async (req, res) => {
  const { coin } = req.query;
  if (!coin) return res.status(400).json({ error: 'Coin is required' });

  const records = await CryptoPrice.find({ name: coin }).sort({ timestamp: -1 }).limit(100);
  if (records.length === 0) return res.status(404).json({ error: 'No records found' });

  const prices = records.map(record => record.current_price);
  const mean = prices.reduce((acc, price) => acc + price, 0) / prices.length;
  const variance = prices.reduce((acc, price) => acc + Math.pow(price - mean, 2), 0) / prices.length;
  const stdDeviation = Math.sqrt(variance);

  res.json({ deviation: stdDeviation });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

// Initial job run
job();
