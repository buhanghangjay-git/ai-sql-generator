function HistoryPanel({
  history,
  clearHistory,
  rerunQuery,
  copyHistorySQL,
  deleteHistoryItem,
}) {
  return (
    <section>
      <div className="history-header">
        <h2>Query History</h2>

        <button
          className="danger-button"
          onClick={clearHistory}
          disabled={history.length === 0}
        >
          Clear History
        </button>
      </div>

      {history.length > 0 ? (
        <div className="history-list">
          {history.map((item, index) => (
            <div
              className="history-item"
              key={index}
            >
              <div className="history-item-header">
                <strong>
                  {item.prompt}
                </strong>

                <span>
                  {item.resultCount} result
                  {item.resultCount === 1
                    ? ""
                    : "s"}
                </span>
              </div>

              <p className="history-source">
                Source: {item.source}
              </p>

              <p>{item.prompt}</p>

              <code>{item.sql}</code>

                    <div className="history-actions">
                      <button
                        className="secondary-button"
                        onClick={() => rerunQuery(item)}
                      >
                        🔄 Re-run
                      </button>

                      <button
                        className="secondary-button"
                        onClick={() =>
                          copyHistorySQL(item.sql)
                        }
                      >
                        📋 Copy SQL
                      </button>

                      <button
                        className="danger-button"
                        onClick={() =>
                          deleteHistoryItem(index)
                        }
                      >
                        🗑 Delete
                      </button>
                    </div>

                  <div className="history-actions">
                    <button
                      className="secondary-button"
                      onClick={() => rerunQuery(item)}
                    >
                      🔄 Re-run
              </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="empty-message">
          No query history yet.
        </p>
      )}
    </section>
  );
}

export default HistoryPanel;