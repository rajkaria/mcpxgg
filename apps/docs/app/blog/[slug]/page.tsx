import { blogSource } from '@/lib/source';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getMDXComponents } from '@/mdx-components';
import type { Metadata } from 'next';

export default async function BlogPost(props: {
  params: Promise<{ slug: string }>;
}) {
  const params = await props.params;
  const page = blogSource.getPage([params.slug]);
  if (!page) notFound();

  const MDX = page.data.body;
  const meta = page.data as { title: string; date?: string };

  return (
    <article className="prose">
      <Link
        href="/blog"
        className="no-underline text-sm text-fd-muted-foreground"
      >
        ← All posts
      </Link>
      <h1 className="mb-1">{meta.title}</h1>
      {meta.date ? (
        <time className="text-sm text-fd-muted-foreground">
          {new Date(meta.date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </time>
      ) : null}
      <MDX components={getMDXComponents()} />
    </article>
  );
}

export function generateStaticParams() {
  return blogSource.generateParams().map((p) => ({
    slug: Array.isArray(p.slug) ? p.slug[0] : p.slug,
  }));
}

export async function generateMetadata(props: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const params = await props.params;
  const page = blogSource.getPage([params.slug]);
  if (!page) notFound();
  return {
    title: page.data.title,
    description: page.data.description,
  };
}
