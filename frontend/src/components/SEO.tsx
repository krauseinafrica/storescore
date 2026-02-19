import { Helmet } from 'react-helmet-async';

const SITE_NAME = 'StoreScore';
const SITE_URL = 'https://storescore.app';
const OG_IMAGE =
  'https://images-media.nyc3.cdn.digitaloceanspaces.com/storescore-files/SS%20Store.png';

interface SEOProps {
  title: string;
  description: string;
  path: string;
  type?: string;
}

export default function SEO({ title, description, path, type = 'website' }: SEOProps) {
  const url = `${SITE_URL}${path}`;

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />

      {/* Open Graph */}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={OG_IMAGE} />
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={SITE_NAME} />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={OG_IMAGE} />
    </Helmet>
  );
}
