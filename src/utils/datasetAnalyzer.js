export const analyzeDataset = (
  columns = [],
  rows = []
) => {
  if (!columns.length) {
    return {
      type: "general",
      label: "General Dataset",
      confidence: "Low",
      suggestions: [
        "Show all records",
        "Count records",
      ],
    };
  }

  /* =========================================
     HELPERS
  ========================================= */

  const normalizeColumn = (column) => {
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

  /* =========================================
     BUILD COLUMN PROFILES
  ========================================= */

  const columnProfiles = columns.map(
    (column) => {
      const values = rows
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
        normalized:
          normalizeColumn(column),

        values,
        numericValues,
        uniqueValues,

        isNumeric:
          values.length > 0 &&
          numericRatio >= 0.7,
      };
    }
  );

  /* =========================================
     DATASET TYPE DETECTION
  ========================================= */

  const normalizedColumns =
    columns.map(normalizeColumn);

  const containsColumn = (
    keywords
  ) => {
    return normalizedColumns.some(
      (column) =>
        keywords.some((keyword) =>
          column.includes(keyword)
        )
    );
  };

  let type = "general";
  let label = "General Dataset";
  let confidence = "Medium";

  const hasEmployeeColumns =
    containsColumn([
      "employee",
      "salary",
      "department",
      "position",
      "jobtitle",
    ]);

  const hasProductColumns =
    containsColumn([
      "product",
      "price",
      "stock",
      "inventory",
      "brand",
    ]);

  const hasSalesColumns =
    containsColumn([
      "sales",
      "revenue",
      "customer",
      "order",
      "quantity",
    ]);

  const hasFinanceColumns =
    containsColumn([
      "income",
      "expense",
      "balance",
      "budget",
      "payment",
      "transaction",
    ]);

  if (hasEmployeeColumns) {
    type = "employees";
    label = "Employee Dataset";
    confidence = "High";
  } else if (hasProductColumns) {
    type = "products";
    label = "Product Dataset";
    confidence = "High";
  } else if (hasSalesColumns) {
    type = "sales";
    label = "Sales Dataset";
    confidence = "High";
  } else if (hasFinanceColumns) {
    type = "finance";
    label = "Finance Dataset";
    confidence = "High";
  }

  /* =========================================
     FIND NUMERIC COLUMNS
  ========================================= */

  const ignoredNumericColumns = [
    "id",
    "employeeid",
    "productid",
    "customerid",
    "orderid",
    "transactionid",
    "recordid",
    "zipcode",
    "postalcode",
    "phone",
    "year",
  ];

  const numericProfiles =
    columnProfiles.filter(
      (profile) => {
        if (!profile.isNumeric) {
          return false;
        }

        return !ignoredNumericColumns.some(
          (ignoredName) =>
            profile.normalized ===
              ignoredName ||
            profile.normalized.endsWith(
              ignoredName
            )
        );
      }
    );

  /* =========================================
     FIND IMPORTANT NUMERIC METRIC
  ========================================= */

  const numericKeywords = [
    "salary",
    "revenue",
    "sales",
    "price",
    "amount",
    "income",
    "expense",
    "profit",
    "cost",
    "balance",
    "stock",
    "quantity",
    "budget",
    "payment",
    "rating",
    "score",
  ];

  const numericColumn =
    numericProfiles.find(
      (profile) =>
        numericKeywords.some(
          (keyword) =>
            profile.normalized.includes(
              keyword
            )
        )
    ) ||
    numericProfiles[0] ||
    null;

  /* =========================================
     FIND CATEGORY COLUMN
  ========================================= */

  const categoryKeywords = [
    "department",
    "category",
    "region",
    "status",
    "segment",
    "type",
    "team",
    "division",
    "brand",
    "country",
    "city",
  ];

  const categoryProfiles =
    columnProfiles.filter(
      (profile) =>
        !profile.isNumeric &&
        profile.uniqueValues.length > 1
    );

  const categoryColumn =
    categoryProfiles.find(
      (profile) =>
        categoryKeywords.some(
          (keyword) =>
            profile.normalized.includes(
              keyword
            )
        )
    ) ||
    categoryProfiles.find(
      (profile) =>
        profile.uniqueValues.length <=
        Math.max(
          20,
          Math.ceil(rows.length * 0.5)
        )
    ) ||
    null;

  /* =========================================
     STOCK COLUMN
  ========================================= */

  const stockColumn =
    numericProfiles.find(
      (profile) =>
        profile.normalized.includes(
          "stock"
        ) ||
        profile.normalized.includes(
          "inventory"
        ) ||
        profile.normalized.includes(
          "quantity"
        )
    );

  /* =========================================
     GENERATE SMART SUGGESTIONS
  ========================================= */

  const suggestions = [];

  suggestions.push(
    "Show all records"
  );

  suggestions.push(
    "Count records"
  );

  if (numericColumn) {
    suggestions.push(
      `Average ${numericColumn.column}`
    );

    suggestions.push(
      `Highest ${numericColumn.column}`
    );

    const values =
      numericColumn.numericValues;

    if (values.length > 0) {
      const average =
        values.reduce(
          (sum, value) =>
            sum + value,
          0
        ) / values.length;

      const roundedAverage =
        Math.round(average);

      suggestions.push(
        `Show ${numericColumn.column} above ${roundedAverage}`
      );
    }
  }

  if (categoryColumn) {
    suggestions.push(
      `Group by ${categoryColumn.column}`
    );

    const firstCategory =
      categoryColumn.uniqueValues[0];

    if (firstCategory) {
      suggestions.push(
        `Show ${firstCategory} records`
      );
    }
  }

  if (stockColumn) {
    suggestions.push(
      "Show low stock"
    );
  }

  /* =========================================
     DATASET-SPECIFIC SUGGESTIONS
  ========================================= */

  if (type === "products") {
    const priceColumn =
      numericProfiles.find(
        (profile) =>
          profile.normalized.includes(
            "price"
          )
      );

    if (priceColumn) {
      suggestions.push(
        `Top 5 ${priceColumn.column}`
      );
    }
  }

  if (type === "sales") {
    const revenueColumn =
      numericProfiles.find(
        (profile) =>
          profile.normalized.includes(
            "revenue"
          ) ||
          profile.normalized.includes(
            "sales"
          )
      );

    if (revenueColumn) {
      suggestions.push(
        `Total ${revenueColumn.column}`
      );
    }
  }

  if (type === "finance") {
    const expenseColumn =
      numericProfiles.find(
        (profile) =>
          profile.normalized.includes(
            "expense"
          )
      );

    if (expenseColumn) {
      suggestions.push(
        `Average ${expenseColumn.column}`
      );
    }
  }

  /* =========================================
     REMOVE DUPLICATES
  ========================================= */

  const uniqueSuggestions = [
    ...new Set(suggestions),
  ];

  return {
    type,
    label,
    confidence,

    suggestions:
      uniqueSuggestions.slice(0, 8),

    numericColumn:
      numericColumn?.column || null,

    categoryColumn:
      categoryColumn?.column || null,

    detectedColumns: columns,

    rowCount: rows.length,
  };
};