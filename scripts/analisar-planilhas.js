const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const planilhas = ['Jackson.xlsx', 'christyian.xlsx', 'gabriel.xlsx', 'brenda.xlsx', 'keila.xlsx', 'raquel.xlsx'];

for (const nome of planilhas) {
  const caminho = path.join(__dirname, '..', nome);
  if (!fs.existsSync(caminho)) continue;

  const workbook = xlsx.readFile(caminho);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });

  console.log(`\n━━━ ${nome} (${rows.length} linhas) ━━━`);

  // Procura a linha de cabeçalho real
  let headerRow = -1;
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const row = rows[i];
    if (row && row.length > 5) {
      headerRow = i;
      console.log(`\nCabeçalho encontrado na linha ${i + 1}:`);
      row.forEach((col, idx) => {
        if (col) console.log(`  ${idx + 1}. ${col}`);
      });
      break;
    }
  }

  if (headerRow >= 0 && rows[headerRow + 1]) {
    console.log(`\nPrimeira linha de dados (linha ${headerRow + 2}):`);
    rows[headerRow + 1].forEach((val, idx) => {
      console.log(`  ${idx + 1}. ${rows[headerRow][idx] || '?'}: ${val}`);
    });
  }
}
