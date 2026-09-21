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
  if (!excelRows || excelRows.length === 0) {
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

  const normalizeText = (value) => {
    return String(value ?? "")
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

    const cleanedValue = String(value)
      .replaceAll(",", "")
      .replace(/[^\d.-]/g, "");

    if (cleanedValue === "") {
      return null;
    }

    const number = Number(cleanedValue);

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

  const formatNumber = (value) => {
    return Number(
      Number(value).toFixed(2)
    );
  };

  /* =========================================
     BUILD COLUMN PROFILES
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
     IGNORE IDENTIFIER COLUMNS FOR ANALYTICS
  ========================================= */

  const ignoredNumericNames = [
    "id",
    "employeeid",
    "productid",
    "customerid",
    "orderid",
    "transactionid",
    "recordid",
    "code",
    "zipcode",
    "postalcode",
    "phone",
    "year",
  ];

  const businessNumericColumns =
    numericColumns.filter((profile) => {
      return !ignoredNumericNames.some(
        (ignoredName) =>
          profile.normalizedColumn ===
            ignoredName ||
          profile.normalizedColumn.endsWith(
            ignoredName
          )
      );
    });

  /* =========================================
     PREFERRED COLUMN TYPES
  ========================================= */

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
    businessNumericColumns.find(
      (profile) => {
        return preferredNumericKeywords.some(
          (keyword) =>
            profile.normalizedColumn.includes(
              keyword
            )
        );
      }
    ) ||
    businessNumericColumns[0] ||
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
        profile.uniqueValues.length <=
          Math.max(
            30,
            Math.ceil(
              excelRows.length * 0.5
            )
          )
      );
    }) ||
    null;

  /* =========================================
     FIND A COLUMN MENTIONED IN THE PROMPT
  ========================================= */

  const findMentionedColumn = (
    profiles
  ) => {
    return profiles.find((profile) => {
      const readableColumn =
        normalizeText(profile.column);

      return (
        requestText.includes(
          readableColumn
        ) ||
        requestText.includes(
          profile.normalizedColumn
        )
      );
    });
  };

  const mentionedNumericColumn =
    findMentionedColumn(
      businessNumericColumns
    ) ||
    findMentionedColumn(
      numericColumns
    );

  const mentionedTextColumn =
    findMentionedColumn(textColumns);

  const selectedNumericColumn =
    mentionedNumericColumn ||
    preferredNumericColumn;

  const selectedCategoryColumn =
    mentionedTextColumn ||
    preferredCategoryColumn;

  /* =========================================
     QUERY PLAN
  ========================================= */

  const queryPlan = {
    textConditions: [],
    numericConditions: [],
    sort: null,
    limit: null,
    aggregate: null,
    groupBy: null,
  };

  /* =========================================
     TEXT CONDITIONS
  ========================================= */

  textColumns.forEach((profile) => {
    const matchingValue =
      profile.uniqueValues
        .filter((value) => {
          return (
            String(value).trim().length >
            0
          );
        })
        .sort(
          (first, second) =>
            String(second).length -
            String(first).length
        )
        .find((value) => {
          const normalizedValue =
            normalizeText(value);

          return (
            normalizedValue.length >
              0 &&
            requestText.includes(
              normalizedValue
            )
          );
        });

    if (matchingValue !== undefined) {
      const alreadyAdded =
        queryPlan.textConditions.some(
          (condition) =>
            condition.column ===
              profile.column &&
            normalizeText(
              condition.value
            ) ===
              normalizeText(
                matchingValue
              )
        );

      if (!alreadyAdded) {
        queryPlan.textConditions.push({
          column: profile.column,
          value: matchingValue,
        });
      }
    }
  });

  /* =========================================
     NUMERIC CONDITION
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

  const greaterThanRequested =
    requestText.includes("greater than") ||
    requestText.includes("more than") ||
    requestText.includes("higher than") ||
    requestText.includes("above") ||
    requestText.includes("over");

  const greaterThanOrEqualRequested =
    requestText.includes(
      "at least"
    ) ||
    requestText.includes(
      "greater than or equal"
    ) ||
    requestText.includes(
      "more than or equal"
    );

  const lessThanRequested =
    requestText.includes("less than") ||
    requestText.includes("lower than") ||
    requestText.includes("below") ||
    requestText.includes("under");

  const lessThanOrEqualRequested =
    requestText.includes(
      "at most"
    ) ||
    requestText.includes(
      "less than or equal"
    ) ||
    requestText.includes(
      "lower than or equal"
    );

  const equalRequested =
    requestText.includes("equal to") ||
    requestText.includes("equals") ||
    requestText.includes("exactly");

  if (
    requestedNumber !== null &&
    selectedNumericColumn
  ) {
    let operator = null;

    if (
      greaterThanOrEqualRequested
    ) {
      operator = ">=";
    } else if (
      lessThanOrEqualRequested
    ) {
      operator = "<=";
    } else if (
      greaterThanRequested
    ) {
      operator = ">";
    } else if (
      lessThanRequested
    ) {
      operator = "<";
    } else if (equalRequested) {
      operator = "=";
    }

    if (operator) {
      queryPlan.numericConditions.push({
        column:
          selectedNumericColumn.column,

        operator,
        value: requestedNumber,
      });
    }
  }

  /* =========================================
     GROUPING
  ========================================= */

  const groupingRequested =
    requestText.includes("group by") ||
    requestText.includes(
      "group records"
    ) ||
    requestText.includes(
      "breakdown by"
    ) ||
    requestText.includes(
      "distribution by"
    );

  if (
    groupingRequested &&
    selectedCategoryColumn
  ) {
    queryPlan.groupBy =
      selectedCategoryColumn.column;
  }

  /* =========================================
     AGGREGATION
  ========================================= */

  if (
    requestText.includes("average") ||
    requestText.includes("mean")
  ) {
    queryPlan.aggregate = "AVG";
  } else if (
    requestText.includes("total") ||
    requestText.includes("sum")
  ) {
    queryPlan.aggregate = "SUM";
  } else if (
    requestText.includes("count") ||
    requestText.includes("how many")
  ) {
    queryPlan.aggregate = "COUNT";
  } else if (
    requestText.includes("minimum") ||
    requestText.includes("min ")
  ) {
    queryPlan.aggregate = "MIN";
  } else if (
    requestText.includes("maximum") ||
    requestText.includes("max ")
  ) {
    queryPlan.aggregate = "MAX";
  }

  /* =========================================
     TOP / BOTTOM LIMIT
  ========================================= */

  const topMatch = requestText.match(
    /(?:top|highest|largest|most expensive)\s+(\d+)/
  );

  const bottomMatch = requestText.match(
    /(?:bottom|lowest|smallest|cheapest)\s+(\d+)/
  );

  const requestsHighest =
    requestText.includes("highest") ||
    requestText.includes("largest") ||
    requestText.includes(
      "most expensive"
    );

  const requestsLowest =
    requestText.includes("lowest") ||
    requestText.includes("smallest") ||
    requestText.includes(
      "cheapest"
    );

  if (topMatch) {
    queryPlan.limit = Number(
      topMatch[1]
    );

    queryPlan.sort = {
      column:
        selectedNumericColumn?.column,

      direction: "DESC",
    };
  } else if (bottomMatch) {
    queryPlan.limit = Number(
      bottomMatch[1]
    );

    queryPlan.sort = {
      column:
        selectedNumericColumn?.column,

      direction: "ASC",
    };
  } else if (
    requestsHighest &&
    selectedNumericColumn
  ) {
    queryPlan.limit = 1;

    queryPlan.sort = {
      column:
        selectedNumericColumn.column,

      direction: "DESC",
    };
  } else if (
    requestsLowest &&
    selectedNumericColumn
  ) {
    queryPlan.limit = 1;

    queryPlan.sort = {
      column:
        selectedNumericColumn.column,

      direction: "ASC",
    };
  }

  /* =========================================
     EXPLICIT SORTING
  ========================================= */

  const requestsDescending =
    requestText.includes(
      "highest to lowest"
    ) ||
    requestText.includes(
      "descending"
    ) ||
    requestText.includes(
      "sort descending"
    ) ||
    requestText.includes(
      "largest first"
    );

  const requestsAscending =
    requestText.includes(
      "lowest to highest"
    ) ||
    requestText.includes(
      "ascending"
    ) ||
    requestText.includes(
      "sort ascending"
    ) ||
    requestText.includes(
      "smallest first"
    );

  if (
    requestsDescending &&
    selectedNumericColumn
  ) {
    queryPlan.sort = {
      column:
        selectedNumericColumn.column,

      direction: "DESC",
    };
  }

  if (
    requestsAscending &&
    selectedNumericColumn
  ) {
    queryPlan.sort = {
      column:
        selectedNumericColumn.column,

      direction: "ASC",
    };
  }

  /* =========================================
     LOW-STOCK QUERY
  ========================================= */

  const stockColumn =
    businessNumericColumns.find(
      (profile) => {
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
      }
    );

  if (
    requestText.includes("low stock") &&
    stockColumn &&
    stockColumn.numericValues.length > 0
  ) {
    const averageStock =
      stockColumn.numericValues.reduce(
        (sum, value) =>
          sum + value,
        0
      ) /
      stockColumn.numericValues.length;

    queryPlan.numericConditions.push({
      column: stockColumn.column,
      operator: "<",
      value: formatNumber(
        averageStock
      ),
    });
  }

  /* =========================================
     APPLY MULTIPLE CONDITIONS
  ========================================= */

  let filteredRows = [...excelRows];

  queryPlan.textConditions.forEach(
    (condition) => {
      filteredRows =
        filteredRows.filter((row) => {
          return (
            normalizeText(
              row[condition.column]
            ) ===
            normalizeText(
              condition.value
            )
          );
        });
    }
  );

  queryPlan.numericConditions.forEach(
    (condition) => {
      filteredRows =
        filteredRows.filter((row) => {
          const value =
            cleanNumericValue(
              row[condition.column]
            );

          if (value === null) {
            return false;
          }

          switch (condition.operator) {
            case ">":
              return (
                value >
                condition.value
              );

            case ">=":
              return (
                value >=
                condition.value
              );

            case "<":
              return (
                value <
                condition.value
              );

            case "<=":
              return (
                value <=
                condition.value
              );

            case "=":
              return (
                value ===
                condition.value
              );

            default:
              return true;
          }
        });
    }
  );

  /* =========================================
     APPLY SORTING
  ========================================= */

  if (
    queryPlan.sort?.column
  ) {
    filteredRows.sort(
      (firstRow, secondRow) => {
        const firstValue =
          cleanNumericValue(
            firstRow[
              queryPlan.sort.column
            ]
          );

        const secondValue =
          cleanNumericValue(
            secondRow[
              queryPlan.sort.column
            ]
          );

        if (
          firstValue === null &&
          secondValue === null
        ) {
          return 0;
        }

        if (firstValue === null) {
          return 1;
        }

        if (secondValue === null) {
          return -1;
        }

        if (
          queryPlan.sort.direction ===
          "DESC"
        ) {
          return (
            secondValue - firstValue
          );
        }

        return (
          firstValue - secondValue
        );
      }
    );
  }

  /* =========================================
     APPLY LIMIT
  ========================================= */

  if (
    queryPlan.limit &&
    queryPlan.limit > 0
  ) {
    filteredRows =
      filteredRows.slice(
        0,
        queryPlan.limit
      );
  }

  /* =========================================
     GENERATE WHERE CONDITIONS
  ========================================= */

  const sqlConditions = [];

  queryPlan.textConditions.forEach(
    (condition) => {
      sqlConditions.push(
        `${quoteColumn(
          condition.column
        )} = ` +
          `'${escapeSQLValue(
            condition.value
          )}'`
      );
    }
  );

  queryPlan.numericConditions.forEach(
    (condition) => {
      sqlConditions.push(
        `${quoteColumn(
          condition.column
        )} ${condition.operator} ` +
          `${condition.value}`
      );
    }
  );

  const whereClause =
    sqlConditions.length > 0
      ? ` WHERE ${sqlConditions.join(
          " AND "
        )}`
      : "";

  /* =========================================
     GROUPED QUERY
  ========================================= */

  let generatedSQL = "";
  let finalRows = filteredRows;
  let operationDescription = "";

  if (queryPlan.groupBy) {
    const groupData = {};

    filteredRows.forEach((row) => {
      const rawValue =
        row[queryPlan.groupBy];

      const groupName =
        rawValue === null ||
        rawValue === undefined ||
        rawValue === ""
          ? "Unknown"
          : String(rawValue).trim();

      if (!groupData[groupName]) {
        groupData[groupName] = {
          rows: [],
        };
      }

      groupData[
        groupName
      ].rows.push(row);
    });

    if (
      queryPlan.aggregate &&
      queryPlan.aggregate !==
        "COUNT" &&
      selectedNumericColumn
    ) {
      finalRows = Object.entries(
        groupData
      )
        .map(([groupName, data]) => {
          const values = data.rows
            .map((row) =>
              cleanNumericValue(
                row[
                  selectedNumericColumn
                    .column
                ]
              )
            )
            .filter(
              (value) =>
                value !== null
            );

          let aggregateValue = 0;

          if (
            queryPlan.aggregate === "AVG"
          ) {
            aggregateValue =
              values.length > 0
                ? values.reduce(
                    (sum, value) =>
                      sum + value,
                    0
                  ) / values.length
                : 0;
          }

          if (
            queryPlan.aggregate === "SUM"
          ) {
            aggregateValue =
              values.reduce(
                (sum, value) =>
                  sum + value,
                0
              );
          }

          if (
            queryPlan.aggregate === "MIN"
          ) {
            aggregateValue =
              values.length > 0
                ? Math.min(...values)
                : 0;
          }

          if (
            queryPlan.aggregate === "MAX"
          ) {
            aggregateValue =
              values.length > 0
                ? Math.max(...values)
                : 0;
          }

          return {
            [queryPlan.groupBy]:
              groupName,

            [
              `${queryPlan.aggregate}_${selectedNumericColumn.column}`
            ]:
              formatNumber(
                aggregateValue
              ),
          };
        });

      generatedSQL =
        `SELECT ${quoteColumn(
          queryPlan.groupBy
        )}, ` +
        `${queryPlan.aggregate}(${quoteColumn(
          selectedNumericColumn.column
        )}) AS ` +
        `${quoteColumn(
          `${queryPlan.aggregate}_${selectedNumericColumn.column}`
        )} ` +
        `FROM ${quoteColumn(
          selectedSheet
        )}` +
        `${whereClause} ` +
        `GROUP BY ${quoteColumn(
          queryPlan.groupBy
        )};`;

      operationDescription =
        `${queryPlan.aggregate} ${selectedNumericColumn.column} grouped by ${queryPlan.groupBy}`;
    } else {
      finalRows = Object.entries(
        groupData
      )
        .map(
          ([groupName, data]) => {
            return {
              [queryPlan.groupBy]:
                groupName,

              RecordCount:
                data.rows.length,
            };
          }
        )
        .sort(
          (first, second) =>
            second.RecordCount -
            first.RecordCount
        );

      generatedSQL =
        `SELECT ${quoteColumn(
          queryPlan.groupBy
        )}, ` +
        `COUNT(*) AS [RecordCount] ` +
        `FROM ${quoteColumn(
          selectedSheet
        )}` +
        `${whereClause} ` +
        `GROUP BY ${quoteColumn(
          queryPlan.groupBy
        )} ` +
        `ORDER BY [RecordCount] DESC;`;

      operationDescription =
        `records grouped by ${queryPlan.groupBy}`;
    }
  }

  /* =========================================
     SINGLE AGGREGATE QUERY
  ========================================= */

  if (
    !queryPlan.groupBy &&
    queryPlan.aggregate
  ) {
    if (
      queryPlan.aggregate === "COUNT"
    ) {
      finalRows = [
        {
          Metric: "Record Count",
          Value: filteredRows.length,
        },
      ];

      generatedSQL =
        `SELECT COUNT(*) AS ` +
        `[RecordCount] FROM ` +
        `${quoteColumn(
          selectedSheet
        )}` +
        `${whereClause};`;

      operationDescription =
        "record count";
    } else if (
      selectedNumericColumn
    ) {
      const numericValues =
        filteredRows
          .map((row) =>
            cleanNumericValue(
              row[
                selectedNumericColumn
                  .column
              ]
            )
          )
          .filter(
            (value) =>
              value !== null
          );

      let aggregateValue = 0;

      if (
        queryPlan.aggregate === "AVG"
      ) {
        aggregateValue =
          numericValues.length > 0
            ? numericValues.reduce(
                (sum, value) =>
                  sum + value,
                0
              ) /
              numericValues.length
            : 0;
      }

      if (
        queryPlan.aggregate === "SUM"
      ) {
        aggregateValue =
          numericValues.reduce(
            (sum, value) =>
              sum + value,
            0
          );
      }

      if (
        queryPlan.aggregate === "MIN"
      ) {
        aggregateValue =
          numericValues.length > 0
            ? Math.min(
                ...numericValues
              )
            : 0;
      }

      if (
        queryPlan.aggregate === "MAX"
      ) {
        aggregateValue =
          numericValues.length > 0
            ? Math.max(
                ...numericValues
              )
            : 0;
      }

            finalRows = [
        {
          Metric:
            `${queryPlan.aggregate} ${selectedNumericColumn.column}`,

          Value: formatNumber(
            aggregateValue
          ),
        },
      ];

      generatedSQL =
        `SELECT ${queryPlan.aggregate}(` +
        `${quoteColumn(
          selectedNumericColumn.column
        )}) AS ` +
        `${quoteColumn(
          `${queryPlan.aggregate}_${selectedNumericColumn.column}`
        )} ` +
        `FROM ${quoteColumn(
          selectedSheet
        )}` +
        `${whereClause};`;

      operationDescription =
        `${queryPlan.aggregate} ${selectedNumericColumn.column}`;
    }
  }

  /* =========================================
     STANDARD SELECT QUERY
  ========================================= */

  if (!generatedSQL) {
    const topClause =
      queryPlan.limit
        ? `TOP ${queryPlan.limit} `
        : "";

    const orderClause =
      queryPlan.sort?.column
        ? ` ORDER BY ${quoteColumn(
            queryPlan.sort.column
          )} ${
            queryPlan.sort.direction
          }`
        : "";

    generatedSQL =
      `SELECT ${topClause}* ` +
      `FROM ${quoteColumn(
        selectedSheet
      )}` +
      `${whereClause}` +
      `${orderClause};`;

    const appliedOperations = [];

    if (
      queryPlan.textConditions.length > 0
    ) {
      appliedOperations.push(
        `${queryPlan.textConditions.length} text filter${
          queryPlan.textConditions.length === 1
            ? ""
            : "s"
        }`
      );
    }

    if (
      queryPlan.numericConditions.length > 0
    ) {
      appliedOperations.push(
        `${queryPlan.numericConditions.length} numeric filter${
          queryPlan.numericConditions.length === 1
            ? ""
            : "s"
        }`
      );
    }

    if (queryPlan.sort) {
      appliedOperations.push(
        `${queryPlan.sort.direction} sorting`
      );
    }

    if (queryPlan.limit) {
      appliedOperations.push(
        `top ${queryPlan.limit}`
      );
    }

    operationDescription =
      appliedOperations.length > 0
        ? appliedOperations.join(", ")
        : "all records";
  }

  /* =========================================
     UPDATE APPLICATION STATE
  ========================================= */

  setSql(generatedSQL);
  setResults(finalRows);

  const historyItem = {
    source: `Excel: ${uploadedFileName}`,
    prompt,
    sql: generatedSQL,
    resultCount: finalRows.length,
    operation: operationDescription,
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

  if (finalRows.length === 0) {
    setSuccessMessage("");

    setError(
      "The query was generated, but no matching records were found."
    );
  } else {
    setError("");

    setSuccessMessage(
      `${finalRows.length} result${
        finalRows.length === 1
          ? ""
          : "s"
      } found using ${operationDescription}.`
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