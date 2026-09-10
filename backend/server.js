require("dotenv").config();

const express = require("express");
const cors = require("cors");
const sql = require("mssql/msnodesqlv8");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const dbConfig = {
  connectionString:
    `Driver={${process.env.DB_DRIVER}};` +
    `Server=${process.env.DB_SERVER};` +
    `Database=${process.env.DB_DATABASE};` +
    `Trusted_Connection=Yes;` +
    `TrustServerCertificate=Yes;`
};

// Test Route
app.get("/", (req, res) => {
  res.json({
    message: "AI SQL Generator Backend Running",
  });
});

// Test Database Connection
app.get("/test-database", async (req, res) => {
  try {
    const pool = await sql.connect(dbConfig);

    const result = await pool
      .request()
      .query(
        "SELECT COUNT(*) AS TotalEmployees FROM Employees"
      );

    res.json({
      status: "success",
      totalEmployees:
        result.recordset[0].TotalEmployees,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

// Generate SQL Route
app.post("/generate-sql", async (req, res) => {
  try {
    const prompt = req.body.prompt.toLowerCase();

    let query = "";

    if (
      prompt.includes("it") &&
      prompt.includes("employee")
    ) {
      query =
        "SELECT * FROM Employees WHERE Department = 'IT'";
    }

    else if (
      prompt.includes("hr") &&
      prompt.includes("employee")
    ) {
      query =
        "SELECT * FROM Employees WHERE Department = 'HR'";
    }

    else if (
      prompt.includes("salary")
    ) {
      query =
        "SELECT EmployeeID, FirstName, LastName, Salary FROM Employees";
    }

    else if (
      prompt.includes("employee")
    ) {
      query =
        "SELECT * FROM Employees";
    }

    else {
      return res.json({
        sql: "-- Query not recognized",
        results: [],
      });
    }

    const pool = await sql.connect(dbConfig);

    const result = await pool
      .request()
      .query(query);

    res.json({
      sql: query,
      results: result.recordset,
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: error.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(
    `🚀 Backend running on http://localhost:${PORT}`
  );
});