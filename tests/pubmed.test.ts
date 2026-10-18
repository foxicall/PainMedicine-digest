// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchStudyAbstract, parsePubMedXML, publicationEndDate, searchPubMed } from '@/lib/pubmed';

const article = (id = '12345678', year = '2024', type = 'Randomized Controlled Trial') =>
  `<PubmedArticle><MedlineCitation><PMID>${id}</PMID><Article><Journal><Title>PAIN</Title><ISOAbbreviation>Pain</ISOAbbreviation><JournalIssue><Volume>165</Volume><Issue>1</Issue><PubDate><Year>${year}</Year></PubDate></JournalIssue></Journal><ArticleTitle>Pregabalin for <i>neuropathic</i> pain</ArticleTitle><AuthorList><Author><LastName>Smith</LastName><Initials>AB</Initials></Author><Author><LastName>Jones</LastName><Initials>CD</Initials></Author></AuthorList><Abstract><AbstractText Label="RESULTS">Patient outcomes.</AbstractText></Abstract><PublicationTypeList><PublicationType>${type}</PublicationType></PublicationTypeList></Article></MedlineCitation><PubmedData><ArticleIdList><ArticleId IdType="doi">10.1000/target</ArticleId></ArticleIdList><ReferenceList><Reference><ArticleIdList><ArticleId IdType="doi">10.1000/wrong-reference</ArticleId></ArticleIdList></Reference></ReferenceList></PubmedData></PubmedArticle>`;
afterEach(() => vi.unstubAllGlobals());
describe('PubMed parsing and eligibility', () => {
  it('fetches a newer nonrandomized study abstract without creating an appraised dose', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            `<PubmedArticleSet>${article('12345678', '2027', 'Clinical Trial')}</PubmedArticleSet>`,
          ),
        ),
    );
    const result = await fetchStudyAbstract('12345678');
    expect(result).toEqual({ pmid: '12345678', abstract: 'RESULTS: Patient outcomes.' });
  });
  it('rejects a mismatched abstract instead of attributing another study’s intervention', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(new Response(`<PubmedArticleSet>${article('111')}</PubmedArticleSet>`)),
    );
    await expect(fetchStudyAbstract('222')).rejects.toThrow('not returned');
  });
  it('parses bibliographic metadata without inventing clinical findings', () => {
    const [t] = parsePubMedXML(`<PubmedArticleSet>${article()}</PubmedArticleSet>`);
    expect(t.title).toBe('Pregabalin for neuropathic pain');
    expect(t.doi).toBe('10.1000/target');
    expect(t.sampleSize).toBeNull();
    expect(t.outcome.pValue).toBeNull();
    expect(t.provenance.status).toBe('Awaiting appraisal');
    expect(t.abstract).toBe('RESULTS: Patient outcomes.');
    expect(t.seniorAuthor).toBe('Jones CD');
  });
  it('excludes protocols, non-RCT records, and out-of-window publications', () => {
    const xml = `<PubmedArticleSet>${article('1', '2015')}${article('2', '2027')}${article('3', '2024', 'Clinical Trial Protocol')}${article('4', '2024')}</PubmedArticleSet>`;
    expect(parsePubMedXML(xml).map((t) => t.id)).toEqual(['4']);
  });
  it('supports seasonal publication dates', () => {
    const xml = article().replace('<Year>2024</Year>', '<MedlineDate>2024 Jan-Feb</MedlineDate>');
    expect(parsePubMedXML(`<PubmedArticleSet>${xml}</PubmedArticleSet>`)[0].year).toBe(2024);
  });
  it('rejects malformed XML and API errors', () => {
    expect(() => parsePubMedXML('<PubmedArticleSet>')).toThrow('invalid XML');
    expect(() => parsePubMedXML('<eFetchResult><ERROR>Bad request</ERROR></eFetchResult>')).toThrow(
      'error',
    );
  });
  it('caps future searching at 2026 and past searching at the current day', () => {
    expect(publicationEndDate(new Date('2026-10-18T12:00:00Z'))).toBe('2026/10/18');
    expect(publicationEndDate(new Date('2029-01-01T00:00:00Z'))).toBe('2026/12/31');
  });
  it('searches then fetches returned identifiers', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ esearchresult: { idlist: ['12345678'], count: '1' } })),
      )
      .mockResolvedValueOnce(new Response(`<PubmedArticleSet>${article()}</PubmedArticleSet>`));
    vi.stubGlobal('fetch', fetch);
    const result = await searchPubMed('pregabalin');
    expect(result.trials).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(fetch.mock.calls[0][0]).toContain('esearch.fcgi');
    expect(fetch.mock.calls[1][0]).toContain('id=12345678');
  });
  it('reports network failure instead of silently substituting fabricated results', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Network failure')));
    await expect(searchPubMed('pain')).rejects.toThrow('could not be reached');
  });
});
