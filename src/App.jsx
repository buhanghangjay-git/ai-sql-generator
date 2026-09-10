import { useState } from "react";
import "./App.css";

function App() {
  const [prompt, setPrompt] = useState("");
  const [sql, setSql] = useState("");
  const [history, setHistory] = useState([]);

  const generateSQL = async () => {
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

      setSql(data.sql);
      setHistory((prev) => [...prev, data.sql]);
    } catch (error) {
      console.error(error);
      setSql("Error connecting to backend");
    }
  };

  const clearHistory = () => {
    setHistory([]);
  };

  const copySQL = () => {
    navigator.clipboard.writeText(sql);
    alert("SQL copied!");
  };

  return (
    <div className="container">
      <div className="card">
        <h1>🤖 AI SQL Generator</h1>

        <p>
          Convert natural language into SQL queries.
        </p>

        <textarea
          rows="5"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={`Try:
Show IT employees
Show HR employees
Show salary`}
        />

        <br />
        <br />

        <button onClick={generateSQL}>
          Generate SQL
        </button>

        <button onClick={copySQL}>
          Copy SQL
        </button>

        <button onClick={clearHistory}>
          Clear History
        </button>

        <h3>Generated SQL</h3>

        <pre>{sql}</pre>

        <h3>Query History</h3>

        <ul>
          {history.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default App;