import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Page from './page';

export function render() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const html = renderToString(
    <QueryClientProvider client={client}>
      <Page />
    </QueryClientProvider>,
  );
  client.clear();
  return html;
}
