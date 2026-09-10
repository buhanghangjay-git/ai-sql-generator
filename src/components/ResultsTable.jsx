function ResultsTable({ rows }) {
  if (!rows || rows.length === 0) {
    return (
      <p className="empty-message">
        No records to display.
      </p>
    );
  }

  const tableColumns = Object.keys(rows[0]);

  return (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>
            {tableColumns.map((column) => (
              <th key={column}>
                {column}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {tableColumns.map((column) => (
                <td
                  key={`${rowIndex}-${column}`}
                >
                  {row[column] === null ||
                  row[column] === ""
                    ? "NULL"
                    : String(row[column])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default ResultsTable;