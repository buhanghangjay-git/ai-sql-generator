import { useState } from "react";
import * as XLSX from "xlsx";
import "./App.css";

function App() {
  // 1. Selected data source
  const [dataSource, setDataSource] = useState("database");

  // 2. Query states
  const [prompt, setPrompt] = useState("");
  const [sql, setSql] = useState("");
  const [results, setResults] = useState([]);
  const [history, setHistory] = useState([]);

  // 3. Excel states
  const [workbook, setWorkbook] = useState(null);
  const [sheetNames, setSheetNames] = useState([]);
  const [selectedSheet, setSelectedSheet] = useState("");
  const [excelRows, setExcelRows] = useState([]);
  const [columns, setColumns] = useState([]);
  const [uploadedFileName, setUploadedFileName] =
    useState("");

  // 4. Application states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // 5. Read one selected Excel sheet
  const readSheet = (book, sheetName) => {
    const sheet = book.Sheets[sheetName];

    const rows = XLSX.utils.sheet_to_json(sheet, {
      defval: "",
    });

    setSelectedSheet(sheetName);
    setExcelRows(rows);
    setResults([]);

    if (rows.length > 0) {
      setColumns(Object.keys(rows[0]));
    } else {
      setColumns([]);
    }
  };

  // 6. Handle Excel or CSV upload
  const handleFileUpload = (event) => {
    const file = event.target.files[0];

    if (!file) {
      return;
    }

    setError("");
    setSql("");
    setResults([]);
    setUploadedFileName(file.name);

    const reader = new FileReader();

    reader.onload = (fileEvent) => {
      try {
        const fileData = new Uint8Array(
          fileEvent.target.result
        );

        const book = XLSX.read(fileData, {
          type: "array",
        });

        setWorkbook(book);
        setSheetNames(book.SheetNames);

        if (book.SheetNames.length > 0) {
          readSheet(book, book.SheetNames[0]);
        }
      } catch (uploadError) {
        console.error(uploadError);

        setError(
          "The spreadsheet could not be read. Please use a valid Excel or CSV file."
        );

        clearUploadedFile();
      }
    };

    reader.onerror = () => {
      setError("The selected file could not be opened.");
    };

    reader.readAsArrayBuffer(file);
  };

  // 7. Change the active Excel sheet
  const handleSheetChange = (event) => {
    const newSheetName = event.target.value;

    if (workbook) {
      readSheet(workbook, newSheetName);
    }
  };

  // 8. Find a column without depending on exact capitalization
  const findColumn = (possibleNames) => {
    return columns.find((column) =>
      possibleNames.some((name) =>
        column
          .toLowerCase()
          .replaceAll(" ", "")
          .includes(name.toLowerCase())
      )
    );
  };

  // 9. Generate a query for an uploaded spreadsheet
  const queryExcel = () => {
    if (excelRows.length === 0) {
      throw new Error(
        "Please upload an Excel or CSV file first."
      );
    }

    const text = prompt.toLowerCase().trim();

    const departmentColumn = findColumn([
      "department",
      "dept",
      "division",
      "team",
    ]);

    const salaryColumn = findColumn([
      "salary",
      "income",
      "amount",
      "pay",
    ]);

    let filteredRows = [...excelRows];
    let generatedSQL =
      `SELECT * FROM [${selectedSheet}];`;

    // Find a department value from the uploaded data
    if (departmentColumn) {
      const availableDepartments = [
        ...new Set(
          excelRows
            .map((row) =>
              String(row[departmentColumn]).trim()
            )
            .filter(Boolean)
        ),
      ];

      const matchingDepartment =
        availableDepartments.find((department) =>
          text.includes(department.toLowerCase())
        );

      if (matchingDepartment) {
        filteredRows = filteredRows.filter(
          (row) =>
            String(row[departmentColumn])
              .trim()
              .toLowerCase() ===
            matchingDepartment.toLowerCase()
        );

        generatedSQL =
          `SELECT * FROM [${selectedSheet}] ` +
          `WHERE [${departmentColumn}] = ` +
          `'${matchingDepartment}';`;
      }
    }

    // Find a number in the user's request
    const numberMatch = text.match(
      /(?:₱|php|\$)?\s*(\d+(?:,\d{3})*(?:\.\d+)?)/
    );

    if (salaryColumn && numberMatch) {
      const amount = Number(
        numberMatch[1].replaceAll(",", "")
      );

      if (
        text.includes("greater") ||
        text.includes("above") ||
        text.includes("more than") ||
        text.includes("over")
      ) {
        filteredRows = filteredRows.filter(
          (row) =>
            Number(row[salaryColumn]) > amount
        );

        generatedSQL =
          `SELECT * FROM [${selectedSheet}] ` +
          `WHERE [${salaryColumn}] > ${amount};`;
      } else if (
        text.includes("less") ||
        text.includes("below") ||
        text.includes("under")
      ) {
        filteredRows = filteredRows.filter(
          (row) =>
            Number(row[salaryColumn]) < amount
        );

        generatedSQL =
          `SELECT * FROM [${selectedSheet}] ` +
          `WHERE [${salaryColumn}] < ${amount};`;
      }
    }

    // Show everything
    if (
      text.includes("show all") ||
      text.includes("all rows") ||
      text.includes("all records")
    ) {
      filteredRows = [...excelRows];

      generatedSQL =
        `SELECT * FROM [${selectedSheet}];`;
    }

    setSql(generatedSQL);
    setResults(filteredRows);

    setHistory((previousHistory) => [
      ...previousHistory,
      {
        source: `Excel: ${uploadedFileName}`,
        prompt,
        sql: generatedSQL,
        resultCount: filteredRows.length,
      },
    ]);
  };

  // 10. Query the SQL Server backend
  const queryDatabase = async () => {
    const response = await fetch(
      "http://localhost:5000/generate-sql",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.message ||
          "The database request could not be processed."
      );
    }

    setSql(data.sql || "");
    setResults(data.results || []);

    setHistory((previousHistory) => [
      ...previousHistory,
      {
        source: "SQL Server",
        prompt,
        sql: data.sql || "",
        resultCount: data.results?.length || 0,
      },
    ]);
  };

  // 11. Generate from the selected source
  const generateQuery = async () => {
    if (!prompt.trim()) {
      setError("Please enter a request.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      if (dataSource === "database") {
        await queryDatabase();
      } else {
        queryExcel();
      }
    } catch (requestError) {
      console.error(requestError);

      setError(
        requestError.message ||
          "The request could not be processed."
      );

      setSql("");
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  // 12. Copy generated SQL
  const copySQL = async () => {
    if (!sql) {
      setError("There is no query to copy.");
      return;
    }

    try {
      await navigator.clipboard.writeText(sql);
      setError("");
      alert("SQL copied!");
    } catch {
      setError("The SQL query could not be copied.");
    }
  };

  // 13. Clear the uploaded spreadsheet
  const clearUploadedFile = () => {
    setWorkbook(null);
    setSheetNames([]);
    setSelectedSheet("");
    setExcelRows([]);
    setColumns([]);
    setUploadedFileName("");
    setResults([]);
    setSql("");
  };

  // 14. Clear current request and output
  const clearCurrentQuery = () => {
    setPrompt("");
    setSql("");
    setResults([]);
    setError("");
  };

  // 15. Display any returned rows dynamically
  const renderResultsTable = (
    rows,
    className = "results-table"
  ) => {
    if (rows.length === 0) {
      return (
        <p className="empty-message">
          No records to display.
        </p>
      );
    }

    const tableColumns = Object.keys(rows[0]);

    return (
      <div className="table-wrapper">
        <table className={className}>
          <thead>
            <tr>
              {tableColumns.map((column) => (
                <th key={column}>{column}</th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {tableColumns.map((column) => (
                  <td key={`${rowIndex}-${column}`}>
                    {row[column] === null ||
                    row[column] === ""
                      ? "NULL"
                      : String(row[column])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="container">
      <div className="card">
        <h1>AI Data Query Generator</h1>

        <p className="subtitle">
          Query SQL Server or analyze an uploaded Excel
          or CSV file using natural language.
        </p>

        <h2>Choose Data Source</h2>

        <div className="source-selector">
          <button
            className={
              dataSource === "database"
                ? "source-button active-source"
                : "source-button"
            }
            onClick={() => {
              setDataSource("database");
              setSql("");
              setResults([]);
              setError("");
            }}
          >
            SQL Server
          </button>

          <button
            className={
              dataSource === "excel"
                ? "source-button active-source"
                : "source-button"
            }
            onClick={() => {
              setDataSource("excel");
              setSql("");
              setResults([]);
              setError("");
            }}
          >
            Excel / CSV
          </button>
        </div>

        <div className="source-information">
          {dataSource === "database" ? (
            <>
              <strong>Connected source:</strong>
              <span>AISQLGeneratorDB</span>
            </>
          ) : (
            <>
              <label
                className="file-label"
                htmlFor="spreadsheet-upload"
              >
                Upload Excel or CSV
              </label>

              <input
                id="spreadsheet-upload"
                className="file-input"
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
              />

              {uploadedFileName && (
                <div className="file-details">
                  <p>
                    <strong>File:</strong>{" "}
                    {uploadedFileName}
                  </p>

                  {sheetNames.length > 0 && (
                    <div className="sheet-selector">
                      <label htmlFor="sheet-select">
                        Sheet:
                      </label>

                      <select
                        id="sheet-select"
                        value={selectedSheet}
                        onChange={handleSheetChange}
                      >
                        {sheetNames.map((sheetName) => (
                          <option
                            key={sheetName}
                            value={sheetName}
                          >
                            {sheetName}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <p>
                    <strong>Rows:</strong>{" "}
                    {excelRows.length}
                  </p>

                  <p>
                    <strong>Columns:</strong>{" "}
                    {columns.join(", ") || "None"}
                  </p>

                  <button
                    className="danger-button"
                    onClick={clearUploadedFile}
                  >
                    Remove File
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {dataSource === "excel" &&
          excelRows.length > 0 && (
            <>
              <h2>Spreadsheet Preview</h2>

              {renderResultsTable(
                excelRows.slice(0, 5),
                "preview-table"
              )}

              {excelRows.length > 5 && (
                <p className="preview-note">
                  Showing the first 5 of{" "}
                  {excelRows.length} rows.
                </p>
              )}
            </>
          )}

        <h2>Ask About the Data</h2>

        <label htmlFor="prompt">
          Describe the records you want:
        </label>

        <textarea
          id="prompt"
          rows="5"
          value={prompt}
          onChange={(event) =>
            setPrompt(event.target.value)
          }
          placeholder={`Try:
Show all employees
Show HR employees
Show employees with salary above 50000`}
        />

        <div className="button-group">
          <button
            onClick={generateQuery}
            disabled={loading}
          >
            {loading
              ? "Processing..."
              : "Generate Query"}
          </button>

          <button
            className="secondary-button"
            onClick={copySQL}
          >
            Copy SQL
          </button>

          <button
            className="secondary-button"
            onClick={clearCurrentQuery}
          >
            Clear
          </button>
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <h2>Generated SQL</h2>

        <pre>
          {sql ||
            "-- Your generated query will appear here"}
        </pre>

        <div className="results-heading">
          <h2>Results</h2>

          <span className="result-count">
            {results.length} record
            {results.length === 1 ? "" : "s"}
          </span>
        </div>

        {renderResultsTable(results)}

        <div className="history-header">
          <h2>Query History</h2>

          <button
            className="danger-button"
            onClick={() => setHistory([])}
          >
            Clear History
          </button>
        </div>

        {history.length > 0 ? (
          <div className="history-list">
            {history.map((item, index) => (
              <div
                className="history-item"
                key={index}
              >
                <strong>
                  Request {index + 1}
                </strong>

                <p className="history-source">
                  Source: {item.source}
                </p>

                <p>{item.prompt}</p>

                <code>{item.sql}</code>

                <p>
                  Results: {item.resultCount}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="empty-message">
            No query history yet.
          </p>
        )}
      </div>
    </div>
  );
}

export default App;