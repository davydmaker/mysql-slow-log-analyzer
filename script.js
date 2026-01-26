const appState = {
  queries: [],
  filteredQueries: [],
  stats: {},
  processingMode: "recent",
  currentFile: null,
};

const uploadArea = document.getElementById("uploadArea");
const fileInput = document.getElementById("fileInput");
const fileInfo = document.getElementById("fileInfo");
const processingOptions = document.getElementById("processingOptions");
const progressContainer = document.getElementById("progressContainer");
const resultsContainer = document.getElementById("resultsContainer");

uploadArea.addEventListener("click", () => fileInput.click());
uploadArea.addEventListener("dragover", handleDragOver);
uploadArea.addEventListener("drop", handleDrop);
uploadArea.addEventListener("dragleave", handleDragLeave);
fileInput.addEventListener("change", handleFileSelect);

document.querySelectorAll(".option-card").forEach((card) => {
  card.addEventListener("click", () =>
    selectProcessingMode(card.dataset.mode, false),
  );
});

document
  .getElementById("searchFilter")
  .addEventListener("input", applyFilters);
document
  .getElementById("schemaFilter")
  .addEventListener("change", applyFilters);
document
  .getElementById("userFilter")
  .addEventListener("change", applyFilters);
document
  .getElementById("severityFilter")
  .addEventListener("change", applyFilters);
document
  .getElementById("dateFromFilter")
  .addEventListener("change", applyFilters);
document
  .getElementById("dateToFilter")
  .addEventListener("change", applyFilters);
document
  .getElementById("sortFilter")
  .addEventListener("change", applyFilters);
document
  .getElementById("limitFilter")
  .addEventListener("change", applyFilters);
document
  .getElementById("minTimeFilter")
  .addEventListener("input", applyFilters);
document
  .getElementById("maxTimeFilter")
  .addEventListener("input", applyFilters);
document
  .getElementById("minLockTimeFilter")
  .addEventListener("input", applyFilters);
document
  .getElementById("rowsRatioFilter")
  .addEventListener("input", applyFilters);
document
  .getElementById("indexIssueFilter")
  .addEventListener("change", applyFilters);

function handleDragOver(e) {
  e.preventDefault();
  uploadArea.classList.add("dragover");
}

function handleDragLeave(e) {
  e.preventDefault();
  uploadArea.classList.remove("dragover");
}

function handleDrop(e) {
  e.preventDefault();
  uploadArea.classList.remove("dragover");
  const files = e.dataTransfer.files;
  if (files.length > 0) {
    handleFile(files[0]);
  }
}

function handleFileSelect(e) {
  const file = e.target.files[0];
  if (file) {
    handleFile(file);
  }
}

function handleFile(file) {
  appState.currentFile = file;

  const fileSize = (file.size / 1024 / 1024).toFixed(2);
  fileInfo.innerHTML = `
    <strong>File:</strong> ${file.name}<br>
    <strong>Size:</strong> ${fileSize}MB<br>
    <strong>Type:</strong> ${file.type || "text/plain"}
  `;
  fileInfo.style.display = "block";
  processingOptions.classList.remove("hidden");

  let suggestion = "";
  if (parseFloat(fileSize) > 50) {
    selectProcessingMode("sample", false);
    suggestion =
      "<strong>Tip:</strong> Use sampling mode for large files";
  } else if (parseFloat(fileSize) > 10) {
    selectProcessingMode("recent", false);
    suggestion =
      "<strong>Tip:</strong> Recent mode recommended for medium files";
  } else {
    selectProcessingMode("recent", false);
    suggestion = "<strong>Ready to go!</strong>";
  }

  if (suggestion) {
    fileInfo.innerHTML += `<br><div class="file-suggestion">${suggestion}</div>`;
  }
}

function selectProcessingMode(mode, autoProcess = false) {
  document
    .querySelectorAll(".option-card")
    .forEach((card) => card.classList.remove("selected"));
  document
    .querySelector(`[data-mode="${mode}"]`)
    .classList.add("selected");
  appState.processingMode = mode;

  const startBtn = document.getElementById("startProcessingBtn");
  if (startBtn) {
    let btnText = "Start Processing";
    switch (mode) {
      case "full":
        btnText = "Process Full File";
        break;
      case "recent":
        btnText = "Process Last 10k Lines";
        break;
      case "sample":
        btnText = "Process Sampling (10%)";
        break;
    }
    startBtn.textContent = btnText;
  }

  if (autoProcess) {
    setTimeout(() => processFile(), 500);
  }
}

function setMinTime(value) {
  const input = document.getElementById("minExecutionTime");
  if (input) {
    input.value = value;
    input.style.background = value > 0 ? "#e6fffa" : "#ffffff";
    input.style.borderColor = value > 0 ? "#38b2ac" : "#cbd5e0";
  }
}

function processFile() {
  if (!appState.currentFile) {
    alert("Select a file first");
    return;
  }

  processingOptions.classList.add("hidden");
  progressContainer.classList.add("visible");

  const reader = new FileReader();
  reader.onload = function (e) {
    const content = e.target.result;
    parseSlowLog(content);
  };
  reader.readAsText(appState.currentFile);
}

function updateProgress(percent, text) {
  document.getElementById("progressFill").style.width = percent + "%";
  document.getElementById("progressText").textContent = text;
}

function parseSlowLog(content) {
  updateProgress(10, "Parsing log file...");

  setTimeout(() => {
    try {
      const lines = content.split("\n");
      const queries = [];
      let currentQuery = null;
      let currentTime = null;
      let processedLines = 0;

      let linesToProcess = lines.length;
      if (appState.processingMode === "recent") {
        linesToProcess = Math.min(50000, lines.length);
        lines.splice(0, lines.length - linesToProcess);
      } else if (appState.processingMode === "sample") {
        const sampledLines = [];
        for (let i = 0; i < lines.length; i += 10) {
          sampledLines.push(lines[i]);
        }
        lines.length = 0;
        lines.push.apply(lines, sampledLines);
        linesToProcess = lines.length;
      }

      const minTime = parseFloat(
        document.getElementById("minExecutionTime")?.value || 0,
      );
      const filterText = minTime > 0 ? ` (filter: ≥${minTime}ms)` : "";
      updateProgress(
        20,
        `Processing ${linesToProcess.toLocaleString()} lines${filterText}...`,
      );

      for (let i = 0; i < lines.length; i++) {
        processedLines++;

        if (processedLines % 5000 === 0) {
          const progress =
            20 + Math.floor((processedLines / lines.length) * 60);
          updateProgress(
            progress,
            `Processing line ${processedLines.toLocaleString()} of ${lines.length.toLocaleString()}`,
          );
        }

        const line = cleanLine(lines[i].trim());

        if (line.startsWith("# Time:")) {
          currentTime = parseTimeEntry(line);
        } else if (line.startsWith("# User@Host:")) {
          if (currentQuery && currentQuery.sql) {
            const minTime = parseFloat(
              document.getElementById("minExecutionTime")?.value || 0,
            );
            const queryTimeMs = (currentQuery.query_time || 0) * 1000;

            if (queryTimeMs >= minTime) {
              queries.push(currentQuery);
            }
          }

          currentQuery = {
            time: currentTime,
            user_host: parseUserHost(line),
            thread_id: null,
            schema: null,
            query_time: 0,
            lock_time: 0,
            rows_sent: 0,
            rows_examined: 0,
            rows_affected: 0,
            bytes_sent: 0,
            timestamp: null,
            sql: "",
            severity: "low",
          };
        } else if (currentQuery) {
          if (line.startsWith("# Thread_id:")) {
            const match = line.match(
              /Thread_id:\s+(\d+)\s+Schema:\s+(\w+)/,
            );
            if (match) {
              currentQuery.thread_id = parseInt(match[1]);
              currentQuery.schema = match[2];
            }
          } else if (line.startsWith("# Query_time:")) {
            const metrics = parseQueryMetrics(line);
            Object.assign(currentQuery, metrics);
          } else if (line.startsWith("# Rows_affected:")) {
            const match = line.match(
              /Rows_affected:\s+([\d.]+)\s+Bytes_sent:\s+([\d.]+)/,
            );
            if (match) {
              currentQuery.rows_affected = parseInt(match[1]);
              currentQuery.bytes_sent = parseInt(match[2]);
            }
          } else if (line.startsWith("SET timestamp=")) {
            const match = line.match(/SET timestamp=(\d+);/);
            if (match) {
              currentQuery.timestamp = parseInt(match[1]) * 1000;
              currentQuery.datetime = new Date(currentQuery.timestamp);
            }
          } else if (
            !line.startsWith("#") &&
            line &&
            !line.startsWith("SET timestamp=") &&
            !line.startsWith("use ")
          ) {
            currentQuery.sql += line + " ";
          }
        }
      }

      if (currentQuery && currentQuery.sql) {
        const minTime = parseFloat(
          document.getElementById("minExecutionTime")?.value || 0,
        );
        const queryTimeMs = (currentQuery.query_time || 0) * 1000;

        if (queryTimeMs >= minTime) {
          queries.push(currentQuery);
        }
      }

      updateProgress(85, "Analyzing queries...");

      // Process in chunks to avoid browser freezing
      const chunkSize = 1000;
      let processed = 0;

      function processChunk() {
        const end = Math.min(processed + chunkSize, queries.length);

        for (let i = processed; i < end; i++) {
          const query = queries[i];
          const efficiency = calculateEfficiency(query);
          query.severity = efficiency.level;
          query.index_issue =
            efficiency.level !== "low" ? efficiency.level : "none";
          query.efficiency_issues = efficiency.issues;
          query.rows_ratio = calculateRowsRatio(query);
          query.sql = cleanSqlString(query.sql || "").trim();
          query.sql_preview =
            query.sql.substring(0, 100) +
            (query.sql.length > 100 ? "..." : "");
        }

        processed = end;
        const progress =
          85 + Math.floor((processed / queries.length) * 10);
        updateProgress(
          progress,
          `Processing metrics: ${processed.toLocaleString()} of ${queries.length.toLocaleString()}`,
        );

        if (processed < queries.length) {
          setTimeout(processChunk, 0);
        } else {
          finishProcessing();
        }
      }

      function finishProcessing() {
        queries.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        appState.queries = queries;

        updateProgress(95, "Building stats...");
        generateStats();

        updateProgress(100, "Done!");

        setTimeout(() => {
          progressContainer.classList.remove("visible");
          resultsContainer.classList.add("visible");
          displayResults();
        }, 500);
      }

      if (queries.length > 0) {
        processChunk();
      } else {
        finishProcessing();
      }
    } catch (error) {
      console.error("Parsing error:", error);
      updateProgress(0, "Processing error: " + error.message);
    }
  }, 100);
}

function cleanLine(line) {
  if (!line) return "";

  return line
    .replace(/[\x00-\x1F\x7F-\x9F]/g, "")
    .replace(/&#[0-9a-fA-F]+;/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanSqlString(sql) {
  if (!sql) return "SQL not available";

  return sql
    .replace(/[\x00-\x1F\x7F-\x9F]/g, "")
    .replace(/&#[0-9a-fA-F]+;/g, "")
    .replace(/&[a-zA-Z0-9#]+;(?![a-zA-Z0-9#]*;)/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(
      /\b(SELECT|FROM|WHERE|JOIN|INNER|LEFT|RIGHT|ON|UPDATE|SET|DELETE|INSERT|INTO|VALUES|GROUP BY|ORDER BY|HAVING|UNION|AND|OR)\b/gi,
      "\n$1",
    )
    .replace(/,\s*/g, ",\n    ")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line)
    .join("\n");
}

function parseTimeEntry(line) {
  const match = line.match(/# Time:\s+(\d{6})\s+(\d{2}):(\d{2}):(\d{2})/);
  if (match) {
    const [, date, hour, minute, second] = match;
    const year = "20" + date.substring(0, 2);
    const month = date.substring(2, 4) - 1;
    const day = date.substring(4, 6);
    return new Date(year, month, day, hour, minute, second);
  }
  return null;
}

function parseUserHost(line) {
  const match = line.match(
    /# User@Host:\s+([^\[]+)\[([^\]]*)\]\s+@\s+([^\[]+)\s*\[([^\]]*)\]/,
  );
  if (match) {
    return {
      user: match[1].trim(),
      real_user: match[2].trim(),
      host: match[3].trim(),
      ip: match[4].trim() || "localhost",
    };
  }

  const simpleMatch = line.match(/# User@Host:\s+([^\s]+)/);
  if (simpleMatch) {
    return {
      user: simpleMatch[1],
      real_user: simpleMatch[1],
      host: "localhost",
      ip: "",
    };
  }

  return {
    user: "unknown",
    real_user: "unknown",
    host: "unknown",
    ip: "",
  };
}

function parseQueryMetrics(line) {
  const metrics = {};

  const queryTimeMatch = line.match(/Query_time:\s+([\d.]+)/);
  if (queryTimeMatch) metrics.query_time = parseFloat(queryTimeMatch[1]);

  const lockTimeMatch = line.match(/Lock_time:\s+([\d.]+)/);
  if (lockTimeMatch) metrics.lock_time = parseFloat(lockTimeMatch[1]);

  const rowsSentMatch = line.match(/Rows_sent:\s+([\d.]+)/);
  if (rowsSentMatch) metrics.rows_sent = parseInt(rowsSentMatch[1]);

  const rowsExaminedMatch = line.match(/Rows_examined:\s+([\d.]+)/);
  if (rowsExaminedMatch)
    metrics.rows_examined = parseInt(rowsExaminedMatch[1]);

  return metrics;
}

// Calculate query efficiency (time, lock time, row divergence)
function calculateEfficiency(query) {
  const queryTime = query.query_time || 0;
  const lockTime = query.lock_time || 0;
  const rowsExamined = query.rows_examined || 0;
  const rowsSent = query.rows_sent || 0;

  let maxSeverity = "low";
  const issues = {
    query_time: null,
    lock_time: null,
    rows_examined: null,
  };

  // Evaluate execution time
  if (queryTime > 2.0) {
    maxSeverity = "critical";
    issues.query_time = "critical";
  } else if (queryTime > 0.5) {
    if (maxSeverity === "low") maxSeverity = "high";
    if (maxSeverity === "medium") maxSeverity = "high";
    issues.query_time = "high";
  } else if (queryTime > 0.05) {
    if (maxSeverity === "low") maxSeverity = "medium";
    issues.query_time = "medium";
  }

  // Evaluate lock time
  if (lockTime > 0.5) {
    maxSeverity = "critical";
    issues.lock_time = "critical";
  } else if (lockTime > 0.1) {
    if (maxSeverity === "low") maxSeverity = "high";
    if (maxSeverity === "medium") maxSeverity = "high";
    issues.lock_time = "high";
  } else if (lockTime > 0.01) {
    if (maxSeverity === "low") maxSeverity = "medium";
    issues.lock_time = "medium";
  }

  // Evaluate row divergence
  // Only considers inefficient if there is real divergence (rows_examined > rows_sent)
  // And rows_examined > 0 (otherwise there is no problem)
  if (rowsExamined > 0) {
    if (rowsSent === 0) {
      // For modification queries, evaluate only by rows_examined
      if (rowsExamined > 10000) {
        maxSeverity = "critical";
        issues.rows_examined = "critical";
      } else if (rowsExamined > 1000) {
        if (maxSeverity === "low") maxSeverity = "high";
        if (maxSeverity === "medium") maxSeverity = "high";
        issues.rows_examined = "high";
      } else if (rowsExamined > 100) {
        if (maxSeverity === "low") maxSeverity = "medium";
        issues.rows_examined = "medium";
      }
    } else {
      // There is only divergence if rows_examined > rows_sent
      if (rowsExamined > rowsSent) {
        const ratio = rowsExamined / rowsSent;
        if (ratio > 1000) {
          maxSeverity = "critical";
          issues.rows_examined = "critical";
        } else if (ratio > 100) {
          if (maxSeverity === "low") maxSeverity = "high";
          if (maxSeverity === "medium") maxSeverity = "high";
          issues.rows_examined = "high";
        } else if (ratio > 10) {
          if (maxSeverity === "low") maxSeverity = "medium";
          issues.rows_examined = "medium";
        }
      }
    }
  }

  return {
    level: maxSeverity,
    issues: issues,
  };
}

function calculateRowsRatio(query) {
  const rowsExamined = query.rows_examined || 0;
  const rowsSent = query.rows_sent || 0;

  if (rowsSent === 0) return 0;
  return rowsExamined / rowsSent;
}

function generateStats() {
  const totalQueries = appState.queries.length;
  const timeRange = getTimeRange();
  const durationMinutes = timeRange.duration / (1000 * 60);
  const minTime = parseFloat(
    document.getElementById("minExecutionTime")?.value || 0,
  );

  const queriesWithIndexIssue = appState.queries.filter(
    (q) =>
      q.index_issue &&
      q.index_issue !== "none" &&
      q.index_issue !== "unknown",
  );
  const queriesWithHighLockTime = appState.queries.filter(
    (q) => (q.lock_time || 0) > 0.01,
  );

  appState.stats = {
    total_queries: totalQueries,
    avg_query_time:
      totalQueries > 0
        ? appState.queries.filter((q) => q.query_time > 0).length > 0
          ? appState.queries
              .filter((q) => q.query_time > 0)
              .reduce((sum, q) => sum + q.query_time, 0) /
            appState.queries.filter((q) => q.query_time > 0).length
          : 0
        : 0,
    total_query_time: appState.queries.reduce(
      (sum, q) => sum + (q.query_time || 0),
      0,
    ),
    avg_lock_time:
      totalQueries > 0
        ? appState.queries.filter((q) => q.lock_time > 0).length > 0
          ? appState.queries
              .filter((q) => q.lock_time > 0)
              .reduce((sum, q) => sum + q.lock_time, 0) /
            appState.queries.filter((q) => q.lock_time > 0).length
          : 0
        : 0,
    max_lock_time:
      totalQueries > 0
        ? appState.queries.reduce(
            (max, q) => Math.max(max, q.lock_time || 0),
            0,
          )
        : 0,
    qps: durationMinutes > 0 ? (totalQueries / durationMinutes) * 60 : 0,
    severities: {
      critical: appState.queries.filter((q) => q.severity === "critical")
        .length,
      high: appState.queries.filter((q) => q.severity === "high").length,
      medium: appState.queries.filter((q) => q.severity === "medium").length,
      low: appState.queries.filter((q) => q.severity === "low").length,
    },
    index_issues: {
      critical: appState.queries.filter(
        (q) => q.index_issue === "critical",
      ).length,
      high: appState.queries.filter((q) => q.index_issue === "high").length,
      medium: appState.queries.filter((q) => q.index_issue === "medium")
        .length,
      total: queriesWithIndexIssue.length,
    },
    lock_time_issues: queriesWithHighLockTime.length,
    time_range: timeRange,
    filter_config: {
      min_execution_time_ms: minTime,
      processing_mode: appState.processingMode,
    },
  };
}

function getTimeRange() {
  const timestamps = appState.queries
    .filter((q) => q.timestamp)
    .map((q) => q.timestamp);

  if (timestamps.length === 0)
    return { start: null, end: null, duration: 0 };

  let start = timestamps[0];
  let end = timestamps[0];

  for (let i = 1; i < timestamps.length; i++) {
    if (timestamps[i] < start) start = timestamps[i];
    if (timestamps[i] > end) end = timestamps[i];
  }

  return {
    start: new Date(start),
    end: new Date(end),
    duration: end - start,
  };
}

function formatDateTime(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

function displayResults() {
  displayStats();
  populateFilterOptions();
  applyFilters();
}

function populateFilterOptions() {
  const schemas = [
    ...new Set(
      appState.queries
        .map((q) => q.schema)
        .filter((s) => s && s !== "N/A"),
    ),
  ];

  const schemaSelect = document.getElementById("schemaFilter");
  schemaSelect.innerHTML = '<option value="">All Schemas</option>';
  schemas.sort().forEach((schema) => {
    const option = document.createElement("option");
    option.value = schema;
    option.textContent = schema;
    schemaSelect.appendChild(option);
  });

  const users = [
    ...new Set(
      appState.queries
        .map((q) =>
          q.user_host && q.user_host.user ? q.user_host.user : null,
        )
        .filter((u) => u && u !== "N/A" && u !== "unknown"),
    ),
  ];

  const userSelect = document.getElementById("userFilter");
  userSelect.innerHTML = '<option value="">All Users</option>';
  users.sort().forEach((user) => {
    const option = document.createElement("option");
    option.value = user;
    option.textContent = user;
    userSelect.appendChild(option);
  });

  const timestamps = appState.queries
    .map((q) => q.timestamp)
    .filter((t) => t);

  if (timestamps.length > 0) {
    let minTimestamp = timestamps[0];
    let maxTimestamp = timestamps[0];

    for (let i = 1; i < timestamps.length; i++) {
      if (timestamps[i] < minTimestamp) minTimestamp = timestamps[i];
      if (timestamps[i] > maxTimestamp) maxTimestamp = timestamps[i];
    }

    const minDate = new Date(minTimestamp);
    const maxDate = new Date(maxTimestamp);

    document.getElementById("dateFromFilter").min = formatDateTime(minDate);
    document.getElementById("dateFromFilter").max = formatDateTime(maxDate);
    document.getElementById("dateToFilter").min = formatDateTime(minDate);
    document.getElementById("dateToFilter").max = formatDateTime(maxDate);

    const dayAgo = new Date(maxDate.getTime() - 24 * 60 * 60 * 1000);
    if (dayAgo > minDate) {
      document.getElementById("dateFromFilter").value = formatDateTime(dayAgo);
    }
    document.getElementById("dateToFilter").value = formatDateTime(maxDate);
  }

}

function displayStats() {
  const statsGrid = document.getElementById("statsGrid");
  const stats = appState.stats;

  statsGrid.innerHTML = `
    <div class="stat-card">
      <div class="custom-tooltip">Total queries found</div>
      <h3>Total Queries</h3>
      <div class="value">${stats.total_queries.toLocaleString()}</div>
    </div>
    <div class="stat-card">
      <div class="custom-tooltip">Average queries per second</div>
      <h3>Average QPS</h3>
      <div class="value">${stats.qps.toFixed(1)}</div>
    </div>
    <div class="stat-card">
      <div class="custom-tooltip">Average query execution time</div>
      <h3>Average Time</h3>
      <div class="value">${stats.avg_query_time > 0 ? (stats.avg_query_time * 1000).toFixed(0) + "ms" : "N/A"}</div>
    </div>
    <div class="stat-card">
      <div class="custom-tooltip">Critical queries (slow, high lock, or inefficient)</div>
      <h3>Critical Queries</h3>
      <div class="value">${stats.severities.critical}</div>
    </div>
    <div class="stat-card">
      <div class="custom-tooltip">Average lock wait time</div>
      <h3>Average Lock Time</h3>
      <div class="value">${stats.avg_lock_time > 0 ? (stats.avg_lock_time * 1000).toFixed(0) + "ms" : "N/A"}</div>
    </div>
    <div class="stat-card">
      <div class="custom-tooltip">Time span covered by the log</div>
      <h3>Period</h3>
      <div class="value">${stats.time_range.duration > 0 ? Math.round(stats.time_range.duration / (1000 * 60)) + "min" : "N/A"}</div>
    </div>
    <div class="stat-card stat-card-border-teal">
      <div class="custom-tooltip">Time threshold used during processing</div>
      <h3>Applied Filter</h3>
      <div class="value value-small">
        ${stats.filter_config.min_execution_time_ms > 0
          ? `≥${stats.filter_config.min_execution_time_ms}ms`
          : "No filter"}
      </div>
    </div>
    <div class="stat-card stat-card-border-purple">
      <div class="custom-tooltip">How the file was processed</div>
      <h3>Processing Mode</h3>
      <div class="value value-xs">
        ${stats.filter_config.processing_mode === "full"
          ? "Full"
          : stats.filter_config.processing_mode === "recent"
            ? "Recent"
            : "Sample"}
      </div>
    </div>
    <div class="stat-card stat-card-border-red">
      <div class="custom-tooltip">Queries with performance issues</div>
      <h3>Efficiency Problems</h3>
      <div class="value">${stats.index_issues.total}</div>
    </div>
    <div class="stat-card stat-card-border-orange">
      <div class="custom-tooltip">Worst lock time found</div>
      <h3>Max Lock Time</h3>
      <div class="value">${(stats.max_lock_time * 1000).toFixed(0)}ms</div>
    </div>
    <div class="stat-card stat-card-border-dark-red">
      <div class="custom-tooltip">Queries with lock time > 10ms (possible contention)</div>
      <h3>Queries with High Lock</h3>
      <div class="value">${stats.lock_time_issues}</div>
    </div>
  `;
}

function applyFilters() {
  const searchTerm = document
    .getElementById("searchFilter")
    .value.toLowerCase();
  const schemaFilter = document.getElementById("schemaFilter").value;
  const userFilter = document.getElementById("userFilter").value;
  const severityFilter = document.getElementById("severityFilter").value;
  const dateFromFilter = document.getElementById("dateFromFilter").value;
  const dateToFilter = document.getElementById("dateToFilter").value;
  const sortBy = document.getElementById("sortFilter").value;
  const limit = document.getElementById("limitFilter").value;
  const minTimeFilter =
    parseFloat(document.getElementById("minTimeFilter").value) || 0;
  const maxTimeFilter =
    parseFloat(document.getElementById("maxTimeFilter").value) || Infinity;
  const minLockTimeFilter =
    parseFloat(document.getElementById("minLockTimeFilter").value) || 0;
  const rowsRatioFilter =
    parseFloat(document.getElementById("rowsRatioFilter").value) || 0;
  const indexIssueFilter = document.getElementById("indexIssueFilter").value;

  // Convert dates to timestamps if provided
  const dateFromTimestamp = dateFromFilter
    ? new Date(dateFromFilter).getTime()
    : null;
  const dateToTimestamp = dateToFilter
    ? new Date(dateToFilter).getTime()
    : null;

  appState.filteredQueries = appState.queries.filter((query) => {
    const matchesSearch =
      !searchTerm ||
      (query.sql && query.sql.toLowerCase().includes(searchTerm)) ||
      (query.schema && query.schema.toLowerCase().includes(searchTerm));

    const matchesSchema = !schemaFilter || query.schema === schemaFilter;

    const matchesUser =
      !userFilter ||
      (query.user_host && query.user_host.user === userFilter);

    const matchesSeverity =
      !severityFilter || query.severity === severityFilter;

    const queryTimeMs = (query.query_time || 0) * 1000;
    const matchesMinTime = queryTimeMs >= minTimeFilter;
    const matchesMaxTime = queryTimeMs <= maxTimeFilter;

    const lockTimeMs = (query.lock_time || 0) * 1000;
    const matchesMinLockTime = lockTimeMs >= minLockTimeFilter;

    const matchesRowsRatio =
      !rowsRatioFilter || (query.rows_ratio || 0) >= rowsRatioFilter;

    let matchesIndexIssue = true;
    if (indexIssueFilter === "yes") {
      matchesIndexIssue =
        query.index_issue &&
        query.index_issue !== "none" &&
        query.index_issue !== "unknown";
    } else if (indexIssueFilter === "no") {
      matchesIndexIssue =
        !query.index_issue ||
        query.index_issue === "none" ||
        query.index_issue === "unknown";
    }

    let matchesDateRange = true;
    if (dateFromTimestamp || dateToTimestamp) {
      const queryTimestamp = query.timestamp;
      if (queryTimestamp) {
        if (dateFromTimestamp && queryTimestamp < dateFromTimestamp)
          matchesDateRange = false;
        if (dateToTimestamp && queryTimestamp > dateToTimestamp)
          matchesDateRange = false;
      } else {
        matchesDateRange = false;
      }
    }

    return (
      matchesSearch &&
      matchesSchema &&
      matchesUser &&
      matchesSeverity &&
      matchesDateRange &&
      matchesMinTime &&
      matchesMaxTime &&
      matchesMinLockTime &&
      matchesRowsRatio &&
      matchesIndexIssue
    );
  });

  appState.filteredQueries.sort((a, b) => {
    switch (sortBy) {
      case "query_time":
        return (b.query_time || 0) - (a.query_time || 0);
      case "lock_time":
        return (b.lock_time || 0) - (a.lock_time || 0);
      case "rows_examined":
        return (b.rows_examined || 0) - (a.rows_examined || 0);
      case "timestamp":
        return (b.timestamp || 0) - (a.timestamp || 0);
      default:
        return 0;
    }
  });

  if (limit !== "all") {
    appState.filteredQueries = appState.filteredQueries.slice(
      0,
      parseInt(limit),
    );
  }

  updateFilterSummary();
  displayQueries();
}

function updateFilterSummary() {
  const summary = document.getElementById("filterSummary");
  const totalQueries = appState.queries.length;
  const filteredCount = appState.filteredQueries.length;

  let activeFilters = [];

  if (document.getElementById("searchFilter").value)
    activeFilters.push("Text");
  if (document.getElementById("schemaFilter").value)
    activeFilters.push("Schema");
  if (document.getElementById("userFilter").value)
    activeFilters.push("User");
  if (document.getElementById("severityFilter").value)
    activeFilters.push("Severity");
  if (
    document.getElementById("dateFromFilter").value ||
    document.getElementById("dateToFilter").value
  )
    activeFilters.push("Date");
  if (document.getElementById("minTimeFilter").value)
    activeFilters.push("Min Time");
  if (document.getElementById("maxTimeFilter").value)
    activeFilters.push("Max Time");
  if (document.getElementById("minLockTimeFilter").value)
    activeFilters.push("Min Lock");
  if (document.getElementById("rowsRatioFilter").value)
    activeFilters.push("Rows Ratio");
  if (document.getElementById("indexIssueFilter").value)
    activeFilters.push("Efficiency");

  const limit = document.getElementById("limitFilter").value;
  const displayedCount =
    limit === "all"
      ? filteredCount
      : Math.min(filteredCount, parseInt(limit));

  let summaryText = "";
  if (
    filteredCount === totalQueries &&
    displayedCount === filteredCount
  ) {
    summaryText = `${displayedCount.toLocaleString()} queries`;
  } else if (displayedCount === filteredCount) {
    summaryText = `${displayedCount.toLocaleString()} of ${totalQueries.toLocaleString()} queries`;
  } else {
    summaryText = `Showing ${displayedCount.toLocaleString()} of ${filteredCount.toLocaleString()} filtered (total: ${totalQueries.toLocaleString()})`;
  }

  if (activeFilters.length > 0) {
    summaryText += ` | Filters: ${activeFilters.join(", ")}`;
  }

  summary.textContent = summaryText;
}

function clearAllFilters() {
  document.getElementById("searchFilter").value = "";
  document.getElementById("schemaFilter").value = "";
  document.getElementById("userFilter").value = "";
  document.getElementById("severityFilter").value = "";
  document.getElementById("dateFromFilter").value = "";
  document.getElementById("dateToFilter").value = "";
  document.getElementById("sortFilter").value = "query_time";
  document.getElementById("limitFilter").value = "100";
  document.getElementById("minTimeFilter").value = "";
  document.getElementById("maxTimeFilter").value = "";
  document.getElementById("minLockTimeFilter").value = "";
  document.getElementById("rowsRatioFilter").value = "";
  document.getElementById("indexIssueFilter").value = "";

  applyFilters();
}

function setQuickFilters(type) {
  clearAllFilters();

  switch (type) {
    case "today":
      const now = new Date();
      const todayStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
      );
      document.getElementById("dateFromFilter").value = formatDateTime(todayStart);
      document.getElementById("dateToFilter").value = formatDateTime(now);
      break;

    case "critical":
      document.getElementById("severityFilter").value = "critical";
      break;
    case "index_issues":
      document.getElementById("indexIssueFilter").value = "yes";
      break;
    case "high_lock":
      document.getElementById("minLockTimeFilter").value = "10";
      break;
  }

  applyFilters();
}

function displayQueries() {
  const queriesList = document.getElementById("queriesList");

  if (appState.filteredQueries.length === 0) {
    queriesList.innerHTML = `
      <div class="empty-state">
        No queries match your filters.
      </div>
    `;
    return;
  }

  queriesList.innerHTML = appState.filteredQueries
    .map(
      (query, index) => `
      <div class="query-item severity-${query.severity}">
        <div class="query-header" onclick="toggleQuery(${index})">
          <div class="query-title">
            <span class="toggle-icon" id="icon-${index}">▶</span>
            <strong>Query #${index + 1}</strong>
          </div>
          <div class="query-info">
            <span>${query.datetime ? query.datetime.toLocaleString() : "N/A"}</span>
            <span>Schema: ${query.schema || "N/A"}</span>
            <span>User: ${query.user_host && query.user_host.user ? query.user_host.user : "N/A"}</span>
            <span class="query-time" style="color: ${query.efficiency_issues && query.efficiency_issues.query_time ? getIssueColor(query.efficiency_issues.query_time) : (query.query_time || 0) > 2.0 ? "#e53e3e" : (query.query_time || 0) > 0.5 ? "#d69e2e" : (query.query_time || 0) > 0.05 ? "#38b2ac" : getTimeColor(query.severity)}; font-weight: ${(query.efficiency_issues && query.efficiency_issues.query_time) || (query.query_time || 0) > 0.05 ? "600" : "normal"};">
              ${((query.query_time || 0) * 1000).toFixed(1)}ms
            </span>
            ${(query.lock_time || 0) > 0 ? `<span style="color: ${query.efficiency_issues && query.efficiency_issues.lock_time ? getIssueColor(query.efficiency_issues.lock_time) : (query.lock_time || 0) > 0.01 ? "#d69e2e" : "inherit"}; font-weight: ${query.efficiency_issues && query.efficiency_issues.lock_time ? "600" : (query.lock_time || 0) > 0.01 ? "600" : "normal"}; margin-right: 0.5rem;">Lock: ${((query.lock_time || 0) * 1000).toFixed(1)}ms</span>` : ""}
          </div>
          <span class="severity-badge badge-${query.severity}">${query.severity}</span>
        </div>
        
        <div class="query-content" id="content-${index}">
          <div class="query-metrics">
            <div class="metric">
              <div class="custom-tooltip tooltip-bottom">Query execution time</div>
              <div class="metric-label">Query Time</div>
              <div class="metric-value ${query.efficiency_issues && query.efficiency_issues.query_time ? "metric-value-bold" : ""}" style="color: ${query.efficiency_issues && query.efficiency_issues.query_time ? getIssueColor(query.efficiency_issues.query_time) : "inherit"};">
                ${((query.query_time || 0) * 1000).toFixed(2)}ms
              </div>
            </div>
            <div class="metric">
              <div class="custom-tooltip tooltip-bottom">Time waiting for table locks</div>
              <div class="metric-label">Lock Time</div>
              <div class="metric-value ${query.efficiency_issues && query.efficiency_issues.lock_time ? "metric-value-bold" : ""}" style="color: ${query.efficiency_issues && query.efficiency_issues.lock_time ? getIssueColor(query.efficiency_issues.lock_time) : "inherit"};">
                ${((query.lock_time || 0) * 1000).toFixed(2)}ms
              </div>
            </div>
            <div class="metric">
              <div class="custom-tooltip tooltip-bottom">Rows returned</div>
              <div class="metric-label">Rows Returned</div>
              <div class="metric-value">${(query.rows_sent || 0).toLocaleString()}</div>
            </div>
            <div class="metric">
              <div class="custom-tooltip tooltip-bottom">Rows examined (scanned)</div>
              <div class="metric-label">Rows Examined</div>
              <div class="metric-value ${query.efficiency_issues && query.efficiency_issues.rows_examined ? "metric-value-bold" : ""}" style="color: ${query.efficiency_issues && query.efficiency_issues.rows_examined ? getIssueColor(query.efficiency_issues.rows_examined) : "inherit"};">
                ${(query.rows_examined || 0).toLocaleString()}
              </div>
            </div>
            ${(query.rows_affected || 0) > 0 ? `
            <div class="metric">
              <div class="custom-tooltip tooltip-bottom">Rows affected (for UPDATE/DELETE/INSERT)</div>
              <div class="metric-label">Rows Affected</div>
              <div class="metric-value">${(query.rows_affected || 0).toLocaleString()}</div>
            </div>
            ` : ""}
          </div>
          
          <div class="query-sql">${escapeHtml(query.sql || "SQL not available")}</div>
        </div>
      </div>
    `,
    )
    .join("");
}

function getTimeColor(severity) {
  switch (severity) {
    case "critical":
      return "#e53e3e";
    case "high":
      return "#d69e2e";
    case "medium":
      return "#38b2ac";
    default:
      return "#68d391";
  }
}

function getIssueColor(issueLevel) {
  if (!issueLevel) return "inherit";
  switch (issueLevel) {
    case "critical":
      return "#e53e3e";
    case "high":
      return "#d69e2e";
    case "medium":
      return "#38b2ac";
    default:
      return "inherit";
  }
}

function getIssueFontWeight(issueLevel) {
  return issueLevel ? "600" : "normal";
}

function toggleQuery(index) {
  const icon = document.getElementById(`icon-${index}`);
  const content = document.getElementById(`content-${index}`);

  if (content.classList.contains("expanded")) {
    content.classList.remove("expanded");
    icon.textContent = "▶";
    icon.classList.remove("expanded");
  } else {
    content.classList.add("expanded");
    icon.textContent = "▼";
    icon.classList.add("expanded");
  }
}

function toggleAllQueries(expand = true) {
  const queries = document.querySelectorAll(".query-content");
  const icons = document.querySelectorAll(".toggle-icon");

  queries.forEach((content, index) => {
    const icon = icons[index];
    if (expand) {
      content.classList.add("expanded");
      icon.textContent = "▼";
      icon.classList.add("expanded");
    } else {
      content.classList.remove("expanded");
      icon.textContent = "▶";
      icon.classList.remove("expanded");
    }
  });
}

function escapeHtml(text) {
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}
