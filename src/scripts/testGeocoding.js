import 'dotenv/config';
import axios from 'axios';

const { GOOGLE_API_KEY } = process.env;
if (!GOOGLE_API_KEY) {
  console.error('Falta GOOGLE_API_KEY en .env');
  process.exit(1);
}

async function main() {
  const address = 'Antigua Guatemala'; 
  const url = 'https://maps.googleapis.com/maps/api/geocode/json';

  const { data } = await axios.get(url, {
    params: { address, key: GOOGLE_API_KEY }
  });

  if (data.status !== 'OK') {
    console.error('Geocoding error:', data.status, data.error_message);
    process.exit(1);
  }

  const first = data.results[0];
  console.log('Formatted address:', first.formatted_address);
  console.log('Location:', first.geometry.location); 
}

main().catch(err => {
  console.error('Request failed:', err.response?.data || err.message);
});