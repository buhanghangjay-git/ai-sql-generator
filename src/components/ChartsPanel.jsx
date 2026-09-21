import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const ChartsPanel = ({ results }) => {
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

  /* =========================================
     COLUMN PROFILES
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

      const shouldIgnore =
        ignoredNumericNames.some(
          (name) =>
            normalized === name ||
            normalized.endsWith(name)
        );

      return !shouldIgnore;
    });

  const numericColumn =
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

  const categoryColumn =
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
     CATEGORY COUNTS
  ========================================= */

  let categoryData = [];

  if (categoryColumn) {
    const categoryCounts = {};

    results.forEach((row) => {
      const rawValue =
        row[categoryColumn.column];

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

    categoryData =
      Object.entries(categoryCounts)
        .map(([name, count]) => {
          return {
            name,
            count,
          };
        })
        .sort(
          (first, second) =>
            second.count - first.count
        )
        .slice(0, 10);
  }

  /* =========================================
     AVERAGE METRIC BY CATEGORY
  ========================================= */

  let metricByCategoryData = [];

  if (
    categoryColumn &&
    numericColumn
  ) {
    const groups = {};

    results.forEach((row) => {
      const rawCategory =
        row[categoryColumn.column];

      const category =
        rawCategory === null ||
        rawCategory === undefined ||
        rawCategory === ""
          ? "Unknown"
          : String(rawCategory).trim();

      const numericValue =
        cleanNumericValue(
          row[numericColumn.column]
        );

      if (numericValue === null) {
        return;
      }

      if (!groups[category]) {
        groups[category] = {
          total: 0,
          count: 0,
        };
      }

      groups[category].total +=
        numericValue;

      groups[category].count += 1;
    });

    metricByCategoryData =
      Object.entries(groups)
        .map(
          ([name, group]) => {
            return {
              name,

              average: Number(
                (
                  group.total /
                  group.count
                ).toFixed(2)
              ),
            };
          }
        )
        .sort(
          (first, second) =>
            second.average -
            first.average
        )
        .slice(0, 10);
  }

  /* =========================================
     NUMERIC DISTRIBUTION
  ========================================= */

  let numericDistribution = [];

  if (
    numericColumn &&
    numericColumn.numericValues.length > 0
  ) {
    const values =
      numericColumn.numericValues;

    const minimum =
      Math.min(...values);

    const maximum =
      Math.max(...values);

    if (minimum === maximum) {
      numericDistribution = [
        {
          range:
            minimum.toLocaleString(),

          count: values.length,
        },
      ];
    } else {
      const bucketCount = 5;

      const bucketSize =
        (maximum - minimum) /
        bucketCount;

      const buckets = Array.from(
        {
          length: bucketCount,
        },
        (_, index) => {
          const start =
            minimum +
            index * bucketSize;

          const end =
            index ===
            bucketCount - 1
              ? maximum
              : start + bucketSize;

          return {
            start,
            end,
            count: 0,
          };
        }
      );

      values.forEach((value) => {
        let bucketIndex =
          Math.floor(
            (value - minimum) /
              bucketSize
          );

        if (
          bucketIndex >= bucketCount
        ) {
          bucketIndex =
            bucketCount - 1;
        }

        buckets[
          bucketIndex
        ].count += 1;
      });

      numericDistribution =
        buckets.map((bucket) => {
          const start =
            Math.round(
              bucket.start
            ).toLocaleString();

          const end =
            Math.round(
              bucket.end
            ).toLocaleString();

          return {
            range:
              `${start} - ${end}`,

            count: bucket.count,
          };
        });
    }
  }

  /* =========================================
     CHART COLORS
  ========================================= */

  const chartColors = [
    "#7c6cf2",
    "#4ea8de",
    "#67c587",
    "#f1b84b",
    "#e8789a",
    "#9b7ede",
    "#5bc0be",
    "#f08a5d",
    "#6c8cd5",
    "#8bc34a",
  ];

  /* =========================================
     NO CHARTABLE DATA
  ========================================= */

  if (
    !categoryColumn &&
    !numericColumn
  ) {
    return (
      <section>
        <h2>
          Data Visualizations
        </h2>

        <div className="empty-message">
          No suitable columns were found
          for automatic visualization.
        </div>
      </section>
    );
  }

  /* =========================================
     RENDER
  ========================================= */

  return (
    <section>
      <h2>
        Data Visualizations
      </h2>

      <div className="charts-grid">
        {/* =================================
            RECORDS BY CATEGORY
        ================================= */}

        {categoryData.length > 0 && (
          <div className="chart-card">
            <h3>
              Records by{" "}
              {categoryColumn.column}
            </h3>

            <ResponsiveContainer
              width="100%"
              height={300}
            >
              <BarChart
                data={categoryData}
                margin={{
                  top: 20,
                  right: 20,
                  left: 0,
                  bottom: 30,
                }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  opacity={0.25}
                />

                <XAxis
                  dataKey="name"
                  angle={-25}
                  textAnchor="end"
                  interval={0}
                  height={70}
                />

                <YAxis
                  allowDecimals={false}
                />

                <Tooltip />

                <Bar
                  dataKey="count"
                  name="Records"
                  fill="#7c6cf2"
                  radius={[
                    10,
                    10,
                    0,
                    0,
                  ]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* =================================
            CATEGORY DISTRIBUTION
        ================================= */}

        {categoryData.length > 1 && (
          <div className="chart-card">
            <h3>
              {categoryColumn.column}{" "}
              Distribution
            </h3>

            <ResponsiveContainer
              width="100%"
              height={300}
            >
              <PieChart>
                <Pie
                  data={categoryData}
                  dataKey="count"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={95}
                  label
                >
                  {categoryData.map(
                    (entry, index) => (
                      <Cell
                        key={
                          `${entry.name}-${index}`
                        }
                        fill={
                          chartColors[
                            index %
                              chartColors.length
                          ]
                        }
                      />
                    )
                  )}
                </Pie>

                <Tooltip />

                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* =================================
            AVERAGE METRIC BY CATEGORY
        ================================= */}

        {metricByCategoryData.length >
          0 && (
          <div className="chart-card">
            <h3>
              Average{" "}
              {numericColumn.column}{" "}
              by{" "}
              {categoryColumn.column}
            </h3>

            <ResponsiveContainer
              width="100%"
              height={300}
            >
              <BarChart
                data={
                  metricByCategoryData
                }
                margin={{
                  top: 20,
                  right: 20,
                  left: 10,
                  bottom: 30,
                }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  opacity={0.25}
                />

                <XAxis
                  dataKey="name"
                  angle={-25}
                  textAnchor="end"
                  interval={0}
                  height={70}
                />

                <YAxis />

                <Tooltip />

                <Bar
                  dataKey="average"
                  name={
                    `Average ${numericColumn.column}`
                  }
                  fill="#67c587"
                  radius={[
                    10,
                    10,
                    0,
                    0,
                  ]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* =================================
            NUMERIC DISTRIBUTION
        ================================= */}

        {numericDistribution.length >
          0 && (
          <div className="chart-card">
            <h3>
              {numericColumn.column}{" "}
              Distribution
            </h3>

            <ResponsiveContainer
              width="100%"
              height={300}
            >
              <LineChart
                data={
                  numericDistribution
                }
                margin={{
                  top: 20,
                  right: 20,
                  left: 0,
                  bottom: 35,
                }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  opacity={0.25}
                />

                <XAxis
                  dataKey="range"
                  angle={-20}
                  textAnchor="end"
                  interval={0}
                  height={75}
                />

                <YAxis
                  allowDecimals={false}
                />

                <Tooltip />

                <Line
                  type="monotone"
                  dataKey="count"
                  name="Records"
                  stroke="#e8789a"
                  strokeWidth={3}
                  dot={{
                    r: 5,
                    fill: "#e8789a",
                  }}
                  activeDot={{
                    r: 7,
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </section>
  );
};

export default ChartsPanel;