function DatasetProfile({
  datasetProfile,
  rowCount,
  columnCount,
}) {
  if (!datasetProfile) {
    return null;
  }

  return (
    <section className="dataset-profile">
      <div className="dataset-profile-header">
        <div>
          <p className="dataset-label">
            Detected Dataset
          </p>

          <h2>{datasetProfile.label}</h2>

          <p className="dataset-description">
            {datasetProfile.description}
          </p>
        </div>

        <span className="confidence-badge">
          {datasetProfile.confidence} confidence
        </span>
      </div>

      <div className="dataset-profile-grid">
        <div>
          <span className="profile-value">
            {rowCount}
          </span>

          <span className="profile-label">
            Records
          </span>
        </div>

        <div>
          <span className="profile-value">
            {columnCount}
          </span>

          <span className="profile-label">
            Columns
          </span>
        </div>

        <div>
          <span className="profile-value">
            {datasetProfile.numericColumns.length}
          </span>

          <span className="profile-label">
            Numeric
          </span>
        </div>

        <div>
          <span className="profile-value">
            {datasetProfile.dateColumns.length}
          </span>

          <span className="profile-label">
            Date Fields
          </span>
        </div>
      </div>

      {datasetProfile.numericColumns.length > 0 && (
        <p className="detected-fields">
          <strong>Numeric fields:</strong>{" "}
          {datasetProfile.numericColumns.join(", ")}
        </p>
      )}

      {datasetProfile.textColumns.length > 0 && (
        <p className="detected-fields">
          <strong>Text fields:</strong>{" "}
          {datasetProfile.textColumns.join(", ")}
        </p>
      )}
    </section>
  );
}

export default DatasetProfile;