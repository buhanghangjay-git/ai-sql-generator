const InsightsPanel = ({ results }) => {
  if (!results || results.length === 0) {
    return null;
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

  const formatNumber = (value) => {
    if (
      value === null ||
      value === undefined
    ) {
      return "N/A";
    }

    return new Intl.NumberFormat(
      "en-US",
      {
        maximumFractionDigits: 2,
      }
    ).format(value);
  };

  /* =========================================
     BUILD COLUMN PROFILES
  ========================================= */

  const columns = Object.keys(
    results[0] || {}
  );

  const columnProfiles = columns.map(
    (column) => {
      const values = results
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

      const uniqueValues = new Set(
        values.map((value) =>
          String(value).trim()
        )
      );

      return {
        column,
        values,
        numericValues,
        uniqueCount: uniqueValues.size,

        isNumeric:
          values.length > 0 &&
          numericRatio >= 0.7,
      };
    }
  );

  /* =========================================
     FIND USEFUL NUMERIC COLUMN
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

  const numericColumns =
    columnProfiles.filter((profile) => {
      if (!profile.isNumeric) {
        return false;
      }

      const normalized =
        normalizeColumn(profile.column);

      const ignored =
        ignoredNumericNames.some(
          (name) =>
            normalized === name ||
            normalized.endsWith(name)
        );

      return !ignored;
    });

  const preferredNumericColumn =
    numericColumns.find((profile) => {
      const normalized =
        normalizeColumn(profile.column);

      return preferredNumericKeywords.some(
        (keyword) =>
          normalized.includes(keyword)
      );
    }) ||
    numericColumns[0] ||
    null;

  /* =========================================
     FIND CATEGORY COLUMN
  ========================================= */

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

  const textColumns =
    columnProfiles.filter(
      (profile) =>
        !profile.isNumeric &&
        profile.values.length > 0
    );

  const preferredCategoryColumn =
    textColumns.find((profile) => {
      const normalized =
        normalizeColumn(profile.column);

      return preferredCategoryKeywords.some(
        (keyword) =>
          normalized.includes(keyword)
      );
    }) ||
    textColumns.find((profile) => {
      return (
        profile.uniqueCount > 1 &&
        profile.uniqueCount <=
          Math.max(
            20,
            Math.ceil(
              results.length * 0.5
            )
          )
      );
    }) ||
    null;

  /* =========================================
     GENERATE INSIGHTS
  ========================================= */

  const insights = [];

  /*
    Insight 1:
    Total returned records
  */

  insights.push(
    `The current analysis contains ${formatNumber(
      results.length
    )} record${
      results.length === 1 ? "" : "s"
    }.`
  );

  /*
    Insight 2:
    Numeric metric analysis
  */

  if (
    preferredNumericColumn &&
    preferredNumericColumn.numericValues
      .length > 0
  ) {
    const values =
      preferredNumericColumn.numericValues;

    const total = values.reduce(
      (sum, value) => sum + value,
      0
    );

    const average =
      total / values.length;

    const highest =
      Math.max(...values);

    const lowest =
      Math.min(...values);

    insights.push(
      `Average ${preferredNumericColumn.column}: ${formatNumber(
        average
      )}.`
    );

    insights.push(
      `Highest ${preferredNumericColumn.column}: ${formatNumber(
        highest
      )}.`
    );

    insights.push(
      `Lowest ${preferredNumericColumn.column}: ${formatNumber(
        lowest
      )}.`
    );
  }

  /*
    Insight 3:
    Category distribution
  */

  if (preferredCategoryColumn) {
    const categoryCounts = {};

    results.forEach((row) => {
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

      categoryCounts[category] =
        (categoryCounts[category] || 0) +
        1;
    });

    const sortedCategories =
      Object.entries(categoryCounts).sort(
        (a, b) => b[1] - a[1]
      );

    if (sortedCategories.length > 0) {
      const [
        largestCategory,
        largestCount,
      ] = sortedCategories[0];

      insights.push(
        `${largestCategory} is the largest ${preferredCategoryColumn.column} group with ${formatNumber(
          largestCount
        )} record${
          largestCount === 1 ? "" : "s"
        }.`
      );
    }

    if (sortedCategories.length > 1) {
      const [
        smallestCategory,
        smallestCount,
      ] =
        sortedCategories[
          sortedCategories.length - 1
        ];

      insights.push(
        `${smallestCategory} is the smallest ${preferredCategoryColumn.column} group with ${formatNumber(
          smallestCount
        )} record${
          smallestCount === 1 ? "" : "s"
        }.`
      );
    }

    insights.push(
      `${preferredCategoryColumn.column} contains ${formatNumber(
        Object.keys(categoryCounts).length
      )} distinct group${
        Object.keys(categoryCounts)
          .length === 1
          ? ""
          : "s"
      }.`
    );
  }

  /* =========================================
     LOW STOCK INSIGHT
  ========================================= */

  const stockColumn =
    numericColumns.find((profile) => {
      const normalized =
        normalizeColumn(profile.column);

      return (
        normalized.includes("stock") ||
        normalized.includes("inventory")
      );
    });

  if (
    stockColumn &&
    stockColumn.numericValues.length > 0
  ) {
    const averageStock =
      stockColumn.numericValues.reduce(
        (sum, value) => sum + value,
        0
      ) /
      stockColumn.numericValues.length;

    const belowAverageStock =
      stockColumn.numericValues.filter(
        (value) =>
          value < averageStock
      ).length;

    insights.push(
      `${formatNumber(
        belowAverageStock
      )} record${
        belowAverageStock === 1
          ? ""
          : "s"
      } have ${stockColumn.column} below the dataset average of ${formatNumber(
        averageStock
      )}.`
    );
  }

  /* =========================================
     DATA QUALITY INSIGHT
  ========================================= */

  let missingValueCount = 0;

  results.forEach((row) => {
    columns.forEach((column) => {
      const value = row[column];

      if (
        value === null ||
        value === undefined ||
        String(value).trim() === ""
      ) {
        missingValueCount += 1;
      }
    });
  });

  if (missingValueCount > 0) {
    insights.push(
      `${formatNumber(
        missingValueCount
      )} empty or missing field${
        missingValueCount === 1
          ? ""
          : "s"
      } were detected in the returned data.`
    );
  } else {
    insights.push(
      "No empty fields were detected in the returned data."
    );
  }

  /* =========================================
     RENDER
  ========================================= */

  return (
    <section>
      <h2>AI Insights</h2>

      <div className="insight-card">
        <ul>
          {insights.map(
            (insight, index) => (
              <li
                key={`${insight}-${index}`}
              >
                {insight}
              </li>
            )
          )}
        </ul>
      </div>
    </section>
  );
};

export default InsightsPanel;