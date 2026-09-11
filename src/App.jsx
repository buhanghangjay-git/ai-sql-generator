import { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import "./App.css";

import Header from "./components/Header";
import StatsCards from "./components/StatsCards";
import ResultsTable from "./components/ResultsTable";
import Suggestions from "./components/Suggestions";
import HistoryPanel from "./components/HistoryPanel";
import ChartsPanel from "./components/ChartsPanel";
import SummaryPanel from "./components/SummaryPanel";
import Footer from "./components/Footer";
import InsightsPanel from "./components/InsightsPanel";

import jsPDF from "jspdf";
import html2canvas from "html2canvas";


function App() {
  // 1. Data source
  const [dataSource, setDataSource] = useState("database");

  // 2. Query information
  const [prompt, setPrompt] = useState("");
  const [sql, setSql] = useState("");
  const [results, setResults] = useState([]);
  const [history, setHistory] = useState([]);
  const [favorites, setFavorites] = useState([]);

  // 3. Excel and CSV information
  const [workbook, setWorkbook] = useState(null);
  const [sheetNames, setSheetNames] = useState([]);
  const [selectedSheet, setSelectedSheet] = useState("");
  const [excelRows, setExcelRows] = useState([]);
  const [columns, setColumns] = useState([]);
  const [uploadedFileName, setUploadedFileName] =
    useState("");

  // 4. User feedback
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] =
    useState("");
  const [theme, setTheme] = useState("dark");

  useEffect(() => {
  const savedHistory =
    JSON.parse(localStorage.getItem("sqlHistory")) || [];

  const savedFavorites =
    JSON.parse(localStorage.getItem("sqlFavorites")) || [];

  setHistory(savedHistory);
  setFavorites(savedFavorites);
}, []);

  // 5. Suggested requests
  const databaseSuggestions = [
    "Show all employees",
    "Show HR employees",
    "Show IT employees",
    "Show employee salaries",
  ];

  const excelSuggestions = [
    "Show all records",
    "Show HR employees",
    "Show IT employees",
    "Show employees with salary above 50000",
    "Show employees with salary below 50000",
  ];

  const suggestions =
    dataSource === "database"
      ? databaseSuggestions
      : excelSuggestions;

  // 6. Read an Excel sheet
  const readSheet = (book, sheetName) => {
    const sheet = book.Sheets[sheetName];

    const rows = XLSX.utils.sheet_to_json(sheet, {
      defval: "",
    });

    setSelectedSheet(sheetName);
    setExcelRows(rows);
    setResults([]);
    setSql("");

    if (rows.length > 0) {
      setColumns(Object.keys(rows[0]));
    } else {
      setColumns([]);
    }
  };

  // 7. Clear uploaded spreadsheet
  const clearUploadedFile = () => {
    setWorkbook(null);
    setSheetNames([]);
    setSelectedSheet("");
    setExcelRows([]);
    setColumns([]);
    setUploadedFileName("");
    setResults([]);
    setSql("");
    setError("");
    setSuccessMessage("");
  };

  // 8. Handle Excel or CSV upload
  const handleFileUpload = (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setError("");
    setSuccessMessage("");
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

        if (book.SheetNames.length === 0) {
          throw new Error(
            "The uploaded file has no readable sheets."
          );
        }

        setWorkbook(book);
        setSheetNames(book.SheetNames);

        readSheet(book, book.SheetNames[0]);

        setSuccessMessage(
          `${file.name} was uploaded successfully.`
        );
      } catch (uploadError) {
        console.error(uploadError);

        setWorkbook(null);
        setSheetNames([]);
        setSelectedSheet("");
        setExcelRows([]);
        setColumns([]);
        setUploadedFileName("");
        setResults([]);
        setSql("");

        setError(
          "The spreadsheet could not be read. Please upload a valid Excel or CSV file."
        );
      }
    };

    reader.onerror = () => {
      setError(
        "The selected file could not be opened."
      );
    };

    reader.readAsArrayBuffer(file);
  };

  // 9. Change the active spreadsheet sheet
  const handleSheetChange = (event) => {
    const newSheetName = event.target.value;

    if (workbook) {
      readSheet(workbook, newSheetName);
    }
  };

  // 10. Normalize text for column matching
  const normalizeText = (value) => {
    return String(value)
      .toLowerCase()
      .replaceAll(" ", "")
      .replaceAll("_", "")
      .replaceAll("-", "");
  };

  // 11. Find a likely spreadsheet column
  const findColumn = (possibleNames) => {
    return columns.find((column) => {
      const normalizedColumn = normalizeText(column);

      return possibleNames.some((name) =>
        normalizedColumn.includes(
          normalizeText(name)
        )
      );
    });
  };

  // 12. Query uploaded spreadsheet data
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
      "compensation",
    ]);

    let filteredRows = [...excelRows];

    let generatedSQL =
      `SELECT * FROM [${selectedSheet}];`;

    let filterApplied = false;

    // Department filtering
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
          text.includes(
            department.toLowerCase()
          )
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

        filterApplied = true;
      }
    }

    // Number detection for salary filtering
    const numberMatch = text.match(
      /(?:₱|php|\$)?\s*(\d+(?:,\d{3})*(?:\.\d+)?)/
    );

    if (salaryColumn && numberMatch) {
      const amount = Number(
        numberMatch[1].replaceAll(",", "")
      );

      const getNumericValue = (value) => {
        return Number(
          String(value)
            .replaceAll(",", "")
            .replace(/[^\d.-]/g, "")
        );
      };

      if (
        text.includes("greater") ||
        text.includes("above") ||
        text.includes("more than") ||
        text.includes("over")
      ) {
        filteredRows = filteredRows.filter(
          (row) =>
            getNumericValue(
              row[salaryColumn]
            ) > amount
        );

        generatedSQL =
          `SELECT * FROM [${selectedSheet}] ` +
          `WHERE [${salaryColumn}] > ${amount};`;

        filterApplied = true;
      } else if (
        text.includes("less") ||
        text.includes("below") ||
        text.includes("under")
      ) {
        filteredRows = filteredRows.filter(
          (row) =>
            getNumericValue(
              row[salaryColumn]
            ) < amount
        );

        generatedSQL =
          `SELECT * FROM [${selectedSheet}] ` +
          `WHERE [${salaryColumn}] < ${amount};`;

        filterApplied = true;
      }
    }

    // Explicitly show all rows
    if (
      text.includes("show all") ||
      text.includes("all rows") ||
      text.includes("all records")
    ) {
      filteredRows = [...excelRows];

      generatedSQL =
        `SELECT * FROM [${selectedSheet}];`;

      filterApplied = true;
    }

    // If no supported filter was detected
    if (!filterApplied) {
      generatedSQL =
        `SELECT * FROM [${selectedSheet}];`;

      filteredRows = [...excelRows];
    }

    setSql(generatedSQL);
    setResults(filteredRows);

    const updatedHistory = [
  {
    source: `Excel: ${uploadedFileName}`,
    prompt,
    sql: generatedSQL,
    resultCount: filteredRows.length,
     },
        ...history,
      ];

      setHistory(updatedHistory);

    localStorage.setItem(
       "sqlHistory",
       JSON.stringify(updatedHistory)
    );

    if (filteredRows.length === 0) {
      setSuccessMessage("");
      setError(
        "The query was generated, but no matching records were found."
      );
    } else {
      setError("");
      setSuccessMessage(
        `${filteredRows.length} record${
          filteredRows.length === 1 ? "" : "s"
        } found successfully.`
      );
    }
  };

  // 13. Query SQL Server through Express
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

    const returnedResults = data.results || [];
    const returnedSQL =
      data.sql || "-- Query not recognized";

    setSql(returnedSQL);
    setResults(returnedResults);

    const updatedHistory = [
       {
       source: "SQL Server",
       prompt,
       sql: returnedSQL,
       resultCount: returnedResults.length,
          },
               ...history,
        ];

            setHistory(updatedHistory);
    
          localStorage.setItem(
  "sqlHistory",
  JSON.stringify(updatedHistory)
          );

    if (returnedSQL.includes("not recognized")) {
      setSuccessMessage("");
      setError(
        "The request was not recognized. Try one of the suggested questions."
      );
    } else if (returnedResults.length === 0) {
      setSuccessMessage("");
      setError(
        "The query was generated, but no matching records were found."
      );
    } else {
      setError("");
      setSuccessMessage(
        `${returnedResults.length} record${
          returnedResults.length === 1
            ? ""
            : "s"
        } found successfully.`
      );
    }
  };

  // 14. Generate the query
  const generateQuery = async () => {
    if (!prompt.trim()) {
      setError("Please enter a request.");
      setSuccessMessage("");
      return;
    }

    if (
      dataSource === "excel" &&
      excelRows.length === 0
    ) {
      setError(
        "Please upload an Excel or CSV file first."
      );
      setSuccessMessage("");
      return;
    }

    setLoading(true);
    setError("");
    setSuccessMessage("");

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

      setSuccessMessage("");
      setSql("");
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  // 15. Use a suggested request
  const useSuggestion = (suggestion) => {
    setPrompt(suggestion);
    setError("");
    setSuccessMessage("");
  };

  // 16. Copy generated SQL
  const copySQL = async () => {
    if (!sql) {
      setError("There is no query to copy.");
      setSuccessMessage("");
      return;
    }

    try {
      await navigator.clipboard.writeText(sql);

      setError("");
      setSuccessMessage(
        "The SQL query was copied."
      );
    } catch {
      setError(
        "The SQL query could not be copied."
      );

      setSuccessMessage("");
    }
  };

  // 17. Export results to Excel
  const exportResultsToExcel = () => {
    if (results.length === 0) {
      setError("There are no results to export.");
      setSuccessMessage("");
      return;
    }

    const worksheet =
      XLSX.utils.json_to_sheet(results);

    const exportWorkbook =
      XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      exportWorkbook,
      worksheet,
      "Query Results"
    );

    const currentDate = new Date()
      .toISOString()
      .slice(0, 10);

    XLSX.writeFile(
      exportWorkbook,
      `query-results-${currentDate}.xlsx`
    );

    setError("");
    setSuccessMessage(
      "The results were exported to Excel."
    );
  };

  // 18. Export results to CSV
  const exportResultsToCSV = () => {
    if (results.length === 0) {
      setError("There are no results to export.");
      setSuccessMessage("");
      return;
    }

    const worksheet =
      XLSX.utils.json_to_sheet(results);

    const csvContent =
      XLSX.utils.sheet_to_csv(worksheet);

    const csvBlob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });

    const downloadURL =
      URL.createObjectURL(csvBlob);

    const downloadLink =
      document.createElement("a");

    const currentDate = new Date()
      .toISOString()
      .slice(0, 10);

    downloadLink.href = downloadURL;
    downloadLink.download =
      `query-results-${currentDate}.csv`;

    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);

    URL.revokeObjectURL(downloadURL);

    setError("");
    setSuccessMessage(
      "The results were exported to CSV."
    );
  };

  const exportPDF = async () => {
  const input = document.getElementById("report-section");

  if (!input) {
    alert("Report section not found.");
    return;
  }

  const canvas = await html2canvas(input);

  const imgData = canvas.toDataURL("image/png");

  const pdf = new jsPDF("p", "mm", "a4");

  const pdfWidth = pdf.internal.pageSize.getWidth();

  const imgWidth = pdfWidth - 20;

  const imgHeight =
    (canvas.height * imgWidth) / canvas.width;

  pdf.addImage(
    imgData,
    "PNG",
    10,
    10,
    imgWidth,
    imgHeight
  );

  pdf.save("AI_SQL_Report.pdf");
};

  // 19. Clear current query
  const clearCurrentQuery = () => {
    setPrompt("");
    setSql("");
    setResults([]);
    setError("");
    setSuccessMessage("");
  };

  // 20. Change data source
  const changeDataSource = (newSource) => {
    setDataSource(newSource);
    setPrompt("");
    setSql("");
    setResults([]);
    setError("");
    setSuccessMessage("");
  };

  // 21. Clear query history

  const addToFavorites = (item) => {
  const updatedFavorites = [
    item,
    ...favorites,
  ];

  setFavorites(updatedFavorites);

  localStorage.setItem(
    "sqlFavorites",
    JSON.stringify(updatedFavorites)
  );

  setSuccessMessage(
    "Query added to favorites."
  );
};

const rerunQuery = (item) => {
  setPrompt(item.prompt);

  setSuccessMessage(
    `Loaded: ${item.prompt}`
  );

  setError("");

  window.scrollTo({
    top: 0,
    behavior: "smooth",
  });
};

const copyHistorySQL = async (sql) => {
  try {
    await navigator.clipboard.writeText(sql);

    setSuccessMessage(
      "Query copied successfully."
    );

    setError("");
  } catch {
    setError("Unable to copy query.");
  }
};

const deleteHistoryItem = (index) => {
  const updatedHistory =
    history.filter(
      (_, itemIndex) =>
        itemIndex !== index
    );

  setHistory(updatedHistory);

  localStorage.setItem(
    "sqlHistory",
    JSON.stringify(updatedHistory)
  );

  setSuccessMessage(
    "History item removed."
  );

  setError("");
};

  const clearHistory = () => {
  setHistory([]);
  localStorage.removeItem("sqlHistory");
};

  // 22. Toggle between light and dark themes
  const toggleTheme = () => {
    setTheme((previousTheme) =>
    previousTheme === "dark"
      ? "light"
      : "dark"
    );
  };
  

  return (
    <div
  className={`container ${
    theme === "dark"
      ? "theme-dark"
      : "theme-light"
  }`}
>
      <main className="card">
        <Header dataSource={dataSource} />
          <div className="theme-toggle-wrapper">
            <button
                className="theme-button"
                onClick={toggleTheme}
                  >
                {theme === "dark"
                ? "☀ Light Mode"
                : "🌙 Dark Mode"}
            </button>
          </div>
        <StatsCards
          queryCount={history.length}
          resultCount={results.length}
          dataSource={dataSource}
        />

        <section>
          <h2>Data Source</h2>

          <div className="source-selector">
            <button
              className={
                dataSource === "database"
                  ? "source-button active-source"
                  : "source-button"
              }
              onClick={() =>
                changeDataSource("database")
              }
            >
              SQL Server
            </button>

            <button
              className={
                dataSource === "excel"
                  ? "source-button active-source"
                  : "source-button"
              }
              onClick={() =>
                changeDataSource("excel")
              }
            >
              Excel / CSV
            </button>
          </div>

          <div className="source-information">
            {dataSource === "database" ? (
              <div>
                <p className="source-title">
                  Connected Database
                </p>

                <p className="source-value">
                  AISQLGeneratorDB
                </p>

                <p className="privacy-note">
                  Database requests are processed by
                  the Express backend. This version
                  supports predefined read-only
                  queries.
                </p>
              </div>
            ) : (
              <div>
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

                <p className="privacy-note">
                  The uploaded spreadsheet is
                  processed inside the browser. Use
                  clear column names such as
                  Department, Salary, EmployeeName,
                  or Date for better results.
                </p>

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
                          {sheetNames.map(
                            (sheetName) => (
                              <option
                                key={sheetName}
                                value={sheetName}
                              >
                                {sheetName}
                              </option>
                            )
                          )}
                        </select>
                      </div>
                    )}

                    <div className="file-statistics">
                      <span>
                        Rows: {excelRows.length}
                      </span>

                      <span>
                        Columns: {columns.length}
                      </span>
                    </div>

                    <p className="column-list">
                      <strong>
                        Detected columns:
                      </strong>{" "}
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
              </div>
            )}
          </div>
        </section>

        {dataSource === "excel" &&
          excelRows.length > 0 && (
            <section>
              <h2>Spreadsheet Preview</h2>

              <ResultsTable rows={excelRows.slice(0, 5)} />
              <ResultsTable rows={results} />
              {excelRows.length > 5 && (
                <p className="preview-note">
                  Showing the first 5 of{" "}
                  {excelRows.length} rows.
                </p>
              )}
            </section>
          )}

        <section>
          <h2>Ask Your Question</h2>

          <Suggestions
            suggestions={suggestions}
            useSuggestion={useSuggestion}
          />

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
            placeholder={`Examples:
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

          {successMessage && (
            <div className="success-message">
              {successMessage}
            </div>
          )}

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}
        </section>

        <details className="collapsible-section">
          <summary>SQL Query</summary>

          <pre>
            {sql ||
            "-- Your generated query will appear here"}
          </pre>
          </details>

        <section>
          <div className="results-heading">
            <div>
              <h2>Results</h2>

              <span className="result-count">
                {results.length} record
                {results.length === 1 ? "" : "s"}
              </span>
            </div>

            <div className="export-buttons">
              <button
                className="export-button"
                onClick={exportResultsToExcel}
                disabled={results.length === 0}
              >
                Export Excel
              </button>

              <button
                className="export-button csv-button"
                onClick={exportResultsToCSV}
                disabled={results.length === 0}
              >
                Export CSV
              </button>

              <button
                className="export-button"
                onClick={exportPDF}
                disabled={results.length === 0}
              >
                Download PDF
              </button>
            </div>
          </div>

          <div id="report-section">

          <ResultsTable rows={results} />
          <SummaryPanel results={results} />
          <InsightsPanel results={results} />
          <ChartsPanel results={results} />
          
          </div>
          
        </section>
        <details className="collapsible-section">
          <summary>
             History ({history.length})
          </summary>

              <HistoryPanel
                  history={history}
                  clearHistory={clearHistory}
                  rerunQuery={rerunQuery}
                  copyHistorySQL={copyHistorySQL}
                  deleteHistoryItem={deleteHistoryItem}
                />
          </details>
        <Footer/>
      </main>
    </div>
  );
}

export default App;