# Markdown to Custom XML Converter Script

This script reads a Markdown document from standard input and converts it into a custom XML format. It handles YAML front matter metadata separately and transforms the Markdown body into an XML structure with semantic elements such as sections, paragraphs, inline formatting, and metadata.

---

## Overview of the Script

The script consists of several main parts that interact to produce the final XML output:

### 1. Input Handling and Preprocessing

- Listens to data events on standard input (`process.stdin`).
- Converts the input buffer to a string representing the full Markdown document.

### 2. Header and Body Separation (`splitHeader`)

- Detects and extracts YAML front matter enclosed between `---` lines at the top of the document.
- Returns an object containing:
  - `header`: the YAML front matter string (or `null` if none found).
  - `body`: the Markdown content without the YAML front matter.

### 3. YAML Parsing (`parseYamlPreamble`)

- Parses the YAML header string into a JavaScript object using the `js-yaml` library.
- Catches and logs errors for invalid YAML, returning an empty object if parsing fails.

### 4. Metadata Normalization

- Checks if the `date` field in the metadata is parsed as a JavaScript `Date` object.
- Converts it to an ISO 8601 string to maintain a consistent date format in the output XML.

### 5. Markdown Sanitization (`stripContainerDirectives`)

- Removes lines matching container directive syntax, such as `::: date`, from the Markdown body.
- This prevents those directives from affecting the AST parsing and final XML output.

### 6. Markdown Parsing

- Uses `remark` with the `remark-parse` plugin to parse the sanitized Markdown into an Abstract Syntax Tree (AST).

### 7. XML Generation (`astToXml`)

- Receives the full Markdown AST and metadata object.
- Defines helper functions for:
  - **Escaping XML special characters** to ensure valid XML.
  - **Serializing inline Markdown elements** (text, emphasis, strong, links, code, images, etc.) to corresponding XML tags.
  - **Serializing block-level Markdown nodes** (paragraphs, code blocks, lists, blockquotes, headings, etc.).
  - **Grouping content into `<section>` elements** based on level 1 headings, nesting content properly.
- Builds the final XML document:
  - Inserts the metadata as a `<head>` element, with a `<title>` from the metadata’s `title` field.
  - Converts other metadata key-values to `<meta>` elements.
  - Places the serialized body content inside the `<body>` element.
  - Adds an XML declaration on top.

### 8. Output Formatting and Display

- The generated XML string is pretty-printed using `xml-formatter` for readability.
- The formatted XML is written to standard output.

### 9. Error Handling

- Wraps the entire processing pipeline in a `try-catch` block.
- Logs errors to standard error, ensuring the script does not crash silently.

---

## Function Descriptions

### `splitHeader(md)`

- Input: A Markdown string.
- Output: An object `{ header, body }`.
- Extracts the YAML front matter block between `---` delimiters.
- Returns `header: null` and full body if no front matter is found.

### `parseYamlPreamble(preambleStr)`

- Input: YAML string extracted from the front matter.
- Output: JavaScript object representing metadata.
- Parses YAML into an object using `js-yaml`.

### `stripContainerDirectives(md)`

- Input: Markdown string.
- Output: Markdown string with container directive lines removed.
- Removes lines starting with `:::` followed by any text.

### `escapeAttr(str)`

- Input: String.
- Output: XML-escaped string for use in attribute values.

### `generateHeadXml(metadata)`

- Input: Metadata object parsed from YAML.
- Output: XML string representing the `<head>` element.
- Includes `<title>` with metadata title.
- Converts all other metadata keys into `<meta name="..." content="..."/>` elements.

### `astToXml(ast, metadata)`

- Inputs:
  - `ast`: The full Markdown AST object.
  - `metadata`: Parsed metadata object.
- Output: Complete XML string representing the entire document.
- Serializes inline elements (`serializeInline`) like emphasis, strong, links, images, code, etc.
- Serializes block elements (`serializeNode`) like paragraphs, code blocks, lists, blockquotes.
- Groups content into `<section>` elements based on level 1 headings (`serializeBodyWithSections`).
- Builds the full XML document including the `<head>` and `<body>`.
- Returns the raw XML string (pretty-printing is handled outside).

### `prettyXml(xmlString)`

- Input: Raw XML string.
- Output: Formatted XML string with indentation and collapsed content.
- Uses the `xml-formatter` library for beautification.

---

## Interaction Flow Summary

1. **Input received** from `stdin`.
2. **Split** into YAML header and Markdown body.
3. **Parse YAML** into metadata object.
4. **Sanitize Markdown** by stripping container directives.
5. **Parse Markdown** to AST.
6. **Convert AST and metadata** into XML string.
7. **Pretty-print XML**.
8. **Output XML** to `stdout`.
9. **Handle errors** gracefully during the entire process.

---

## Usage

- Pipe a Markdown file with optional YAML front matter to this script.
- The output is a well-formed, pretty-printed XML document following your custom schema.
- Example command line:

```bash
cat input.md | node markdown-to-xml.js > output.xml
