import { NextResponse } from "next/server"
import { getAdminUser } from "@/lib/admin"
import { getAdminClient } from "@/lib/supabase/admin"
import type { VocabTerm, ExpressionCard } from "@/app/api/vocab/[videoId]/route"

export interface VideoNoteDetail {
  cefr_level: string
  terms: VocabTerm[]
  expressions: ExpressionCard[]
}

export interface VideoCacheDetail {
  notes: VideoNoteDetail[]
}

interface Params {
  params: Promise<{ id: string }>
}

export async function GET(_req: Request, { params }: Params) {
  if (!(await getAdminUser())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }
  const admin = getAdminClient()
  if (!admin) {
    return NextResponse.json({ error: "no_service_role_key" }, { status: 503 })
  }

  const { id } = await params
  const { data } = await admin
    .from("study_notes")
    .select("cefr_level, content")
    .eq("video_id", id)
    .order("cefr_level")

  const notes: VideoNoteDetail[] = (data ?? []).map((n) => {
    const content = n.content as { terms?: VocabTerm[]; expressions?: ExpressionCard[] }
    return {
      cefr_level: n.cefr_level,
      terms: content?.terms ?? [],
      expressions: content?.expressions ?? [],
    }
  })

  const detail: VideoCacheDetail = { notes }
  return NextResponse.json(detail)
}
