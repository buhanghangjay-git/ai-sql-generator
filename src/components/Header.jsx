function Header({ dataSource }) {
  return (
    <header className="app-header">
      <div>
        <h1>AI Data Analytics Dashboard</h1>

        <p className="subtitle">
          Query SQL Server or analyze uploaded
          Excel and CSV files using natural language.
        </p>
      </div>

      <div className="status-badge">
        {dataSource === "database"
          ? "🗄 SQL Server Mode"
          : "📁 Spreadsheet Mode"}
      </div>
    </header>
  );
}

export default Header;