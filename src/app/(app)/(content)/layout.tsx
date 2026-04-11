/**
 * Content layout — wraps all non-chat app pages in a scrollable padded container.
 * This sits inside (app)/layout.tsx's <main> which has h-full overflow-hidden (no padding).
 * The overflow-y-auto here enables scrolling for pages with lots of content.
 */
export default function ContentLayout({
  children,
}: {
  children: React.ReactNode
}): React.ReactElement {
  return (
    <div className="h-full overflow-y-auto overscroll-y-none px-4 pt-4 pb-[calc(4rem+env(safe-area-inset-bottom,0px))] md:p-6">
      {children}
    </div>
  )
}
