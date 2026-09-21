const SummaryPanel = ({ results }) => {
  if (!results || results.length === 0) {
    return null;
  }

  /* =========================================
     HELPERS
  ========================================= */

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

  const normalizeColumn = (column) => {
    return String(column)
      .toLowerCase()
      .replaceAll(" ", "")
      .replaceAll("_", "")
      .replaceAll("-", "");
  };

  /* =========================================
     COLUMN DETECTION
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

      const uniqueValues = new Set(
        values.map((value) =>
          String(value).trim()
        )
      );

      const numericRatio =
        values.length > 0
          ? numericValues.length /
            values.length
          : 0;

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
     NUMERIC COLUMN DETECTION
  ========================================= */

  /*
    Columns such as IDs should not normally be
    treated as useful business metrics.
  */

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

  const numericColumns =
    columnProfiles.filter((profile) => {
      if (!profile.isNumeric) {
        return false;
      }

      const normalized = normalizeColumn(
        profile.column
      );

      const shouldIgnore =
        ignoredNumericNames.some(
          (name) =>
            normalized === name ||
            normalized.endsWith(name)
        );

      return !shouldIgnore;
    });

  /* =========================================
     PREFERRED BUSINESS METRICS
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

  const preferredNumericColumn =
    numericColumns.find((profile) => {
      const normalized = normalizeColumn(
        profile.column
      );

      return preferredNumericKeywords.some(
        (keyword) =>
          normalized.includes(keyword)
      );
    }) ||
    numericColumns[0] ||
    null;

  /* =========================================
     NUMERIC ANALYSIS
  ========================================= */

  let averageValue = null;
  let highestValue = null;
  let lowestValue = null;

  if (
    preferredNumericColumn &&
    preferredNumericColumn.numericValues
      .length > 0
  ) {
    const values =
      preferredNumericColumn.numericValues;

    const total = values.reduce(
      (sum, value) => {
        return sum + value;
      },
      0
    );

    averageValue =
      total / values.length;

    highestValue =
      Math.max(...values);

    lowestValue =
      Math.min(...values);
  }

  /* =========================================
     CATEGORY COLUMN DETECTION
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
      const normalized = normalizeColumn(
        profile.column
      );

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
     CATEGORY ANALYSIS
  ========================================= */

  const categoryCount =
    preferredCategoryColumn
      ? preferredCategoryColumn.uniqueCount
      : null;

  /* =========================================
     SUMMARY CARDS
  ========================================= */

  const summaryCards = [
    {
      label: "Total Records",
      value: formatNumber(
        results.length
      ),
    },
  ];

  /*
    Add numeric analytics only when a useful
    numeric business column was detected.
  */

  if (preferredNumericColumn) {
    summaryCards.push(
      {
        label:
          `Average ${preferredNumericColumn.column}`,

        value: formatNumber(
          averageValue
        ),
      },

      {
        label:
          `Highest ${preferredNumericColumn.column}`,

        value: formatNumber(
          highestValue
        ),
      },

      {
        label:
          `Lowest ${preferredNumericColumn.column}`,

        value: formatNumber(
          lowestValue
        ),
      }
    );
  }

  /*
    Add a categorical grouping metric when a
    useful categorical column was detected.
  */

  if (
    preferredCategoryColumn &&
    categoryCount !== null
  ) {
    summaryCards.push({
      label:
        `${preferredCategoryColumn.column} Groups`,

      value: formatNumber(
        categoryCount
      ),
    });
  }

  /* =========================================
     RENDER
  ========================================= */

  return (
    <section>
      <h2>Dataset Summary</h2>

      <div className="summary-grid">
        {summaryCards.map(
          (card, index) => (
            <div
              className="summary-card"
              key={`${card.label}-${index}`}
            >
              <p>
                {card.label}
              </p>

              <h3>
                {card.value}
              </h3>
            </div>
          )
        )}
      </div>
    </section>
  );
};

export default SummaryPanel;