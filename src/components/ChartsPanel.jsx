import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

import { Bar } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

function ChartsPanel({ results }) {
  if (!results || results.length === 0) {
    return null;
  }

  // Department chart
  const departmentField =
    Object.keys(results[0]).find(
      (key) =>
        key.toLowerCase() === "department"
    );

  const departmentCounts = {};

  if (departmentField) {
    results.forEach((row) => {
      const department =
        row[departmentField] || "Unknown";

      departmentCounts[department] =
        (departmentCounts[department] || 0) + 1;
    });
  }

  const departmentData = {
    labels: Object.keys(departmentCounts),
    datasets: [
      {
        label: "Employees",
        data: Object.values(departmentCounts),
        backgroundColor: "#3B82F6",
      },
    ],
  };

  // Salary chart
  const salaryField =
    Object.keys(results[0]).find(
      (key) =>
        key.toLowerCase() === "salary"
    );

  let salaryData = null;

  if (salaryField) {
    const ranges = {
      "0-30K": 0,
      "30K-50K": 0,
      "50K-70K": 0,
      "70K+": 0,
    };

    results.forEach((row) => {
      const salary =
        Number(row[salaryField]) || 0;

      if (salary < 30000) {
        ranges["0-30K"]++;
      } else if (salary < 50000) {
        ranges["30K-50K"]++;
      } else if (salary < 70000) {
        ranges["50K-70K"]++;
      } else {
        ranges["70K+"]++;
      }
    });

    salaryData = {
      labels: Object.keys(ranges),
      datasets: [
        {
          label: "Salary Range",
          data: Object.values(ranges),
          backgroundColor: "#22C55E",
        },
      ],
    };
  }

  return (
    <>
      {departmentField && (
        <section>
          <h2>
            📊 Department Distribution
          </h2>

          <div className="chart-card">
            <Bar data={departmentData} />
          </div>
        </section>
      )}

      {salaryData && (
        <section>
          <h2>
            💰 Salary Distribution
          </h2>

          <div className="chart-card">
            <Bar data={salaryData} />
          </div>
        </section>
      )}
    </>
  );
}

export default ChartsPanel;