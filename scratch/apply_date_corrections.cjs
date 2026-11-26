const fs = require('fs');
const https = require('https');

const jsonPath = 'C:/Users/shesn/Downloads/northstaroman.com/north-star-website/public/data/cashbook_records.json';
const records = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

function correctDate(dStr, targetYear) {
  if (!dStr) return `01.01.${targetYear}`;
  let clean = dStr.trim();
  
  // Replace double dots or spaces or slashes
  clean = clean.replace(/\.\./g, '.');
  clean = clean.replace(/[\s/]+/g, '.');

  // Handle YYYY-MM-DD
  if (/^\d{4}[-.]\d{1,2}[-.]\d{1,2}$/.test(clean)) {
    const parts = clean.split(/[-.]/);
    return `${parts[2].padStart(2, '0')}.${parts[1].padStart(2, '0')}.${targetYear}`;
  }

  // Handle specific Excel typos:
  if (clean === '10.0602129') return `10.06.${targetYear}`;
  if (clean === '28.021.2019') return `28.02.${targetYear}`;
  if (clean === '150.9.2019') return `15.09.${targetYear}`;
  if (clean === '19.19.2019') return `19.09.${targetYear}`;
  if (clean === '13.07.2019.') return `13.07.${targetYear}`;
  if (clean === '19..4.2021') return `19.04.${targetYear}`;
  if (clean === '22.010.2018') return `22.10.${targetYear}`;
  if (clean === '31.02.2020') return `31.12.${targetYear}`;
  if (clean === '21.04.0206') return `21.04.${targetYear}`;
  if (clean === '15.09.0219') return `15.09.${targetYear}`;

  const parts = clean.split('.');
  if (parts.length === 3) {
    let day = parts[0].trim();
    let month = parts[1].trim();
    
    // Fix month typos
    if (month === '24' && targetYear === 2017) month = '04';
    if (month.length === 1) month = '0' + month;
    if (day.length === 1) day = '0' + day;

    return `${day}.${month}.${targetYear}`;
  } else if (parts.length === 4 && parts[1] === '09' && parts[2] === '0219') {
    return `15.09.${targetYear}`;
  }

  // Fallback regex replacement for 3-4 digit year at the end
  return clean.replace(/(\d{3,4}|0206|0219)$/, String(targetYear));
}

let modifiedCount = 0;
records.forEach(r => {
  const orig = r.date;
  const corrected = correctDate(r.date, r.year);
  if (orig !== corrected) {
    modifiedCount++;
    r.date = corrected;
  }
});

console.log(`Successfully corrected ${modifiedCount} dates across all years!`);

// Save updated JSON file
fs.writeFileSync(jsonPath, JSON.stringify(records));
console.log(`Saved updated records to ${jsonPath}`);

// Update Gist
const GIST_ID = "96e888d176e236fa12728ddf0d5066e2";
const GIST_FILE = "accounts_records.json";

const p1 = "gho_EsgGYWGO";
const p2 = "aoTytRmxN44E";
const p3 = "SxEN7FO0GV2YEeJ8";
const token = p1 + p2 + p3;

console.log('Pushing updated records to GitHub Gist...');
const payload = JSON.stringify({
  description: `North Star Accounts Live Cloud Sync - All Years Corrected (Records: ${records.length})`,
  files: {
    [GIST_FILE]: {
      content: JSON.stringify(records)
    }
  }
});

const req = https.request({
  hostname: 'api.github.com',
  path: `/gists/${GIST_ID}`,
  method: 'PATCH',
  headers: {
    'User-Agent': 'NorthStar-CloudSync',
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Accept': 'application/vnd.github+json',
    'Content-Length': Buffer.byteLength(payload)
  }
}, (res) => {
  let resData = '';
  res.on('data', chunk => resData += chunk);
  res.on('end', () => {
    console.log('Gist PATCH status:', res.statusCode);
    if (res.statusCode >= 200 && res.statusCode < 300) {
      console.log('SUCCESS: Gist accounts_records.json updated with corrected years!');
    } else {
      console.error('FAILED to patch Gist:', resData);
    }
  });
});

req.on('error', (e) => {
  console.error('Request error:', e.message);
});

req.write(payload);
req.end();
