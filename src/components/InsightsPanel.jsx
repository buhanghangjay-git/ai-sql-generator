function InsightsPanel({ results }) {
  if (!results || results.length === 0) {
    return null;
  }

  const totalRecords = results.length;

  const departmentField =
    Object.keys(results[0]).find(
      (key) =>
        key.toLowerCase() === "department"
    );

  const salaryField =
    Object.keys(results[0]).find(
      (key) =>
        key.toLowerCase() === "salary"
    );

  let largestDepartment = "N/A";
  let averageSalary = "N/A";

  if (departmentField) {
    const counts = {};

    results.forEach((row) => {
      const department =
        row[departmentField];

      counts[department] =
        (counts[department] || 0) + 1;
    });

    largestDepartment = Object.keys(counts)
      .sort(
        (a, b) =>
          counts[b] - counts[a]
      )[0];
  }

  if (salaryField) {
    const salaries = results
      .map((row) =>
        Number(row[salaryField])
      )
      .filter((value) => !isNaN(value));

    if (salaries.length > 0) {
      averageSalary = Math.round(
        salaries.reduce(
          (sum, value) => sum + value,
          0
        ) / salaries.length
      );
    }
  }

  return (
    <section>
      <h2> AI Insights</h2>

      <div className="insight-card">
        <ul>
          <li>
            Total Records: {totalRecords}
          </li>

          <li>
            Largest Department:{" "}
            {largestDepartment}
          </li>

          <li>
            Average Salary:{" "}
            {averageSalary}
          </li>
        </ul>
      </div>
    </section>
  );
}

export default InsightsPanel;