/** CSS artwork preserves image semantics without exposing demo assets to image
 * extensions that insert sibling controls before React hydrates. */
export function SampleArtwork({ src, label }: { src: string; label: string }) {
  return <span className="sample-artwork" role="img" aria-label={label} style={{ backgroundImage: `url("${src}")` }}/>;
}
