# MySQL Slow Log Analyzer

A client-side tool to analyze MySQL and MariaDB slow query logs directly in the browser.

This project reads a MySQL/MariaDB slow query log file and converts it into structured data, statistics, and actionable insights about query performance, lock contention, and efficiency issues — without requiring a backend or database connection.

All processing happens locally in the browser.

---

## Features

- Drag-and-drop or file upload support for slow query logs
- Fully client-side processing (no data leaves your machine)
- Multiple processing modes for large files:
  - Full analysis
  - Recent entries only
  - Sampling mode
- Automatic parsing of slow log entries, including:
  - Execution time
  - Lock time
  - Rows examined / rows returned
  - User, schema, timestamp, and SQL text
- Query severity classification based on:
  - Execution time
  - Lock wait time
  - Rows examined vs rows returned divergence
- Aggregated statistics:
  - Total queries
  - Average query time
  - Average QPS
  - Lock contention metrics
  - Time range covered by the log
- Advanced filtering and sorting:
  - SQL text search
  - Schema and user
  - Severity level
  - Time range
  - Execution time thresholds
  - Lock time thresholds
  - Efficiency issues (possible missing indexes)
- Expandable query view with formatted SQL

---

## Why this exists

Slow query logs are valuable but difficult to work with at scale. Existing tools often require server access, database imports, or external dependencies.

This project focuses on:
- Quick analysis without setup
- Data privacy (local processing)
- Helping identify which queries deserve attention first

It is intended as a diagnostic and investigation tool, not a replacement for full performance monitoring systems.

---

## How it works

1. A slow query log file is loaded in the browser using the File API.
2. The log is parsed line by line and converted into structured query objects.
3. Queries are analyzed to detect performance and efficiency issues.
4. Results are displayed with statistics, filters, and expandable query details.

For large files, processing is performed in chunks to avoid blocking the UI.

---

## Supported logs

- MySQL slow query log
- MariaDB slow query log

The parser is designed to handle standard slow log formats and common variations.

---

## Limitations

- Very large log files may require sampling or recent-only processing
- Query normalization and fingerprinting are not currently implemented
- Results depend on the completeness and correctness of the log file

---

## Usage

1. Open the application in your browser
2. Upload or drag a slow query log file
3. Select a processing mode and optional execution time threshold
4. Start processing and explore the results

No installation or backend setup is required.

---

## Development

This is a standalone frontend project built with plain HTML, CSS, and JavaScript.

There are no external dependencies.

To run locally:

```bash
git clone git@github.com:davydmaker/mysql-slow-log-analyzer.git
cd mysql-slow-log-analyzer
open index.html
```

---

## Roadmap
- Query fingerprinting and grouping
- CSV / JSON export
- Visualization charts
- Web Worker support for heavy processing
- Saved filter presets
