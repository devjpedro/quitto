/** The short text below 1140 px (a phone, a narrow window: mockup 15, C0), the full one beside the preview. */
export function ResponsiveText({
  narrow,
  wide,
}: {
  narrow: string;
  wide: string;
}) {
  return (
    <>
      <span className="stage:hidden">{narrow}</span>
      <span className="stage:inline hidden">{wide}</span>
    </>
  );
}
