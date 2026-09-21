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
import DatasetProfile from "./components/DatasetProfile";
import { analyzeDataset } from "./utils/datasetAnalyzer";
import { downloadAnalysisPDF } from "./utils/exportAnalysisPDF";

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
  const [sqlExplanation, setSqlExplanation] = useState("");
  const [savedReports, setSavedReports] = useState([]);

  // 3. Excel and CSV information
  const [workbook, setWorkbook] = useState(null);
  const [sheetNames, setSheetNames] = useState([]);
  const [selectedSheet, setSelectedSheet] = useState("");
  const [excelRows, setExcelRows] = useState([]);
  const [columns, setColumns] = useState([]);
  const [uploadedFileName, setUploadedFileName] =
    useState("");
  const [datasetProfile, setDatasetProfile] = 
    useState(null);

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

  const savedReportsData =
  JSON.parse(localStorage.getItem("savedReports")) || [];

  setSavedReports(savedReportsData);
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
    : datasetProfile?.suggestions ||
      excelSuggestions;

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
    const detectedColumns =
      Object.keys(rows[0]);

    setColumns(detectedColumns);

    const analysis = analyzeDataset(
      detectedColumns,
      rows
    );

    setDatasetProfile(analysis);
  } else {
    setColumns([]);
    setDatasetProfile(null);
  }
};


  // 7. Clear uploaded spreadsheet
  const clearUploadedFile = () => {
    setWorkbook(null);
    setSheetNames([]);
    setSelectedSheet("");
    setExcelRows([]);
    setColumns([]);
    setDatasetProfile(null);
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

  // Query uploaded Excel or CSV data dynamically
const queryExcel = () => {
  if (excelRows.length === 0) {
    throw new Error(
      "Please upload an Excel or CSV file first."
    );
  }

  const requestText = prompt
    .toLowerCase()
    .trim();

  /* =========================================
     HELPERS
  ========================================= */

  const normalizeValue = (value) => {
    return String(value)
      .toLowerCase()
      .trim();
  };

  const normalizeColumnName = (column) => {
    return String(column)
      .toLowerCase()
      .replaceAll(" ", "")
      .replaceAll("_", "")
      .replaceAll("-", "");
  };

  const cleanNumericValue = (value) => {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return null;
    }

    const cleaned = String(value)
      .replaceAll(",", "")
      .replace(/[^\d.-]/g, "");

    if (cleaned === "") {
      return null;
    }

    const number = Number(cleaned);

    return Number.isFinite(number)
      ? number
      : null;
  };

  const escapeSQLValue = (value) => {
    return String(value).replaceAll(
      "'",
      "''"
    );
  };

  const quoteColumn = (column) => {
    return `[${String(column).replaceAll(
      "]",
      "]]"
    )}]`;
  };

  /* =========================================
     ANALYZE THE AVAILABLE COLUMNS
  ========================================= */

  const availableColumns =
    columns.length > 0
      ? columns
      : Object.keys(excelRows[0] || {});

  const columnProfiles =
    availableColumns.map((column) => {
      const values = excelRows
        .map((row) => row[column])
        .filter(
          (value) =>
            value !== null &&
            value !== undefined &&
            value !== ""
        );

      const numericValues = values
        .map(cleanNumericValue)
        .filter(
          (value) => value !== null
        );

      const numericRatio =
        values.length > 0
          ? numericValues.length /
            values.length
          : 0;

      const uniqueValues = [
        ...new Set(
          values.map((value) =>
            String(value).trim()
          )
        ),
      ];

      return {
        column,
        normalizedColumn:
          normalizeColumnName(column),
        values,
        numericValues,
        uniqueValues,

        isNumeric:
          values.length > 0 &&
          numericRatio >= 0.7,
      };
    });

  const numericColumns =
    columnProfiles.filter(
      (profile) => profile.isNumeric
    );

  const textColumns =
    columnProfiles.filter(
      (profile) => !profile.isNumeric
    );

  /* =========================================
     FIND THE COLUMN MENTIONED BY THE USER
  ========================================= */

  const directlyMentionedColumn =
    columnProfiles.find((profile) => {
      const readableColumn =
        String(profile.column)
          .toLowerCase()
          .trim();

      return (
        requestText.includes(
          readableColumn
        ) ||
        requestText.includes(
          profile.normalizedColumn
        )
      );
    });

  const preferredNumericKeywords = [
    "salary",
    "price",
    "revenue",
    "sales",
    "amount",
    "income",
    "expense",
    "cost",
    "stock",
    "quantity",
    "balance",
    "profit",
    "rating",
    "score",
    "budget",
    "payment",
  ];

  const preferredCategoryKeywords = [
    "department",
    "category",
    "segment",
    "type",
    "status",
    "region",
    "country",
    "city",
    "team",
    "division",
    "brand",
  ];

  const preferredNumericColumn =
    numericColumns.find((profile) => {
      return preferredNumericKeywords.some(
        (keyword) =>
          profile.normalizedColumn.includes(
            keyword
          )
      );
    }) ||
    numericColumns[0] ||
    null;

  const preferredCategoryColumn =
    textColumns.find((profile) => {
      return preferredCategoryKeywords.some(
        (keyword) =>
          profile.normalizedColumn.includes(
            keyword
          )
      );
    }) ||
    textColumns.find((profile) => {
      return (
        profile.uniqueValues.length > 1 &&
        profile.uniqueValues.length <= 30
      );
    }) ||
    null;

  /* =========================================
     INITIAL QUERY
  ========================================= */

  let filteredRows = [...excelRows];

  let generatedSQL =
    `SELECT * FROM ${quoteColumn(
      selectedSheet
    )};`;

  let operationDescription =
    "all records";

  let queryRecognized = false;

  /* =========================================
     SHOW ALL RECORDS
  ========================================= */

  const requestsAllRecords =
    requestText.includes("show all") ||
    requestText.includes("all records") ||
    requestText.includes("all rows") ||
    requestText.includes("list all") ||
    requestText === "all";

  if (requestsAllRecords) {
    filteredRows = [...excelRows];

    generatedSQL =
      `SELECT * FROM ${quoteColumn(
        selectedSheet
      )};`;

    operationDescription =
      "all records";

    queryRecognized = true;
  }

  /* =========================================
     TEXT / CATEGORY FILTERING
  ========================================= */

  let matchedTextColumn = null;
  let matchedTextValue = null;

  for (const profile of textColumns) {
    const matchedValue =
      profile.uniqueValues.find((value) => {
        const normalized =
          normalizeValue(value);

        return (
          normalized.length > 0 &&
          requestText.includes(normalized)
        );
      });

    if (matchedValue !== undefined) {
      matchedTextColumn = profile;
      matchedTextValue = matchedValue;
      break;
    }
  }

  if (
    matchedTextColumn &&
    matchedTextValue !== null
  ) {
    filteredRows = filteredRows.filter(
      (row) => {
        return (
          normalizeValue(
            row[
              matchedTextColumn.column
            ]
          ) ===
          normalizeValue(
            matchedTextValue
          )
        );
      }
    );

    generatedSQL =
      `SELECT * FROM ${quoteColumn(
        selectedSheet
      )} ` +
      `WHERE ${quoteColumn(
        matchedTextColumn.column
      )} = ` +
      `'${escapeSQLValue(
        matchedTextValue
      )}';`;

    operationDescription =
      `${matchedTextColumn.column} equals ${matchedTextValue}`;

    queryRecognized = true;
  }

  /* =========================================
     NUMBER DETECTION
  ========================================= */

  const numberMatch = requestText.match(
    /(?:₱|php|\$)?\s*(-?\d+(?:,\d{3})*(?:\.\d+)?)/
  );

  const requestedNumber = numberMatch
    ? Number(
        numberMatch[1].replaceAll(
          ",",
          ""
        )
      )
    : null;

  const requestedNumericColumn =
    directlyMentionedColumn?.isNumeric
      ? directlyMentionedColumn
      : preferredNumericColumn;

  /* =========================================
     NUMERIC GREATER-THAN FILTER
  ========================================= */

  const requestsGreaterThan =
    requestText.includes("greater than") ||
    requestText.includes("more than") ||
    requestText.includes("higher than") ||
    requestText.includes("above") ||
    requestText.includes("over");

  if (
    requestsGreaterThan &&
    requestedNumber !== null &&
    requestedNumericColumn
  ) {
    filteredRows = excelRows.filter(
      (row) => {
        const value = cleanNumericValue(
          row[
            requestedNumericColumn.column
          ]
        );

        return (
          value !== null &&
          value > requestedNumber
        );
      }
    );

    generatedSQL =
      `SELECT * FROM ${quoteColumn(
        selectedSheet
      )} ` +
      `WHERE ${quoteColumn(
        requestedNumericColumn.column
      )} > ${requestedNumber};`;

    operationDescription =
      `${requestedNumericColumn.column} above ${requestedNumber}`;

    queryRecognized = true;
  }

  /* =========================================
     NUMERIC LESS-THAN FILTER
  ========================================= */

  const requestsLessThan =
    requestText.includes("less than") ||
    requestText.includes("lower than") ||
    requestText.includes("below") ||
    requestText.includes("under");

  if (
    requestsLessThan &&
    requestedNumber !== null &&
    requestedNumericColumn
  ) {
    filteredRows = excelRows.filter(
      (row) => {
        const value = cleanNumericValue(
          row[
            requestedNumericColumn.column
          ]
        );

        return (
          value !== null &&
          value < requestedNumber
        );
      }
    );

    generatedSQL =
      `SELECT * FROM ${quoteColumn(
        selectedSheet
      )} ` +
      `WHERE ${quoteColumn(
        requestedNumericColumn.column
      )} < ${requestedNumber};`;

    operationDescription =
      `${requestedNumericColumn.column} below ${requestedNumber}`;

    queryRecognized = true;
  }

  /* =========================================
     NUMERIC EQUAL FILTER
  ========================================= */

  const requestsEqual =
    requestText.includes("equal to") ||
    requestText.includes("equals") ||
    requestText.includes("exactly");

  if (
    requestsEqual &&
    requestedNumber !== null &&
    requestedNumericColumn
  ) {
    filteredRows = excelRows.filter(
      (row) => {
        const value = cleanNumericValue(
          row[
            requestedNumericColumn.column
          ]
        );

        return (
          value !== null &&
          value === requestedNumber
        );
      }
    );

    generatedSQL =
      `SELECT * FROM ${quoteColumn(
        selectedSheet
      )} ` +
      `WHERE ${quoteColumn(
        requestedNumericColumn.column
      )} = ${requestedNumber};`;

    operationDescription =
      `${requestedNumericColumn.column} equals ${requestedNumber}`;

    queryRecognized = true;
  }

  /* =========================================
     TOP / HIGHEST RECORDS
  ========================================= */

  const topCountMatch =
    requestText.match(
      /(?:top|highest|largest|most expensive)\s+(\d+)/
    );

  const requestedTopCount =
    topCountMatch
      ? Number(topCountMatch[1])
      : requestText.includes("highest") ||
          requestText.includes(
            "largest"
          ) ||
          requestText.includes(
            "most expensive"
          )
        ? 1
        : null;

  if (
    requestedTopCount &&
    requestedNumericColumn
  ) {
    filteredRows = [...excelRows]
      .filter((row) => {
        return (
          cleanNumericValue(
            row[
              requestedNumericColumn.column
            ]
          ) !== null
        );
      })
      .sort((firstRow, secondRow) => {
        return (
          cleanNumericValue(
            secondRow[
              requestedNumericColumn.column
            ]
          ) -
          cleanNumericValue(
            firstRow[
              requestedNumericColumn.column
            ]
          )
        );
      })
      .slice(0, requestedTopCount);

    generatedSQL =
      `SELECT TOP ${requestedTopCount} * ` +
      `FROM ${quoteColumn(
        selectedSheet
      )} ` +
      `ORDER BY ${quoteColumn(
        requestedNumericColumn.column
      )} DESC;`;

    operationDescription =
      `top ${requestedTopCount} records by ${requestedNumericColumn.column}`;

    queryRecognized = true;
  }

  /* =========================================
     BOTTOM / LOWEST RECORDS
  ========================================= */

  const bottomCountMatch =
    requestText.match(
      /(?:bottom|lowest|smallest|cheapest)\s+(\d+)/
    );

  const requestedBottomCount =
    bottomCountMatch
      ? Number(bottomCountMatch[1])
      : requestText.includes("lowest") ||
          requestText.includes(
            "smallest"
          ) ||
          requestText.includes(
            "cheapest"
          )
        ? 1
        : null;

  if (
    requestedBottomCount &&
    requestedNumericColumn
  ) {
    filteredRows = [...excelRows]
      .filter((row) => {
        return (
          cleanNumericValue(
            row[
              requestedNumericColumn.column
            ]
          ) !== null
        );
      })
      .sort((firstRow, secondRow) => {
        return (
          cleanNumericValue(
            firstRow[
              requestedNumericColumn.column
            ]
          ) -
          cleanNumericValue(
            secondRow[
              requestedNumericColumn.column
            ]
          )
        );
      })
      .slice(
        0,
        requestedBottomCount
      );

    generatedSQL =
      `SELECT TOP ${requestedBottomCount} * ` +
      `FROM ${quoteColumn(
        selectedSheet
      )} ` +
      `ORDER BY ${quoteColumn(
        requestedNumericColumn.column
      )} ASC;`;

    operationDescription =
      `bottom ${requestedBottomCount} records by ${requestedNumericColumn.column}`;

    queryRecognized = true;
  }

  /* =========================================
     LOW STOCK
  ========================================= */

  const stockColumn =
    numericColumns.find((profile) => {
      return (
        profile.normalizedColumn.includes(
          "stock"
        ) ||
        profile.normalizedColumn.includes(
          "inventory"
        ) ||
        profile.normalizedColumn.includes(
          "quantity"
        )
      );
    });

  if (
    requestText.includes("low stock") &&
    stockColumn
  ) {
    const stockValues =
      stockColumn.numericValues;

    const averageStock =
      stockValues.length > 0
        ? stockValues.reduce(
            (sum, value) =>
              sum + value,
            0
          ) / stockValues.length
        : 0;

    filteredRows = excelRows.filter(
      (row) => {
        const value = cleanNumericValue(
          row[stockColumn.column]
        );

        return (
          value !== null &&
          value < averageStock
        );
      }
    );

    generatedSQL =
      `SELECT * FROM ${quoteColumn(
        selectedSheet
      )} ` +
      `WHERE ${quoteColumn(
        stockColumn.column
      )} < ${Number(
        averageStock.toFixed(2)
      )};`;

    operationDescription =
      `${stockColumn.column} below its dataset average`;

    queryRecognized = true;
  }

  /* =========================================
     CATEGORY GROUPING
  ========================================= */

  const requestsGrouping =
    requestText.includes("group by") ||
    requestText.includes("group records") ||
    requestText.includes("by category") ||
    requestText.includes(
      "by department"
    ) ||
    requestText.includes("by region") ||
    requestText.includes("by status");

  if (
    requestsGrouping &&
    preferredCategoryColumn
  ) {
    const groupedRows = {};

    excelRows.forEach((row) => {
      const rawValue =
        row[
          preferredCategoryColumn.column
        ];

      const category =
        rawValue === null ||
        rawValue === undefined ||
        rawValue === ""
          ? "Unknown"
          : String(rawValue).trim();

      groupedRows[category] =
        (groupedRows[category] || 0) +
        1;
    });

        filteredRows = Object.entries(
      groupedRows
    )
      .map(([group, count]) => {
        return {
          [preferredCategoryColumn.column]:
            group,

          RecordCount: count,
        };
      })
      .sort(
        (first, second) =>
          second.RecordCount -
          first.RecordCount
      );

    generatedSQL =
      `SELECT ${quoteColumn(
        preferredCategoryColumn.column
      )}, ` +
      `COUNT(*) AS [RecordCount] ` +
      `FROM ${quoteColumn(
        selectedSheet
      )} ` +
      `GROUP BY ${quoteColumn(
        preferredCategoryColumn.column
      )} ` +
      `ORDER BY [RecordCount] DESC;`;

    operationDescription =
      `records grouped by ${preferredCategoryColumn.column}`;

    queryRecognized = true;
  }

  /* =========================================
     AVERAGE CALCULATION
  ========================================= */

  const requestsAverage =
    requestText.includes("average") ||
    requestText.includes("mean");

  if (
    requestsAverage &&
    requestedNumericColumn
  ) {
    const values =
      requestedNumericColumn.numericValues;

    const average =
      values.length > 0
        ? values.reduce(
            (sum, value) =>
              sum + value,
            0
          ) / values.length
        : 0;

    filteredRows = [
      {
        Metric:
          `Average ${requestedNumericColumn.column}`,

        Value: Number(
          average.toFixed(2)
        ),
      },
    ];

    generatedSQL =
      `SELECT AVG(${quoteColumn(
        requestedNumericColumn.column
      )}) AS ` +
      `[Average${String(
        requestedNumericColumn.column
      ).replaceAll(" ", "")}] ` +
      `FROM ${quoteColumn(
        selectedSheet
      )};`;

    operationDescription =
      `average ${requestedNumericColumn.column}`;

    queryRecognized = true;
  }

  /* =========================================
     TOTAL / SUM CALCULATION
  ========================================= */

  const requestsTotal =
    requestText.includes("total") ||
    requestText.includes("sum");

  if (
    requestsTotal &&
    requestedNumericColumn  ) {
    const values =
      requestedNumericColumn.numericValues;

    const total = values.reduce(
      (sum, value) =>
        sum + value,
      0
    );

    filteredRows = [
      {
        Metric:
          `Total ${requestedNumericColumn.column}`,

        Value: Number(
          total.toFixed(2)
        ),
      },
    ];

    generatedSQL =
      `SELECT SUM(${quoteColumn(
        requestedNumericColumn.column
      )}) AS ` +
      `[Total${String(
        requestedNumericColumn.column
      ).replaceAll(" ", "")}] ` +
      `FROM ${quoteColumn(
        selectedSheet
      )};`;

    operationDescription =
      `total ${requestedNumericColumn.column}`;

    queryRecognized = true;
  }

  /* =========================================
     COUNT RECORDS
  ========================================= */

  const requestsCount =
    requestText.includes("count") ||
    requestText.includes("how many");

  if (
    requestsCount &&
    !requestsGrouping
  ) {
    filteredRows = [
      {
        Metric: "Record Count",
        Value: excelRows.length,
      },
    ];

    generatedSQL =
      `SELECT COUNT(*) AS ` +
      `[RecordCount] FROM ` +
      `${quoteColumn(
        selectedSheet
      )};`;

    operationDescription =
      "record count";

    queryRecognized = true;
  }

  /* =========================================
     GENERAL TEXT SEARCH
  ========================================= */

  if (!queryRecognized) {
    const searchWords =
      requestText
        .split(/\s+/)
        .filter(
          (word) =>
            word.length >= 3 &&
            ![
              "show",
              "find",
              "list",
              "records",
              "record",
              "data",
              "with",
              "from",
              "that",
              "have",
              "the",
              "all",
            ].includes(word)
        );

    const searchedRows =
      excelRows.filter((row) => {
        return availableColumns.some(
          (column) => {
            const value =
              normalizeValue(
                row[column]
              );

            return searchWords.some(
              (word) =>
                value.includes(word)
            );
          }
        );
      });

    if (
      searchWords.length > 0 &&
      searchedRows.length > 0
    ) {
      filteredRows = searchedRows;

      generatedSQL =
        `-- General text search across ` +
        `${availableColumns.length} columns\n` +
        `SELECT * FROM ${quoteColumn(
          selectedSheet
        )};`;

      operationDescription =
        "general text search";

      queryRecognized = true;
    }
  }

  /* =========================================
     FALLBACK
  ========================================= */

  if (!queryRecognized) {
    filteredRows = [...excelRows];

    generatedSQL =
      `SELECT * FROM ${quoteColumn(
        selectedSheet
      )};`;

    operationDescription =
      "all records because no supported filter was detected";
  }

  /* =========================================
     UPDATE UI
  ========================================= */

  setSql(generatedSQL);
  setResults(filteredRows);

  const historyItem = {
    source:
      `Excel: ${uploadedFileName}`,

    prompt,

    sql: generatedSQL,

    resultCount:
      filteredRows.length,

    operation:
      operationDescription,
  };

  const updatedHistory = [
    historyItem,
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
      `${filteredRows.length} result${
        filteredRows.length === 1
          ? ""
          : "s"
      } found for ${operationDescription}.`
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

    const explainSQL = () => {
  if (!sql) {
    setSqlExplanation(
      "Generate a SQL query first."
    );
    return;
  }

  let explanation = "";

  const query = sql.toLowerCase();

  if (query.includes("select")) {
    explanation +=
      "• SELECT retrieves data from a table.\n";
  }

  if (query.includes("where")) {
    explanation +=
      "• WHERE filters records based on a condition.\n";
  }

  if (query.includes("&gt;")) {
    explanation +=
      "• The > operator returns values greater than the specified amount.\n";
  }

  if (query.includes("&lt;")) {
    explanation +=
      "• The < operator returns values less than the specified amount.\n";
  }

  if (query.includes("department")) {
    explanation +=
      "• The query filters employees by department.\n";
  }

  if (query.includes("salary")) {
    explanation +=
      "• Salary information is included in the results.\n";
  }

  if (!explanation) {
    explanation =
      "This query retrieves data from the database.";
  }

  setSqlExplanation(explanation);
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

const saveReport = () => {
  if (!sql) {
    setError("Generate a query first.");
    setSuccessMessage("");
    return;
  }

  const report = {
    id: Date.now(),
    date: new Date().toLocaleString(),
    prompt,
    sql,
    records: results.length,
    explanation: sqlExplanation,
  };

  const updatedReports = [
    report,
    ...savedReports,
  ];

  setSavedReports(updatedReports);

  localStorage.setItem(
    "savedReports",
    JSON.stringify(updatedReports)
  );

  setError("");
  setSuccessMessage("Report saved successfully.");
};

  const openSavedReport = (report) => {
  setPrompt(report.prompt);
  setSql(report.sql);
  setSqlExplanation(report.explanation || "");

  setError("");
  setSuccessMessage("Report loaded successfully.");

  window.scrollTo({
    top: 0,
    behavior: "smooth",
  });
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

  // 23. Download complete analysis report
  const downloadPDFReport = () => {
    if (!results || results.length === 0) {
      setError(
        "Run a query first before downloading a report."
      );

      return;
    }

    setError("");

    downloadAnalysisPDF({
      results,
      prompt,
      sql,
      dataSource,
      datasetProfile,
      uploadedFileName,
      selectedSheet,
    });

    setSuccessMessage(
      "Analysis report downloaded successfully."
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

                            {dataSource === "excel" &&
                datasetProfile && (
                  <DatasetProfile
                    datasetProfile={datasetProfile}
                    rowCount={excelRows.length}
                    columnCount={columns.length}
                  />
                )}

              {dataSource === "excel" &&
                excelRows.length > 0 && (
                  <section>
                    <h2>Spreadsheet Preview</h2>

                    <ResultsTable
                      rows={excelRows.slice(0, 5)}
                    />

                    {excelRows.length > 5 && (
                      <p className="preview-note">
                        Showing the first 5 of{" "}
                        {excelRows.length} rows.
                      </p>
                    )}
                  </section>
                )}

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
              onClick={explainSQL}
            >
              Explain SQL
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

          <details
            className="collapsible-section"
            open
          >
            <summary>SQL Query</summary>

            <pre>
              {sql ||
                "-- Your generated query will appear here"}
            </pre>

            {sqlExplanation && (
              <div className="sql-explanation">
                <h3>SQL Explanation</h3>

                <pre>{sqlExplanation}</pre>

              
              </div>
            )}
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
                  className="pdf-button"
                  onClick={downloadPDFReport}
                  disabled={results.length === 0}
                >
                  Download PDF
                </button>

                <button
                  className="export-button"
                  onClick={saveReport}
                  disabled={results.length === 0}
                >
                  Save Report
                </button>
              </div>
            </div>

          <div id="report-section">

          <ResultsTable rows={results} />
          <SummaryPanel results={results} />
          <InsightsPanel results={results} />
          <ChartsPanel results={results} />
          
          </div>
        <details className="collapsible-section">
            <summary>
              Saved Reports ({savedReports.length})
            </summary>

            {savedReports.map((report) => (
              <div
                key={report.id}
                className="history-item"
              >
                <h4>{report.prompt}</h4>

                <p>{report.date}</p>

                <p>
                  Records: {report.records}
                </p>

                <pre>{report.sql}</pre>
                <button
                  className="secondary-button"
                  onClick={() =>
                    openSavedReport(report)
                  }
                >
                  Open Report
                </button>
              </div>
            ))}
          </details>

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