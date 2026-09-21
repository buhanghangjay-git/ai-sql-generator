import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";

const formatValue = (value) => {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "N/A";
  }

  return String(value);
};

const findColumn = (rows, possibleNames) => {
  if (!rows?.length) {
    return null;
  }

  const columns = Object.keys(rows[0]);

  return columns.find((column) =>
    possibleNames.includes(column.toLowerCase())
  );
};

const calculateReportSummary = (rows) => {
  if (!rows?.length) {
    return {
      totalRecords: 0,
      numericColumn: null,
      highest: null,
      lowest: null,
      average: null,
    };
  }

  const columns = Object.keys(rows[0]);

  let numericColumn = null;
  let numericValues = [];

  for (const column of columns) {
    const values = rows
      .map((row) => row[column])
      .filter(
        (value) =>
          value !== "" &&
          value !== null &&
          value !== undefined
      )
      .map((value) => {
        const cleanedValue = String(value)
          .replaceAll(",", "")
          .replace(/[^\d.-]/g, "");

        return Number(cleanedValue);
      })
      .filter((value) => Number.isFinite(value));

    if (
      values.length >=
      Math.max(1, rows.length * 0.7)
    ) {
      numericColumn = column;
      numericValues = values;
      break;
    }
  }

  if (!numericValues.length) {
    return {
      totalRecords: rows.length,
      numericColumn: null,
      highest: null,
      lowest: null,
      average: null,
    };
  }

  const total = numericValues.reduce(
    (sum, value) => sum + value,
    0
  );

  return {
    totalRecords: rows.length,
    numericColumn,
    highest: Math.max(...numericValues),
    lowest: Math.min(...numericValues),
    average:
      Math.round(
        (total / numericValues.length) * 100
      ) / 100,
  };
};

const calculateInsights = (rows) => {
  if (!rows?.length) {
    return ["No result records were available."];
  }

  const insights = [
    `The analysis returned ${rows.length} records.`,
  ];

  const departmentColumn = findColumn(rows, [
    "department",
    "category",
    "segment",
  ]);

  if (departmentColumn) {
    const counts = {};

    rows.forEach((row) => {
      const value =
        row[departmentColumn] || "Unknown";

      counts[value] =
        (counts[value] || 0) + 1;
    });

    const largestGroup =
      Object.entries(counts).sort(
        (a, b) => b[1] - a[1]
      )[0];

    if (largestGroup) {
      insights.push(
        `${departmentColumn}: "${largestGroup[0]}" has the most returned records (${largestGroup[1]}).`
      );
    }
  }

  const summary =
    calculateReportSummary(rows);

  if (
    summary.numericColumn &&
    summary.average !== null
  ) {
    insights.push(
      `Average ${summary.numericColumn}: ${summary.average}.`
    );
  }

  return insights;
};

export const downloadAnalysisPDF = ({
  results = [],
  prompt = "",
  sql = "",
  dataSource = "",
  datasetProfile = null,
  uploadedFileName = "",
  selectedSheet = "",
}) => {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth =
    doc.internal.pageSize.getWidth();

  const summary =
    calculateReportSummary(results);

  const insights =
    calculateInsights(results);

  const generatedAt =
    new Date().toLocaleString();

  let y = 18;

  /* =====================================
     REPORT HEADER
  ===================================== */

  doc.setFillColor(215, 197, 255);

  doc.roundedRect(
    14,
    y,
    pageWidth - 28,
    31,
    5,
    5,
    "F"
  );

  doc.setTextColor(32, 32, 51);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);

  doc.text(
    "AI Data Analytics Report",
    20,
    y + 12
  );

  doc.setFont(
    "helvetica",
    "normal"
  );

  doc.setFontSize(9);

  doc.text(
    `Generated: ${generatedAt}`,
    20,
    y + 21
  );

  y += 42;

  /* =====================================
     DATASET INFORMATION
  ===================================== */

  doc.setTextColor(32, 32, 51);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);

  doc.text(
    "Dataset Information",
    14,
    y
  );

  y += 7;

  const datasetInformation = [
    [
      "Dataset",
      datasetProfile?.label ||
        "Database Dataset",
    ],
    [
      "Source",
      dataSource === "excel"
        ? "Excel / CSV"
        : "SQL Server",
    ],
    [
      "File",
      uploadedFileName || "N/A",
    ],
    [
      "Sheet",
      selectedSheet || "N/A",
    ],
    [
      "Records",
      String(results.length),
    ],
    [
      "Confidence",
      datasetProfile?.confidence ||
        "N/A",
    ],
  ];

  autoTable(doc, {
    startY: y,

    body: datasetInformation,

    theme: "plain",

    styles: {
      fontSize: 9,
      textColor: [32, 32, 51],
      cellPadding: 3,
    },

    columnStyles: {
      0: {
        fontStyle: "bold",
        fillColor: [185, 220, 255],
        cellWidth: 38,
      },

      1: {
        fillColor: [246, 243, 255],
      },
    },

    margin: {
      left: 14,
      right: 14,
    },
  });

  y = doc.lastAutoTable.finalY + 12;

  /* =====================================
     QUESTION
  ===================================== */

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);

  doc.text(
    "Question",
    14,
    y
  );

  y += 6;

  doc.setFont(
    "helvetica",
    "normal"
  );

  doc.setFontSize(10);

  const questionLines =
    doc.splitTextToSize(
      prompt ||
        "No question was supplied.",
      pageWidth - 28
    );

  doc.text(
    questionLines,
    14,
    y
  );

  y +=
    questionLines.length * 5 + 8;

  /* =====================================
     SQL QUERY
  ===================================== */

  if (sql) {
    if (y > 230) {
      doc.addPage();
      y = 18;
    }

    doc.setFont(
      "helvetica",
      "bold"
    );

    doc.setFontSize(14);

    doc.text(
      "Generated SQL",
      14,
      y
    );

    y += 6;

    const sqlLines =
      doc.splitTextToSize(
        sql,
        pageWidth - 36
      );

    const boxHeight =
      sqlLines.length * 5 + 10;

    doc.setFillColor(
      41,
      38,
      58
    );

    doc.roundedRect(
      14,
      y,
      pageWidth - 28,
      boxHeight,
      4,
      4,
      "F"
    );

    doc.setTextColor(
      248,
      250,
      252
    );

    doc.setFont(
      "courier",
      "normal"
    );

    doc.setFontSize(8);

    doc.text(
      sqlLines,
      18,
      y + 6
    );

    y += boxHeight + 12;
  }

  /* =====================================
     SUMMARY
  ===================================== */

  if (y > 225) {
    doc.addPage();
    y = 18;
  }

  doc.setTextColor(
    32,
    32,
    51
  );

  doc.setFont(
    "helvetica",
    "bold"
  );

  doc.setFontSize(14);

  doc.text(
    "Dataset Summary",
    14,
    y
  );

  y += 7;

  const summaryRows = [
    [
      "Total Records",
      String(
        summary.totalRecords
      ),
    ],
  ];

  if (summary.numericColumn) {
    summaryRows.push(
      [
        `Highest ${summary.numericColumn}`,
        formatValue(
          summary.highest
        ),
      ],
      [
        `Lowest ${summary.numericColumn}`,
        formatValue(
          summary.lowest
        ),
      ],
      [
        `Average ${summary.numericColumn}`,
        formatValue(
          summary.average
        ),
      ]
    );
  }

  autoTable(doc, {
    startY: y,

    body: summaryRows,

    theme: "plain",

    styles: {
      fontSize: 9,
      textColor: [32, 32, 51],
      cellPadding: 3,
    },

    columnStyles: {
      0: {
        fillColor: [
          189,
          236,
          207,
        ],
        fontStyle: "bold",
      },

      1: {
        fillColor: [
          246,
          243,
          255,
        ],
      },
    },

    margin: {
      left: 14,
      right: 14,
    },
  });

  y =
    doc.lastAutoTable.finalY +
    12;

  /* =====================================
     INSIGHTS
  ===================================== */

  if (y > 225) {
    doc.addPage();
    y = 18;
  }

  doc.setFont(
    "helvetica",
    "bold"
  );

  doc.setFontSize(14);

  doc.text(
    "Analysis Insights",
    14,
    y
  );

  y += 7;

  doc.setFont(
    "helvetica",
    "normal"
  );

  doc.setFontSize(10);

  insights.forEach(
    (insight) => {
      const lines =
        doc.splitTextToSize(
          `• ${insight}`,
          pageWidth - 34
        );

      if (
        y +
          lines.length * 5 >
        280
      ) {
        doc.addPage();
        y = 18;
      }

      doc.text(
        lines,
        18,
        y
      );

      y +=
        lines.length * 5 + 3;
    }
  );

  /* =====================================
     RESULTS TABLE
  ===================================== */

  if (results.length > 0) {
    if (y > 210) {
      doc.addPage();
      y = 18;
    } else {
      y += 8;
    }

    doc.setFont(
      "helvetica",
      "bold"
    );

    doc.setFontSize(14);

    doc.text(
      "Query Results",
      14,
      y
    );

    y += 6;

    const columns =
      Object.keys(results[0]);

    const rows =
      results.map((row) =>
        columns.map((column) =>
          formatValue(
            row[column]
          )
        )
      );

    autoTable(doc, {
      startY: y,

      head: [columns],
      body: rows,

      theme: "grid",

      styles: {
        fontSize: 7,
        cellPadding: 2,
        overflow: "linebreak",
        textColor: [
          32,
          32,
          51,
        ],
      },

      headStyles: {
        fillColor: [
          215,
          197,
          255,
        ],
        textColor: [
          51,
          43,
          77,
        ],
        fontStyle: "bold",
      },

      alternateRowStyles: {
        fillColor: [
          246,
          243,
          255,
        ],
      },

      margin: {
        left: 10,
        right: 10,
      },

      didDrawPage: () => {
        const currentPage =
          doc.internal
            .getCurrentPageInfo()
            .pageNumber;

        doc.setFontSize(8);

        doc.setTextColor(
          100,
          100,
          110
        );

        doc.text(
          `Page ${currentPage}`,
          pageWidth - 24,
          290
        );
      },
    });
  }

  /* =====================================
     SAVE PDF
  ===================================== */

  const safeDatasetName =
    (
      datasetProfile?.type ||
      "analysis"
    )
      .toLowerCase()
      .replace(
        /[^a-z0-9]+/g,
        "-"
      );

  const date =
    new Date()
      .toISOString()
      .slice(0, 10);

  doc.save(
    `${safeDatasetName}-report-${date}.pdf`
  );
};