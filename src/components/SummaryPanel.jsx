function SummaryPanel({ results }) {
  if (!results || results.length === 0) {
    return null;
  }

  const salaryField = Object.keys(results[0]).find(
    (key) => key.toLowerCase() === "salary"
  );

  const salaries = salaryField
    ? results
        .map((row) => Number(row[salaryField]))
        .filter((value) => !isNaN(value))
    : [];

  const totalRecords = results.length;

  const highestSalary =
    salaries.length > 0
      ? Math.max(...salaries)
      : "N/A";

  const lowestSalary =
    salaries.length > 0
      ? Math.min(...salaries)
      : "N/A";

  const averageSalary =
    salaries.length > 0
      ? Math.round(
          salaries.reduce(
            (total, value) => total + value,
            0
          ) / salaries.length
        )
      : "N/A";

  return (
    <section>
      <h2>📈 Dataset Summary</h2>

      <div className="summary-grid">
        <div className="summary-card">
          <p>Total Records</p>
          <h3>{totalRecords}</h3>
        </div>

        <div className="summary-card">
          <p>Highest Salary</p>
          <h3>{highestSalary}</h3>
        </div>

        <div className="summary-card">
          <p>Lowest Salary</p>
          <h3>{lowestSalary}</h3>
        </div>

        <div className="summary-card">
          <p>Average Salary</p>
          <h3>{averageSalary}</h3>
        </div>
      </div>
    </section>
  );
}

export default SummaryPanel;