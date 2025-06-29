#!/usr/bin/env node
import { readFileSync } from 'fs';

// Read all stdin as a string asynchronously
async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

// Escape XML text content (for text nodes)
function escXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Parse date string like "Friday, June 28, 2025."
function parseJournalDate(dateStr) {
  const cleaned = dateStr.trim().replace(/\.$/, '');
  const d = new Date(cleaned);
  if (isNaN(d)) throw new Error(`Invalid date format: ${dateStr}`);
  return d;
}

// Normalize date string: capitalize first letter of weekday and month, lowercase others
function normalizeDateText(dateStr) {
  const trimmed = dateStr.trim();
  const dot = trimmed.endsWith('.') ? '.' : '';
  const noDot = dot ? trimmed.slice(0, -1) : trimmed;

  const lower = noDot.toLowerCase();

  const commaIndex = lower.indexOf(',');
  if (commaIndex === -1) return dateStr; // fallback no change

  const weekday = lower.slice(0, commaIndex).trim();
  const rest = lower.slice(commaIndex + 1).trim();

  const capWeekday = weekday.charAt(0).toUpperCase() + weekday.slice(1);

  const spaceIndex = rest.indexOf(' ');
  if (spaceIndex === -1) return dateStr; // fallback no change

  const month = rest.slice(0, spaceIndex);
  const restAfterMonth = rest.slice(spaceIndex + 1);

  const capMonth = month.charAt(0).toUpperCase() + month.slice(1);

  return `${capWeekday}, ${capMonth} ${restAfterMonth}${dot}`;
}

// Serialize Markdown paragraphs and lists to XML <par> and <list>/<item>
function serializeMarkdownContent(text) {
  const lines = text.split('\n');

  let xmlParts = [];
  let listBuffer = [];
  let inList = false;

  function flushList() {
    if (listBuffer.length === 0) return;
    const itemsXml = listBuffer
      .map(item => `<item>${escXml(item.trim())}</item>`)
      .join('\n');
    xmlParts.push(`<list type="bullet">\n${itemsXml}\n</list>`);
    listBuffer = [];
  }

  for (let line of lines) {
    if (/^\s*[-*+]\s+/.test(line)) {
      if (!inList) {
        flushList();
        inList = true;
      }
      const itemText = line.replace(/^\s*[-*+]\s+/, '');
      listBuffer.push(itemText);
    } else if (/^\s*$/.test(line)) {
      flushList();
      inList = false;
      xmlParts.push(''); // paragraph separator
    } else {
      if (inList) {
        flushList();
        inList = false;
      }
      xmlParts.push(line.trim());
    }
  }

  flushList();

  let paragraphs = [];
  let buffer = [];

  for (let part of xmlParts) {
    if (part === '') {
      if (buffer.length) {
        paragraphs.push(buffer.join(' '));
        buffer = [];
      }
    } else if (part.startsWith('<list')) {
      if (buffer.length) {
        paragraphs.push(buffer.join(' '));
        buffer = [];
      }
      paragraphs.push(part);
    } else {
      buffer.push(part);
    }
  }
  if (buffer.length) paragraphs.push(buffer.join(' '));

  return paragraphs
    .map(p => (p.startsWith('<list') ? p : `<par>${escXml(p)}</par>`))
    .join('\n');
}

async function main() {
  const md = await readStdin();

  const paragraphs = md.split(/\n{2,}/);

  if (paragraphs.length === 0) {
    console.error('No content found.');
    process.exit(1);
  }

  const firstPara = paragraphs[0];

  const dateRegex = /^([A-Za-z]+,\s+[A-Za-z]+\s+\d{1,2},\s+\d{4}\.)\s*(.*)$/s;
  const match = firstPara.match(dateRegex);
  if (!match) {
    console.error('Date declaration not found at start of first paragraph.');
    process.exit(1);
  }

  const [, dateStrRaw, restOfPara] = match;

  let dateObj;
  try {
    dateObj = parseJournalDate(dateStrRaw);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }

  // Normalize date text (capitalize weekday and month)
  const dateStr = normalizeDateText(dateStrRaw);

  paragraphs[0] = restOfPara.trim();
  const content = paragraphs.filter(p => p.length > 0).join('\n\n');

  const contentXml = serializeMarkdownContent(content);

  const xml = `<section>
  <title>${escXml(dateStr)}</title>
  ${contentXml}
</section>`;

  console.log(xml);
}

main();
