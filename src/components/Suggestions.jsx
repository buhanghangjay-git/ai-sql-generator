function Suggestions({
  suggestions,
  useSuggestion,
}) {
  return (
    <div className="suggestions-section">
      <p className="suggestions-title">
        Not sure what to ask? Try one:
      </p>

      <div className="suggestions-list">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion}
            className="suggestion-button"
            onClick={() =>
              useSuggestion(suggestion)
            }
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}

export default Suggestions;