import { useState } from "react";
import "./App.css";

function App() {
  // 1. Store the user's natural-language request
  const [prompt, setPrompt] = useState("");

  // 2. Store the generated SQL query
  const [sql, setSql] = useState("");

  // 3. Store query history
  const [history, setHistory] = useState([]);

  // 4. Store employee records returned by SQL Server
  const [results, setResults] = useState([]);

  // 5. Store loading state
  const [loading, setLoading] = useState(false);

  // 6. Store possible error messages
  const [error, setError] = useState("");

  const generateSQL = async () => {
    if (!prompt.trim()) {
      setError("Please enter a request.");
      setSql("");
      setResults([]);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        "http://localhost:5000/generate-sql",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt: prompt,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "The request could not be processed."
        );
      }

      setSql(data.sql || "");
      setResults(data.results || []);

      setHistory((previousHistory) => [
        ...previousHistory,
        {
          prompt: prompt,
          sql: data.sql || "",
        },
      ]);
    } catch (requestError) {
      console.error(requestError);

      setError(
        requestError.message ||
          "Error connecting to the backend."
      );

      setSql("");
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const copySQL = async () => {
    if (!sql) {
      setError("There is no SQL query to copy.");
      return;
    }

    try {
      await navigator.clipboard.writeText(sql);
      setError("");
      alert("SQL copied!");
    } catch {
      setError("The SQL query could not be copied.");
    }
  };

  const clearHistory = () => {
    setHistory([]);
  };

  const clearAll = () => {
    setPrompt("");
    setSql("");
    setResults([]);
    setError("");
  };

  return (
    <div className="container">
      <div className="card">
        <h1>AI SQL Generator</h1>

        <p className="subtitle">
          Convert natural language into SQL and view live
          results from SQL Server.
        </p>

        <label htmlFor="prompt">
          Describe the data you want:
        </label>

        <textarea
          id="prompt"
          rows="5"
          value={prompt}
          onChange={(event) =>
            setPrompt(event.target.value)
          }
          placeholder={`Try:
Show all employees
Show IT employees
Show HR employees
Show salary
Show department`}
        />

        <div className="button-group">
          <button
            onClick={generateSQL}
            disabled={loading}
          >
            {loading ? "Generating..." : "Generate SQL"}
          </button>

          <button
            className="secondary-button"
            onClick={copySQL}
          >
            Copy SQL
          </button>

          <button
            className="secondary-button"
            onClick={clearAll}
          >
            Clear
          </button>
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <h2>Generated SQL</h2>

        <pre>
          {sql || "-- Your generated SQL will appear here"}
        </pre>

        <h2>Database Results</h2>

        {results.length > 0 ? (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  {Object.keys(results[0]).map(
                    (columnName) => (
                      <th key={columnName}>
                        {columnName}
                      </th>
                    )
                  )}
                </tr>
              </thead>

              <tbody>
                {results.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {Object.entries(row).map(
                      ([columnName, value]) => (
                        <td
                          key={`${rowIndex}-${columnName}`}
                        >
                          {value === null
                            ? "NULL"
                            : String(value)}
                        </td>
                      )
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty-message">
            No database records to display.
          </p>
        )}

        <div className="history-header">
          <h2>Query History</h2>

          <button
            className="danger-button"
            onClick={clearHistory}
          >
            Clear History
          </button>
        </div>

        {history.length > 0 ? (
          <div className="history-list">
            {history.map((historyItem, index) => (
              <div
                className="history-item"
                key={index}
              >
                <strong>
                  Request {index + 1}:
                </strong>

                <p>{historyItem.prompt}</p>

                <code>{historyItem.sql}</code>
              </div>
            ))}
          </div>
        ) : (
          <p className="empty-message">
            No query history yet.
          </p>
        )}
      </div>
    </div>
  );
}

export default App;
