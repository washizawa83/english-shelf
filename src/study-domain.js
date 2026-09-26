const intervals = {
  1: 20 * 60 * 1000,
  2: 60 * 60 * 1000,
  3: 9 * 60 * 60 * 1000,
  4: 24 * 60 * 60 * 1000,
  5: 2 * 24 * 60 * 60 * 1000,
  6: 6 * 24 * 60 * 60 * 1000,
  7: 30 * 24 * 60 * 60 * 1000,
  8: 182 * 24 * 60 * 60 * 1000
};

function notionPageId(url = '') {
  const compact = String(url).match(/([a-f0-9]{32})(?:\?|$)/i)?.[1];
  if (!compact) return null;
  return `${compact.slice(0, 8)}-${compact.slice(8, 12)}-${compact.slice(12, 16)}-${compact.slice(16, 20)}-${compact.slice(20)}`;
}

module.exports = { intervals, notionPageId };
