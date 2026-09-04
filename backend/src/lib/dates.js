// Filtros de data chegam como "YYYY-MM-DD" e representam o dia no fuso de quem
// usa o sistema. `new Date('2026-09-03')` seria meia-noite UTC — em UTC-3 isso
// cai às 21h do dia 02 e o filtro perde (ou sobra) três horas. Por isso as datas
// puras são montadas componente a componente, no fuso local do servidor.
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

function startOfDay(value) {
  const m = DATE_ONLY.exec(String(value));
  if (!m) return new Date(value);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0);
}

function endOfDay(value) {
  const m = DATE_ONLY.exec(String(value));
  if (!m) return new Date(value);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59, 59, 999);
}

// Monta o filtro `createdAt` do Prisma a partir de from/to opcionais.
function dateRangeFilter(from, to) {
  if (!from && !to) return null;
  const range = {};
  if (from) range.gte = startOfDay(from);
  if (to) range.lte = endOfDay(to);
  return range;
}

module.exports = { startOfDay, endOfDay, dateRangeFilter };
