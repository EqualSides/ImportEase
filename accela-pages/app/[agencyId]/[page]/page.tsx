type AccelaPageProps = {
  params: Promise<{
    agencyId: string;
    page: string;
  }>;
};

function humanize(value: string) {
  return decodeURIComponent(value)
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default async function AccelaPage({ params }: AccelaPageProps) {
  const { agencyId, page } = await params;

  return (
    <main className="shell">
      <section className="card" aria-labelledby="page-title">
        <p className="eyebrow">Perpetual Hive · Accela</p>
        <h1 id="page-title">{humanize(page)}</h1>
        <p className="lead">
          The Custom Accela Pages foundation is rendering successfully. This diagnostic shell is the starting point for the agency-specific page experience.
        </p>

        <div className="status">
          <div className="item">
            <span className="label">Agency ID</span>
            <span className="value">{agencyId}</span>
          </div>
          <div className="item">
            <span className="label">Page</span>
            <span className="value">{page}</span>
          </div>
          <div className="item">
            <span className="label">Route</span>
            <span className="value">/Accela/{agencyId}/{page}</span>
          </div>
          <div className="item">
            <span className="label">Accela Context</span>
            <span className="value">Awaiting validation</span>
          </div>
        </div>

        <div className="notice">
          Diagnostic only: this version does not read Accela data, expose credentials, or treat the Agency ID in the URL as authorization.
        </div>
      </section>
    </main>
  );
}
