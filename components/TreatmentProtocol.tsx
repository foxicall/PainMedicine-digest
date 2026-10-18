import { ArrowUpRight, RefreshCw, Syringe } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import type { ClinicalTrialSummary } from '@/types/trial';
import { protocolFields } from '@/types/protocol';
import { fetchStudyAbstract } from '@/lib/pubmed';

export function TreatmentProtocol({ trial }: { trial: ClinicalTrialSummary }) {
  const protocol = trial.treatmentProtocol;
  const abstract = useQuery({
    queryKey: ['study-abstract', trial.pmid],
    queryFn: ({ signal }) => fetchStudyAbstract(trial.pmid, signal),
    enabled: false,
    staleTime: 24 * 3600_000,
    retry: false,
  });
  const originalAbstract = trial.abstract || abstract.data?.abstract;
  return (
    <section className="treatment-protocol" aria-label="Intervention protocol and dosing">
      <h3>
        <Syringe size={18} /> Intervention protocol & dosing
      </h3>
      {protocol ? (
        <>
          <p>{protocol.design}</p>
          <p className="protocol-context">
            Regimens as studied · source check {protocol.checkedOn}. Study doses are not
            individualized prescribing instructions.
          </p>
          <div className="protocol-arms">
            {protocol.arms.map((arm) => (
              <div className="protocol-arm" key={arm.label}>
                <div className="protocol-arm-heading">
                  <span>
                    {arm.role} · {arm.kind}
                  </span>
                  <h4>{arm.label}</h4>
                </div>
                <dl>
                  {protocolFields
                    .filter(([key]) => arm[key] !== undefined)
                    .map(([key, label]) => (
                      <div key={key}>
                        <dt>{label}</dt>
                        <dd className={arm[key] === null ? 'unextracted' : undefined}>
                          {arm[key] ?? 'Not extracted from the cited source.'}
                        </dd>
                      </div>
                    ))}
                </dl>
                <div className="protocol-arm-sources">
                  Sources:{' '}
                  {arm.sourceIds.map((id) => {
                    const source = protocol.sources.find((s) => s.id === id)!;
                    return (
                      <a
                        key={id}
                        href={source.url}
                        target="_blank"
                        rel="noreferrer"
                        title={source.location}
                      >
                        {source.title} <ArrowUpRight size={12} />
                      </a>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          {!!protocol.gaps.length && (
            <div className="protocol-gaps">
              <strong>Details still to verify</strong>
              <ul>
                {protocol.gaps.map((gap) => (
                  <li key={gap}>{gap}</li>
                ))}
              </ul>
            </div>
          )}
          <details className="protocol-references">
            <summary>Protocol references & extraction locations</summary>
            <ul>
              {protocol.sources.map((source) => (
                <li key={source.id}>
                  <a href={source.url} target="_blank" rel="noreferrer">
                    {source.title} <ArrowUpRight size={12} />
                  </a>
                  <span>
                    {source.kind} · {source.location}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        </>
      ) : (
        <div className="protocol-pending">
          <p>
            <strong>Procedure and dosage awaiting extraction.</strong> The index contains
            bibliographic records; a title does not establish the treatment dose or technique.
          </p>
          <dl className="evidence-table">
            {[
              'Drug / injectate and dose',
              'Route, concentration and volume',
              'Frequency, duration and titration',
              'Procedure, target and device parameters',
            ].map((label) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>Not extracted</dd>
              </div>
            ))}
          </dl>
          <p>
            Retrieve the original abstract to check the reported intervention. Unreported details
            require the full text or protocol.
          </p>
          {!trial.abstract && (
            <button
              className="button button-secondary small"
              onClick={() => abstract.refetch()}
              disabled={abstract.isFetching}
            >
              <RefreshCw size={14} className={abstract.isFetching ? 'spin' : ''} />
              {abstract.isFetching
                ? 'Retrieving abstract…'
                : abstract.data
                  ? 'Refresh source abstract'
                  : 'Retrieve source abstract'}
            </button>
          )}
          {abstract.error && (
            <p role="alert">
              {abstract.error.message}{' '}
              <a href={trial.provenance.sourceUrl} target="_blank" rel="noreferrer">
                Read on PubMed
              </a>
            </p>
          )}
          {originalAbstract && (
            <div className="source-abstract">
              <h4>Original PubMed abstract · unappraised</h4>
              <p>{originalAbstract}</p>
            </div>
          )}
          {abstract.data && !originalAbstract && (
            <p>
              No abstract is available in this PubMed record.{' '}
              <a href={trial.provenance.sourceUrl} target="_blank" rel="noreferrer">
                Open the source record
              </a>
              .
            </p>
          )}
        </div>
      )}
    </section>
  );
}
