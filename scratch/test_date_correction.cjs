const fs = require('fs');
const records = JSON.parse(fs.readFileSync('C:/Users/shesn/Downloads/northstaroman.com/north-star-website/public/data/cashbook_records.json', 'utf8'));

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
const changes = [];

records.forEach(r => {
  const orig = r.date;
  const corrected = correctDate(r.date, r.year);
  if (orig !== corrected) {
    modifiedCount++;
    changes.push({
      id: r.id,
      year: r.year,
      originalDate: orig,
      correctedDate: corrected,
      paidTo: r.paidTo,
      desc: r.description
    });
  }
});

console.log(`Total dates to update: ${modifiedCount}`);
console.table(changes.slice(0, 35));
if (changes.length > 35) {
  console.log(`... and ${changes.length - 35} more`);
}
