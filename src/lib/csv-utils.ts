export const exportTransactionsCSV = (
  transactions: Array<{
    description: string;
    amount: number;
    type: string;
    date: string;
    categoryName?: string;
    cardName?: string;
    is_installment?: boolean;
    current_installment?: number;
    total_installments?: number;
  }>,
  filename: string
) => {
  const header = "Data,Descrição,Tipo,Categoria,Cartão,Valor,Parcela\n";
  const rows = transactions.map((tx) => {
    const date = new Date(tx.date + "T00:00:00").toLocaleDateString("pt-BR");
    const tipo = tx.type === "income" ? "Receita" : "Despesa";
    const parcela = tx.is_installment ? `${tx.current_installment}/${tx.total_installments}` : "";
    const valor = tx.type === "income" ? Number(tx.amount) : -Number(tx.amount);
    return `${date},"${tx.description}",${tipo},"${tx.categoryName || ""}","${tx.cardName || ""}",${valor.toFixed(2).replace(".", ",")},${parcela}`;
  });

  const csv = header + rows.join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

export interface ParsedNubankRow {
  date: string;
  description: string;
  amount: number;
}

export const parseNubankCSV = (csvText: string): ParsedNubankRow[] => {
  const lines = csvText.trim().split("\n");
  if (lines.length < 2) return [];

  // Nubank CSV: "Data","Categoria","Título","Valor" or "date","title","amount"
  const header = lines[0].toLowerCase().replace(/"/g, "").split(",");
  
  // Find column indices
  const dateIdx = header.findIndex((h) => h.includes("data") || h === "date");
  const descIdx = header.findIndex((h) => h.includes("título") || h.includes("titulo") || h === "title" || h.includes("descri"));
  const amountIdx = header.findIndex((h) => h.includes("valor") || h === "amount");

  if (dateIdx === -1 || descIdx === -1 || amountIdx === -1) {
    throw new Error("Formato CSV não reconhecido. Esperado colunas: Data, Título/Descrição, Valor");
  }

  const rows: ParsedNubankRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Simple CSV parse handling quoted fields
    const cols = parseCSVLine(line);
    if (cols.length <= Math.max(dateIdx, descIdx, amountIdx)) continue;

    const rawDate = cols[dateIdx].trim();
    const description = cols[descIdx].trim();
    const rawAmount = cols[amountIdx].trim().replace(",", ".");
    const amount = Math.abs(parseFloat(rawAmount));

    if (isNaN(amount) || !description) continue;

    // Parse date (DD/MM/YYYY or YYYY-MM-DD)
    let isoDate: string;
    if (rawDate.includes("/")) {
      const [d, m, y] = rawDate.split("/");
      isoDate = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    } else {
      isoDate = rawDate;
    }

    rows.push({ date: isoDate, description, amount });
  }

  return rows;
};

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}
