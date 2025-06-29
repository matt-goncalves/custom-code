import { remark } from 'remark';
import remarkParse from 'remark-parse';
import format from 'xml-formatter';
import yaml from 'js-yaml';

// Receive text from stdin
process.stdin.on('data' , (buffer) => {

  try {

    const text = String(buffer)

    // Split header if it exists
    const { header , body } = splitHeader(text);

    const headerObj = parseYamlPreamble(header);

    // Fix date fields to ISO string
    if (headerObj.date instanceof Date) {
      headerObj.date = headerObj.date.toISOString();
    }

    const mdSanitized = stripContainerDirectives(body);

    const ast = remark()
      .use(remarkParse)
      .parse(mdSanitized);

    const xml = astToXml(ast, headerObj);

    console.log(prettyXml(xml));

  } catch (err) {
    if (err instanceof Error) {
      console.error(err.message);
    } else {
      console.error(err);
    }
  }

});

function splitHeader(md)
{
  const regex = /^---\s*\n([\s\S]*?)\n---\s*\n?/;
  const match = md.match(regex);
  if (!match) {
    return { header: null, body: md };
  }
  return {
    header: match[1].trim(),
    body: md.slice(match[0].length)
  };
}


function stripContainerDirectives(md) {
  return md.replace(/^:::\s*.*\n/gm, ''); // removes lines like "::: date"
}

function prettyXml(xmlString)
{
  const prettified = format(xmlString, {
    indentation: '  ',
    collapseContent: true
  });
  return prettified;
}

function parseYamlPreamble(preambleStr) {
  try {
    return yaml.load(preambleStr) || {};
  } catch (err) {
    console.error('Invalid YAML:', err.message);
    return {};
  }
}

function escapeAttr(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function generateHeadXml(metadata) {
  const title = metadata.title || "";
  const metas = Object.entries(metadata)
    .filter(([key]) => key !== 'title')
    .map(
      ([key, value]) =>
        `<meta name="${escapeAttr(key)}" content="${escapeAttr(value)}"/>`
    );
  return `<head>\n<title>${escapeAttr(title)}</title>\n${metas.join("\n")}\n</head>`;
}


function astToXml(ast, metadata) {
  const esc = (str) =>
    String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");

  function serializeInline(nodes) {
    if (!nodes) return "";
    return nodes.map((node) => {
      switch (node.type) {
        case "text":
          return esc(node.value);
        case "emphasis":
          return `<emph style="i">${serializeInline(node.children)}</emph>`;
        case "strong":
          return `<emph style="b">${serializeInline(node.children)}</emph>`;
        case "delete":
          return `<emph style="m">${serializeInline(node.children)}</emph>`;
        case "inlineCode":
          return `<code>${esc(node.value)}</code>`;
        case "link":
          return `<link to="${esc(node.url)}">${serializeInline(node.children)}</link>`;
        case "image":
          return `<image src="${esc(node.url)}" alt="${esc(node.alt || "")}"/>`;
        case "break":
          return "\n";
        default:
          return `<inline type="${esc(node.type)}">${serializeInline(node.children)}</inline>`;
      }
    }).join("");
  }

  function serializeNode(node) {
    switch (node.type) {
      case "paragraph":
        return `<par>${serializeInline(node.children)}</par>`;
      case "code":
        const lang = node.lang ? ` lang="${esc(node.lang)}"` : "";
        return `<code-block xml:space="preserve"${lang}>${esc(node.value)}</code-block>`;
      case "list":
        const listType = node.ordered ? "enum" : "bullet";
        return `<list type="${listType}">\n${node.children.map(serializeNode).join("\n")}\n</list>`;
      case "listItem":
        return `<item>${node.children.map(child =>
          child.type === "paragraph" ? serializeInline(child.children) : serializeNode(child)
        ).join("")}</item>`;
      case "blockquote":
        return `<block type="blockquote">\n${node.children.map(serializeNode).join("\n")}\n</block>`;
      case "thematicBreak":
        return `<block type="hr"/>`;
      case "image":
        return `<image src="${esc(node.url)}" alt="${esc(node.alt || "")}"/>`;
      case "html":
        return ""; // strip raw HTML nodes
      case "heading":
        // We'll group these in serializeBodyWithSections instead
        return "";
      default:
        return `<block type="${esc(node.type)}">${
          node.children ? node.children.map(serializeNode).join("\n") : ""
        }</block>`;
    }
  }

  function serializeBodyWithSections(nodes) {
    const output = [];
    let i = 0;
    while (i < nodes.length) {
      const node = nodes[i];
      if (node.type === "heading" && node.depth === 1) {
        const title = serializeInline(node.children);
        const sectionContent = [];
        i++;
        while (i < nodes.length && !(nodes[i].type === "heading" && nodes[i].depth <= 1)) {
          sectionContent.push(serializeNode(nodes[i]));
          i++;
        }
        output.push(`<section>\n<title>${title}</title>\n${sectionContent.join("\n")}\n</section>`);
      } else {
        output.push(serializeNode(node));
        i++;
      }
    }
    return output.join("\n");
  }

  // Compose full XML document
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<document>
${generateHeadXml(metadata)}
<body>
${serializeBodyWithSections(ast.children)}
</body>
</document>`;

  return xml;
}
