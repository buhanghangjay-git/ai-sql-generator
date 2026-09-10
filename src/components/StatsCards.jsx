function StatsCards({
  queryCount,
  resultCount,
  dataSource,
}) {
  return (
    <div className="stats-grid">
      <div className="stat-card">
        <p className="stat-title">
          Queries
        </p>

        <h3>{queryCount}</h3>
      </div>

      <div className="stat-card">
        <p className="stat-title">
          Results
        </p>

        <h3>{resultCount}</h3>
      </div>

      <div className="stat-card">
        <p className="stat-title">
          Source
        </p>

        <h3>
          {dataSource === "database"
            ? "SQL Server"
            : "Excel / CSV"}
        </h3>
      </div>
    </div>
  );
}

export default StatsCards;