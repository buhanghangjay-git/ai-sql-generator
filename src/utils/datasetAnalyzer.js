const normalizeColumnName = (columnName) => {
  return String(columnName)
    .toLowerCase()
    .replaceAll(" ", "")
    .replaceAll("_", "")
    .replaceAll("-", "");
};

const includesAnyKeyword = (
  normalizedColumns,
  keywords
) => {
  return keywords.some((keyword) =>
    normalizedColumns.some((column) =>
      column.includes(
        normalizeColumnName(keyword)
      )
    )
  );
};

export const analyzeDataset = (
  columns = [],
  rows = []
) => {
  if (!columns.length) {
    return {
      type: "Unknown",
      label: "Unknown Dataset",
      confidence: "Low",
      description:
        "Upload a spreadsheet to detect the dataset type.",
      suggestions: [
        "Show all records",
        "Count all records",
      ],
      numericColumns: [],
      textColumns: [],
      dateColumns: [],
    };
  }

  const normalizedColumns = columns.map(
    normalizeColumnName
  );

  const employeeScore = [
    "employee",
    "firstname",
    "lastname",
    "department",
    "salary",
    "position",
    "jobtitle",
    "hiredate",
  ].filter((keyword) =>
    includesAnyKeyword(
      normalizedColumns,
      [keyword]
    )
  ).length;

  const productScore = [
    "product",
    "productname",
    "sku",
    "price",
    "stock",
    "inventory",
    "category",
    "quantity",
  ].filter((keyword) =>
    includesAnyKeyword(
      normalizedColumns,
      [keyword]
    )
  ).length;

  const salesScore = [
    "sale",
    "sales",
    "revenue",
    "order",
    "customer",
    "amount",
    "quantity",
    "date",
  ].filter((keyword) =>
    includesAnyKeyword(
      normalizedColumns,
      [keyword]
    )
  ).length;

  const customerScore = [
    "customer",
    "client",
    "email",
    "phone",
    "address",
    "city",
    "country",
    "segment",
  ].filter((keyword) =>
    includesAnyKeyword(
      normalizedColumns,
      [keyword]
    )
  ).length;

  const financeScore = [
    "expense",
    "income",
    "budget",
    "transaction",
    "balance",
    "account",
    "payment",
    "cost",
  ].filter((keyword) =>
    includesAnyKeyword(
      normalizedColumns,
      [keyword]
    )
  ).length;

  const datasetScores = [
    {
      type: "Employees",
      score: employeeScore,
    },
    {
      type: "Products",
      score: productScore,
    },
    {
      type: "Sales",
      score: salesScore,
    },
    {
      type: "Customers",
      score: customerScore,
    },
    {
      type: "Finance",
      score: financeScore,
    },
  ];

  datasetScores.sort(
    (firstDataset, secondDataset) =>
      secondDataset.score -
      firstDataset.score
  );

  const detectedDataset = datasetScores[0];

  let type = "General";
  let confidence = "Low";

  if (detectedDataset.score >= 3) {
    type = detectedDataset.type;
    confidence = "High";
  } else if (detectedDataset.score >= 2) {
    type = detectedDataset.type;
    confidence = "Medium";
  }

  const numericColumns = [];
  const textColumns = [];
  const dateColumns = [];

  columns.forEach((column) => {
    const sampleValues = rows
      .slice(0, 20)
      .map((row) => row[column])
      .filter(
        (value) =>
          value !== "" &&
          value !== null &&
          value !== undefined
      );

    if (!sampleValues.length) {
      textColumns.push(column);
      return;
    }

    const numericValues =
      sampleValues.filter((value) => {
        const cleanedValue = String(value)
          .replaceAll(",", "")
          .replace(/[^\d.-]/g, "");

        return (
          cleanedValue !== "" &&
          !Number.isNaN(Number(cleanedValue))
        );
      });

    const dateValues =
      sampleValues.filter((value) => {
        const parsedDate = Date.parse(value);

        return !Number.isNaN(parsedDate);
      });

    if (
      numericValues.length >=
      sampleValues.length * 0.7
    ) {
      numericColumns.push(column);
    } else if (
      dateValues.length >=
      sampleValues.length * 0.7
    ) {
      dateColumns.push(column);
    } else {
      textColumns.push(column);
    }
  });

  const configurations = {
    Employees: {
      label: "Employee Dataset",
      description:
        "Employee, department, position, and compensation data were detected.",
      suggestions: [
        "Show all employees",
        "Group employees by department",
        "Show the highest salaries",
        "Show records with salary above 50000",
        "Which department has the most employees?",
      ],
    },

    Products: {
      label: "Product Inventory Dataset",
      description:
        "Product, price, category, quantity, or inventory data were detected.",
      suggestions: [
        "Show all products",
        "Show products with low stock",
        "Show the most expensive products",
        "Group products by category",
        "What is the average product price?",
      ],
    },

    Sales: {
      label: "Sales Dataset",
      description:
        "Sales, revenue, order, customer, or transaction data were detected.",
      suggestions: [
        "Show all sales records",
        "Show the highest sales",
        "Calculate total revenue",
        "Group sales by customer",
        "What is the average order amount?",
      ],
    },

    Customers: {
      label: "Customer Dataset",
      description:
        "Customer, contact, location, or customer segment data were detected.",
      suggestions: [
        "Show all customers",
        "Group customers by city",
        "Group customers by country",
        "Show customers by segment",
        "Count all customers",
      ],
    },

    Finance: {
      label: "Financial Dataset",
      description:
        "Income, expense, budget, payment, or transaction data were detected.",
      suggestions: [
        "Show all transactions",
        "Calculate total expenses",
        "Calculate total income",
        "Show the largest transactions",
        "Compare income and expenses",
      ],
    },

    General: {
      label: "General Dataset",
      description:
        "The file was analyzed successfully, but no specialized dataset category was strongly detected.",
      suggestions: [
        "Show all records",
        "Count all records",
        "Show the first 10 records",
        "Summarize numeric columns",
        "Group records by category",
      ],
    },
  };

  const selectedConfiguration =
    configurations[type] ||
    configurations.General;

  return {
    type,
    label: selectedConfiguration.label,
    confidence,
    description:
      selectedConfiguration.description,
    suggestions:
      selectedConfiguration.suggestions,
    numericColumns,
    textColumns,
    dateColumns,
  };
};