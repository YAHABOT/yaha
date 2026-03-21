import { getRoutine } from '@/lib/db/routines'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const routine = await getRoutine(id)
    return Response.json(routine)
  } catch (error: unknown) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 404 })
  }
}
